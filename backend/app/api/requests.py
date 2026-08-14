"""
app/api/requests.py — the request/accept/decline flow behind "Request this
artisan": a customer targets one specific artisan from their profile; that
artisan alone can accept or decline. Not a broadcast — matching already
happened when the customer picked who to ask, so there's no pool of
candidates to filter, only one recipient per request.
"""
from datetime import datetime, timezone
import stripe
from flask import Blueprint, request, jsonify
from sqlalchemy import update
from app import db, limiter
from app.models import Artisan, JobRequest, Review
from app.middleware.error_handlers import APIError
from app.utils.auth import get_scope, get_artisan_scope, require_artisan_scope, require_customer_scope
from app.utils.mail import send_email
from app.utils.ratings import recompute_rating
from app.utils.stripe_client import stripe_configured, FRONTEND_URL

requests_bp = Blueprint("job_requests", __name__)


def _utcnow():
    # Naive UTC — matches every other timestamp column in this app (see
    # auth.py's own _utcnow for why: neither SQLite nor a plain Postgres
    # TIMESTAMP column round-trips tzinfo).
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _notify_target_artisan(job, artisan):
    """Best-effort email to the one artisan this request is addressed to —
    never raises into the request-creation path, same "email failures
    print, don't crash" pattern as auth.py's password-reset flow. A missed
    notification just means they find it in "Requests for you" a little
    later instead of getting pinged for it; a request that failed to SAVE
    because an email provider hiccuped would be worse."""
    if not artisan.email:
        return
    if artisan.notify_new_request is False:
        return
    try:
        send_email(
            artisan.email,
            f"New {job.trade} request from a customer",
            f"""
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:8px;">
              <p style="font-weight:800;letter-spacing:0.02em;color:#111;margin:0 0 24px;">NOVIQ</p>
              <h2 style="color:#111;margin:0 0 12px;">New job request</h2>
              <p style="color:#444;line-height:1.6;margin:0 0 4px;"><b>Location:</b> {job.city or 'Not specified'}</p>
              <p style="color:#444;line-height:1.6;margin:0 0 16px;">{job.description}</p>
              <p style="color:#888;font-size:12.5px;line-height:1.5;">Sign in to your artisan dashboard to accept or decline.</p>
            </div>
            """,
        )
    except Exception as exc:
        print(f"⚠️ Could not notify artisan {artisan.id} ({artisan.email}) of job request {job.id}: {exc}")


@requests_bp.route("", methods=["POST"])
@limiter.limit("10 per hour")
def create_request():
    body = request.get_json(force=True) or {}
    target_artisan_id = (body.get("artisan_id") or "").strip()
    description = (body.get("description") or "").strip()
    contact_name = (body.get("contact_name") or "").strip()
    contact_phone = (body.get("contact_phone") or "").strip()

    if not (target_artisan_id and description and contact_name and contact_phone):
        raise APIError("artisan_id, description, contact_name and contact_phone are required", 400)
    if len(description) > 1000:
        raise APIError("description must be 1000 characters or fewer", 400)

    # In whole cents, from the client — avoids float-cents rounding
    # ambiguity entirely rather than accepting dollars and multiplying
    # here. No price-negotiation flow exists yet (see JobRequest's own
    # model comment): the customer states what they're offering to pay,
    # and an artisan accepting the job is accepting that price.
    try:
        amount_cents = int(body.get("amount_cents"))
    except (TypeError, ValueError):
        raise APIError("amount_cents is required and must be a whole number of cents", 400)
    if amount_cents < 100 or amount_cents > 5_000_000:
        raise APIError("amount_cents must be between 100 ($1) and 5,000,000 ($50,000)", 400)

    target = db.session.get(Artisan, target_artisan_id)
    if not target:
        raise APIError("Artisan not found", 404)
    if not target.password_hash:
        raise APIError("This artisan hasn't set up an account to receive requests", 400)
    if not target.is_available:
        raise APIError("This artisan isn't accepting requests right now", 400)

    # Booking is one of the three actions this product explicitly requires
    # a real account for (see require_customer_scope's docstring) — unlike
    # nearly everything else in this app, X-Guest-Id alone doesn't count
    # here. Existing guest-scoped rows from before this shipped still work
    # fine for read/cancel/schedule (those stay on get_scope) — this only
    # tightens where NEW requests can come from.
    user_id = require_customer_scope(request)

    job = JobRequest(
        user_id=user_id,
        artisan_id=target.id,
        # Denormalized from the target at creation time — this was only
        # ever a broadcast-matching field; with a named target it's just
        # display data, so it's set from the artisan's own record, not
        # client input.
        trade=target.trade,
        city=(body.get("city") or "").strip() or None,
        description=description,
        contact_name=contact_name,
        contact_phone=contact_phone,
        contact_email=(body.get("contact_email") or "").strip() or None,
        amount_cents=amount_cents,
    )
    db.session.add(job)
    db.session.commit()

    _notify_target_artisan(job, target)

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

    # One cheap batch query for "has this job already been reviewed" rather
    # than N+1 — the frontend needs this to know whether to offer "Leave a
    # review" on a completed job (see MyRequestsPane.js).
    reviewed_ids = {
        row[0] for row in db.session.query(Review.job_request_id)
        .filter(Review.job_request_id.in_([j.id for j in items]))
        .all()
    } if items else set()

    data = []
    for j in items:
        d = j.to_dict()
        d["reviewed"] = j.id in reviewed_ids
        data.append(d)
    return jsonify({"success": True, "data": data}), 200


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

    # A customer's money can't get stuck just because the job fell
    # through after they'd already funded escrow — refund before marking
    # cancelled, not after, so a failed refund blocks the cancellation
    # instead of silently leaving payment_status wrong.
    if job.payment_status == "held" and job.stripe_payment_intent_id:
        stripe.Refund.create(payment_intent=job.stripe_payment_intent_id)
        job.payment_status = "refunded"

    job.status = "cancelled"
    db.session.commit()
    return jsonify({"success": True, "data": job.to_dict()}), 200


