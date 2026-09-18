"""
app/api/brand_scheduler.py — the branding workspace's post scheduler:
register social handles once, schedule content against them, get an
AI-suggested time per content type. Everything here is scoped by
workspace token (see brand_workspace.py's require_workspace) — no admin
gate, no login, matching every other branding-workspace tool.

Not an auto-poster — this app has no API integration with any social
platform. scheduled_at/reminded_at drive an email + a persistent in-app
badge telling a human "go post this now" (GET /scheduled-posts/due-count
below is that badge's live data source); the email itself is sent by
api/cron.py's externally-triggered /api/v1/cron/due-reminders, not an
in-process timer.
"""
import json
from datetime import datetime, timedelta, timezone

from flask import Blueprint, request, jsonify

from app import db
from app.models import BrandHandle, ScheduledPost, ScheduledPostHandle
from app.middleware.error_handlers import APIError
from app.utils.auth import require_workspace, EMAIL_RE
from app.utils.ai_client import ai_complete

scheduler_bp = Blueprint("brand_scheduler", __name__)

VALID_HANDLE_PLATFORMS = {"instagram", "tiktok", "x", "facebook", "linkedin", "youtube", "pinterest", "other"}
VALID_CONTENT_TYPES = {"post", "story"}


# ── Handle registry — register an account once, schedule against it forever. ──
@scheduler_bp.route("/handles", methods=["GET"])
def list_handles():
    ws = require_workspace(request)
    items = BrandHandle.query.filter_by(workspace_id=ws.id).order_by(BrandHandle.platform.asc(), BrandHandle.handle_name.asc()).all()
    return jsonify({"success": True, "data": [h.to_dict() for h in items]}), 200


@scheduler_bp.route("/handles", methods=["POST"])
def create_handle():
    ws = require_workspace(request)
    body = request.get_json(force=True) or {}
    platform = body.get("platform") or "other"
    if platform not in VALID_HANDLE_PLATFORMS:
        raise APIError(f"platform must be one of {sorted(VALID_HANDLE_PLATFORMS)}", 400)
    handle_name = (body.get("handle_name") or "").strip()
    if not handle_name:
        raise APIError("handle_name is required", 400)

    handle = BrandHandle(workspace_id=ws.id, platform=platform, handle_name=handle_name, label=(body.get("label") or "").strip() or None)
    db.session.add(handle)
    db.session.commit()
    return jsonify({"success": True, "data": handle.to_dict()}), 201


@scheduler_bp.route("/handles/<handle_id>", methods=["DELETE"])
def delete_handle(handle_id):
    ws = require_workspace(request)
    handle = BrandHandle.query.filter_by(id=handle_id, workspace_id=ws.id).first()
    if handle:
        # A scheduled post keeps its per-handle rows (so past history stays
        # readable) but they now point at nothing — ScheduledPostHandle.
        # to_dict() already handles self.handle being None gracefully.
        db.session.delete(handle)
        db.session.commit()
    return jsonify({"success": True}), 200


SUGGEST_TIME_SYSTEM = """You are Noqeev's social media scheduler. Given a piece of brand content's
type, title, and caption, you suggest the single best UPCOMING date/time to post it — inferring
likely intent from how the content is FRAMED. Content that reads as a wake-up routine, a morning
tip, or "start your day" framing suggests an early morning slot; something reflective, a wind-down,
or an evening-framed piece suggests a evening slot; a quick tip/stat/announcement with no particular
time framing gets a reliable general-engagement slot (late morning or early afternoon on a weekday).
You always respond with ONLY valid JSON — no markdown fences, no explanation, no preamble."""

SUGGEST_TIME_PROMPT = """Current date/time (UTC): {now_iso}.

Content type: {content_type}
Title: {title}
Caption: {caption}

Suggest the single best UPCOMING date/time (UTC) to post this — never in the past, and within the
next 14 days unless the content itself clearly implies a specific later date. Return this exact
JSON (no other text):
{{
  "scheduled_at": "YYYY-MM-DDTHH:MM:SS",
  "reasoning": "one short sentence explaining why this slot"
}}"""


