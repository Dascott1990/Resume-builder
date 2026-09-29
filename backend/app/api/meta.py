"""
app/api/meta.py
GET /api/v1/meta/location — best-effort visitor city/region/country from
their IP, for the landing page's location display (Noqeev isn't an
Ottawa-only product — the marketing copy shouldn't hardcode one city).

Public, no auth, no DB, no guest_id scoping — this is read-only, visitor-
agnostic infrastructure, not user data.
"""
from flask import Blueprint, request, jsonify
from app import limiter
from app.utils.geoip import client_ip, lookup_geo

meta_bp = Blueprint("meta", __name__)


@meta_bp.route("/location", methods=["GET"])
@limiter.limit("30 per minute")
def location():
    geo = lookup_geo(client_ip(request))
    return jsonify({"success": True, "data": geo or {}}), 200