@requests_bp.route("/<request_id>/pay", methods=["POST"])
@limiter.limit("10 per hour")
def pay_for_request(request_id):
    """Funds escrow for an accepted job — creates a Stripe Checkout
    Session (a Stripe-hosted payment page) for the job's agreed amount.
    The charge lands on THIS platform's own Stripe balance, not the
    artisan's — that's what makes it escrow rather than an instant
    payout; see api/payments.py's module docstring for the full
    "separate charges and transfers" reasoning. payment_status only
    actually flips to "held" once the webhook confirms the Checkout
    Session completed, not here — this route just starts it."""
    if not stripe_configured():
        raise APIError("Payments aren't configured on this server yet.", 503)

    job = db.session.get(JobRequest, request_id)
    if not job:
        raise APIError("Request not found", 404)

    user_id = require_customer_scope(request)
    if job.user_id != user_id:
        raise APIError("Not authorized to pay for this request", 403)
    if job.status != "accepted":
        raise APIError("Can only fund escrow once the job's been accepted", 400)
    if job.payment_status != "unpaid":
        raise APIError(f"This job's payment is already {job.payment_status}", 400)
    if not job.amount_cents:
        raise APIError("This job has no agreed amount to pay", 400)

    artisan = db.session.get(Artisan, job.artisan_id) if job.artisan_id else None
    session = stripe.checkout.Session.create(
        mode="payment",
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "usd",
                "unit_amount": job.amount_cents,
                "product_data": {
                    "name": f"{job.trade} — {artisan.name if artisan else 'Artisan'}",
                    "description": job.description[:500],
                },
            },
            "quantity": 1,
        }],
        # Read back by the webhook (checkout.session.completed) to know
        # which JobRequest this payment belongs to.
        metadata={"job_request_id": job.id},
        success_url=f"{FRONTEND_URL}?payment=success",
        cancel_url=f"{FRONTEND_URL}?payment=cancelled",
    )
    job.stripe_checkout_session_id = session.id
    db.session.commit()
    return jsonify({"success": True, "data": {"checkout_url": session.url}}), 200


