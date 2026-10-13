"""
app/api/meta.py
GET /api/v1/meta/location — best-effort visitor city/region/country from
their IP, for the landing page's location display (Noqeev isn't an
Ottawa-only product — the marketing copy shouldn't hardcode one city).

POST /api/v1/meta/track-visit — records one real load of the root site
(see models.SiteVisit) for the admin panel's "Site visits" tab. Public,
no auth, no guest_id scoping — same "read-only, visitor-agnostic
infrastructure, not user data" shape as /location above.

POST /api/v1/meta/track-event — same shape as track-visit, for the
landing page's signup/demo funnel (see models.FunnelEvent). event must be
one of models.FUNNEL_EVENTS.
"""
from flask import Blueprint, request, jsonify
from app import db, limiter
from app.models import SiteVisit, FunnelEvent, FUNNEL_EVENTS
from app.utils.geoip import client_ip, lookup_geo

meta_bp = Blueprint("meta", __name__)


@meta_bp.route("/location", methods=["GET"])
@limiter.limit("30 per minute")
def location():
    geo = lookup_geo(client_ip(request))
    return jsonify({"success": True, "data": geo or {}}), 200


@meta_bp.route("/track-visit", methods=["POST"])
@limiter.limit("10 per minute")
def track_visit():
    db.session.add(SiteVisit())
    db.session.commit()
    return jsonify({"success": True}), 201


# POST /api/v1/meta/track-event — same public/no-auth/fire-and-forget shape
# as track-visit above, for the landing page's funnel (signup started/
# completed, demo used). event must be one of FUNNEL_EVENTS — never stores
# an arbitrary string, so this can't become a general-purpose junk-data sink.
@meta_bp.route("/track-event", methods=["POST"])
@limiter.limit("20 per minute")
def track_event():
    body = request.get_json(silent=True) or {}
    event = (body.get("event") or "").strip()
    if event not in FUNNEL_EVENTS:
        return jsonify({"success": False, "error": "Unknown event"}), 400
    db.session.add(FunnelEvent(event=event))
    db.session.commit()
    return jsonify({"success": True}), 201
