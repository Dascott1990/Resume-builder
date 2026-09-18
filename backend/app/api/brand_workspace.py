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
from app.models import BrandWorkspace, BrandAsset
from app.middleware.error_handlers import APIError
from app.utils.auth import require_workspace
from app.utils.storage import get_storage, make_key, LocalStorage
from app.utils.uploads import validate_upload
from app.utils import logo_render

workspace_bp = Blueprint("brand_workspace", __name__)

DOWNLOAD_FORMATS = {
    "icon": ("image/png", "noqeev-app-icon.png", lambda: logo_render.render_app_icon()),
    "avatar": ("image/png", "noqeev-social-avatar.png", lambda: logo_render.render_social_avatar()),
    "lockup": ("image/png", "noqeev-lockup.png", lambda: logo_render.render_lockup()),
    "svg": ("image/svg+xml", "noqeev-mark.svg", lambda: logo_render.render_svg().encode("utf-8")),
}


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


def _get_or_create_source_asset(ws):
    """The one cached source every download format renders from — a
    workspace's first download request mints it via the storage
    interface (never a pre-made static file), every request after that
    reuses the same stored key instead of re-minting one."""
    asset = BrandAsset.query.filter_by(workspace_id=ws.id, kind="logo_source").first()
    if asset:
        return asset
    svg_bytes = logo_render.render_svg().encode("utf-8")
    key = make_key(ws.id, "logo_source", "svg")
    get_storage().put(key, svg_bytes, "image/svg+xml")
    asset = BrandAsset(workspace_id=ws.id, kind="logo_source", storage_key=key, content_type="image/svg+xml", filename="mark.svg")
    db.session.add(asset)
    db.session.commit()
    return asset


@workspace_bp.route("/downloads/<fmt>", methods=["GET"])
def download_asset(fmt):
    ws = require_workspace(request)
    if fmt not in DOWNLOAD_FORMATS:
        raise APIError(f"Unknown format '{fmt}' — choose one of: {', '.join(DOWNLOAD_FORMATS)}", 400)
    content_type, filename, render_fn = DOWNLOAD_FORMATS[fmt]
    source_asset = _get_or_create_source_asset(ws)
    if fmt == "svg":
        # The cached source IS the SVG — serve it straight from storage.
        data = get_storage().get(source_asset.storage_key)
    else:
        # Rasterized from the same MARK_POINTS/MARK_STROKE constants the
        # cached source SVG was itself built from — see logo_render.py's
        # module docstring for why this renders natively in Pillow
        # rather than re-parsing the cached SVG bytes.
        data = render_fn()
    return send_file(io.BytesIO(data), mimetype=content_type, download_name=filename)


@workspace_bp.route("/compose/export", methods=["POST"])
def export_post():
    """The post composer's canvas is exported client-side (canvas.toBlob),
    then handed here so the PNG is persisted via the storage interface —
    never left purely local — scoped to this workspace the same way
    every other asset is. The browser also keeps its own immediate copy
    (a plain download) so this round-trip is never on the critical path
    for actually getting the file."""
    ws = require_workspace(request)
    file = request.files.get("file")
    data = validate_upload(file, allowed_mimetypes=("image/",), max_bytes=15 * 1024 * 1024)
    key = make_key(ws.id, "post_export", "png")
    get_storage().put(key, data, "image/png")
    asset = BrandAsset(
        workspace_id=ws.id, kind="post_export", storage_key=key,
        content_type="image/png", filename=(request.form.get("filename") or "post.png"),
    )
    db.session.add(asset)
    db.session.commit()
    result = asset.to_dict()
    result["url"] = get_storage().url(key)
    return jsonify({"success": True, "data": result}), 201


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
