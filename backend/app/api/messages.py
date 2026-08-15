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
from app.models import Artisan, JobRequest, Message
from app.middleware.error_handlers import APIError
from app.utils.auth import get_scope, get_artisan_scope
from app.utils.mail import send_email
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


def _notify_new_message(job, msg):
    """Best-effort, same "never raises into the caller" pattern as
    requests.py's _notify_target_artisan.

    Debounced: an unread thread with five messages piling up should send
    ONE email, not five — there's no message queue in this app to batch
    notifications, so this fires only when the count of unread messages
    from this sender (in this thread) is exactly 1, i.e. this is the
    first thing the recipient hasn't seen yet. Once they're already
    sitting on an unread notification, further messages before they
    check just accumulate quietly instead of re-notifying.

    Only the artisan side has an actual preference to check (see
    Artisan.notify_new_message) — the customer side has no account/
    Settings surface to opt out from, so it uses the same "they gave
    this email specifically for this job" reasoning contact_email
    already relies on elsewhere (job-request creation, etc.)."""
    unread_from_sender = Message.query.filter(
        Message.job_request_id == job.id,
        Message.sender_type == msg.sender_type,
        Message.read_at.is_(None),
    ).count()
    if unread_from_sender != 1:
        return

    if msg.sender_type == "customer":
        artisan = db.session.get(Artisan, job.artisan_id)
        if not artisan or not artisan.email or artisan.notify_new_message is False:
            return
        recipient = artisan.email
    else:
        if not job.contact_email:
            return
        recipient = job.contact_email

    try:
        send_email(
            recipient,
            f"New message about your {job.trade} request",
            f"""
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:8px;">
              <p style="font-weight:800;letter-spacing:0.02em;color:#111;margin:0 0 24px;">NOVIQ</p>
              <h2 style="color:#111;margin:0 0 12px;">New message</h2>
              <p style="color:#444;line-height:1.6;margin:0 0 16px;">{msg.body}</p>
              <p style="color:#888;font-size:12.5px;line-height:1.5;">Sign in to reply.</p>
            </div>
            """,
        )
    except Exception as exc:
        print(f"⚠️ Could not send message notification for job {job.id}: {exc}")


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
    _notify_new_message(job, msg)
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


@messages_bp.route("/unread", methods=["GET"])
def unread_threads():
    """The per-thread breakdown behind unread_count's single number — what
    actually powers the notification bell's dropdown (Dashboard.js). A
    bare count can only ever point at ONE hardcoded screen when clicked;
    this is what lets each notification say what it's actually about and
    open the right place for THAT item, not a guess based on whichever
    side has the bigger number. Same dual-scope check as unread_count.
    Small-scale N+1 here (a query per job) — deliberately not optimized
    into a join, since this app's own job-request volume per caller is
    tiny (see other routes in this file for the same non-concern)."""
    artisan_id = get_artisan_scope(request)
    if artisan_id:
        jobs = JobRequest.query.filter_by(artisan_id=artisan_id).all()
        viewer_role, other_type = "artisan", "customer"
    else:
        user_id, guest_id = get_scope(request)
        if not (user_id or guest_id):
            return jsonify({"success": True, "data": []}), 200
        q = JobRequest.query.filter_by(user_id=user_id) if user_id else JobRequest.query.filter_by(guest_id=guest_id)
        jobs = q.all()
        viewer_role, other_type = "customer", "artisan"

    items = []
    for job in jobs:
        count = Message.query.filter(
            Message.job_request_id == job.id,
            Message.sender_type == other_type,
            Message.read_at.is_(None),
        ).count()
        if not count:
            continue
        last = (
            Message.query.filter_by(job_request_id=job.id, sender_type=other_type)
            .order_by(Message.created_at.desc()).first()
        )
        if viewer_role == "customer":
            other = db.session.get(Artisan, job.artisan_id)
            other_name = other.name if other else job.trade
        else:
            other_name = job.contact_name
        items.append({
            "job_request_id": job.id,
            "trade": job.trade,
            "other_name": other_name,
            "unread_count": count,
            "preview": last.body[:120] if last else None,
            "viewer_role": viewer_role,
        })
    items.sort(key=lambda it: it["unread_count"], reverse=True)
    return jsonify({"success": True, "data": items}), 200
