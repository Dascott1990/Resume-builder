"""
app/api/applications.py — the job application tracker.
POST   /api/v1/applications
GET    /api/v1/applications
PATCH  /api/v1/applications/<id>
DELETE /api/v1/applications/<id>

Scoped by guest_id (anonymous, the default) or user_id (signed in) — never
both, never neither, and never visible to anyone else's scope. See
app/utils/auth.get_scope for how the two are told apart.
"""
from datetime import date, datetime
from flask import Blueprint, request, jsonify
from app import db, limiter
from app.models import JobApplication, Media
from app.middleware.error_handlers import APIError
from app.utils.auth import get_scope
from app.utils.ai_client import ai_complete

applications_bp = Blueprint("applications", __name__)

VALID_STATUSES = {"applied", "interview", "offer", "rejected"}
# How long an application sits at "applied" with no update before we
# suggest following up. Not configurable per-user on purpose — a fixed,
# predictable rule is easier to trust than a setting nobody will find.
FOLLOWUP_AFTER_DAYS = 7


def _scope_filter(query):
    user_id, guest_id = get_scope(request)
    if user_id:
        return query.filter_by(user_id=user_id), user_id, guest_id
    if guest_id:
        return query.filter_by(guest_id=guest_id), user_id, guest_id
    return query.filter(db.false()), user_id, guest_id  # neither header present — show nothing, not everything


def _clean_resume_id(raw, user_id, guest_id):
    """A resume_id is "which of my own saved resumes did I send for this
    application" — accepting any id the client sends with no ownership
    check would let a request attach someone else's Media row to your
    application (that row's caption/owner then shows up wherever this
    application is rendered, admin panel included). Silently drops it to
    None instead of erroring: a stale/foreign id here is a UI mismatch,
    not something worth failing the whole save over."""
    resume_id = (raw or "").strip() or None
    if not resume_id:
        return None
    q = Media.query.filter_by(id=resume_id)
    q = q.filter_by(user_id=user_id) if user_id else q.filter_by(guest_id=guest_id)
    return resume_id if q.first() else None


def _needs_followup(app_row):
    if app_row.status != "applied":
        return False
    base_date = None
    if app_row.date_applied:
        try:
            base_date = datetime.strptime(app_row.date_applied, "%Y-%m-%d").date()
        except ValueError:
            base_date = None  # free-text field — not every entry parses, fall back below
    if base_date is None and app_row.created_at:
        base_date = app_row.created_at.date()
    if base_date is None:
        return False
    return (date.today() - base_date).days >= FOLLOWUP_AFTER_DAYS


def _serialize(app_row):
    return {**app_row.to_dict(), "needs_followup": _needs_followup(app_row)}


@applications_bp.route("", methods=["POST"])
def create_application():
    body = request.get_json(force=True) or {}
    company = (body.get("company") or "").strip()
    role = (body.get("role") or "").strip()
    status = body.get("status") or "applied"

    if not company or not role:
        raise APIError("company and role are required", 400)
    if status not in VALID_STATUSES:
        raise APIError(f"status must be one of {sorted(VALID_STATUSES)}", 400)

    user_id, guest_id = get_scope(request)
    if not user_id and not guest_id:
        raise APIError("Missing X-Guest-Id header", 400)

    app_row = JobApplication(
        company=company, role=role, status=status,
        date_applied=(body.get("date_applied") or "").strip() or None,
        notes=(body.get("notes") or "").strip() or None,
        resume_id=_clean_resume_id(body.get("resume_id"), user_id, guest_id),
        user_id=user_id, guest_id=None if user_id else guest_id,
    )
    db.session.add(app_row)
    db.session.commit()
    return jsonify({"success": True, "data": _serialize(app_row)}), 201


@applications_bp.route("", methods=["GET"])
def list_applications():
    query, _, _ = _scope_filter(JobApplication.query)
    items = query.order_by(JobApplication.created_at.desc()).limit(500).all()
    return jsonify({"success": True, "data": [_serialize(a) for a in items]}), 200


@applications_bp.route("/<app_id>", methods=["PATCH"])
def update_application(app_id):
    query, user_id, guest_id = _scope_filter(JobApplication.query.filter_by(id=app_id))
    app_row = query.first()
    if not app_row:
        raise APIError("Application not found", 404)

    body = request.get_json(force=True) or {}
    if "company" in body:
        app_row.company = (body["company"] or "").strip() or app_row.company
    if "role" in body:
        app_row.role = (body["role"] or "").strip() or app_row.role
    if "status" in body:
        if body["status"] not in VALID_STATUSES:
            raise APIError(f"status must be one of {sorted(VALID_STATUSES)}", 400)
        app_row.status = body["status"]
    if "date_applied" in body:
        app_row.date_applied = (body["date_applied"] or "").strip() or None
    if "notes" in body:
        app_row.notes = (body["notes"] or "").strip() or None
    if "resume_id" in body:
        app_row.resume_id = _clean_resume_id(body["resume_id"], user_id, guest_id)

    db.session.commit()
    return jsonify({"success": True, "data": _serialize(app_row)}), 200


INSIGHT_PROMPTS = {
    # Short on purpose — this renders inline under one Recent Applications
    # row, not in its own screen. 2-3 plain sentences, no lists, no headers.
    "why": "This job application was rejected. In 2-3 short, encouraging sentences, give ONE or TWO plausible, constructive reasons this might not have worked out and what to look at for next time. Be concrete where the role/notes give you something to go on, not generic platitudes.",
    "reapply": "This job application was rejected. In 2-3 short, encouraging sentences, say whether it's generally worth reapplying to this company/role in the future (and roughly when), or better to focus elsewhere.",
}


@applications_bp.route("/<app_id>/insight", methods=["POST"])
@limiter.limit("30 per hour")
def application_insight(app_id):
    """On-demand, not stored — see Dashboard.js's rejection-help buttons.
    Cheap enough (one short completion, max_tokens=160) to regenerate on
    every click rather than add a column and cache-invalidation story for
    something this disposable."""
    query, _, _ = _scope_filter(JobApplication.query.filter_by(id=app_id))
    app_row = query.first()
    if not app_row:
        raise APIError("Application not found", 404)

    body = request.get_json(force=True) or {}
    kind = body.get("kind")
    if kind not in INSIGHT_PROMPTS:
        raise APIError("kind must be 'why' or 'reapply'", 400)

    context = f"Role: {app_row.role}\nCompany: {app_row.company}"
    if app_row.notes:
        context += f"\nNotes / job description excerpt: {app_row.notes[:600]}"

    text = ai_complete(
        system="You are a calm, direct career coach. Keep responses extremely short — 2-3 sentences, no lists, no headers, no fluff, no preamble like \"Sure,\" just the sentences themselves.",
        prompt=f"{context}\n\n{INSIGHT_PROMPTS[kind]}",
        effort="low", max_tokens=160,
    )
    return jsonify({"success": True, "data": {"text": text}}), 200


@applications_bp.route("/<app_id>", methods=["DELETE"])
def delete_application(app_id):
    query, _, _ = _scope_filter(JobApplication.query.filter_by(id=app_id))
    app_row = query.first()
    if app_row:
        db.session.delete(app_row)
        db.session.commit()
    return jsonify({"success": True}), 200
