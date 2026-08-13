"""app/api/artisans.py — artisan directory: CRUD + AI bio polish + accounts."""
import os
import re
import io
import secrets
import anthropic
import requests
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import func
from app import db, limiter
from flask_limiter.util import get_remote_address
from app.models import Artisan, ArtisanPhoto, Review
from app.middleware.error_handlers import APIError
from app.utils.auth import get_admin_user, require_artisan_scope, hash_password, verify_password, issue_token
from app.utils.geocoding import geocode_city, haversine_km
from app.utils.ratings import recompute_rating

artisans_bp = Blueprint("artisans", __name__)
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _authorize_edit(a):
    """Who's allowed to PATCH/DELETE this listing: an admin, always — or
    whoever's holding the edit_token handed back when it was created. A
    NULL edit_token means this row predates the token system entirely and
    stays open (there was never a secret to check it against), rather than
    silently locking out whoever originally listed themselves."""
    if get_admin_user(request):
        return
    if not a.edit_token:
        return
    provided = request.headers.get("X-Edit-Token") or (request.get_json(silent=True) or {}).get("edit_token")
    if provided != a.edit_token:
        raise APIError("Not authorized to edit this listing", 403)


def _apply_geocode(a, city):
    """Best-effort geocode on save — called from every path that sets/changes
    an artisan's city (create_artisan, artisan_signup, update_artisan).
    Never blocks the save on failure: geocode_city() already swallows its
    own errors, so a bad network call or an unresolvable city just leaves
    lat/lng/geocoded_city NULL, exactly like a listing that never set a
    city at all — browse's near-me sort already treats that as append-at-
    the-end, not reject-the-save.
    """
    if not city:
        return
    result = geocode_city(city)
    if result:
        a.lat, a.lng, a.geocoded_city = result

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


def _clean_emoji(raw):
    """avatar_emoji is a String(16) column, otherwise-unvalidated free text
    from the client — cheap insurance against a raw DB error for a purely
    cosmetic field, same helper as auth.py's."""
    if not raw:
        return None
    cleaned = str(raw).strip()[:16]
    return cleaned or None


def _apply_profile_fields(a, body):
    """The actual field-assignment logic behind editing an artisan's own
    listing — shared by update_artisan (authorized via the anonymous
    edit_token) and artisan_update_me (authorized via the artisan's own
    session token, see PATCH /me below). Same fields, same geocode-on-
    city-change behavior, regardless of which door was used to get here."""
    city_changed = "city" in body and body["city"] != a.city
    for field in ["name", "trade", "city", "phone", "email", "bio"]:
        if field in body:
            setattr(a, field, body[field])
    if "years_experience" in body:
        a.years_experience = _clean_years_experience(body["years_experience"])
    if "avatar_emoji" in body:
        a.avatar_emoji = _clean_emoji(body["avatar_emoji"])
    if "notify_new_request" in body:
        a.notify_new_request = bool(body["notify_new_request"])
    if "notify_new_message" in body:
        a.notify_new_message = bool(body["notify_new_message"])
    if city_changed:
        _apply_geocode(a, a.city)


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
@limiter.limit("15 per hour")
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

    token = secrets.token_urlsafe(24)
    a = Artisan(
        name=name, trade=trade, phone=phone,
        city=body.get("city"), email=body.get("email"), bio=body.get("bio"),
        years_experience=_clean_years_experience(body.get("years_experience")),
        edit_token=token,
    )
    _apply_geocode(a, body.get("city"))
    db.session.add(a)
    db.session.commit()
    # edit_token only ever appears in THIS response — to_dict() (used by
    # every other route that returns an artisan) never includes it, so
    # there's no later request where it could leak to anyone but the
    # person who just created the listing.
    return jsonify({"success": True, "data": {**a.to_dict(), "edit_token": token}}), 201


