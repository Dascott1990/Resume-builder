"""
app/api/brand.py — internal marketing tooling behind the /brand page:

POST /api/v1/brand/suggest-post     — AI drafts one post (shape + copy),
                                       grounded in what Noqeev actually does
POST /api/v1/brand/suggest-theme    — AI proposes this month's signature accent
POST /api/v1/brand/email-asset      — emails a generated image to whoever's
                                       shipping it to a given platform
GET  /api/v1/brand/news             — recent admin-posted updates
POST /api/v1/brand/news             — post one (admin only) + push it to
                                       everyone subscribed
PATCH /api/v1/brand/news/<id>       — edit, or mark resolved/reopen (admin only)
DELETE /api/v1/brand/news/<id>      — remove one (admin only)
GET  /api/v1/brand/world-feed       — real auto-fetched tech/physics/history
                                       (admin only — see utils/world_feed.py)
DELETE /api/v1/brand/world-feed/<id> — dismiss one item (admin only)
GET  /api/v1/brand/push/vapid-public-key — the public half of the app's
                                       VAPID key pair (safe to expose; the
                                       browser needs it to open a subscription)
POST /api/v1/brand/push/subscribe   — save this browser's push subscription
                                       (admin only)
POST /api/v1/brand/push/unsubscribe — remove it
GET  /api/v1/brand/tasks            — the task list (admin only — this is
                                       internal work-tracking, not public
                                       like the news feed)
POST /api/v1/brand/tasks            — add one
PATCH /api/v1/brand/tasks/<id>      — mark done/reopen, snooze, or edit
DELETE /api/v1/brand/tasks/<id>     — remove one
GET  /api/v1/brand/tasks/<id>/ics   — a calendar file for one task (Google/
                                       Apple/Outlook can all import it)

Most of this file is unauthenticated on purpose — no auth, no guest_id
scoping, since it's a tool for whoever's running the brand, not a
customer-facing feature (same "no identity to scope by" reasoning as
api/capture.py's bookmarklet endpoint). The news/push/tasks write paths
are the exception: news and push broadcast to real subscribers, and
tasks are internal work-tracking nobody outside the team should see, so
all three require an actual signed-in admin (require_admin) — reading
the news list is the one thing that stays open, same as everything else
here.
"""
import base64
import json
import re
from datetime import datetime, timedelta, timezone

from flask import Blueprint, request, jsonify

from app import db, limiter
from app.middleware.error_handlers import APIError
from app.models import BrandNews, BrandTask, PushSubscription, WorldFeedItem
from app.utils.ai_client import ai_complete
from app.utils.auth import require_admin
from app.utils.mail import send_email
from app.utils.push import VAPID_PUBLIC_KEY, push_configured, send_push_to_all
from app.utils.task_reminders import build_ics, next_occurrence

brand_bp = Blueprint("brand", __name__)

# Kept in lockstep with frontend/lib/accentColor.js's ACCENT_COLORS ids —
# the AI is constrained to pick one of these, never an invented hex, so
# "this month's signature theme" always lands on a color the rest of the
# app already knows how to render (Settings' accent picker, every
# --primary-driven surface), not a one-off that only ever exists on a
# single exported PNG.
ACCENT_IDS = ["amber", "red", "orange", "green", "blue", "purple", "pink"]

