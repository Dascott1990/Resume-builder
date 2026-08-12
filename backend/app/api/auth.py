"""
app/api/auth.py
POST /api/v1/auth/signup
POST /api/v1/auth/verify-email
POST /api/v1/auth/resend-verification
POST /api/v1/auth/login
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
GET  /api/v1/auth/me

Entirely optional layer on top of the anonymous guest_id system already
used everywhere else — nothing else in the app requires any of this.

A real auth flow proves the email is reachable before trusting it (signup
sends a verification link, login refuses unverified accounts) and lets
someone recover access without emailing support (forgot/reset password).
Both flows use single-use, time-limited tokens and never reveal whether a
given email actually has an account — that's a free enumeration oracle
otherwise.
"""
import os
import re
import secrets
from datetime import datetime, timedelta, timezone

from flask import Blueprint, request, jsonify
from app import db, limiter
from app.models import User, Media, JobApplication, CareerProfile, ApplicationRun
from app.middleware.error_handlers import APIError
from app.utils.auth import hash_password, verify_password, issue_token, get_scope
from app.utils.mail import send_email

auth_bp = Blueprint("auth", __name__)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
VERIFICATION_TOKEN_TTL = timedelta(hours=24)
RESET_TOKEN_TTL = timedelta(hours=1)
FRONTEND_URL = (os.environ.get("FRONTEND_URL") or "http://localhost:3000").rstrip("/")


def _new_token():
    return secrets.token_urlsafe(32)


def _utcnow():
    # Naive UTC, deliberately not datetime.now(timezone.utc) — neither
    # SQLite nor a plain (non timezone=True) Postgres TIMESTAMP column
    # preserves tzinfo on read, so an aware "now" crashes comparing against
    # a value that came back from the DB naive. Every column in this app
    # already stores naive-on-read timestamps, so staying naive throughout
    # is what actually matches what's in the database, not a compromise.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _migrate_guest_data(guest_id, user_id):
    """Reassigns this browser's anonymous rows to a real account — used by
    both signup() and login(), so anonymous work follows you in whichever
    one you actually use. Clears guest_id, not just sets user_id: leaving
    both set would keep the row reachable via the old guest_id forever,
    which is what let one person's resumes leak to the next person on a
    shared browser after the first signed out (fixed in useAuth.logout on
    the frontend too, by rotating the local guest_id — this half handles
    rows that were already migrated before that fix existed)."""
    Media.query.filter_by(guest_id=guest_id, user_id=None).update({"user_id": user_id, "guest_id": None})
    JobApplication.query.filter_by(guest_id=guest_id, user_id=None).update({"user_id": user_id, "guest_id": None})
    ApplicationRun.query.filter_by(guest_id=guest_id, user_id=None).update({"user_id": user_id, "guest_id": None})

    # CareerProfile is one-per-scope (see its model docstring) — a bulk
    # update here could leave a signed-in user with two rows, and
    # everywhere else that reads it (e.g. api/apply.py's
    # `.filter_by(user_id=...).first()`) would then pick between them
    # arbitrarily. Only adopt the guest's profile if the account doesn't
    # already have one; otherwise the guest copy is superseded — delete it
    # rather than leaving it dangling under the old guest_id, still
    # reachable by whoever inherits that id next.
    guest_profile = CareerProfile.query.filter_by(guest_id=guest_id, user_id=None).first()
    if guest_profile:
        if CareerProfile.query.filter_by(user_id=user_id).first():
            db.session.delete(guest_profile)
        else:
            guest_profile.user_id = user_id
            guest_profile.guest_id = None