@artisans_bp.route("/signup", methods=["POST"])
@limiter.limit("8 per hour")
def artisan_signup():
    """Creates a real artisan ACCOUNT — separate from the plain anonymous
    "list yourself" flow above (POST ""), which is untouched by this and
    keeps working exactly as it did. An account is what lets an artisan
    sign in to accept job requests (see api/requests.py); the anonymous
    listing has no need for either an email or a password. Deliberately no
    email-verification step here (unlike User signup) — the goal is a
    tradesperson can sign up and start receiving job leads in one step;
    the request/accept flow itself is the real proof this account is
    theirs, not an unclickable inbox link."""
    body = request.get_json(force=True) or {}
    name, trade, phone = body.get("name"), body.get("trade"), body.get("phone")
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not (name and trade and phone):
        raise APIError("name, trade and phone are required", 400)
    if not EMAIL_RE.match(email):
        raise APIError("Enter a valid email address", 400)
    if len(password) < 8:
        raise APIError("Password must be at least 8 characters", 400)
    if Artisan.query.filter(Artisan.email == email, Artisan.password_hash.isnot(None)).first():
        raise APIError("An artisan account with that email already exists", 409)

    a = Artisan(
        name=name, trade=trade, phone=phone, email=email,
        city=body.get("city"), bio=body.get("bio"),
        years_experience=_clean_years_experience(body.get("years_experience")),
        edit_token=secrets.token_urlsafe(24),
        password_hash=hash_password(password),
        is_available=False,
    )
    _apply_geocode(a, body.get("city"))
    db.session.add(a)
    db.session.commit()
    return jsonify({"success": True, "data": {"artisan": a.to_dict(), "token": issue_token(a.id, role="artisan")}}), 201


@artisans_bp.route("/login", methods=["POST"])
@limiter.limit("10 per minute")
def artisan_login():
    body = request.get_json(force=True) or {}
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    a = Artisan.query.filter(Artisan.email == email, Artisan.password_hash.isnot(None)).first()
    # Same message either way — confirming "no account with that email" is
    # a free enumeration oracle, same reasoning as the User login route.
    if not a or not verify_password(password, a.password_hash):
        raise APIError("Incorrect email or password", 401)

    return jsonify({"success": True, "data": {"artisan": a.to_dict(), "token": issue_token(a.id, role="artisan")}}), 200


@artisans_bp.route("/me", methods=["GET"])
def artisan_me():
    artisan_id = require_artisan_scope(request)
    a = db.session.get(Artisan, artisan_id)
    if not a:
        raise APIError("Artisan account not found", 404)
    return jsonify({"success": True, "data": a.to_dict()}), 200


@artisans_bp.route("/me/availability", methods=["PATCH"])
def artisan_set_availability():
    """The one on/off switch that decides whether this artisan shows up in
    anyone's request pool at all — see api/requests.py's matching query.
    Off by default from signup (see artisan_signup) and after every login
    is unaffected by this (availability persists across sessions; someone
    who was On yesterday is still On until they explicitly flip it)."""
    artisan_id = require_artisan_scope(request)
    a = db.session.get(Artisan, artisan_id)
    if not a:
        raise APIError("Artisan account not found", 404)
    body = request.get_json(force=True) or {}
    if "is_available" not in body:
        raise APIError("is_available is required", 400)
    a.is_available = bool(body["is_available"])
    db.session.commit()
    return jsonify({"success": True, "data": a.to_dict()}), 200


@artisans_bp.route("/me", methods=["PATCH"])
def artisan_update_me():
    """The fix for a real gap: an artisan signed in normally (via this
    session token) previously had no way to edit their own name/trade/
    city/phone/bio at all — only the anonymous edit_token flow could
    (see _authorize_edit/update_artisan), and a real signed-up artisan is
    never handed that token. Same field logic either door uses — see
    _apply_profile_fields."""
    artisan_id = require_artisan_scope(request)
    a = db.session.get(Artisan, artisan_id)
    if not a:
        raise APIError("Artisan account not found", 404)
    body = request.get_json(force=True) or {}
    _apply_profile_fields(a, body)
    db.session.commit()
    return jsonify({"success": True, "data": a.to_dict()}), 200


