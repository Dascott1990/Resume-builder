"""
app/api/admin.py — the admin panel's backend: everything gated behind
require_admin(request), the one thing none of the rest of this app's
routes are (auth is entirely optional everywhere else — see get_scope's
docstring).

GET    /api/v1/admin/me                    — confirms the caller is an admin, returns their profile
GET    /api/v1/admin/stats                 — counts across every model, for the overview screen
GET    /api/v1/admin/users                 — paginated, ?q= searches by email
PATCH  /api/v1/admin/users/<id>            — email, is_admin, email_verified
DELETE /api/v1/admin/users/<id>            — also removes their saved resumes/applications
GET    /api/v1/admin/resumes               — every saved Media row across every user/guest
GET    /api/v1/admin/resumes/<id>          — full resume content (contact/sections), for editing
PATCH  /api/v1/admin/resumes/<id>          — overwrite the resume content — the actual AI-generated
                                              document, not just its metadata
DELETE /api/v1/admin/resumes/<id>
GET    /api/v1/admin/applications          — every job application across every user/guest
PATCH  /api/v1/admin/applications/<id>     — company/role/status/date_applied/notes
DELETE /api/v1/admin/applications/<id>
GET    /api/v1/admin/vendors               — third-party services registry (auto-detected + manual)
POST   /api/v1/admin/vendors               — add a vendor manually
PATCH  /api/v1/admin/vendors/<id>          — edit any field, auto-detected or manual
DELETE /api/v1/admin/vendors/<id>
POST   /api/v1/admin/vendors/sync          — re-run env-var detection (see utils/vendors.py)
GET    /api/v1/admin/vendors/<id>/news     — real status-feed items, only for vendors with a status_feed_url set
GET    /api/v1/admin/handles               — registered social/campaign accounts
POST   /api/v1/admin/handles               — register one (platform + handle name)
DELETE /api/v1/admin/handles/<id>
GET    /api/v1/admin/scheduled-posts       — every scheduled post, newest scheduled_at first
POST   /api/v1/admin/scheduled-posts       — schedule one (title/caption/handles/scheduled_at)
PATCH  /api/v1/admin/scheduled-posts/<id>  — reschedule, retitle, edit caption
DELETE /api/v1/admin/scheduled-posts/<id>
POST   /api/v1/admin/scheduled-posts/suggest-time — AI suggests a date/time from content_type + title/caption
POST   /api/v1/admin/scheduled-posts/<id>/handles/<handle_id> — mark (or un-mark) one handle posted;
                                              flips the post to "completed" once every handle is
GET    /api/v1/admin/scheduled-posts/next-up — the single earliest not-yet-completed scheduled post
GET    /api/v1/admin/scheduled-posts/due-count — badge count: scheduled posts at/past their time, still open
POST   /api/v1/admin/resumes/polish-summary — AI-rewrites a resume's summary paragraph;
                                               same Claude-then-Groq fallback /api/v1/resume
                                               already uses, reused here rather than duplicated
                                               (see the import below).
GET    /api/v1/admin/broadcasts/recipients   — recipient count preview for an audience, before sending
GET    /api/v1/admin/broadcasts              — send history (audit trail), newest first
GET    /api/v1/admin/broadcasts/<id>         — one broadcast's live sent/failed progress
POST   /api/v1/admin/broadcasts              — email every user in an audience; runs in a
                                                background thread, see _run_broadcast —
                                                rate-limited, this is the one admin action that
                                                reaches real people outside the app
GET    /api/v1/admin/login-geo               — logins by country, ?range=today|7d|30d (see models.LoginGeo)
GET    /api/v1/admin/jobs-ingest-status       — the jobs board's latest ingestion run: per-source
                                                health, category coverage, last-updated timestamp
                                                (reads app/jobs_ingest/pipeline.py's own snapshot
                                                meta — the same file api/jobs_board.py serves to
                                                the public jobs board, just the admin-facing view)

No "admin sets a user's password directly" route on purpose — that would
mean an admin (or anyone who compromises the admin panel) can silently
take over any account. Resetting someone's password instead goes through
the exact same email-token flow a locked-out user would use themselves
(POST /api/v1/auth/forgot-password with their email) — the admin panel
just triggers it, it never sees or sets the password.
"""
import io
import os
import json
import re
import jwt
import threading
import time
from datetime import date, datetime, timedelta, timezone
from html import escape as escape_html