def _email_shell(heading, body_html, cta_label, cta_link, footnote):
    return f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:8px;">
      <p style="font-weight:800;letter-spacing:0.02em;color:#111;margin:0 0 24px;">NOVIQ</p>
      <h2 style="color:#111;margin:0 0 12px;">{heading}</h2>
      <p style="color:#444;line-height:1.6;margin:0 0 4px;">{body_html}</p>
      <p style="margin:28px 0;">
        <a href="{cta_link}" style="background:#f5a623;color:#111;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block;">{cta_label}</a>
      </p>
      <p style="color:#888;font-size:12.5px;line-height:1.5;">{footnote}</p>
    </div>
    """


def _send_verification_email(user, token):
    link = f"{FRONTEND_URL}/verify-email?token={token}"
    send_email(
        user.email,
        "Verify your Noviq account",
        _email_shell(
            "Verify your email",
            "Confirm this is your email address to finish setting up your account.",
            "Verify email", link,
            "This link expires in 24 hours. If you didn't create a Noviq account, you can ignore this email.",
        ),
    )


def _send_reset_email(user, token):
    link = f"{FRONTEND_URL}/reset-password?token={token}"
    send_email(
        user.email,
        "Reset your Noviq password",
        _email_shell(
            "Reset your password",
            "Someone requested a password reset for this account. If that was you, choose a new password below.",
            "Reset password", link,
            "This link expires in 1 hour. If you didn't request this, your password won't change — you can ignore this email.",
        ),
    )


@auth_bp.route("/signup", methods=["POST"])
@limiter.limit("8 per hour")
def signup():
    body = request.get_json(force=True) or {}
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not EMAIL_RE.match(email):
        raise APIError("Enter a valid email address", 400)
    if len(password) < 8:
        raise APIError("Password must be at least 8 characters", 400)
    if User.query.filter_by(email=email).first():
        raise APIError("An account with that email already exists", 409)

    token = _new_token()
    user = User(
        email=email,
        password_hash=hash_password(password),
        email_verified=False,
        verification_token=token,
        verification_token_expires=_utcnow() + VERIFICATION_TOKEN_TTL,
    )
    db.session.add(user)
    db.session.flush()  # assigns user.id before we touch rows that reference it

    # Whatever this browser already built anonymously follows them in —
    # signing up shouldn't mean starting over. Clearing guest_id here (not
    # just setting user_id) matters: a row left with BOTH set stays
    # reachable via its old guest_id forever, which is exactly how a
    # shared/family browser leaks one person's resumes to the next person
    # who uses it after the first signs out — see _migrate_guest_data.
    _, guest_id = get_scope(request)
    if guest_id:
        _migrate_guest_data(guest_id, user.id)

    # Send before committing — an account nobody can ever verify (because
    # the email silently failed) is worse than no account at all.
    try:
        _send_verification_email(user, token)
    except Exception as exc:
        db.session.rollback()
        print(f"❌ Failed to send verification email to {email}: {exc}")
        raise APIError("Could not send verification email — please try again", 502)

    db.session.commit()
    return jsonify({
        "success": True,
        "data": {"email": user.email, "message": "Check your email to verify your account before signing in."},
    }), 201


@auth_bp.route("/verify-email", methods=["POST"])
def verify_email():
    body = request.get_json(force=True) or {}
    token = (body.get("token") or "").strip()
    if not token:
        raise APIError("Missing verification token", 400)

    user = User.query.filter_by(verification_token=token).first()
    if not user or not user.verification_token_expires or user.verification_token_expires < _utcnow():
        raise APIError("This verification link is invalid or has expired", 400)

    user.email_verified = True
    user.verification_token = None
    user.verification_token_expires = None
    db.session.commit()

    return jsonify({"success": True, "data": {"user": user.to_dict(), "token": issue_token(user.id)}}), 200


@auth_bp.route("/resend-verification", methods=["POST"])
@limiter.limit("5 per hour")
def resend_verification():
    body = request.get_json(force=True) or {}
    email = (body.get("email") or "").strip().lower()
    user = User.query.filter_by(email=email).first()

    if user and not user.email_verified:
        token = _new_token()
        user.verification_token = token
        user.verification_token_expires = _utcnow() + VERIFICATION_TOKEN_TTL
        db.session.commit()
        try:
            _send_verification_email(user, token)
        except Exception as exc:
            print(f"❌ Failed to resend verification email to {email}: {exc}")

    # Same response either way — confirming an email doesn't have an
    # account (or is already verified) is a free enumeration oracle.
    return jsonify({"success": True, "data": {"message": "If that account needs verifying, a new link is on its way."}}), 200


@auth_bp.route("/login", methods=["POST"])
@limiter.limit("10 per minute")
def login():
    body = request.get_json(force=True) or {}
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    user = User.query.filter_by(email=email).first()
    # Same message either way — confirming "that email doesn't exist" to
    # whoever's asking is a free account-enumeration oracle.
    if not user or not verify_password(password, user.password_hash):
        raise APIError("Incorrect email or password", 401)

    if not user.email_verified:
        raise APIError("Please verify your email before signing in", 403, code="EMAIL_NOT_VERIFIED")

    # Same "anonymous work follows you in" as signup — without this, someone
    # who built resumes anonymously on this browser and then logs into an
    # EXISTING account (rather than signing up fresh) had those resumes
    # just vanish from Saved/the Tracker instead of attaching to their account.
    _, guest_id = get_scope(request)
    if guest_id:
        _migrate_guest_data(guest_id, user.id)
        db.session.commit()

    return jsonify({"success": True, "data": {"user": user.to_dict(), "token": issue_token(user.id)}}), 200


@auth_bp.route("/forgot-password", methods=["POST"])
@limiter.limit("5 per hour")
def forgot_password():
    body = request.get_json(force=True) or {}
    email = (body.get("email") or "").strip().lower()
    user = User.query.filter_by(email=email).first()

    if user:
        token = _new_token()
        user.reset_token = token
        user.reset_token_expires = _utcnow() + RESET_TOKEN_TTL
        db.session.commit()
        try:
            _send_reset_email(user, token)
        except Exception as exc:
            print(f"❌ Failed to send reset email to {email}: {exc}")

    # Same response whether or not the account exists.
    return jsonify({"success": True, "data": {"message": "If that email has an account, a reset link is on its way."}}), 200


@auth_bp.route("/reset-password", methods=["POST"])
@limiter.limit("10 per hour")
def reset_password():
    body = request.get_json(force=True) or {}
    token = (body.get("token") or "").strip()
    password = body.get("password") or ""

    if not token:
        raise APIError("Missing reset token", 400)
    if len(password) < 8:
        raise APIError("Password must be at least 8 characters", 400)

    user = User.query.filter_by(reset_token=token).first()
    if not user or not user.reset_token_expires or user.reset_token_expires < _utcnow():
        raise APIError("This reset link is invalid or has expired", 400)

    user.password_hash = hash_password(password)
    user.reset_token = None
    user.reset_token_expires = None
    # A password reset invalidates any pending email-verification token too
    # — no reason to leave an old one alive once someone's proven control
    # of the inbox via the reset link itself.
    if not user.email_verified:
        user.email_verified = True
        user.verification_token = None
        user.verification_token_expires = None
    db.session.commit()

    # Clicking a link from the inbox AND choosing a new password already
    # proves both control of the account and of the email — no reason to
    # then also demand they immediately retype the password they just set.
    return jsonify({"success": True, "data": {"user": user.to_dict(), "token": issue_token(user.id)}}), 200


@auth_bp.route("/me", methods=["GET"])
def me():
    user_id, _ = get_scope(request)
    if not user_id:
        raise APIError("Not signed in", 401)
    user = db.session.get(User, user_id)
    if not user:
        raise APIError("Not signed in", 401)
    return jsonify({"success": True, "data": user.to_dict()}), 200