@artisans_bp.route("/me/change-password", methods=["POST"])
@limiter.limit("10 per hour")
def artisan_change_password():
    artisan_id = require_artisan_scope(request)
    a = db.session.get(Artisan, artisan_id)
    if not a:
        raise APIError("Artisan account not found", 404)

    body = request.get_json(force=True) or {}
    current_password = body.get("current_password") or ""
    new_password = body.get("new_password") or ""

    if not verify_password(current_password, a.password_hash):
        raise APIError("Current password is incorrect", 400)
    if len(new_password) < 8:
        raise APIError("New password must be at least 8 characters", 400)

    a.password_hash = hash_password(new_password)
    db.session.commit()
    return jsonify({"success": True, "data": {"message": "Password updated"}}), 200


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

    near_lat, near_lng = request.args.get("near_lat"), request.args.get("near_lng")
    if near_lat and near_lng:
        try:
            near_lat, near_lng = float(near_lat), float(near_lng)
            radius_km = float(request.args.get("radius_km", 50))
        except (TypeError, ValueError):
            raise APIError("near_lat, near_lng and radius_km must be numbers", 400)

        # Distance sort can't be pushed down to SQL (Postgres has no built-in
        # great-circle distance without PostGIS, which this app doesn't run),
        # so pull the trade/city-filtered set into Python and sort there.
        # Fine at this app's actual scale; revisit only if a single
        # trade/city ever has thousands of rows.
        with_dist, without_dist = [], []
        for a in q.all():
            if a.lat is not None and a.lng is not None:
                dist = haversine_km(near_lat, near_lng, a.lat, a.lng)
                if dist <= radius_km:
                    with_dist.append((dist, a))
            else:
                without_dist.append(a)
        with_dist.sort(key=lambda pair: pair[0])
        # Not-yet-geocoded listings are appended, not hidden — "near me"
        # shouldn't make a real, available artisan invisible just because
        # their city string hasn't resolved to coordinates yet.
        page = (with_dist + [(None, a) for a in without_dist])[offset:offset + limit]
        data = []
        for dist, a in page:
            d = a.to_dict()
            if dist is not None:
                d["distance_km"] = round(dist, 1)
            data.append(d)
        return jsonify({"success": True, "data": data}), 200

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
    _authorize_edit(a)
    body = request.get_json(force=True) or {}
    _apply_profile_fields(a, body)
    db.session.commit()
    return jsonify({"success": True, "data": a.to_dict()}), 200


@artisans_bp.route("/<artisan_id>", methods=["DELETE"])
def delete_artisan(artisan_id):
    a = Artisan.query.get(artisan_id)
    if not a:
        raise APIError("Artisan not found", 404)
    _authorize_edit(a)
    # SQLite (local dev) doesn't enforce the FK's ondelete=CASCADE, only
    # Postgres (prod) does — deleting reviews/photos explicitly here means
    # this works the same way in both, instead of only failing in prod the
    # first time someone deletes a listing that has reviews or photos.
    Review.query.filter_by(artisan_id=artisan_id).delete()
    ArtisanPhoto.query.filter_by(artisan_id=artisan_id).delete()
    db.session.delete(a)
    db.session.commit()
    return jsonify({"success": True}), 200


MAX_PHOTO_BYTES = 5 * 1024 * 1024  # 5MB


