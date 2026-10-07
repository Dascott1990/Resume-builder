"""
app/api/meta.py
GET /api/v1/meta/location — best-effort visitor city/region/country from
their IP, for the landing page's location display (Noqeev isn't an
Ottawa-only product — the marketing copy shouldn't hardcode one city).

POST /api/v1/meta/track-visit — records one real load of the root site
(see models.SiteVisit) for the admin panel's "Site visits" tab. Public,
no auth, no guest_id scoping — same "read-only, visitor-agnostic
infrastructure, not user data" shape as /location above.
"""
from flask import Blueprint, request, jsonify
from app import db, limiter
from app.models import SiteVisit
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