@scheduler_bp.route("/scheduled-posts/suggest-time", methods=["POST"])
def suggest_scheduled_time():
    require_workspace(request)
    body = request.get_json(force=True) or {}
    content_type = body.get("content_type") or "post"
    if content_type not in VALID_CONTENT_TYPES:
        raise APIError(f"content_type must be one of {sorted(VALID_CONTENT_TYPES)}", 400)
    title = (body.get("title") or "").strip()[:200] or "Untitled"
    caption = (body.get("caption") or "").strip()[:1000] or "(none)"

    now = datetime.now(timezone.utc)
    prompt = SUGGEST_TIME_PROMPT.format(now_iso=now.strftime("%Y-%m-%dT%H:%M:%S"), content_type=content_type, title=title, caption=caption)
    raw = ai_complete(system=SUGGEST_TIME_SYSTEM, prompt=prompt, effort="low", max_tokens=250, groq_temperature=0.4)
    clean = raw.replace("```json", "").replace("```", "").strip()
    try:
        parsed = json.loads(clean)
    except json.JSONDecodeError as e:
        raise APIError(f"AI returned invalid JSON: {e}", 502)

    try:
        suggested = datetime.strptime(str(parsed.get("scheduled_at", "")), "%Y-%m-%dT%H:%M:%S")
    except ValueError:
        raise APIError("AI returned an unparseable date/time", 502)

    # Clamped regardless of what the model returned — never in the past (a
    # stale/confused response reading as "now" looks broken to whoever's
    # scheduling), never wildly far out either.
    now_naive = now.replace(tzinfo=None)
    if suggested < now_naive:
        suggested = now_naive + timedelta(hours=1)
    if suggested > now_naive + timedelta(days=30):
        suggested = now_naive + timedelta(days=30)

    return jsonify({"success": True, "data": {
        "scheduled_at": suggested.isoformat() + "Z",
        "reasoning": str(parsed.get("reasoning") or "").strip()[:300],
    }}), 200


@scheduler_bp.route("/scheduled-posts", methods=["GET"])
def list_scheduled_posts():
    ws = require_workspace(request)
    items = ScheduledPost.query.filter_by(workspace_id=ws.id).order_by(ScheduledPost.scheduled_at.asc()).all()
    return jsonify({"success": True, "data": [p.to_dict() for p in items]}), 200


@scheduler_bp.route("/scheduled-posts", methods=["POST"])
def create_scheduled_post():
    ws = require_workspace(request)
    body = request.get_json(force=True) or {}

    content_type = body.get("content_type") or "post"
    if content_type not in VALID_CONTENT_TYPES:
        raise APIError(f"content_type must be one of {sorted(VALID_CONTENT_TYPES)}", 400)
    title = (body.get("title") or "").strip()
    if not title:
        raise APIError("title is required", 400)
    scheduled_at_raw = body.get("scheduled_at")
    try:
        scheduled_at = datetime.strptime(str(scheduled_at_raw), "%Y-%m-%dT%H:%M:%S")
    except (ValueError, TypeError):
        raise APIError("scheduled_at is required, as YYYY-MM-DDTHH:MM:SS (UTC)", 400)
    suggested_at_raw = body.get("suggested_at")
    suggested_at = None
    if suggested_at_raw:
        try:
            suggested_at = datetime.strptime(str(suggested_at_raw), "%Y-%m-%dT%H:%M:%S")
        except ValueError:
            suggested_at = None
    handle_ids = body.get("handle_ids")
    if not isinstance(handle_ids, list) or not handle_ids:
        raise APIError("handle_ids must be a non-empty list", 400)
    handles = BrandHandle.query.filter(BrandHandle.id.in_(handle_ids), BrandHandle.workspace_id == ws.id).all()
    if len(handles) != len(set(handle_ids)):
        raise APIError("One or more handle_ids do not exist", 400)

    # Falls back to the workspace's own default recipient (BrandWorkspace.
    # notify_email) — no login here, so there's no "admin's email" to fall
    # back to instead the way the old admin-gated version used request.user.
    notify_email = (body.get("notify_email") or "").strip() or ws.notify_email
    if notify_email and not EMAIL_RE.match(notify_email):
        raise APIError("notify_email is not a valid email address", 400)

    post = ScheduledPost(
        workspace_id=ws.id, content_type=content_type, title=title[:200],
        caption=(body.get("caption") or "").strip()[:2000] or None,
        suggested_at=suggested_at, scheduled_at=scheduled_at, notify_email=notify_email,
    )
    db.session.add(post)
    db.session.flush()  # assigns post.id before the child rows reference it
    for h in handles:
        db.session.add(ScheduledPostHandle(scheduled_post_id=post.id, brand_handle_id=h.id))
    db.session.commit()
    return jsonify({"success": True, "data": post.to_dict()}), 201


def _get_owned_post(ws, post_id):
    post = ScheduledPost.query.filter_by(id=post_id, workspace_id=ws.id).first()
    if not post:
        raise APIError("Scheduled post not found", 404)
    return post


