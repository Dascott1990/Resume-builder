"""
app/api/extension.py — the Chrome extension's one real endpoint: save a
job posting straight into the Job Tracker as a "saved" application.
Distinct from api/capture.py's anonymous one-shot bookmarklet handoff —
this is account-scoped and persists directly, via a personal access
token (utils/auth.resolve_personal_access_token), not the full session
JWT. See models.PersonalAccessToken for why that split exists.
"""
from flask import Blueprint, request, jsonify
from app import db, limiter
from app.models import JobApplication
from app.middleware.error_handlers import APIError
from app.utils.auth import resolve_personal_access_token

extension_bp = Blueprint("extension", __name__)

NOTES_LIMIT = 1000
URL_LIMIT = 500


@extension_bp.route("/capture", methods=["POST"])
@limiter.limit("60 per hour")
def capture_job():
    user_id = resolve_personal_access_token(request)
    if not user_id:
        raise APIError("Invalid or revoked token", 401)

    body = request.get_json(force=True) or {}
    company = (body.get("company") or "").strip()
    role = (body.get("role") or "").strip()
    if not company or not role:
        raise APIError("company and role are required", 400)

    app_row = JobApplication(
        company=company, role=role, status="saved",
        notes=(body.get("job_description") or "").strip()[:NOTES_LIMIT] or None,
        source_url=(body.get("url") or "").strip()[:URL_LIMIT] or None,
        user_id=user_id,
    )
    db.session.add(app_row)
    db.session.commit()
    return jsonify({"success": True, "data": app_row.to_dict()}), 201