# Shared grounding for both AI calls below — real, specific product facts
# an AI writer or designer with no other context wouldn't otherwise know,
# so "suggest a post" produces something a Noqeev user would recognize
# rather than generic "resume tips" filler that could belong to any
# competitor's account.
PRODUCT_CONTEXT = """Noqeev is an AI resume/CV builder and job-search toolkit. What it actually does,
concretely — draw suggestions from THESE, not generic "resume tips" filler:
- Paste a job posting in, get a tailored resume + matching cover letter + 3 interview talking
  points in one pass, keyword-aligned to that specific posting.
- Scores a resume's ATS-readiness (0-100) and can auto-rewrite it to fix flagged issues, never
  inventing an employer, degree, or achievement that wasn't already there.
- Scans/imports an existing resume from a PDF/DOCX upload and rebuilds it in the tool.
- Runs a short mock-interview chat grounded in the specific job posting.
- "Apply with AI" — a browser agent that actually fills out a real job application form, but
  never submits on its own and never invents an answer to a sensitive question (work
  authorization, salary, etc.) without a human-confirmed source; a person always does the final
  submit click after reviewing everything.
- A lightweight job-application tracker (company, role, status, follow-up nudges).
- Also, separately: a local artisan/tradesperson marketplace bolted onto the same app (request a
  plumber/electrician/etc., escrowed payment, in-app messaging) — real, but a different audience
  from the resume side; don't lead with this unless it's genuinely the best fit for the brief.
- Anonymous by default — works fully without an account; signing in only makes saved
  resumes/applications follow you across devices.
Brand voice: direct, plain-spoken, a little warm, never corporate-generic. Core belief, stated
elsewhere in the app's own copy: "every career deserves a second chance" — a gap, a layoff, a
career change isn't a failure. Never use these worn-out phrases or close equivalents: "unlock
your potential", "take your career to the next level", "game-changer", "revolutionize",
"seamless", "in today's competitive job market", "elevate"."""

SUGGEST_POST_SYSTEM = f"""You are Noqeev's own social media writer — sharp, concrete, never generic.
{PRODUCT_CONTEXT}
You always respond with ONLY valid JSON — no markdown fences, no explanation, no preamble."""

SUGGEST_POST_PROMPT = """Draft ONE social post for right now.

Context: it's {day_of_week}, {time_of_day}, timezone {timezone}. Mood to write in: {mood}.

Pick whichever of these three shapes actually fits best for this mood/moment — don't default to
the same one every time:
- "tip": a short eyebrow label, a punchy headline (one practical, specific piece of advice), a
  one-sentence supporting line.
- "quote": a short (under 18 words) line in the brand's own voice — a belief, not a feature list
  — plus a 2-4 word attribution (e.g. "— Noqeev").
- "stat": an eyebrow label, ONE short number/phrase as the headline (e.g. "3 minutes", "1 page"),
  and a one-sentence caption explaining what it means. Only pick this if you have a genuinely
  plausible, specific number to use — never a vague or made-up-sounding stat.

Return this exact JSON (no other text):
{{
  "template": "tip | quote | stat",
  "eyebrow": "short label — empty string if the shape you picked doesn't use one (quote doesn't)",
  "headline": "the main line",
  "subtext": "the supporting line",
  "rationale": "one sentence on why this shape/angle fits {mood} on a {day_of_week} {time_of_day}"
}}

Rules:
- Ground the content in something Noqeev ACTUALLY does, from the context above — never a made-up
  feature.
- headline and subtext must each work standing alone in the shape described above — no
  placeholders, no brackets.
- Return ONLY the JSON object."""


def _clean_str(value, max_len):
    # `value or ""` would silently turn a legitimate falsy value (the
    # number 0, False) into an empty string instead of "0"/"False" — an
    # explicit None-check is what actually means "nothing was provided."
    return str(value if value is not None else "").strip()[:max_len]


@brand_bp.route("/suggest-post", methods=["POST"])
@limiter.limit("20 per hour")
def suggest_post():
    body = request.get_json(force=True) or {}
    mood = _clean_str(body.get("mood"), 40) or "practical"
    time_of_day = _clean_str(body.get("time_of_day"), 40) or "afternoon"
    day_of_week = _clean_str(body.get("day_of_week"), 40) or "today"
    tz_label = _clean_str(body.get("timezone"), 60) or "unspecified"

    prompt = SUGGEST_POST_PROMPT.format(day_of_week=day_of_week, time_of_day=time_of_day, timezone=tz_label, mood=mood)
    raw = ai_complete(system=SUGGEST_POST_SYSTEM, prompt=prompt, effort="medium", max_tokens=500, groq_temperature=0.7)
    clean = raw.replace("```json", "").replace("```", "").strip()

    try:
        parsed = json.loads(clean)
    except json.JSONDecodeError as e:
        raise APIError(f"AI returned invalid JSON: {e}", 502)

    if parsed.get("template") not in ("tip", "quote", "stat"):
        parsed["template"] = "tip"
    for key in ("eyebrow", "headline", "subtext", "rationale"):
        parsed[key] = _clean_str(parsed.get(key), 500)

    return jsonify({"success": True, "data": parsed}), 200