from flask import Blueprint, request, jsonify, redirect, current_app, send_file

from app import db, limiter
from app.models import (
    User, Media, JobApplication, JdCapture, CareerProfile,
    ApplicationRun, Vendor, VendorNewsItem, GoogleSearchConsoleCredential, SeoSnapshot,
    SchedulerStatus, AdminBroadcast, LoginGeo,
)
from app.middleware.error_handlers import APIError
from app.utils.auth import require_admin, JWT_SECRET, JWT_ALGORITHM
from app.utils.vendors import sync_vendor_catalog
from app.utils import seo_client
from app.utils.seo_scheduler import fetch_and_store_snapshot
from app.utils.stripe_client import FRONTEND_URL
from app.utils.mail import send_email, mail_configured, wrap_email_html
from app.api.resume import _ai_complete

admin_bp = Blueprint("admin", __name__)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
VALID_APPLICATION_STATUSES = {"applied", "interview", "offer", "rejected"}
VALID_VENDOR_CATEGORIES = {"hosting", "database", "ai", "payments", "email", "push", "monitoring", "other"}


def _clean_pagination(default_limit=50, max_limit=200):
    try:
        limit = int(request.args.get("limit", default_limit))
        offset = int(request.args.get("offset", 0))
    except (TypeError, ValueError):
        raise APIError("limit and offset must be whole numbers", 400)
    if limit < 1 or limit > max_limit:
        raise APIError(f"limit must be between 1 and {max_limit}", 400)
    if offset < 0:
        raise APIError("offset must be zero or greater", 400)
    return limit, offset


def _owner_label(user_id, guest_id):
    if user_id:
        u = db.session.get(User, user_id)
        return u.email if u else f"deleted user ({user_id[:8]})"
    if guest_id:
        return f"guest {guest_id[:10]}"
    return None