@requests_bp.route("/<request_id>/release-payment", methods=["POST"])
@limiter.limit("10 per hour")
def release_payment(request_id):
    """The customer's explicit "I'm satisfied, pay the artisan" action —
    deliberately separate from the artisan's own complete_request above,
    not automatic the moment a job's marked complete. Standard escrow
    safeguard: an artisan marking their own job done shouldn't be what
    moves money, only the customer confirming it should."""
    if not stripe_configured():
        raise APIError("Payments aren't configured on this server yet.", 503)

    job = db.session.get(JobRequest, request_id)
    if not job:
        raise APIError("Request not found", 404)

    user_id = require_customer_scope(request)
    if job.user_id != user_id:
        raise APIError("Not authorized to release payment for this request", 403)
    if job.status != "completed":
        raise APIError("Can only release payment once the job's marked complete", 400)
    if job.payment_status != "held":
        raise APIError(f"This job's payment is {job.payment_status}, not held", 400)

    artisan = db.session.get(Artisan, job.artisan_id) if job.artisan_id else None
    if not artisan or not artisan.stripe_account_id or not artisan.stripe_payouts_enabled:
        raise APIError("This artisan hasn't finished payout setup yet — try again once they have.", 400)

    transfer = stripe.Transfer.create(
        amount=job.amount_cents,  # full amount — no platform fee for now
        currency="usd",
        destination=artisan.stripe_account_id,
        transfer_group=job.id,
    )
    job.payment_status = "released"
    job.stripe_transfer_id = transfer.id
    db.session.commit()
    return jsonify({"success": True, "data": job.to_dict()}), 200


@requests_bp.route("/pool", methods=["GET"])
def pool():
    """"Requests for you" — pending requests addressed to this artisan
    specifically. No trade/city matching needed here anymore: matching
    already happened when the customer picked this artisan by name (see
    create_request). Availability does NOT gate this list — it only gates
    whether NEW requests can be created targeting this artisan; a request
    already sent stays visible/actionable even if they later toggle
    themselves off, same as a real inbox."""
    artisan_id = require_artisan_scope(request)
    items = (
        JobRequest.query
        .filter(JobRequest.artisan_id == artisan_id, JobRequest.status == "requested")
        .order_by(JobRequest.created_at.desc())
        .all()
    )
    return jsonify({"success": True, "data": [j.to_dict() for j in items]}), 200


@requests_bp.route("/<request_id>/decline", methods=["POST"])
def decline_request(request_id):
    artisan_id = require_artisan_scope(request)
    job = db.session.get(JobRequest, request_id)
    if not job:
        raise APIError("Request not found", 404)
    if job.artisan_id != artisan_id:
        raise APIError("Not authorized to decline this request", 403)
    if job.status != "requested":
        raise APIError(f"Cannot decline a request that's already {job.status}", 400)

    job.status = "declined"
    db.session.commit()
    return jsonify({"success": True, "data": job.to_dict()}), 200


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

    # A single conditional UPDATE, not read-then-write — protects against a
    # double-tap (two Accept clicks in quick succession) resolving twice.
    # artisan_id is now part of the WHERE too: a request is addressed to
    # one artisan from creation (see create_request), so no other artisan's
    # id should ever match here — this just makes that invariant explicit
    # rather than trusting it silently.
    result = db.session.execute(
        update(JobRequest)
        .where(JobRequest.id == request_id, JobRequest.artisan_id == artisan_id, JobRequest.status == "requested")
        .values(status="accepted", accepted_at=_utcnow())
    )
    db.session.commit()

    if result.rowcount == 0:
        job = db.session.get(JobRequest, request_id)
        if not job:
            raise APIError("Request not found", 404)
        if job.artisan_id != artisan_id:
            raise APIError("Not authorized to accept this request", 403)
        raise APIError(f"Cannot accept a request that's already {job.status}", 409)

    job = db.session.get(JobRequest, request_id)
    return jsonify({"success": True, "data": job.to_dict()}), 200


def _job_side(job, request):
    """(is_customer, is_artisan) for whoever's calling — either can be True
    for a given caller, never both. Shared by propose/confirm-time so both
    routes check authorization identically."""
    user_id, guest_id = get_scope(request)
    artisan_id = get_artisan_scope(request)
    is_customer = bool((user_id and job.user_id == user_id) or (guest_id and job.guest_id == guest_id))
    is_artisan = bool(artisan_id and job.artisan_id == artisan_id)
    return is_customer, is_artisan