SUGGEST_THEME_SYSTEM = f"""You are Noqeev's brand designer, choosing this month's signature accent
color for social content. {PRODUCT_CONTEXT}
You always respond with ONLY valid JSON — no markdown fences, no explanation, no preamble."""

SUGGEST_THEME_PROMPT = """Available accent colors (you MUST pick exactly one of these ids, never
invent a new one): {accent_ids}.

Current month: {month_name}.

Pick the one accent that makes the most sense as this month's signature color for Noqeev's posts,
and give it a short, ownable name (2-4 words, not just the color name — e.g. not "Warm Orange",
more like something that ties the color to the month or to Noqeev's own "second chance" voice).

Return this exact JSON (no other text):
{{
  "accentId": "one of: {accent_ids}",
  "themeName": "short ownable name for this month's theme",
  "rationale": "1-2 sentences on why this fits the month, grounded in Noqeev's own brand voice — no generic color-psychology filler"
}}

Return ONLY the JSON object."""


@brand_bp.route("/suggest-theme", methods=["POST"])
@limiter.limit("10 per hour")
def suggest_theme():
    body = request.get_json(force=True) or {}
    month_name = _clean_str(body.get("month_name"), 30) or datetime.now(timezone.utc).strftime("%B")

    prompt = SUGGEST_THEME_PROMPT.format(accent_ids=", ".join(ACCENT_IDS), month_name=month_name)
    raw = ai_complete(system=SUGGEST_THEME_SYSTEM, prompt=prompt, effort="low", max_tokens=300, groq_temperature=0.6)
    clean = raw.replace("```json", "").replace("```", "").strip()

    try:
        parsed = json.loads(clean)
    except json.JSONDecodeError as e:
        raise APIError(f"AI returned invalid JSON: {e}", 502)

    if parsed.get("accentId") not in ACCENT_IDS:
        parsed["accentId"] = "amber"
    parsed["themeName"] = _clean_str(parsed.get("themeName"), 60)
    parsed["rationale"] = _clean_str(parsed.get("rationale"), 400)

    return jsonify({"success": True, "data": parsed}), 200


_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_DATA_URL_RE = re.compile(r"^data:image/(png|jpeg|jpg);base64,")
MAX_IMAGE_BYTES = 8 * 1024 * 1024