def _serialize_user(u):
    return {
        "id": u.id, "email": u.email, "email_verified": bool(u.email_verified),
        "is_admin": bool(u.is_admin),
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


def _serialize_media(m):
    return {
        "id": m.id, "filename": m.filename, "media_type": m.media_type,
        "mime_type": m.mime_type, "file_size": m.file_size, "caption": m.caption,
        "is_deleted": m.is_deleted, "owner": _owner_label(m.user_id, m.guest_id),
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


def _serialize_application(a):
    return {**a.to_dict(), "owner": _owner_label(a.user_id, a.guest_id)}


@admin_bp.route("/me", methods=["GET"])
def me():
    admin = require_admin(request)
    return jsonify({"success": True, "data": _serialize_user(admin)}), 200


@admin_bp.route("/stats", methods=["GET"])
def stats():
    require_admin(request)
    from datetime import datetime, timedelta, timezone

    week_ago = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=7)
    data = {
        "users": User.query.count(),
        "admins": User.query.filter_by(is_admin=True).count(),
        "new_users_7d": User.query.filter(User.created_at >= week_ago).count(),
        "resumes": Media.query.filter_by(is_deleted=False).count(),
        "applications": JobApplication.query.count(),
        "pending_job_captures": JdCapture.query.count(),
    }
    return jsonify({"success": True, "data": data}), 200


@admin_bp.route("/users", methods=["GET"])
def list_users():
    require_admin(request)
    limit, offset = _clean_pagination()
    q = User.query
    if search := request.args.get("q"):
        q = q.filter(User.email.ilike(f"%{search}%"))
    items = q.order_by(User.created_at.desc()).offset(offset).limit(limit).all()
    return jsonify({"success": True, "data": [_serialize_user(u) for u in items]}), 200


@admin_bp.route("/users/<user_id>", methods=["PATCH"])
def update_user(user_id):
    admin = require_admin(request)
    user = db.session.get(User, user_id)
    if not user:
        raise APIError("User not found", 404)

    body = request.get_json(force=True) or {}
    if "is_admin" in body:
        if user.id == admin.id and not body["is_admin"]:
            raise APIError("You can't remove your own admin access", 400)
        user.is_admin = bool(body["is_admin"])
    if "email_verified" in body:
        user.email_verified = bool(body["email_verified"])
    if "email" in body:
        new_email = (body["email"] or "").strip().lower()
        if not EMAIL_RE.match(new_email):
            raise APIError("Enter a valid email address", 400)
        if new_email != user.email and User.query.filter_by(email=new_email).first():
            raise APIError("An account with that email already exists", 409)
        user.email = new_email

    db.session.commit()
    return jsonify({"success": True, "data": _serialize_user(user)}), 200


@admin_bp.route("/users/<user_id>", methods=["DELETE"])
def delete_user(user_id):
    admin = require_admin(request)
    if user_id == admin.id:
        raise APIError("You can't delete your own account", 400)

    user = db.session.get(User, user_id)
    if user:
        # Postgres enforces the FK's ondelete=CASCADE, SQLite (local dev)
        # doesn't — deleting these explicitly works the same in both,
        # rather than only failing locally the first time an admin removes
        # a user who has saved resumes or job applications. ApplicationRun/
        # CareerProfile go first: an ApplicationRun can reference this same
        # user's Media as resume_id/review_screenshot_media_id, and THAT FK
        # has no ondelete at all (see delete_resume below) — deleting Media
        # first would 500 on that reference still pointing at it.
        ApplicationRun.query.filter_by(user_id=user_id).delete()
        CareerProfile.query.filter_by(user_id=user_id).delete()
        Media.query.filter_by(user_id=user_id).delete()
        JobApplication.query.filter_by(user_id=user_id).delete()
        db.session.delete(user)
        db.session.commit()
    return jsonify({"success": True}), 200


@admin_bp.route("/resumes", methods=["GET"])
def list_resumes():
    require_admin(request)
    limit, offset = _clean_pagination()
    items = Media.query.order_by(Media.created_at.desc()).offset(offset).limit(limit).all()
    return jsonify({"success": True, "data": [_serialize_media(m) for m in items]}), 200


@admin_bp.route("/resumes/<media_id>", methods=["GET"])
def get_resume(media_id):
    require_admin(request)
    m = db.session.get(Media, media_id)
    if not m or not m.file_data:
        raise APIError("Resume not found", 404)
    try:
        resume = json.loads(m.file_data)
    except json.JSONDecodeError:
        raise APIError("Stored resume data is corrupted", 500)
    return jsonify({"success": True, "data": {**_serialize_media(m), "resume": resume}}), 200


@admin_bp.route("/resumes/<media_id>", methods=["PATCH"])
def update_resume(media_id):
    require_admin(request)
    m = db.session.get(Media, media_id)
    if not m:
        raise APIError("Resume not found", 404)

    body = request.get_json(force=True) or {}
    resume = body.get("resume")
    if not isinstance(resume, dict) or not resume.get("contact") or not resume.get("sections"):
        raise APIError("resume (with contact and sections) is required", 400)

    # Same shape /generate and /optimize already save (see api/resume.py) —
    # overwritten wholesale rather than merged field-by-field, so this is
    # the one place in the app that lets an admin actually edit what the AI
    # produced, not just the Media row's metadata around it.
    doc_bytes = json.dumps(resume).encode()
    m.file_data = doc_bytes
    m.file_size = len(doc_bytes)
    contact = resume.get("contact", {})
    m.caption = f"{contact.get('name')} — {contact.get('title')}"
    meta = dict(m.metadata_json or {})
    meta["user_name"] = contact.get("name")
    meta["user_email"] = contact.get("email")
    meta["target_role"] = contact.get("title")
    m.metadata_json = meta

    db.session.commit()
    return jsonify({"success": True, "data": {**_serialize_media(m), "resume": resume}}), 200


POLISH_SUMMARY_SYSTEM = (
    "You are an elite ATS resume writer. You rewrite a resume's professional summary "
    "paragraph — 3 punchy, keyword-aware sentences, no fluff, no markdown, no quotes, "
    "no preamble. Return ONLY the rewritten summary text."
)


@admin_bp.route("/resumes/polish-summary", methods=["POST"])
def polish_resume_summary():
    require_admin(request)
    body = request.get_json(force=True) or {}
    title = (body.get("title") or "").strip()
    current = (body.get("summary") or "").strip()
    if not title and not current:
        raise APIError("title or summary is required", 400)

    prompt = (
        f"Candidate's target role/title: {title or 'not specified'}\n\n"
        f"CURRENT SUMMARY:\n{current or '(none yet — write one from the title alone)'}\n\n"
        "Rewrite this into a stronger 3-sentence professional summary. Ground every "
        "claim in what's actually there — never invent employers, numbers, or skills "
        "not already implied by the current text."
    )
    polished = _ai_complete(system=POLISH_SUMMARY_SYSTEM, prompt=prompt, effort="low", max_tokens=300, groq_temperature=0.4)
    return jsonify({"success": True, "data": {"summary": polished.strip()}}), 200


@admin_bp.route("/resumes/<media_id>", methods=["DELETE"])
def delete_resume(media_id):
    require_admin(request)
    m = db.session.get(Media, media_id)
    if m:
        # None of resume_id/review_screenshot_media_id cascade at the DB
        # level (see their model comments — deliberately not ondelete=
        # CASCADE, since a resume being removed from "Saved" shouldn't
        # need to touch every application/run that once pointed at it).
        # Without nulling them first, Postgres rejects this delete outright
        # whenever the resume was ever attached to a JobApplication or
        # ApplicationRun — "delete" silently doing nothing is worse than
        # this being explicit.
        JobApplication.query.filter_by(resume_id=media_id).update({"resume_id": None})
        ApplicationRun.query.filter_by(resume_id=media_id).update({"resume_id": None})
        ApplicationRun.query.filter_by(review_screenshot_media_id=media_id).update({"review_screenshot_media_id": None})
        db.session.delete(m)
        db.session.commit()
    return jsonify({"success": True}), 200


@admin_bp.route("/applications", methods=["GET"])
def list_applications():
    require_admin(request)
    limit, offset = _clean_pagination()
    items = JobApplication.query.order_by(JobApplication.created_at.desc()).offset(offset).limit(limit).all()
    return jsonify({"success": True, "data": [_serialize_application(a) for a in items]}), 200


@admin_bp.route("/applications/<app_id>", methods=["PATCH"])
def update_application(app_id):
    require_admin(request)
    a = db.session.get(JobApplication, app_id)
    if not a:
        raise APIError("Application not found", 404)

    body = request.get_json(force=True) or {}
    if "company" in body:
        a.company = (body["company"] or "").strip() or a.company
    if "role" in body:
        a.role = (body["role"] or "").strip() or a.role
    if "status" in body:
        if body["status"] not in VALID_APPLICATION_STATUSES:
            raise APIError(f"status must be one of {sorted(VALID_APPLICATION_STATUSES)}", 400)
        a.status = body["status"]
    if "date_applied" in body:
        a.date_applied = (body["date_applied"] or "").strip() or None
    if "notes" in body:
        a.notes = (body["notes"] or "").strip() or None

    db.session.commit()
    return jsonify({"success": True, "data": _serialize_application(a)}), 200


@admin_bp.route("/applications/<app_id>", methods=["DELETE"])
def delete_application(app_id):
    require_admin(request)
    a = db.session.get(JobApplication, app_id)
    if a:
        db.session.delete(a)
        db.session.commit()
    return jsonify({"success": True}), 200



# ── Vendors — the third-party services registry. Rows starting with
# auto_detected=True came from real env-var presence (see utils/vendors.py);
# everything else is exactly what an admin typed in. Both kinds are edited
# and deleted through the same two routes below — once a row exists, how it
# got there stops mattering. ────────────────────────────────────────────
@admin_bp.route("/vendors", methods=["GET"])
def list_vendors():
    require_admin(request)
    items = Vendor.query.order_by(Vendor.category.asc(), Vendor.name.asc()).all()
    return jsonify({"success": True, "data": [v.to_dict() for v in items]}), 200


@admin_bp.route("/vendors", methods=["POST"])
def create_vendor():
    require_admin(request)
    body = request.get_json(force=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        raise APIError("name is required", 400)
    category = body.get("category") or "other"
    if category not in VALID_VENDOR_CATEGORIES:
        raise APIError(f"category must be one of {sorted(VALID_VENDOR_CATEGORIES)}", 400)

    vendor = Vendor(
        name=name, category=category,
        custom_category=(body.get("custom_category") or "").strip() or None if category == "other" else None,
        plan=(body.get("plan") or "").strip() or None,
        is_free=body.get("is_free") if isinstance(body.get("is_free"), bool) else None,
        monthly_cost=body.get("monthly_cost") if isinstance(body.get("monthly_cost"), (int, float)) else None,
        console_url=(body.get("console_url") or "").strip() or None,
        status_feed_url=(body.get("status_feed_url") or "").strip() or None,
        notes=(body.get("notes") or "").strip() or None,
        auto_detected=False,
    )
    db.session.add(vendor)
    db.session.commit()
    return jsonify({"success": True, "data": vendor.to_dict()}), 201


@admin_bp.route("/vendors/<vendor_id>", methods=["PATCH"])
def update_vendor(vendor_id):
    require_admin(request)
    vendor = db.session.get(Vendor, vendor_id)
    if not vendor:
        raise APIError("Vendor not found", 404)

    body = request.get_json(force=True) or {}
    if "name" in body:
        name = (body["name"] or "").strip()
        if not name:
            raise APIError("name can't be empty", 400)
        vendor.name = name
    if "category" in body:
        if body["category"] not in VALID_VENDOR_CATEGORIES:
            raise APIError(f"category must be one of {sorted(VALID_VENDOR_CATEGORIES)}", 400)
        vendor.category = body["category"]
        if vendor.category != "other":
            vendor.custom_category = None  # only meaningful for "other" — stale otherwise
    if "custom_category" in body and vendor.category == "other":
        vendor.custom_category = (body["custom_category"] or "").strip() or None
    if "plan" in body:
        vendor.plan = (body["plan"] or "").strip() or None
    if "is_free" in body:
        vendor.is_free = body["is_free"] if isinstance(body["is_free"], bool) else None
    if "monthly_cost" in body:
        vendor.monthly_cost = body["monthly_cost"] if isinstance(body["monthly_cost"], (int, float)) else None
    if "console_url" in body:
        vendor.console_url = (body["console_url"] or "").strip() or None
    if "status_feed_url" in body:
        vendor.status_feed_url = (body["status_feed_url"] or "").strip() or None
    if "notes" in body:
        vendor.notes = (body["notes"] or "").strip() or None

    vendor.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({"success": True, "data": vendor.to_dict()}), 200


@admin_bp.route("/vendors/<vendor_id>", methods=["DELETE"])
def delete_vendor(vendor_id):
    require_admin(request)
    vendor = db.session.get(Vendor, vendor_id)
    if vendor:
        VendorNewsItem.query.filter_by(vendor_id=vendor.id).delete()
        db.session.delete(vendor)
        db.session.commit()
    return jsonify({"success": True}), 200


@admin_bp.route("/vendors/sync", methods=["POST"])
def resync_vendors():
    """Explicit, admin-triggered re-detection — unlike the boot-time sync
    (which only ever runs once, see sync_vendor_catalog_at_boot), clicking
    this can re-add a previously-deleted auto-detected row if it's still
    configured. That's expected here: the admin asked for it by clicking."""
    require_admin(request)
    added = sync_vendor_catalog()
    items = Vendor.query.order_by(Vendor.category.asc(), Vendor.name.asc()).all()
    return jsonify({"success": True, "data": {"added": added, "vendors": [v.to_dict() for v in items]}}), 200


@admin_bp.route("/vendors/<vendor_id>/news", methods=["GET"])
def vendor_news(vendor_id):
    require_admin(request)
    if not db.session.get(Vendor, vendor_id):
        raise APIError("Vendor not found", 404)
    items = (
        VendorNewsItem.query.filter_by(vendor_id=vendor_id)
        .order_by(VendorNewsItem.fetched_at.desc())
        .limit(10)
        .all()
    )
    return jsonify({"success": True, "data": [i.to_dict() for i in items]}), 200


# --- SEO dashboard (noqeev.com's own Search Console + Core Web Vitals) ---
# oauth/start and oauth/callback are real browser navigations (Google's
# consent screen has to redirect the top-level page, not a fetch()), so
# require_admin's ?token= query-string fallback (see utils/auth.py) is what
# gates /start. /callback itself can't carry that same token — Google's
# redirect only appends `code` and `state` — so its authorization comes from
# the signed `state` value /start minted, verified below instead.

def _issue_seo_oauth_state(admin_id):
    payload = {
        "purpose": "seo_oauth_state", "sub": admin_id,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _verify_seo_oauth_state(state):
    try:
        payload = jwt.decode(state, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
    if payload.get("purpose") != "seo_oauth_state":
        return None
    return payload.get("sub")


@admin_bp.route("/seo/oauth/start", methods=["GET"])
def seo_oauth_start():
    if not seo_client.google_oauth_configured():
        raise APIError("GOOGLE_OAUTH_CLIENT_ID/SECRET are not configured", 503)
    admin = require_admin(request)
    state = _issue_seo_oauth_state(admin.id)
    return redirect(seo_client.build_oauth_url(state))


@admin_bp.route("/seo/oauth/callback", methods=["GET"])
def seo_oauth_callback():
    error = request.args.get("error")
    if error:
        return redirect(f"{FRONTEND_URL}/brand?seo=error&reason={error}")

    state = request.args.get("state") or ""
    admin_id = _verify_seo_oauth_state(state)
    if not admin_id:
        return redirect(f"{FRONTEND_URL}/brand?seo=error&reason=invalid_state")

    code = request.args.get("code")
    if not code:
        return redirect(f"{FRONTEND_URL}/brand?seo=error&reason=missing_code")

    try:
        tokens = seo_client.exchange_code_for_tokens(code)
        refresh_token = tokens.get("refresh_token")
    except Exception:
        return redirect(f"{FRONTEND_URL}/brand?seo=error&reason=token_exchange_failed")

    if not refresh_token:
        # Happens if this admin already connected once before and Google
        # didn't consider it a fresh consent — access_type=offline plus
        # prompt=consent in build_oauth_url() is specifically there to
        # avoid this, but a stale row is still better kept than dropped.
        return redirect(f"{FRONTEND_URL}/brand?seo=error&reason=no_refresh_token")

    admin = db.session.get(User, admin_id)
    credential = GoogleSearchConsoleCredential.query.first()
    if not credential:
        credential = GoogleSearchConsoleCredential()
        db.session.add(credential)
    credential.refresh_token = refresh_token
    credential.connected_at = datetime.now(timezone.utc)
    credential.connected_by = admin.email if admin else admin_id
    db.session.commit()

    return redirect(f"{FRONTEND_URL}/brand?seo=connected")


@admin_bp.route("/seo/status", methods=["GET"])
def seo_status():
    require_admin(request)
    credential = GoogleSearchConsoleCredential.query.first()
    return jsonify({"success": True, "data": {
        "connected": bool(credential),
        "credential": credential.to_dict() if credential else None,
        "crux_configured": seo_client.crux_configured(),
    }}), 200


@admin_bp.route("/seo/snapshots", methods=["GET"])
def seo_snapshots():
    require_admin(request)
    try:
        days = int(request.args.get("days", 90))
    except (TypeError, ValueError):
        raise APIError("days must be a whole number", 400)
    days = max(1, min(days, 365))
    since = date.today() - timedelta(days=days)
    items = (
        SeoSnapshot.query.filter(SeoSnapshot.snapshot_date >= since)
        .order_by(SeoSnapshot.snapshot_date.asc())
        .all()
    )
    return jsonify({"success": True, "data": [s.to_dict() for s in items]}), 200


@admin_bp.route("/seo/refresh-now", methods=["POST"])
def seo_refresh_now():
    from flask import current_app

    require_admin(request)
    if not GoogleSearchConsoleCredential.query.first():
        raise APIError("Search Console is not connected yet", 400)
    snapshot = fetch_and_store_snapshot(current_app._get_current_object())
    if not snapshot:
        raise APIError("Snapshot fetch failed — check server logs", 502)
    return jsonify({"success": True, "data": snapshot.to_dict()}), 200


# --- System tab: Health + Structure ---------------------------------------
# Two admin-only, read-only views. Health answers "is everything actually
# running" (backend/DB reachability + each background job's last real
# run — see utils/scheduler_health.py). Structure answers "what does this
# app consist of right now" by introspecting the LIVE running app (Flask's
# own url_map, SQLAlchemy's own table metadata) rather than a hand-written
# doc — a route added tomorrow shows up here automatically the next time
# this loads, with nothing to remember to update. Deliberately backend-
# only: the frontend (Next.js, deployed separately on Vercel) has no
# filesystem this process can see, so a live frontend-route map isn't
# something this endpoint can honestly produce.
#
# Neither one reproduces Render's or Sentry's own logs/dashboards — both
# already do that well. This links out to them instead of rebuilding it.

RENDER_DASHBOARD_URL = "https://dashboard.render.com"
SENTRY_DASHBOARD_URL = "https://sentry.io"


@admin_bp.route("/health", methods=["GET"])
def system_health():
    require_admin(request)

    try:
        db.session.execute(db.text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    jobs = SchedulerStatus.query.order_by(SchedulerStatus.job_name.asc()).all()

    return jsonify({"success": True, "data": {
        "backend": "ok",  # trivially true — this response is proof of it
        "database": "ok" if db_ok else "error",
        "jobs": [j.to_dict() for j in jobs],
        "links": {"render": RENDER_DASHBOARD_URL, "sentry": SENTRY_DASHBOARD_URL},
    }}), 200


@admin_bp.route("/structure", methods=["GET"])
def system_structure():
    from flask import current_app

    require_admin(request)
    app = current_app._get_current_object()

    routes_by_blueprint = {}
    for rule in app.url_map.iter_rules():
        if rule.endpoint == "static":
            continue
        blueprint = rule.endpoint.split(".")[0] if "." in rule.endpoint else "app"
        methods = sorted(m for m in rule.methods if m not in ("HEAD", "OPTIONS"))
        routes_by_blueprint.setdefault(blueprint, []).append({"path": str(rule), "methods": methods})
    for group in routes_by_blueprint.values():
        group.sort(key=lambda r: r["path"])

    tables = []
    for name, table in sorted(db.metadata.tables.items()):
        tables.append({
            "name": name,
            "columns": [{"name": c.name, "type": str(c.type)} for c in table.columns],
        })

    return jsonify({"success": True, "data": {
        "blueprints": [
            {"name": name, "routes": routes}
            for name, routes in sorted(routes_by_blueprint.items())
        ],
        "tables": tables,
    }}), 200


# ── Broadcast: email every user from the admin panel ───────────────────────
VALID_BROADCAST_AUDIENCES = {"customers", "everyone"}


def _broadcast_recipients(audience):
    """Real, distinct email addresses for the given audience — never a
    guess. "customers" is every User row (email is required at signup, so
    no filter needed there). "everyone" is the same set today — it's kept
    as its own choice so a future audience can join it without the API
    shape changing again."""
    if audience in ("customers", "everyone"):
        return sorted({u.email for u in User.query.filter(User.email.isnot(None)).all() if u.email})
    raise APIError("audience must be customers or everyone", 400)


def _run_broadcast(app, broadcast_id, recipients, subject, message):
    """Runs in its own background thread (api/apply.py's own threading
    pattern — see that file's docstring for why this app uses plain
    threading instead of Celery/RQ), started right after the POST route
    below returns, so an admin sending to a real user base isn't stuck
    waiting on hundreds of individual Resend calls inside one HTTP
    request. Best-effort per recipient — one bad address shouldn't stop
    the rest of the send."""
    with app.app_context():
        broadcast = db.session.get(AdminBroadcast, broadcast_id)
        if not broadcast:
            return
        # Escaped, then newlines turned into real <br> tags rather than
        # relying on white-space:pre-wrap — plenty of email clients
        # (Outlook desktop chief among them) ignore that CSS property
        # entirely, so this is what actually preserves paragraph breaks
        # everywhere the message gets opened.
        safe_message = escape_html(message).replace("\n", "<br>")
        html = wrap_email_html(subject, f'<p style="color:#444;line-height:1.6;margin:0 0 16px;">{safe_message}</p>')

        sent = 0
        failed = 0
        for email in recipients:
            try:
                send_email(email, subject, html)
                sent += 1
            except Exception as exc:
                failed += 1
                print(f"⚠️ Broadcast {broadcast_id}: failed to send to {email}: {exc}")
            # Progress written every few sends, not every single one — still
            # frequent enough for the admin UI's polling to look live,
            # without a DB write per recipient on what could be a long list.
            if (sent + failed) % 5 == 0 or (sent + failed) == len(recipients):
                broadcast.sent_count = sent
                broadcast.failed_count = failed
                db.session.commit()
            time.sleep(0.15)  # polite pacing against Resend's own rate limits

        broadcast.sent_count = sent
        broadcast.failed_count = failed
        broadcast.status = "done"
        broadcast.completed_at = datetime.now(timezone.utc)
        db.session.commit()


@admin_bp.route("/broadcasts/recipients", methods=["GET"])
def broadcast_recipients():
    """Recipient count preview for the audience currently selected in the
    compose form — the admin sees exactly how many real people "Send"
    will reach before it's ever clicked, not after."""
    require_admin(request)
    audience = request.args.get("audience", "")
    count = len(_broadcast_recipients(audience))
    return jsonify({"success": True, "data": {"count": count}}), 200


@admin_bp.route("/broadcasts", methods=["GET"])
def list_broadcasts():
    require_admin(request)
    rows = AdminBroadcast.query.order_by(AdminBroadcast.created_at.desc()).limit(50).all()
    return jsonify({"success": True, "data": [b.to_dict() for b in rows]}), 200


@admin_bp.route("/broadcasts/<broadcast_id>", methods=["GET"])
def get_broadcast(broadcast_id):
    """Polled by the admin UI while a send is in progress, for the live
    sent/failed progress bar."""
    require_admin(request)
    b = db.session.get(AdminBroadcast, broadcast_id)
    if not b:
        raise APIError("Broadcast not found", 404)
    return jsonify({"success": True, "data": b.to_dict()}), 200


@admin_bp.route("/broadcasts", methods=["POST"])
@limiter.limit("5 per hour")
def send_broadcast():
    """Kicks off a real send to a real audience — rate-limited on purpose
    (5/hour) since this is the one admin action that reaches outside the
    app entirely, to however many people match the chosen audience, and
    can't be recalled once it's sent."""
    admin = require_admin(request)
    if not mail_configured():
        raise APIError("Email isn't configured on this server (RESEND_API_KEY missing)", 503)

    body = request.get_json(force=True) or {}
    audience = (body.get("audience") or "").strip()
    subject = (body.get("subject") or "").strip()
    message = (body.get("body") or "").strip()

    if audience not in VALID_BROADCAST_AUDIENCES:
        raise APIError("audience must be customers or everyone", 400)
    if not subject or not message:
        raise APIError("subject and body are required", 400)
    if len(subject) > 200:
        raise APIError("subject must be 200 characters or fewer", 400)
    if len(message) > 5000:
        raise APIError("body must be 5000 characters or fewer", 400)

    recipients = _broadcast_recipients(audience)
    if not recipients:
        raise APIError("No recipients match that audience", 400)

    broadcast = AdminBroadcast(
        sent_by_email=admin.email, audience=audience, subject=subject, body=message,
        recipient_count=len(recipients), status="sending",
    )
    db.session.add(broadcast)
    db.session.commit()

    app_obj = current_app._get_current_object()
    threading.Thread(target=_run_broadcast, args=(app_obj, broadcast.id, recipients, subject, message), daemon=True).start()

    return jsonify({"success": True, "data": broadcast.to_dict()}), 201



# ── Login geography — daily logins by country (see models.LoginGeo) ────────
_LOGIN_GEO_RANGES = {"today": 1, "7d": 7, "30d": 30}


@admin_bp.route("/login-geo", methods=["GET"])
def login_geo_stats():
    require_admin(request)
    range_key = request.args.get("range", "7d")
    days = _LOGIN_GEO_RANGES.get(range_key)
    if days is None:
        raise APIError("range must be today, 7d, or 30d", 400)

    since = datetime.now(timezone.utc) - timedelta(days=days)
    # today's window is calendar-day, not "last 24h" — matches how the
    # other two ranges read ("7d"/"30d" are rolling, but "today" reads as
    # "since midnight" to anyone glancing at the panel).
    if range_key == "today":
        since = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    rows = db.session.query(LoginGeo.country_code, db.func.count(LoginGeo.id)) \
        .filter(LoginGeo.created_at >= since) \
        .group_by(LoginGeo.country_code) \
        .order_by(db.func.count(LoginGeo.id).desc()) \
        .all()

    counts = [{"country_code": code or "unknown", "count": count} for code, count in rows]
    return jsonify({"success": True, "data": {
        "range": range_key, "since": since.isoformat() + "Z",
        "total_logins": sum(c["count"] for c in counts),
        "countries": counts,
    }}), 200


# ── Jobs board ingestion status — admin-facing view of the same snapshot
# meta api/jobs_board.py serves publicly at /api/v1/jobs/meta. Kept as its
# own admin route (rather than just pointing the admin UI at the public
# one) so this can later show anything genuinely admin-only — the raw
# per-run error strings, say — without exposing that to the public route.
@admin_bp.route("/jobs-ingest-status", methods=["GET"])
def jobs_ingest_status():
    require_admin(request)
    from app.jobs_ingest.pipeline import SNAPSHOT_PATH
    if not os.path.exists(SNAPSHOT_PATH):
        return jsonify({"success": True, "data": None}), 200
    with open(SNAPSHOT_PATH) as f:
        data = json.load(f)
    return jsonify({"success": True, "data": data.get("meta")}), 200
