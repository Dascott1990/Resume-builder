"""
app/api/capture.py — the handoff point for the "tailor for this job"
bookmarklet (see frontend/lib/bookmarklet.js for the JS that runs on the
job board page itself).

POST /api/v1/capture/jd       — bookmarklet calls this with the page's text
GET  /api/v1/capture/jd/<id>  — the new Noviq tab calls this once, then the
                                 row is gone

No auth, no guest_id scoping: the bookmarklet executes in the job board's
own page context, which has no access to Noviq's origin (different site,
no shared localStorage/cookies) — the random id in the URL the bookmarklet
opens IS the only handshake between the two tabs. Capacity for abuse is
bounded by TEXT_LIMIT and the fact that a row is either claimed within the
hour or swept away; nothing here is ever attached to a person or account.
"""
from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify
from app import db
from app.models import JdCapture
from app.middleware.error_handlers import APIError

capture_bp = Blueprint("capture", __name__)

TEXT_LIMIT = 8000
EXPIRY = timedelta(hours=1)


def _sweep_expired():
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - EXPIRY
    JdCapture.query.filter(JdCapture.created_at < cutoff).delete()


@capture_bp.route("/jd", methods=["POST"])
def capture_jd():
    body = request.get_json(force=True) or {}
    text = (body.get("text") or "").strip()
    if not text:
        raise APIError("text is required", 400)

    _sweep_expired()
    row = JdCapture(text=text[:TEXT_LIMIT])
    db.session.add(row)
    db.session.commit()
    return jsonify({"success": True, "data": {"id": row.id}}), 201


@capture_bp.route("/jd/<capture_id>", methods=["GET"])
def get_jd(capture_id):
    row = db.session.get(JdCapture, capture_id)
    if not row:
        raise APIError("This link has expired or was already used", 404)
    text = row.text
    # Single-use — the whole point is a brief handoff between two tabs, not
    # a place job description text sits around waiting to be read again.
    db.session.delete(row)
    db.session.commit()
    return jsonify({"success": True, "data": {"text": text}}), 200
