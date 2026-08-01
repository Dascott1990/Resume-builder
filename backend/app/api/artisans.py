"""app/api/artisans.py — artisan directory: CRUD + AI bio polish."""
import os
import requests
from flask import Blueprint, request, jsonify
from app import db
from app.models import Artisan
from app.middleware.error_handlers import APIError

artisans_bp = Blueprint("artisans", __name__)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"


def _clean_years_experience(raw):
    """
    Coerce the incoming years_experience value to an int or None.

    The frontend form always sends this as a string (React's onChange gives
    e.target.value as text), and it's frequently "" when left blank. Handing
    "" straight to an Integer column throws a raw DB error (e.g. Postgres:
    'invalid input syntax for type integer: ""'), which is the #1 cause of
    the generic "unexpected error occurred" response.
    """
    if raw in (None, ""):
        return None
    try:
        value = int(raw)
    except (TypeError, ValueError):
        raise APIError("years_experience must be a whole number", 400)
    if value < 0 or value > 100:
        raise APIError("years_experience must be between 0 and 100", 400)
    return value


def _polish_bio(trade, years_experience, notes):
    """Turn rough notes into a short, professional listing bio via Groq."""
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        raise APIError("GROQ_API_KEY not configured", 500)

    prompt = (
        f"Trade: {trade or 'not specified'}\n"
        f"Years of experience: {years_experience or 'not specified'}\n"
        f"Notes from the artisan: {notes or 'none provided'}\n\n"
        "Write a 2-sentence, industry-standard professional bio for this "
        "tradesperson's public directory listing. Confident and specific, "
        "no generic buzzwords, do not invent facts not given above."
    )
    try:
        res = requests.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": GROQ_MODEL, "max_tokens": 200, "temperature": 0.5,
                "messages": [
                    {"role": "system", "content": "You write concise, credible professional "
                     "bios for skilled tradespeople. Plain text only — no markdown, no quotes, "
                     "no preamble, just the bio."},
                    {"role": "user", "content": prompt},
                ],
            },
            timeout=30,
        )
        if not res.ok:
            raise APIError("AI bio generation failed", 502)
        return res.json()["choices"][0]["message"]["content"].strip()
    except requests.exceptions.Timeout:
        raise APIError("AI bio generation timed out", 504)
    except requests.exceptions.RequestException as e:
        raise APIError(f"Network error while calling AI: {e}", 502)


@artisans_bp.route("/polish", methods=["POST"])
def polish():
    """Stateless: rough notes in, a polished bio out. Doesn't save anything."""
    body = request.get_json(force=True) or {}
    bio = _polish_bio(body.get("trade"), body.get("years_experience"), body.get("notes"))
    return jsonify({"success": True, "data": {"bio": bio}}), 200


@artisans_bp.route("", methods=["POST"])
def create_artisan():
    body = request.get_json(force=True) or {}
    name, trade, phone = body.get("name"), body.get("trade"), body.get("phone")
    if not (name and trade and phone):
        raise APIError("name, trade and phone are required", 400)

    a = Artisan(
        name=name, trade=trade, phone=phone,
        city=body.get("city"), bio=body.get("bio"),
        years_experience=_clean_years_experience(body.get("years_experience")),
    )
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


@artisans_bp.route("/<artisan_id>", methods=["GET"])
def get_one(artisan_id):
    a = Artisan.query.get(artisan_id)
    if not a:
        raise APIError("Artisan not found", 404)
    return jsonify({"success": True, "data": a.to_dict()}), 200


@artisans_bp.route("/<artisan_id>", methods=["PATCH"])
def update_artisan(artisan_id):
    a = Artisan.query.get(artisan_id)
    if not a:
        raise APIError("Artisan not found", 404)
    body = request.get_json(force=True) or {}
    for field in ["name", "trade", "city", "phone", "bio"]:
        if field in body:
            setattr(a, field, body[field])
    if "years_experience" in body:
        a.years_experience = _clean_years_experience(body["years_experience"])
    db.session.commit()
    return jsonify({"success": True, "data": a.to_dict()}), 200


@artisans_bp.route("/<artisan_id>", methods=["DELETE"])
def delete_artisan(artisan_id):
    a = Artisan.query.get(artisan_id)
    if not a:
        raise APIError("Artisan not found", 404)
    db.session.delete(a)
    db.session.commit()
    return jsonify({"success": True}), 200