@brand_bp.route("/email-asset", methods=["POST"])
@limiter.limit("15 per hour")
def email_asset():
    """The image never touches the database — it's decoded straight from
    the request and handed to send_email as an attachment, same
    "ephemeral unless explicitly saved" default the rest of this app uses
    for anything that isn't a resume/listing/job record."""
    body = request.get_json(force=True) or {}
    to_email = (body.get("to_email") or "").strip()
    filename = _clean_str(body.get("filename"), 120) or "noqeev-post.png"
    note = _clean_str(body.get("note"), 500)
    data_url = body.get("image_data_url") or ""

    if not _EMAIL_RE.match(to_email):
        raise APIError("Enter a valid email address", 400)
    match = _DATA_URL_RE.match(data_url)
    if not match:
        raise APIError("image_data_url must be a base64 PNG/JPEG data URL", 400)
    try:
        image_bytes = base64.b64decode(data_url[match.end():])
    except Exception:
        raise APIError("Could not decode the image data", 400)
    if not image_bytes:
        raise APIError("The image data was empty", 400)
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise APIError("Image is too large to email (8MB max)", 400)

    mime_subtype = "jpeg" if match.group(1) in ("jpeg", "jpg") else "png"
    body_html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:8px;">
      <p style="font-weight:800;letter-spacing:0.02em;color:#111;margin:0 0 24px;">NOQEEV</p>
      <h2 style="color:#111;margin:0 0 12px;">Ready to post</h2>
      <p style="color:#444;line-height:1.6;margin:0 0 4px;">{note or "A post's attached and ready to ship."}</p>
      <p style="color:#888;font-size:12.5px;line-height:1.5;">Generated from /brand.</p>
    </div>
    """
    try:
        send_email(to_email, "Noqeev — ready to post", body_html, attachment=(filename, image_bytes, mime_subtype))
    except Exception as exc:
        print(f"❌ Failed to email brand asset to {to_email}: {exc}")
        raise APIError("Could not send this email — check the mail server configuration", 502)

    return jsonify({"success": True, "data": {"message": f"Sent to {to_email}"}}), 200


# ── News feed — real, admin-authored updates, not a fabricated external
# feed. Posting one fans out a real push to everyone subscribed. ──────────
@brand_bp.route("/news", methods=["GET"])
@limiter.limit("60 per hour")
def list_news():
    # Unresolved first (most actionable), each group newest-first — a
    # resolved update sinks below anything still open regardless of age.
    items = BrandNews.query.order_by(BrandNews.resolved.asc(), BrandNews.created_at.desc()).limit(50).all()
    return jsonify({"success": True, "data": [n.to_dict() for n in items]}), 200


@brand_bp.route("/news", methods=["POST"])
@limiter.limit("30 per hour")
def post_news():
    admin = require_admin(request)
    body = request.get_json(force=True) or {}
    title = _clean_str(body.get("title"), 140)
    news_body = _clean_str(body.get("body"), 500)
    link = _clean_str(body.get("link"), 500)
    if not title:
        raise APIError("Title is required", 400)
    if link and not re.match(r"^https?://", link):
        raise APIError("Link must start with http:// or https://", 400)

    item = BrandNews(title=title, body=news_body or None, link=link or None, created_by=admin.id)
    db.session.add(item)
    db.session.commit()

    # Best-effort — a subscriber's push failing (or push not being
    # configured on this server at all) shouldn't fail the actual post.
    if push_configured():
        subs = PushSubscription.query.all()
        payload = json.dumps({"title": title, "body": news_body or "", "link": link or "/brand"})
        try:
            dead_ids = send_push_to_all(subs, payload)
            if dead_ids:
                PushSubscription.query.filter(PushSubscription.id.in_(dead_ids)).delete(synchronize_session=False)
                db.session.commit()
        except Exception as exc:
            print(f"❌ Push fan-out failed for news item {item.id}: {exc}")

    return jsonify({"success": True, "data": item.to_dict()}), 201


@brand_bp.route("/news/<news_id>", methods=["PATCH"])
@limiter.limit("60 per hour")
def update_news(news_id):
    require_admin(request)
    item = db.session.get(BrandNews, news_id)
    if not item:
        raise APIError("Not found", 404)
    body = request.get_json(force=True) or {}

    if "title" in body:
        title = _clean_str(body.get("title"), 140)
        if not title:
            raise APIError("Title is required", 400)
        item.title = title
    if "body" in body:
        item.body = _clean_str(body.get("body"), 500) or None
    if "link" in body:
        link = _clean_str(body.get("link"), 500)
        if link and not re.match(r"^https?://", link):
            raise APIError("Link must start with http:// or https://", 400)
        item.link = link or None
    if "title" in body or "body" in body or "link" in body:
        item.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)

    if "resolved" in body:
        item.resolved = bool(body["resolved"])
        item.resolved_at = datetime.now(timezone.utc).replace(tzinfo=None) if item.resolved else None

    db.session.commit()
    return jsonify({"success": True, "data": item.to_dict()}), 200


@brand_bp.route("/news/<news_id>", methods=["DELETE"])
@limiter.limit("30 per hour")
def delete_news(news_id):
    require_admin(request)
    item = db.session.get(BrandNews, news_id)
    if not item:
        raise APIError("Not found", 404)
    db.session.delete(item)
    db.session.commit()
    return jsonify({"success": True, "data": {"deleted": True}}), 200


# ── World feed — real, auto-fetched technology/physics/history, on a
# timer (see utils/world_feed.py). Read-only aside from an admin
# dismissing an individual item; there's nothing here to "edit." ─────────
@brand_bp.route("/world-feed", methods=["GET"])
@limiter.limit("120 per hour")
def list_world_feed():
    require_admin(request)
    category = request.args.get("category")
    q = WorldFeedItem.query
    if category in ("world", "tech", "physics", "history"):
        q = q.filter_by(category=category)
    items = q.order_by(WorldFeedItem.fetched_at.desc()).limit(150).all()
    return jsonify({"success": True, "data": [i.to_dict() for i in items]}), 200


@brand_bp.route("/world-feed/<item_id>", methods=["DELETE"])
@limiter.limit("60 per hour")
def dismiss_world_feed_item(item_id):
    require_admin(request)
    item = db.session.get(WorldFeedItem, item_id)
    if not item:
        raise APIError("Not found", 404)
    db.session.delete(item)
    db.session.commit()
    return jsonify({"success": True, "data": {"deleted": True}}), 200


# ── Web Push — VAPID, real OS-level notifications even with the tab
# closed. See utils/push.py for the send path and how to generate a key
# pair; both VAPID_PRIVATE_KEY and VAPID_PUBLIC_KEY must be set as env
# vars for any of this to actually deliver. ────────────────────────────
@brand_bp.route("/push/vapid-public-key", methods=["GET"])
def vapid_public_key():
    if not push_configured():
        raise APIError("Push notifications aren't configured on this server", 503)
    return jsonify({"success": True, "data": {"key": VAPID_PUBLIC_KEY}}), 200


@brand_bp.route("/push/subscribe", methods=["POST"])
@limiter.limit("30 per hour")
def push_subscribe():
    admin = require_admin(request)
    body = request.get_json(force=True) or {}
    endpoint = (body.get("endpoint") or "").strip()
    keys = body.get("keys") or {}
    p256dh = (keys.get("p256dh") or "").strip()
    auth = (keys.get("auth") or "").strip()
    if not endpoint or not p256dh or not auth:
        raise APIError("Malformed subscription", 400)

    # Re-subscribing from the same browser updates the row rather than
    # piling up a duplicate — endpoint is the push service's own stable
    # id for this browser+origin.
    existing = PushSubscription.query.filter_by(endpoint=endpoint).first()
    if existing:
        existing.user_id = admin.id
        existing.p256dh = p256dh
        existing.auth = auth
    else:
        db.session.add(PushSubscription(user_id=admin.id, endpoint=endpoint, p256dh=p256dh, auth=auth))
    db.session.commit()
    return jsonify({"success": True, "data": {"subscribed": True}}), 200


@brand_bp.route("/push/unsubscribe", methods=["POST"])
@limiter.limit("30 per hour")
def push_unsubscribe():
    require_admin(request)
    body = request.get_json(force=True) or {}
    endpoint = (body.get("endpoint") or "").strip()
    if endpoint:
        PushSubscription.query.filter_by(endpoint=endpoint).delete()
        db.session.commit()
    return jsonify({"success": True, "data": {"subscribed": False}}), 200


# ── Tasks — the actual notification-bell content: overdue, due today,
# upcoming, someday. A due date arriving with nobody in the app to notice
# it is exactly why utils/task_reminders.py's scheduler exists. ───────────
def _parse_due_at(value):
    """Frontend sends a plain YYYY-MM-DD (a native <input type="date">) or
    nothing at all — a task's due date is a day, not a specific minute, so
    there's no time-of-day precision to preserve or lose here."""
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        raise APIError("due_at must be YYYY-MM-DD", 400)