@artisans_bp.route("/<artisan_id>/photos", methods=["POST"])
def upload_photo(artisan_id):
    a = Artisan.query.get(artisan_id)
    if not a:
        raise APIError("Artisan not found", 404)
    _authorize_edit(a)

    file = request.files.get("file")
    if not file or not file.filename:
        raise APIError("file is required", 400)
    if not (file.mimetype or "").startswith("image/"):
        raise APIError("Only image files are allowed", 400)

    data = file.read()
    if len(data) > MAX_PHOTO_BYTES:
        raise APIError("Photo must be 5MB or smaller", 400)

    # New uploads go to the end of the strip by default — sort_order is
    # only ever reordered explicitly via PATCH, never inferred otherwise.
    max_order = db.session.query(func.max(ArtisanPhoto.sort_order)).filter_by(artisan_id=artisan_id).scalar()
    photo = ArtisanPhoto(
        artisan_id=artisan_id, filename=file.filename, mime_type=file.mimetype,
        file_data=data, file_size=len(data), caption=(request.form.get("caption") or "").strip() or None,
        sort_order=(max_order + 1) if max_order is not None else 0,
    )
    db.session.add(photo)
    db.session.commit()
    return jsonify({"success": True, "data": photo.to_dict()}), 201


@artisans_bp.route("/<artisan_id>/photos", methods=["GET"])
def list_photos(artisan_id):
    if not Artisan.query.get(artisan_id):
        raise APIError("Artisan not found", 404)
    items = ArtisanPhoto.query.filter_by(artisan_id=artisan_id).order_by(ArtisanPhoto.sort_order, ArtisanPhoto.created_at).all()
    return jsonify({"success": True, "data": [p.to_dict() for p in items]}), 200


@artisans_bp.route("/<artisan_id>/photos/<photo_id>/raw", methods=["GET"])
def get_photo_raw(artisan_id, photo_id):
    photo = ArtisanPhoto.query.filter_by(id=photo_id, artisan_id=artisan_id).first()
    if not photo:
        raise APIError("Photo not found", 404)
    # No auth check — portfolio photos are public, same as the listing
    # itself (browsing/viewing stays open to anyone). This is what an
    # <img src> tag points at directly, never base64-inlined in the JSON.
    return send_file(io.BytesIO(photo.file_data), mimetype=photo.mime_type, max_age=3600)


@artisans_bp.route("/<artisan_id>/photos/<photo_id>", methods=["PATCH"])
def update_photo(artisan_id, photo_id):
    a = Artisan.query.get(artisan_id)
    if not a:
        raise APIError("Artisan not found", 404)
    _authorize_edit(a)
    photo = ArtisanPhoto.query.filter_by(id=photo_id, artisan_id=artisan_id).first()
    if not photo:
        raise APIError("Photo not found", 404)

    body = request.get_json(force=True) or {}
    if "caption" in body:
        photo.caption = (body["caption"] or "").strip() or None
    if "sort_order" in body:
        try:
            photo.sort_order = int(body["sort_order"])
        except (TypeError, ValueError):
            raise APIError("sort_order must be a whole number", 400)
    db.session.commit()
    return jsonify({"success": True, "data": photo.to_dict()}), 200


@artisans_bp.route("/<artisan_id>/photos/<photo_id>", methods=["DELETE"])
def delete_photo(artisan_id, photo_id):
    a = Artisan.query.get(artisan_id)
    if not a:
        raise APIError("Artisan not found", 404)
    _authorize_edit(a)
    photo = ArtisanPhoto.query.filter_by(id=photo_id, artisan_id=artisan_id).first()
    if not photo:
        raise APIError("Photo not found", 404)
    db.session.delete(photo)
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
# Unauthenticated by design (see the Review model's own docstring — this
# is the free-floating "bring your existing reputation" path, not a bug),
# which is exactly why it's the one write endpoint in this file with no
# identity to dedupe against. Scoped to (IP, this artisan) rather than
# the default per-IP-only key: the thing actually worth protecting is one
# artisan's rating integrity, not "how many reviews can this visitor post
# in total" — a global cap would wrongly block someone reviewing five
# different artisans from a shared office/campus network, which has
# nothing to do with review-bombing any one of them.
@limiter.limit("5 per hour", key_func=lambda: f"{get_remote_address()}:{request.view_args.get('artisan_id')}")
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
    recompute_rating(artisan_id)
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