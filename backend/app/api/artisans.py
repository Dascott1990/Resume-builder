"""app/api/artisans.py — artisan directory: CRUD + AI bio polish."""
import os
import anthropic
import requests
from flask import Blueprint, request, jsonify
from sqlalchemy import func
from app import db
from app.models import Artisan, Review
from app.middleware.error_handlers import APIError

artisans_bp = Blueprint("artisans", __name__)

CLAUDE_MODEL = "claude-opus-5"
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


BIO_SYSTEM_PROMPT = (
    "You write concise, credible professional bios for skilled "
    "tradespeople. Plain text only — no markdown, no quotes, "
    "no preamble, just the bio."
)


def _bio_prompt(trade, years_experience, notes):
    return (
        f"Trade: {trade or 'not specified'}\n"
        f"Years of experience: {years_experience or 'not specified'}\n"
        f"Notes from the artisan: {notes or 'none provided'}\n\n"
        "Write a 2-sentence, industry-standard professional bio for this "
        "tradesperson's public directory listing. Confident and specific, "
        "no generic buzzwords, do not invent facts not given above."
    )


def _claude_bio(trade, years_experience, notes):
    """Turn rough notes into a short, professional listing bio via Claude."""
    api_key = os.environ.get("CLAUDE_API_KEY", "")
    if not api_key:
        raise APIError("CLAUDE_API_KEY not configured", 500)

    prompt = _bio_prompt(trade, years_experience, notes)
    client = anthropic.Anthropic(api_key=api_key)
    try:
        res = client.with_options(timeout=30).messages.create(
            model=CLAUDE_MODEL,
            max_tokens=200,
            output_config={"effort": "low"},
            system=BIO_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )

        if res.stop_reason == "refusal":
            raise APIError("AI bio generation failed", 502)

        text = next((b.text for b in res.content if b.type == "text"), None)
        if text is None:
            raise APIError("AI bio generation failed", 502)
        return text.strip()
    except anthropic.APITimeoutError:
        raise APIError("AI bio generation timed out", 504)
    except anthropic.APIStatusError:
        raise APIError("AI bio generation failed", 502)
    except anthropic.APIConnectionError as e:
        raise APIError(f"Network error while calling AI: {e}", 502)


def _groq_bio(trade, years_experience, notes):
    """Turn rough notes into a short, professional listing bio via Groq."""
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        raise APIError("GROQ_API_KEY not configured", 500)

    prompt = _bio_prompt(trade, years_experience, notes)
    try:
        res = requests.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": GROQ_MODEL, "max_tokens": 200, "temperature": 0.5,
                "messages": [
                    {"role": "system", "content": BIO_SYSTEM_PROMPT},
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


def _polish_bio(trade, years_experience, notes):
    """Polish a bio via Claude, falling back to Groq if Claude fails for any reason."""
    try:
        return _claude_bio(trade, years_experience, notes)
    except APIError as claude_err:
        print(f"⚠️ Claude bio generation failed, falling back to Groq: {claude_err}")
        try:
            return _groq_bio(trade, years_experience, notes)
        except APIError as groq_err:
            raise APIError(
                f"AI bio generation failed (Claude: {claude_err}; Groq: {groq_err})", 502
            )


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
        city=body.get("city"), email=body.get("email"), bio=body.get("bio"),
        years_experience=_clean_years_experience(body.get("years_experience")),
    )
    db.session.add(a)
    db.session.commit()
    return jsonify({"success": True, "data": a.to_dict()}), 201


def _clean_pagination(default_limit, max_limit):
    try:
        limit = int(request.args.get("limit", default_limit))
        offset = int(request.args.get("offset", 0))
    except (TypeError, ValueError):
        raise APIError("limit and offset must be whole numbers", 400)
    if limit < 1 or limit > max_limit:
        raise APIError(f"limit must be between 1 and {max_limit}", 400)
    if offset < 0:
        raise APIError("offset must be zero or greater", 400)
    return limit, offset


@artisans_bp.route("", methods=["GET"])
def browse():
    # Note on "has more" detection: the frontend's shared apiRequest() helper
    # auto-unwraps every response to just its "data" array, so an envelope-
    # level has_more flag would never actually reach the caller — the
    # frontend instead infers it from `page.length === limit` (a full page
    # back means there's probably another one), which needs nothing extra
    # from here. Keeping this endpoint's response shape identical to before
    # (just data) is what makes that unwrap safe.
    limit, offset = _clean_pagination(default_limit=50, max_limit=100)
    q = Artisan.query
    if trade := request.args.get("trade"):
        q = q.filter(Artisan.trade.ilike(f"%{trade}%"))
    if city := request.args.get("city"):
        q = q.filter(Artisan.city.ilike(f"%{city}%"))
    items = q.order_by(Artisan.created_at.desc()).offset(offset).limit(limit).all()
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
    for field in ["name", "trade", "city", "phone", "email", "bio"]:
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
    # SQLite (local dev) doesn't enforce the FK's ondelete=CASCADE, only
    # Postgres (prod) does — deleting reviews explicitly here means this
    # works the same way in both, instead of only failing in prod the
    # first time someone deletes a listing that has reviews.
    Review.query.filter_by(artisan_id=artisan_id).delete()
    db.session.delete(a)
    db.session.commit()
    return jsonify({"success": True}), 200


def _clean_stars(raw):
    try:
        value = int(raw)
    except (TypeError, ValueError):
        raise APIError("stars is required and must be a whole number from 1 to 5", 400)
    if value < 1 or value > 5:
        raise APIError("stars must be between 1 and 5", 400)
    return value


@artisans_bp.route("/<artisan_id>/reviews", methods=["POST"])
def create_review(artisan_id):
    a = Artisan.query.get(artisan_id)
    if not a:
        raise APIError("Artisan not found", 404)

    body = request.get_json(force=True) or {}
    stars = _clean_stars(body.get("stars"))
    comment = (body.get("comment") or "").strip() or None
    if comment and len(comment) > 280:
        raise APIError("comment must be 280 characters or fewer", 400)

    review = Review(artisan_id=artisan_id, stars=stars, comment=comment)
    db.session.add(review)
    db.session.flush()  # include the new row in the aggregate below

    count, avg = db.session.query(
        func.count(Review.id), func.avg(Review.stars)
    ).filter(Review.artisan_id == artisan_id).one()
    a.rating_count = count or 0
    a.rating_avg = round(float(avg), 2) if avg is not None else None

    db.session.commit()
    data = review.to_dict()
    data["rating_avg"] = a.rating_avg
    data["rating_count"] = a.rating_count
    return jsonify({"success": True, "data": data}), 201


@artisans_bp.route("/<artisan_id>/reviews", methods=["GET"])
def list_reviews(artisan_id):
    if not Artisan.query.get(artisan_id):
        raise APIError("Artisan not found", 404)
    limit, offset = _clean_pagination(default_limit=50, max_limit=100)
    items = (
        Review.query
        .filter_by(artisan_id=artisan_id)
        .order_by(Review.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return jsonify({"success": True, "data": [r.to_dict() for r in items]}), 200