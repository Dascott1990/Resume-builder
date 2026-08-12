"""
app/api/messages.py — one chat thread per JobRequest. Only the job's own
customer and its assigned artisan can read or post to it, and only once
the job's been accepted — nothing to discuss before that, and no third
party (including other pool artisans who never accepted it) ever sees it.

Polling, not WebSockets — see the marketplace plan's stack-decision table:
this app runs single-worker on Render, and Flask-SocketIO needs
eventlet/gevent + sticky sessions that don't fit that deployment without
real infra changes.
"""
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from app import db, limiter
from app.models import JobRequest, Message
from app.middleware.error_handlers import APIError
from app.utils.auth import get_scope, get_artisan_scope
from app.api.requests import _job_side

messages_bp = Blueprint("messages", __name__)


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _authorize_thread(job_id):
    """Every route below starts here — resolves the job and confirms the
    caller is one of its two participants. Reuses _job_side from
    api/requests.py (same admin-free pattern already established there
    for propose/confirm-time) rather than a second copy of the same
    customer-or-artisan check."""
    job = db.session.get(JobRequest, job_id)
    if not job:
        raise APIError("Request not found", 404)
    is_customer, is_artisan = _job_side(job, request)
    if not (is_customer or is_artisan):
        raise APIError("Not authorized to view this conversation", 403)
    return job, is_customer, is_artisan


@messages_bp.route("/threads/<job_id>", methods=["GET"])
@limiter.limit("1000 per hour")
def get_thread(job_id):
    """Generous rate limit relative to the app-wide 200/hour default — an
    open thread polls every few seconds (see frontend's MessageThread.js),
    which would otherwise crowd out the same visitor's other API calls."""
    _authorize_thread(job_id)
    since_id = request.args.get("since_id", type=int, default=0)
    items = (
        Message.query
        .filter(Message.job_request_id == job_id, Message.id > since_id)
        .order_by(Message.id)
        .all()
    )
    return jsonify({"success": True, "data": [m.to_dict() for m in items]}), 200


@messages_bp.route("/threads/<job_id>", methods=["POST"])
def post_message(job_id):
    job, is_customer, is_artisan = _authorize_thread(job_id)
    if job.status not in ("accepted", "completed"):
        raise APIError("Messaging opens once the job's been accepted", 400)

    body = (request.get_json(force=True) or {}).get("body", "").strip()
    if not body:
        raise APIError("body is required", 400)
    if len(body) > 2000:
        raise APIError("Message must be 2000 characters or fewer", 400)

    if is_artisan:
        sender_type, sender_id = "artisan", job.artisan_id
    else:
        user_id, guest_id = get_scope(request)
        sender_type, sender_id = "customer", user_id or guest_id

    msg = Message(job_request_id=job_id, sender_type=sender_type, sender_id=sender_id, body=body)
    db.session.add(msg)
    db.session.commit()
    return jsonify({"success": True, "data": msg.to_dict()}), 201


@messages_bp.route("/threads/<job_id>/read", methods=["POST"])
def mark_read(job_id):
    _job, is_customer, _is_artisan = _authorize_thread(job_id)
    # Mark the OTHER side's messages read — a caller can never mark their
    # own messages read, only what was sent to them.
    other_type = "artisan" if is_customer else "customer"
    Message.query.filter(
        Message.job_request_id == job_id,
        Message.sender_type == other_type,
        Message.read_at.is_(None),
    ).update({"read_at": _utcnow()})
    db.session.commit()
    return jsonify({"success": True}), 200


@messages_bp.route("/unread-count", methods=["GET"])
def unread_count():
    """Aggregate unread count across every thread this caller is part of —
    the badge on "My requests" (customer) or the dashboard header
    (artisan). Checks the artisan token first: apiRequest always attaches
    X-Guest-Id to every call regardless of caller, so an artisan-context
    request still carries a guest_id — it just isn't the identity that
    matters when X-Artisan-Token is also present."""
    artisan_id = get_artisan_scope(request)
    if artisan_id:
        job_ids = [j.id for j in JobRequest.query.filter_by(artisan_id=artisan_id).all()]
        other_type = "customer"
    else:
        user_id, guest_id = get_scope(request)
        if not (user_id or guest_id):
            return jsonify({"success": True, "data": {"count": 0}}), 200
        q = JobRequest.query.filter_by(user_id=user_id) if user_id else JobRequest.query.filter_by(guest_id=guest_id)
        job_ids = [j.id for j in q.all()]
        other_type = "artisan"

    if not job_ids:
        return jsonify({"success": True, "data": {"count": 0}}), 200

    count = Message.query.filter(
        Message.job_request_id.in_(job_ids),
        Message.sender_type == other_type,
        Message.read_at.is_(None),
    ).count()
    return jsonify({"success": True, "data": {"count": count}}), 200
