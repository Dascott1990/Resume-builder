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
GET    /api/v1/admin/reviews               — every artisan review
DELETE /api/v1/admin/reviews/<id>          — recomputes the artisan's rating after removal
POST   /api/v1/admin/resumes/polish-summary — AI-rewrites a resume's summary paragraph;
                                               same Claude-then-Groq fallback /api/v1/resume
                                               already uses, reused here rather than
                                               duplicated (see the import below). Artisan bios
                                               get the equivalent treatment via the existing,
                                               already-public /api/v1/artisans/polish — no new
                                               route needed there, the admin panel just calls it.

No "admin sets a user's password directly" route on purpose — that would
mean an admin (or anyone who compromises the admin panel) can silently
take over any account. Resetting someone's password instead goes through
the exact same email-token flow a locked-out user would use themselves
(POST /api/v1/auth/forgot-password with their email) — the admin panel
just triggers it, it never sees or sets the password.

Artisan listings themselves already have full CRUD at /api/v1/artisans —
deliberately not duplicated here. Edit/delete there are gated by a
per-listing edit_token (handed back once at creation, no account needed —
see _authorize_edit in api/artisans.py), not by is_admin. Every admin
request, though, is exempt from that token check the same way it's
exempt everywhere else in this file — get_admin_user(request) short-
circuits _authorize_edit, so the admin panel can always moderate any
listing regardless of who created it or whether its token was ever kept.
"""
import json
import re

from flask import Blueprint, request, jsonify
from sqlalchemy import func

from app import db
from app.models import User, Media, Artisan, Review, JobApplication, JdCapture
from app.middleware.error_handlers import APIError
from app.utils.auth import require_admin
from app.api.resume import _ai_complete

admin_bp = Blueprint("admin", __name__)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
VALID_APPLICATION_STATUSES = {"applied", "interview", "offer", "rejected"}


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


def _serialize_review(r):
    artisan = db.session.get(Artisan, r.artisan_id)
    return {**r.to_dict(), "artisan_name": artisan.name if artisan else None}


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
        "artisans": Artisan.query.count(),
        "reviews": Review.query.count(),
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
        # a user who has saved resumes or job applications.
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


@admin_bp.route("/reviews", methods=["GET"])
def list_reviews():
    require_admin(request)
    limit, offset = _clean_pagination()
    items = Review.query.order_by(Review.created_at.desc()).offset(offset).limit(limit).all()
    return jsonify({"success": True, "data": [_serialize_review(r) for r in items]}), 200


@admin_bp.route("/reviews/<review_id>", methods=["DELETE"])
def delete_review(review_id):
    require_admin(request)
    review = db.session.get(Review, review_id)
    if not review:
        return jsonify({"success": True}), 200

    artisan_id = review.artisan_id
    db.session.delete(review)
    db.session.flush()  # exclude the deleted row from the aggregate below

    count, avg = db.session.query(
        func.count(Review.id), func.avg(Review.stars)
    ).filter(Review.artisan_id == artisan_id).one()
    artisan = db.session.get(Artisan, artisan_id)
    if artisan:
        artisan.rating_count = count or 0
        artisan.rating_avg = round(float(avg), 2) if avg is not None else None

    db.session.commit()
    return jsonify({"success": True}), 200
