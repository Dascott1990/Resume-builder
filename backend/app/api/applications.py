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
from flask import Blueprint, request, jsonify
from app import db
from app.models import JobApplication
from app.middleware.error_handlers import APIError
from app.utils.auth import get_scope

applications_bp = Blueprint("applications", __name__)

VALID_STATUSES = {"applied", "interview", "offer", "rejected"}


def _scope_filter(query):
    user_id, guest_id = get_scope(request)
    if user_id:
        return query.filter_by(user_id=user_id), user_id, guest_id
    if guest_id:
        return query.filter_by(guest_id=guest_id), user_id, guest_id
    return query.filter(db.false()), user_id, guest_id  # neither header present — show nothing, not everything


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
        user_id=user_id, guest_id=None if user_id else guest_id,
    )
    db.session.add(app_row)
    db.session.commit()
    return jsonify({"success": True, "data": app_row.to_dict()}), 201


@applications_bp.route("", methods=["GET"])
def list_applications():
    query, _, _ = _scope_filter(JobApplication.query)
    items = query.order_by(JobApplication.created_at.desc()).limit(500).all()
    return jsonify({"success": True, "data": [a.to_dict() for a in items]}), 200


@applications_bp.route("/<app_id>", methods=["PATCH"])
def update_application(app_id):
    query, _, _ = _scope_filter(JobApplication.query.filter_by(id=app_id))
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

    db.session.commit()
    return jsonify({"success": True, "data": app_row.to_dict()}), 200


@applications_bp.route("/<app_id>", methods=["DELETE"])
def delete_application(app_id):
    query, _, _ = _scope_filter(JobApplication.query.filter_by(id=app_id))
    app_row = query.first()
    if app_row:
        db.session.delete(app_row)
        db.session.commit()
    return jsonify({"success": True}), 200
