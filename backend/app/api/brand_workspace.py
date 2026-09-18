"""
app/api/brand_workspace.py — the branding workspace's own identity: no
login, no signup, no User row anywhere in this feature. One long random
token per workspace (secrets.token_urlsafe, same generator
api/artisans.py's edit_token already uses); the token in the URL is the
sole access control for everything else the branding workspace touches
— handles, scheduled posts, stored assets, all scoped by workspace_id
and reachable only by whoever holds this token.

POST /api/v1/workspace          — create one, token appears in THIS response only
GET  /api/v1/workspace/me       — resolve the caller's own workspace from their token
PATCH /api/v1/workspace/me      — name / notify_email
"""
import secrets

from flask import Blueprint, request, jsonify, send_file
import io

from app import db
from app.models import BrandWorkspace
from app.middleware.error_handlers import APIError
from app.utils.auth import require_workspace
from app.utils.storage import get_storage, LocalStorage

workspace_bp = Blueprint("brand_workspace", __name__)


@workspace_bp.route("", methods=["POST"])
def create_workspace():
    body = request.get_json(silent=True) or {}
    token = secrets.token_urlsafe(32)
    ws = BrandWorkspace(token=token, name=(body.get("name") or "").strip() or None)
    db.session.add(ws)
    db.session.commit()
    # token only ever appears in THIS response — to_dict() defaults
    # reveal_token to False everywhere else, so there's no later request
    # where it could leak to anyone but whoever just created it.
    return jsonify({"success": True, "data": ws.to_dict(reveal_token=True)}), 201


@workspace_bp.route("/me", methods=["GET"])
def get_my_workspace():
    ws = require_workspace(request)
    return jsonify({"success": True, "data": ws.to_dict()}), 200


@workspace_bp.route("/me", methods=["PATCH"])
def update_my_workspace():
    ws = require_workspace(request)
    body = request.get_json(force=True) or {}
    if "name" in body:
        ws.name = (body["name"] or "").strip() or None
    if "notify_email" in body:
        ws.notify_email = (body["notify_email"] or "").strip() or None
    db.session.commit()
    return jsonify({"success": True, "data": ws.to_dict()}), 200


@workspace_bp.route("/assets/<path:key>", methods=["GET"])
def serve_local_asset(key):
    """Only meaningful when STORAGE_BACKEND=local — R2's own url()
    returns a real bucket/CDN URL instead, this route is never hit in
    that mode. No workspace-token check here on purpose: the key itself
    (workspace_id/kind/<uuid>.ext, see storage.make_key) is already an
    unguessable bearer capability, the exact same "possession of this
    string is the authorization" shape the token itself is — matching
    what a real R2 public-bucket URL would ALSO be: fetchable by anyone
    who has the exact URL, no separate auth header required."""
    storage = get_storage()
    if not isinstance(storage, LocalStorage):
        raise APIError("Local asset serving is only available when STORAGE_BACKEND=local", 404)
    try:
        data = storage.get(key)
    except FileNotFoundError:
        raise APIError("Not found", 404)
    return send_file(io.BytesIO(data), download_name=key.rsplit("/", 1)[-1])