@brand_bp.route("/tasks", methods=["GET"])
@limiter.limit("120 per hour")
def list_tasks():
    require_admin(request)
    # Open tasks (any due date, including none) plus the 10 most recently
    # completed — enough to undo an accidental check-off without the list
    # growing forever with done items nobody needs to see again.
    open_tasks = BrandTask.query.filter_by(done=False).order_by(
        BrandTask.due_at.is_(None), BrandTask.due_at.asc()
    ).all()
    done_tasks = BrandTask.query.filter_by(done=True).order_by(BrandTask.completed_at.desc()).limit(10).all()
    return jsonify({"success": True, "data": {
        "open": [t.to_dict() for t in open_tasks],
        "done": [t.to_dict() for t in done_tasks],
    }}), 200


@brand_bp.route("/tasks", methods=["POST"])
@limiter.limit("60 per hour")
def create_task():
    admin = require_admin(request)
    body = request.get_json(force=True) or {}
    title = _clean_str(body.get("title"), 140)
    if not title:
        raise APIError("Title is required", 400)
    recurring = body.get("recurring") if body.get("recurring") in ("weekly", "monthly") else None
    task = BrandTask(
        title=title,
        notes=_clean_str(body.get("notes"), 500) or None,
        due_at=_parse_due_at(body.get("due_at")),
        recurring=recurring,
        created_by=admin.id,
    )
    db.session.add(task)
    db.session.commit()
    return jsonify({"success": True, "data": task.to_dict()}), 201


