"""
app/api/requests.py — the request/accept pool behind the "Uber/Lyft for
artisans" flow: a customer posts what they need, any signed-in, available
artisan whose trade/city match can see it and accept it. First to accept
wins; no live location, no map, no dispatch algorithm — Artisan only
stores a city string today, not coordinates, so matching is trade+city,
not geodistance.
"""
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from sqlalchemy import func, update
from app import db, limiter
from app.models import Artisan, JobRequest
from app.middleware.error_handlers import APIError
from app.utils.auth import get_scope, require_artisan_scope
from app.utils.mail import send_email

requests_bp = Blueprint("job_requests", __name__)


def _utcnow():
    # Naive UTC — matches every other timestamp column in this app (see
    # auth.py's own _utcnow for why: neither SQLite nor a plain Postgres
    # TIMESTAMP column round-trips tzinfo).
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _city_matches(a, b) -> bool:
    """Both Artisan.city and JobRequest.city are free text ("Toronto",
    "Toronto, ON", "toronto ontario", ...), typed independently by two
    different people — neither is reliably a substring of the other in a
    fixed direction, so a single-direction SQL ILIKE misses real matches
    (this is exactly the bug a first pass here shipped with: "Toronto" is
    not a substring of "Toronto, ON", only the reverse is). Checking both
    directions in Python, after a cheap trade-only DB filter, is simpler
    and more correct than fighting cross-dialect SQL string functions for
    what's a small result set either way. A blank city on either side
    doesn't exclude the match — better to over-include than silently drop
    someone who just didn't fill in a city."""
    if not a or not b:
        return True
    a, b = a.strip().lower(), b.strip().lower()
    return a in b or b in a


def _notify_matching_artisans(job):
    """Best-effort email to every available artisan whose trade/city match
    this new request — never raises into the request-creation path, same
    "email failures print, don't crash" pattern as auth.py's password-reset
    flow. A missed notification just means that artisan finds the job in
    their pool a little later instead of getting pinged for it; a request
    that failed to SAVE because an email provider hiccuped would be worse."""
    candidates = Artisan.query.filter(
        Artisan.password_hash.isnot(None),
        Artisan.is_available.is_(True),
        func.lower(Artisan.trade) == job.trade.lower(),
    ).all()
    matches = [a for a in candidates if _city_matches(a.city, job.city)]

    for artisan in matches:
        if not artisan.email:
            continue
        try:
            send_email(
                artisan.email,
                f"New {job.trade} job request near {job.city or 'you'}",
                f"""
                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:8px;">
                  <p style="font-weight:800;letter-spacing:0.02em;color:#111;margin:0 0 24px;">NOVIQ</p>
                  <h2 style="color:#111;margin:0 0 12px;">New {job.trade} request</h2>
                  <p style="color:#444;line-height:1.6;margin:0 0 4px;"><b>Location:</b> {job.city or 'Not specified'}</p>
                  <p style="color:#444;line-height:1.6;margin:0 0 16px;">{job.description}</p>
                  <p style="color:#888;font-size:12.5px;line-height:1.5;">Sign in to your artisan dashboard to accept this job before someone else does.</p>
                </div>
                """,
            )
        except Exception as exc:
            print(f"⚠️ Could not notify artisan {artisan.id} ({artisan.email}) of job request {job.id}: {exc}")


@requests_bp.route("", methods=["POST"])
@limiter.limit("10 per hour")
def create_request():
    body = request.get_json(force=True) or {}
    trade = (body.get("trade") or "").strip()
    description = (body.get("description") or "").strip()
    contact_name = (body.get("contact_name") or "").strip()
    contact_phone = (body.get("contact_phone") or "").strip()

    if not (trade and description and contact_name and contact_phone):
        raise APIError("trade, description, contact_name and contact_phone are required", 400)
    if len(description) > 1000:
        raise APIError("description must be 1000 characters or fewer", 400)

    user_id, guest_id = get_scope(request)
    if not user_id and not guest_id:
        raise APIError("Missing guest or user identity", 400)

    job = JobRequest(
        guest_id=guest_id if not user_id else None,
        user_id=user_id,
        trade=trade,
        city=(body.get("city") or "").strip() or None,
        description=description,
        contact_name=contact_name,
        contact_phone=contact_phone,
        contact_email=(body.get("contact_email") or "").strip() or None,
    )
    db.session.add(job)
    db.session.commit()

    _notify_matching_artisans(job)

    return jsonify({"success": True, "data": job.to_dict()}), 201


