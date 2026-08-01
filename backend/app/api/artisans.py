"""app/api/artisans.py — minimal artisan directory slice."""
from flask import Blueprint, request, jsonify
from app import db
from app.models import Artisan
from app.middleware.error_handlers import APIError

artisans_bp = Blueprint("artisans", __name__)


@artisans_bp.route("", methods=["POST"])
def list_yourself():
    body = request.get_json(force=True) or {}
    name, trade, phone = body.get("name"), body.get("trade"), body.get("phone")
    if not (name and trade and phone):
        raise APIError("name, trade and phone are required", 400)

    a = Artisan(name=name, trade=trade, phone=phone, city=body.get("city"))
    db.session.add(a)
    db.session.commit()
    return jsonify({"success": True, "data": a.to_dict()}), 201


@artisans_bp.route("", methods=["GET"])
def browse():
    q = Artisan.query
    if trade := request.args.get("trade"):
        q = q.filter(Artisan.trade.ilike(f"%{trade}%"))
    if city := request.args.get("city"):
        q = q.filter(Artisan.city.ilike(f"%{city}%"))
    items = q.order_by(Artisan.created_at.desc()).limit(50).all()
    return jsonify({"success": True, "data": [a.to_dict() for a in items]}), 200