@requests_bp.route("/<request_id>/propose-time", methods=["POST"])
def propose_time(request_id):
    job = db.session.get(JobRequest, request_id)
    if not job:
        raise APIError("Request not found", 404)
    if job.status != "accepted":
        raise APIError("Can only schedule a time once the job's been accepted", 400)

    is_customer, is_artisan = _job_side(job, request)
    if not (is_customer or is_artisan):
        raise APIError("Not authorized to schedule this job", 403)

    body = request.get_json(force=True) or {}
    raw = body.get("scheduled_at")
    if not raw:
        raise APIError("scheduled_at is required", 400)
    try:
        scheduled_at = datetime.fromisoformat(raw)
    except ValueError:
        raise APIError("scheduled_at must be a valid ISO datetime", 400)

    # Strip any timezone offset the client sent — this app stores every
    # timestamp naive-UTC (see _utcnow's own reasoning above); a bare
    # datetime-local input from the frontend has no offset anyway, but a
    # defensive strip here means a stray offset never round-trips wrong.
    job.scheduled_at = scheduled_at.replace(tzinfo=None)
    job.scheduled_proposed_by = "artisan" if is_artisan else "customer"
    job.scheduled_confirmed = False
    db.session.commit()
    return jsonify({"success": True, "data": job.to_dict()}), 200


@requests_bp.route("/<request_id>/confirm-time", methods=["POST"])
def confirm_time(request_id):
    job = db.session.get(JobRequest, request_id)
    if not job:
        raise APIError("Request not found", 404)
    if not job.scheduled_at or job.scheduled_confirmed:
        raise APIError("Nothing to confirm", 400)

    is_customer, is_artisan = _job_side(job, request)
    if not (is_customer or is_artisan):
        raise APIError("Not authorized to confirm this job's schedule", 403)

    # Only the side that DIDN'T propose can confirm — a propose/confirm
    # pair only means something if it takes two sides, not the same person
    # rubber-stamping their own proposal.
    proposer_is_artisan = job.scheduled_proposed_by == "artisan"
    if (proposer_is_artisan and is_artisan) or (not proposer_is_artisan and is_customer):
        raise APIError("Waiting on the other side to confirm this time", 400)

    job.scheduled_confirmed = True
    db.session.commit()
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

    data = job.to_dict()
    # Non-blocking — plenty of real jobs just get done without a formal
    # scheduled/confirmed time on record; this is a caution for the UI to
    # surface, not a reason to refuse marking the work as finished.
    if not job.scheduled_confirmed:
        data["warning"] = "Marked complete without a confirmed schedule."
    return jsonify({"success": True, "data": data}), 200


@requests_bp.route("/<request_id>/review", methods=["POST"])
def review_request(request_id):
    """The job-gated review path — additive to the free-floating one at
    POST /api/v1/artisans/<id>/reviews (see that route's own docstring
    context), not a replacement for it. Only the job's own customer, only
    once it's completed, only once per job."""
    job = db.session.get(JobRequest, request_id)
    if not job:
        raise APIError("Request not found", 404)
    if job.status != "completed":
        raise APIError("Can only review a completed job", 400)
    if not job.artisan_id:
        raise APIError("This job has no artisan to review", 400)

    user_id = require_customer_scope(request)
    if job.user_id != user_id:
        raise APIError("Not authorized to review this job", 403)
    if Review.query.filter_by(job_request_id=request_id).first():
        raise APIError("This job has already been reviewed", 409)

    body = request.get_json(force=True) or {}
    try:
        stars = int(body.get("stars"))
    except (TypeError, ValueError):
        raise APIError("stars is required and must be a whole number from 1 to 5", 400)
    if stars < 1 or stars > 5:
        raise APIError("stars must be between 1 and 5", 400)
    comment = (body.get("comment") or "").strip() or None
    if comment and len(comment) > 280:
        raise APIError("comment must be 280 characters or fewer", 400)

    review = Review(artisan_id=job.artisan_id, job_request_id=request_id, verified=True, stars=stars, comment=comment)
    db.session.add(review)
    db.session.flush()
    artisan = recompute_rating(job.artisan_id)
    db.session.commit()

    data = review.to_dict()
    data["rating_avg"] = artisan.rating_avg if artisan else None
    data["rating_count"] = artisan.rating_count if artisan else None
    return jsonify({"success": True, "data": data}), 201