@requests_bp.route("/mine", methods=["GET"])
def my_requests():
    user_id, guest_id = get_scope(request)
    q = JobRequest.query
    if user_id:
        q = q.filter_by(user_id=user_id)
    elif guest_id:
        q = q.filter_by(guest_id=guest_id)
    else:
        return jsonify({"success": True, "data": []}), 200
    items = q.order_by(JobRequest.created_at.desc()).all()
    return jsonify({"success": True, "data": [j.to_dict() for j in items]}), 200


@requests_bp.route("/<request_id>/cancel", methods=["POST"])
def cancel_request(request_id):
    job = db.session.get(JobRequest, request_id)
    if not job:
        raise APIError("Request not found", 404)

    user_id, guest_id = get_scope(request)
    owns_it = (user_id and job.user_id == user_id) or (guest_id and job.guest_id == guest_id)
    if not owns_it:
        raise APIError("Not authorized to cancel this request", 403)
    if job.status not in ("requested", "accepted"):
        raise APIError(f"Cannot cancel a request that's already {job.status}", 400)

    job.status = "cancelled"
    db.session.commit()
    return jsonify({"success": True, "data": job.to_dict()}), 200


@requests_bp.route("/pool", methods=["GET"])
def pool():
    """Open requests this signed-in artisan could accept — their own
    trade, matching city, still unclaimed. Requires availability to be on;
    an artisan who's toggled themselves Off sees an empty pool, same as if
    they weren't in it at all."""
    artisan_id = require_artisan_scope(request)
    artisan = db.session.get(Artisan, artisan_id)
    if not artisan:
        raise APIError("Artisan account not found", 404)
    if not artisan.is_available:
        return jsonify({"success": True, "data": []}), 200

    candidates = (
        JobRequest.query
        .filter(JobRequest.status == "requested", func.lower(JobRequest.trade) == artisan.trade.lower())
        .order_by(JobRequest.created_at.desc())
        .all()
    )
    items = [j for j in candidates if _city_matches(artisan.city, j.city)]
    return jsonify({"success": True, "data": [j.to_dict() for j in items]}), 200


@requests_bp.route("/accepted", methods=["GET"])
def accepted_by_me():
    """This artisan's own accepted/completed job history — the dashboard's
    second list, distinct from the open pool above."""
    artisan_id = require_artisan_scope(request)
    items = (
        JobRequest.query
        .filter(JobRequest.artisan_id == artisan_id, JobRequest.status.in_(["accepted", "completed"]))
        .order_by(JobRequest.accepted_at.desc())
        .all()
    )
    return jsonify({"success": True, "data": [j.to_dict() for j in items]}), 200


@requests_bp.route("/<request_id>/accept", methods=["POST"])
def accept_request(request_id):
    artisan_id = require_artisan_scope(request)
    artisan = db.session.get(Artisan, artisan_id)
    if not artisan:
        raise APIError("Artisan account not found", 404)

    # A single conditional UPDATE, not read-then-write — two artisans
    # hitting Accept on the same request within milliseconds of each other
    # is exactly the race this guards against. Whichever request's UPDATE
    # commits first is the one that actually flips status; the loser's
    # WHERE clause matches zero rows and gets a clean "already taken"
    # instead of silently overwriting the winner's claim.
    result = db.session.execute(
        update(JobRequest)
        .where(JobRequest.id == request_id, JobRequest.status == "requested")
        .values(status="accepted", artisan_id=artisan_id, accepted_at=_utcnow())
    )
    db.session.commit()

    if result.rowcount == 0:
        job = db.session.get(JobRequest, request_id)
        if not job:
            raise APIError("Request not found", 404)
        raise APIError("This request was already accepted by someone else", 409)

    job = db.session.get(JobRequest, request_id)
    return jsonify({"success": True, "data": job.to_dict()}), 200


@requests_bp.route("/<request_id>/complete", methods=["POST"])
def complete_request(request_id):
    artisan_id = require_artisan_scope(request)
    job = db.session.get(JobRequest, request_id)
    if not job:
        raise APIError("Request not found", 404)
    if job.artisan_id != artisan_id:
        raise APIError("Not authorized to complete this request", 403)
    if job.status != "accepted":
        raise APIError(f"Cannot complete a request that's {job.status}", 400)

    job.status = "completed"
    job.completed_at = _utcnow()
    db.session.commit()
    return jsonify({"success": True, "data": job.to_dict()}), 200