@brand_bp.route("/tasks/<task_id>", methods=["PATCH"])
@limiter.limit("120 per hour")
def update_task(task_id):
    require_admin(request)
    task = db.session.get(BrandTask, task_id)
    if not task:
        raise APIError("Not found", 404)
    body = request.get_json(force=True) or {}

    if "title" in body:
        title = _clean_str(body.get("title"), 140)
        if not title:
            raise APIError("Title is required", 400)
        task.title = title
    if "notes" in body:
        task.notes = _clean_str(body.get("notes"), 500) or None
    if "due_at" in body:
        task.due_at = _parse_due_at(body.get("due_at"))
        task.reminded_at = None  # a new due date deserves its own reminder
    if "recurring" in body:
        task.recurring = body["recurring"] if body["recurring"] in ("weekly", "monthly") else None

    # Push the due date forward without touching completion state — the
    # "I saw it, not today" button.
    snooze_days = body.get("snooze_days")
    if snooze_days and task.due_at:
        task.due_at = task.due_at + timedelta(days=int(snooze_days))
        task.reminded_at = None

    if "done" in body:
        was_done = task.done
        task.done = bool(body["done"])
        if task.done and not was_done:
            task.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
            # Recurring tasks regenerate the instant they're completed —
            # event-driven, not something the scheduler has to notice.
            if task.recurring and task.due_at:
                nxt = next_occurrence(task.due_at, task.recurring)
                if nxt:
                    db.session.add(BrandTask(
                        title=task.title, notes=task.notes, due_at=nxt,
                        recurring=task.recurring, created_by=task.created_by,
                    ))
        elif not task.done:
            task.completed_at = None

    db.session.commit()
    return jsonify({"success": True, "data": task.to_dict()}), 200


@brand_bp.route("/tasks/<task_id>", methods=["DELETE"])
@limiter.limit("60 per hour")
def delete_task(task_id):
    require_admin(request)
    task = db.session.get(BrandTask, task_id)
    if not task:
        raise APIError("Not found", 404)
    db.session.delete(task)
    db.session.commit()
    return jsonify({"success": True, "data": {"deleted": True}}), 200


@brand_bp.route("/tasks/<task_id>/ics", methods=["GET"])
def task_ics(task_id):
    require_admin(request)
    task = db.session.get(BrandTask, task_id)
    if not task:
        raise APIError("Not found", 404)
    ics = build_ics(task)
    return ics, 200, {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": f'attachment; filename="{task.id}.ics"',
    }
