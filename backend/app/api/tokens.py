"""
app/api/tokens.py — manage personal access tokens, the browser extension's
credential (see models.PersonalAccessToken, utils/auth.py's
resolve_personal_access_token). These routes themselves require a real
signed-in session (require_customer_scope) — only an already-authenticated
account holder can mint or revoke one of its own narrow-scoped tokens.

POST   /api/v1/tokens        — create one; the raw token is returned ONLY
                                here, never again (only its hash is stored)
GET    /api/v1/tokens        — list this account's tokens (no raw values)
DELETE /api/v1/tokens/<id>   — revoke one
"""
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from app import db, limiter
from app.models import PersonalAccessToken
from app.middleware.error_handlers import APIError
from app.utils.auth import require_customer_scope, new_personal_access_token, hash_personal_access_token

tokens_bp = Blueprint("tokens", __name__)


@tokens_bp.route("", methods=["POST"])
@limiter.limit("20 per hour")
def create_token():
    user_id = require_customer_scope(request)
    body = request.get_json(silent=True) or {}
    label = (body.get("label") or "").strip()[:100] or None

    raw = new_personal_access_token()
    row = PersonalAccessToken(user_id=user_id, token_hash=hash_personal_access_token(raw), label=label)
    db.session.add(row)
    db.session.commit()

    # The only response that ever carries the raw token — the hash in the
    # DB can't be reversed back into it, so this is the account holder's
    # one chance to copy it into the extension.
    return jsonify({"success": True, "data": {**row.to_dict(), "token": raw}}), 201


@tokens_bp.route("", methods=["GET"])
def list_tokens():
    user_id = require_customer_scope(request)
    rows = PersonalAccessToken.query.filter_by(user_id=user_id).order_by(PersonalAccessToken.created_at.desc()).all()
    return jsonify({"success": True, "data": [r.to_dict() for r in rows]}), 200


@tokens_bp.route("/<token_id>", methods=["DELETE"])
def revoke_token(token_id):
    user_id = require_customer_scope(request)
    row = PersonalAccessToken.query.filter_by(id=token_id, user_id=user_id).first()
    if not row:
        raise APIError("Token not found", 404)
    if row.revoked_at is None:
        row.revoked_at = datetime.now(timezone.utc)
        db.session.commit()
    return jsonify({"success": True}), 200