@scheduler_bp.route("/scheduled-posts/<post_id>", methods=["PATCH"])
def update_scheduled_post(post_id):
    ws = require_workspace(request)
    post = _get_owned_post(ws, post_id)

    body = request.get_json(force=True) or {}
    if "title" in body:
        title = (body["title"] or "").strip()
        if not title:
            raise APIError("title can't be empty", 400)
        post.title = title[:200]
    if "caption" in body:
        post.caption = (body["caption"] or "").strip()[:2000] or None
    if "scheduled_at" in body:
        try:
            post.scheduled_at = datetime.strptime(str(body["scheduled_at"]), "%Y-%m-%dT%H:%M:%S")
        except (ValueError, TypeError):
            raise APIError("scheduled_at must be YYYY-MM-DDTHH:MM:SS (UTC)", 400)
        # Rescheduling un-fires a reminder that already went out for the
        # OLD time — a moved post is a different due moment, not the same
        # one arriving again, and should get its own email when it's due.
        post.reminded_at = None
    if "notify_email" in body:
        notify_email = (body["notify_email"] or "").strip() or None
        if notify_email and not EMAIL_RE.match(notify_email):
            raise APIError("notify_email is not a valid email address", 400)
        post.notify_email = notify_email

    db.session.commit()
    return jsonify({"success": True, "data": post.to_dict()}), 200


@scheduler_bp.route("/scheduled-posts/<post_id>", methods=["DELETE"])
def delete_scheduled_post(post_id):
    ws = require_workspace(request)
    post = ScheduledPost.query.filter_by(id=post_id, workspace_id=ws.id).first()
    if post:
        db.session.delete(post)  # cascades to its ScheduledPostHandle rows
        db.session.commit()
    return jsonify({"success": True}), 200


@scheduler_bp.route("/scheduled-posts/<post_id>/handles/<handle_id>", methods=["POST"])
def mark_handle_posted(post_id, handle_id):
    """Toggles (not just sets) posted — body: {"posted": true|false}, default
    true. Un-marking is deliberately allowed: a slip of the thumb marking
    the wrong handle done shouldn't require deleting and recreating the
    whole scheduled post to correct."""
    ws = require_workspace(request)
    post = _get_owned_post(ws, post_id)
    link = ScheduledPostHandle.query.filter_by(scheduled_post_id=post.id, brand_handle_id=handle_id).first()
    if not link:
        raise APIError("That handle isn't on this scheduled post", 404)

    body = request.get_json(silent=True) or {}
    posted = body.get("posted", True)
    link.posted = bool(posted)
    link.posted_at = datetime.now(timezone.utc) if link.posted else None

    # Completed the moment EVERY registered handle for this post is marked
    # done — not before. Un-marking one handle on an already-completed
    # post correctly re-opens it, since it's no longer true that all of
    # them are posted.
    all_posted = bool(post.handles) and all(h.posted for h in post.handles)
    if all_posted and post.status != "completed":
        post.status = "completed"
        post.completed_at = datetime.now(timezone.utc)
    elif not all_posted and post.status == "completed":
        post.status = "scheduled"
        post.completed_at = None

    db.session.commit()
    return jsonify({"success": True, "data": post.to_dict()}), 200


@scheduler_bp.route("/scheduled-posts/next-up", methods=["GET"])
def next_up_scheduled_post():
    """The single earliest not-yet-completed scheduled post — surfaced
    after marking one done, so there's always an obvious answer to
    "what's next" without hunting through the full list."""
    ws = require_workspace(request)
    post = (
        ScheduledPost.query.filter(ScheduledPost.workspace_id == ws.id, ScheduledPost.status == "scheduled")
        .order_by(ScheduledPost.scheduled_at.asc())
        .first()
    )
    return jsonify({"success": True, "data": post.to_dict() if post else None}), 200


@scheduler_bp.route("/scheduled-posts/due-count", methods=["GET"])
def scheduled_posts_due_count():
    """The persistent badge's own data source — scheduled posts at/past
    their time and still open (not every handle marked posted yet).
    Live-queried on every call, not a stored counter: it needs to clear
    itself the instant the last handle is marked posted, with nothing to
    keep in sync."""
    ws = require_workspace(request)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    count = ScheduledPost.query.filter(
        ScheduledPost.workspace_id == ws.id,
        ScheduledPost.status == "scheduled",
        ScheduledPost.scheduled_at <= now,
    ).count()
    return jsonify({"success": True, "data": {"count": count}}), 200
