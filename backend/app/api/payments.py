"""
app/api/payments.py — Stripe Connect account onboarding for artisans, and
the webhook that keeps payout/escrow state in sync with what actually
happened on Stripe's side. The job-request-specific payment ACTIONS (fund
escrow, release to the artisan) live in api/requests.py instead, alongside
the rest of that lifecycle — this file is specifically the "artisan payout
account" and "Stripe told us something happened" concerns.

Architecture: "separate charges and transfers," not destination charges.
The customer's card is charged straight to THIS platform's own Stripe
balance (via a Checkout Session created in api/requests.py's /pay) — that
charge landing on the platform's balance, not yet transferred anywhere,
IS the escrow. Only once the customer explicitly releases it (see
/release-payment) does a separate Transfer move the funds to the
artisan's connected account. This needs each artisan to have a Stripe
Express account capable of receiving a Transfer — that's what onboarding
here sets up. See the model comments on Artisan.stripe_account_id /
JobRequest.payment_status for the full field-level picture.
"""
import stripe
from flask import Blueprint, request, jsonify
from app import db, limiter
from app.models import Artisan, JobRequest
from app.middleware.error_handlers import APIError
from app.utils.auth import require_artisan_scope
from app.utils.stripe_client import stripe_configured, STRIPE_WEBHOOK_SECRET, FRONTEND_URL

payments_bp = Blueprint("payments", __name__)


def _require_stripe():
    if not stripe_configured():
        raise APIError("Payments aren't configured on this server yet.", 503)


@payments_bp.route("/connect/onboard", methods=["POST"])
@limiter.limit("10 per hour")
def connect_onboard():
    """Creates this artisan's Stripe Express account on first call, then
    always returns a fresh onboarding link — Account Links expire quickly
    and are meant to be single-use, so re-calling this (e.g. they closed
    the tab partway through Stripe's flow) is the normal, expected way to
    pick onboarding back up, not an error case.

    Only requests the `transfers` capability, not `card_payments` — this
    platform charges the customer on its OWN Stripe account (see
    api/requests.py's /pay) and only ever Transfers to the artisan, so
    that's the one capability an artisan's connected account actually
    needs; requesting more would mean more onboarding requirements for
    them with no corresponding use.
    """
    _require_stripe()
    artisan_id = require_artisan_scope(request)
    artisan = db.session.get(Artisan, artisan_id)
    if not artisan:
        raise APIError("Artisan account not found", 404)

    if not artisan.stripe_account_id:
        account = stripe.Account.create(
            type="express",
            email=artisan.email or None,
            capabilities={"transfers": {"requested": True}},
        )
        artisan.stripe_account_id = account.id
        db.session.commit()

    # Round-tripping through the frontend's own root URL, not a dedicated
    # "onboarding complete" page this app doesn't have real routes for —
    # this SPA already restores whichever screen was last open (see
    # app/page.js's view persistence), so an artisan who was on their
    # dashboard before leaving for Stripe lands right back on it.
    link = stripe.AccountLink.create(
        account=artisan.stripe_account_id,
        refresh_url=FRONTEND_URL,
        return_url=FRONTEND_URL,
        type="account_onboarding",
    )
    return jsonify({"success": True, "data": {"url": link.url}}), 200


@payments_bp.route("/connect/status", methods=["GET"])
def connect_status():
    """Whether this artisan can actually receive a Transfer yet. Prefers
    the cached flag (kept fresh by the account.updated webhook below), but
    falls back to a live Stripe lookup when it's not yet true — a missed
    or delayed webhook shouldn't be able to strand someone on "not ready"
    after they've genuinely finished Stripe's own onboarding."""
    _require_stripe()
    artisan_id = require_artisan_scope(request)
    artisan = db.session.get(Artisan, artisan_id)
    if not artisan:
        raise APIError("Artisan account not found", 404)

    if not artisan.stripe_account_id:
        return jsonify({"success": True, "data": {"payouts_enabled": False, "onboarding_started": False}}), 200

    if not artisan.stripe_payouts_enabled:
        account = stripe.Account.retrieve(artisan.stripe_account_id)
        if bool(account.payouts_enabled) != bool(artisan.stripe_payouts_enabled):
            artisan.stripe_payouts_enabled = bool(account.payouts_enabled)
            db.session.commit()

    return jsonify({"success": True, "data": {
        "payouts_enabled": bool(artisan.stripe_payouts_enabled),
        "onboarding_started": True,
    }}), 200


@payments_bp.route("/webhook", methods=["POST"])
@limiter.limit("1000 per hour")
def webhook():
    """No auth — Stripe calls this directly. Every event is signature-
    verified against STRIPE_WEBHOOK_SECRET (from this endpoint's own
    config in the Stripe dashboard) before anything in it is trusted;
    anything that doesn't verify is rejected outright, same as it never
    arrived."""
    if not STRIPE_WEBHOOK_SECRET:
        raise APIError("Webhook not configured", 503)

    payload = request.get_data()
    sig_header = request.headers.get("Stripe-Signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.SignatureVerificationError):
        raise APIError("Invalid signature", 400)

    obj = event["data"]["object"]

    if event["type"] == "checkout.session.completed":
        job_id = (obj.get("metadata") or {}).get("job_request_id")
        job = db.session.get(JobRequest, job_id) if job_id else None
        # Idempotent on purpose — Stripe can and does redeliver the same
        # event; only the first delivery should actually move the job
        # from unpaid to held.
        if job and job.payment_status == "unpaid":
            job.payment_status = "held"
            job.stripe_payment_intent_id = obj.get("payment_intent")
            db.session.commit()

    elif event["type"] == "account.updated":
        artisan = Artisan.query.filter_by(stripe_account_id=obj.get("id")).first()
        if artisan:
            artisan.stripe_payouts_enabled = bool(obj.get("payouts_enabled"))
            db.session.commit()

    elif event["type"] == "charge.refunded":
        payment_intent_id = obj.get("payment_intent")
        job = JobRequest.query.filter_by(stripe_payment_intent_id=payment_intent_id).first() if payment_intent_id else None
        # Covers a refund issued directly in Stripe's dashboard (e.g. an
        # admin resolving a dispute) — a refund THIS app initiates (see
        # requests.py's cancel_request) already sets payment_status
        # synchronously and doesn't need to wait on this event at all;
        # this is purely a safety net for the out-of-band case.
        if job and job.payment_status == "held":
            job.payment_status = "refunded"
            db.session.commit()

    return jsonify({"success": True}), 200
