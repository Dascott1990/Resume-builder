"""
app/api/applications.py — the job application tracker.
POST   /api/v1/applications
GET    /api/v1/applications
PATCH  /api/v1/applications/<id>
DELETE /api/v1/applications/<id>

Scoped by guest_id (anonymous, the default) or user_id (signed in) — never
both, never neither, and never visible to anyone else's scope. See
app/utils/auth.get_scope for how the two are told apart.
"""
import os
import secrets
from datetime import date, datetime, timedelta, timezone
from flask import Blueprint, request, jsonify, Response
from app import db, limiter
from app.models import JobApplication, Media, User
from app.middleware.error_handlers import APIError
from app.utils.auth import get_scope
from app.utils.ai_client import ai_complete

applications_bp = Blueprint("applications", __name__)

# Same BACKEND_URL resolution as app/utils/email_logo.py — platform-injected
# RENDER_EXTERNAL_URL needs no dashboard setup, BACKEND_URL is a manual
# override, localhost:5002 matches run.py's own default port.
if os.environ.get("BACKEND_URL"):
    _BACKEND_URL = os.environ["BACKEND_URL"].rstrip("/")
elif os.environ.get("RENDER_EXTERNAL_URL"):
    _BACKEND_URL = os.environ["RENDER_EXTERNAL_URL"].rstrip("/")
else:
    _BACKEND_URL = "http://localhost:5002"

VALID_STATUSES = {"saved", "applied", "interview", "offer", "rejected"}
# How long an application sits in the same status (applied or interview)
# before we flag it stale — a fixed, predictable rule is easier to trust
# than a setting nobody will find. 14 days, not the old 7: this now
# checks the real status-change timestamp instead of a date_applied
# heuristic, so it's worth a slightly longer window before nudging.
STALE_AFTER_DAYS = 14


def _utcnow():
    # Naive UTC throughout this app — neither SQLite nor plain Postgres
    # TIMESTAMP round-trips tzinfo, so a timezone-aware value here would
    # silently compare wrong against every other naive column.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _scope_filter(query):
    user_id, guest_id = get_scope(request)
    if user_id:
        return query.filter_by(user_id=user_id), user_id, guest_id
    if guest_id:
        return query.filter_by(guest_id=guest_id), user_id, guest_id
    return query.filter(db.false()), user_id, guest_id  # neither header present — show nothing, not everything


def _clean_resume_id(raw, user_id, guest_id):
    """A resume_id is "which of my own saved resumes did I send for this
    application" — accepting any id the client sends with no ownership
    check would let a request attach someone else's Media row to your
    application (that row's caption/owner then shows up wherever this
    application is rendered, admin panel included). Silently drops it to
    None instead of erroring: a stale/foreign id here is a UI mismatch,
    not something worth failing the whole save over."""
    resume_id = (raw or "").strip() or None
    if not resume_id:
        return None
    q = Media.query.filter_by(id=resume_id)
    q = q.filter_by(user_id=user_id) if user_id else q.filter_by(guest_id=guest_id)
    return resume_id if q.first() else None


CHECKLIST_MAX_ITEMS = 30
CHECKLIST_LABEL_MAX = 200


def _clean_checklist(raw):
    """[{id, label, done}] — defensive, not trusting, since this is a
    client-supplied JSON blob stored verbatim: caps item count and label
    length, coerces `done` to a real bool, and drops anything not shaped
    like an item rather than failing the whole save over one bad entry."""
    if not isinstance(raw, list):
        return None
    out = []
    for item in raw[:CHECKLIST_MAX_ITEMS]:
        if not isinstance(item, dict):
            continue
        label = str(item.get("label") or "").strip()[:CHECKLIST_LABEL_MAX]
        if not label:
            continue
        out.append({
            "id": str(item.get("id") or "").strip()[:64] or None,
            "label": label,
            "done": bool(item.get("done")),
        })
    return out


def _is_stale(app_row):
    """Replaces the old needs_followup heuristic (7 days, applied-only,
    parsed from the free-text date_applied field). This version checks
    the real status_changed_at column — set only when status actually
    changes (see update_application) — falling back to created_at for
    rows whose status has never changed since this column existed."""
    if app_row.status not in ("applied", "interview"):
        return False
    base = app_row.status_changed_at or app_row.created_at
    if base is None:
        return False
    return (_utcnow() - base).days >= STALE_AFTER_DAYS


def _serialize(app_row):
    return {**app_row.to_dict(), "is_stale": _is_stale(app_row)}


def _ics_escape(text):
    return (text or "").replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;").replace("\n", "\\n")


def _ics_fold(line):
    # RFC 5545 content lines SHOULD be folded at 75 octets — most real
    # calendar clients tolerate long lines fine, but folding costs nothing
    # here and keeps the output strictly well-formed.
    out = []
    while len(line) > 74:
        out.append(line[:74])
        line = " " + line[74:]
    out.append(line)
    return "\r\n".join(out)


def _vevent(app_row):
    """One VEVENT per application with an interview_date, as an all-day
    event — interview_date is a plain YYYY-MM-DD string with no time
    component anywhere in this app, so an all-day event is the honest
    representation rather than inventing a time that was never set."""
    try:
        dt = datetime.strptime((app_row.interview_date or ""), "%Y-%m-%d")
    except ValueError:
        return None
    dtstart = dt.strftime("%Y%m%d")
    dtend = (dt + timedelta(days=1)).strftime("%Y%m%d")
    desc_lines = [f"Role: {app_row.role}", f"Company: {app_row.company}"]
    if app_row.notes:
        desc_lines.append(f"Notes: {app_row.notes}")
    lines = [
        "BEGIN:VEVENT",
        f"UID:jobapp-{app_row.id}@noqeev.com",
        f"DTSTAMP:{_utcnow().strftime('%Y%m%dT%H%M%SZ')}",
        f"DTSTART;VALUE=DATE:{dtstart}",
        f"DTEND;VALUE=DATE:{dtend}",
        f"SUMMARY:{_ics_escape(f'Interview: {app_row.role} at {app_row.company}')}",
        f"DESCRIPTION:{_ics_escape(chr(10).join(desc_lines))}",
        "END:VEVENT",
    ]
    return "\r\n".join(_ics_fold(l) for l in lines)


def _ics_calendar(vevents, calname):
    body = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Noqeev//Job Tracker//EN",
        "CALSCALE:GREGORIAN", f"X-WR-CALNAME:{_ics_escape(calname)}",
    ] + vevents + ["END:VCALENDAR"]
    return "\r\n".join(body) + "\r\n"


@applications_bp.route("", methods=["POST"])
def create_application():
    body = request.get_json(force=True) or {}
    company = (body.get("company") or "").strip()
    role = (body.get("role") or "").strip()
    status = body.get("status") or "applied"

    if not company or not role:
        raise APIError("company and role are required", 400)
    if status not in VALID_STATUSES:
        raise APIError(f"status must be one of {sorted(VALID_STATUSES)}", 400)

    user_id, guest_id = get_scope(request)
    if not user_id and not guest_id:
        raise APIError("Missing X-Guest-Id header", 400)

    app_row = JobApplication(
        company=company, role=role, status=status,
        date_applied=(body.get("date_applied") or "").strip() or None,
        notes=(body.get("notes") or "").strip() or None,
        contact_name=(body.get("contact_name") or "").strip() or None,
        contact_email=(body.get("contact_email") or "").strip() or None,
        contact_phone=(body.get("contact_phone") or "").strip() or None,
        interview_date=(body.get("interview_date") or "").strip() or None,
        resume_id=_clean_resume_id(body.get("resume_id"), user_id, guest_id),
        user_id=user_id, guest_id=None if user_id else guest_id,
        # A real baseline for the stale check from day one, not null
        # until the first edit — the status chosen at creation IS a real
        # status "change" (from nothing to something).
        status_changed_at=_utcnow(),
        checklist=_clean_checklist(body.get("checklist")),
    )
    db.session.add(app_row)
    db.session.commit()
    return jsonify({"success": True, "data": _serialize(app_row)}), 201


@applications_bp.route("", methods=["GET"])
def list_applications():
    query, _, _ = _scope_filter(JobApplication.query)
    items = query.order_by(JobApplication.created_at.desc()).limit(500).all()
    return jsonify({"success": True, "data": [_serialize(a) for a in items]}), 200


@applications_bp.route("/<app_id>", methods=["PATCH"])
def update_application(app_id):
    query, user_id, guest_id = _scope_filter(JobApplication.query.filter_by(id=app_id))
    app_row = query.first()
    if not app_row:
        raise APIError("Application not found", 404)

    body = request.get_json(force=True) or {}
    if "company" in body:
        app_row.company = (body["company"] or "").strip() or app_row.company
    if "role" in body:
        app_row.role = (body["role"] or "").strip() or app_row.role
    if "status" in body:
        if body["status"] not in VALID_STATUSES:
            raise APIError(f"status must be one of {sorted(VALID_STATUSES)}", 400)
        if body["status"] != app_row.status:
            app_row.status_changed_at = _utcnow()
        app_row.status = body["status"]
    if "date_applied" in body:
        app_row.date_applied = (body["date_applied"] or "").strip() or None
    if "notes" in body:
        app_row.notes = (body["notes"] or "").strip() or None
    if "contact_name" in body:
        app_row.contact_name = (body["contact_name"] or "").strip() or None
    if "contact_email" in body:
        app_row.contact_email = (body["contact_email"] or "").strip() or None
    if "contact_phone" in body:
        app_row.contact_phone = (body["contact_phone"] or "").strip() or None
    if "interview_date" in body:
        app_row.interview_date = (body["interview_date"] or "").strip() or None
    if "resume_id" in body:
        app_row.resume_id = _clean_resume_id(body["resume_id"], user_id, guest_id)
    if "checklist" in body:
        app_row.checklist = _clean_checklist(body["checklist"])

    db.session.commit()
    return jsonify({"success": True, "data": _serialize(app_row)}), 200


INSIGHT_PROMPTS = {
    # Short on purpose — this renders inline under one Recent Applications
    # row, not in its own screen. 2-3 plain sentences, no lists, no headers.
    "why": "This job application was rejected. In 2-3 short, encouraging sentences, give ONE or TWO plausible, constructive reasons this might not have worked out and what to look at for next time. Be concrete where the role/notes give you something to go on, not generic platitudes.",
    "reapply": "This job application was rejected. In 2-3 short, encouraging sentences, say whether it's generally worth reapplying to this company/role in the future (and roughly when), or better to focus elsewhere.",
}


@applications_bp.route("/<app_id>/insight", methods=["POST"])
@limiter.limit("30 per hour")
def application_insight(app_id):
    """On-demand, not stored — see Dashboard.js's rejection-help buttons.
    Cheap enough (one short completion, max_tokens=160) to regenerate on
    every click rather than add a column and cache-invalidation story for
    something this disposable."""
    query, _, _ = _scope_filter(JobApplication.query.filter_by(id=app_id))
    app_row = query.first()
    if not app_row:
        raise APIError("Application not found", 404)

    body = request.get_json(force=True) or {}
    kind = body.get("kind")
    if kind not in INSIGHT_PROMPTS:
        raise APIError("kind must be 'why' or 'reapply'", 400)

    context = f"Role: {app_row.role}\nCompany: {app_row.company}"
    if app_row.notes:
        context += f"\nNotes / job description excerpt: {app_row.notes[:600]}"

    text = ai_complete(
        system="You are a calm, direct career coach. Keep responses extremely short — 2-3 sentences, no lists, no headers, no fluff, no preamble like \"Sure,\" just the sentences themselves.",
        prompt=f"{context}\n\n{INSIGHT_PROMPTS[kind]}",
        effort="low", max_tokens=160,
    )
    return jsonify({"success": True, "data": {"text": text}}), 200


@applications_bp.route("/<app_id>", methods=["DELETE"])
def delete_application(app_id):
    query, _, _ = _scope_filter(JobApplication.query.filter_by(id=app_id))
    app_row = query.first()
    if app_row:
        db.session.delete(app_row)
        db.session.commit()
    return jsonify({"success": True}), 200


@applications_bp.route("/calendar-token", methods=["GET"])
def calendar_feed_token():
    """Mints the .ics subscription token on first call rather than at
    signup — most accounts never touch calendar subscribe, so there's no
    reason to generate a secret nobody asked for. Signed-in only: a guest's
    identity (an X-Guest-Id header the browser holds) isn't something a
    calendar app can be handed as a durable, shareable subscription URL."""
    user_id, _ = get_scope(request)
    if not user_id:
        raise APIError("Sign in to subscribe to a calendar feed", 401)
    user = db.session.get(User, user_id)
    if not user.calendar_feed_token:
        user.calendar_feed_token = secrets.token_hex(24)
        db.session.commit()
    return jsonify({"success": True, "data": {
        "feed_url": f"{_BACKEND_URL}/api/v1/applications/calendar.ics?token={user.calendar_feed_token}",
    }}), 200


@applications_bp.route("/calendar.ics", methods=["GET"])
def calendar_feed():
    """The subscribable feed — a plain ?token= query param, not a header,
    since this URL is pasted into Google Calendar/Outlook/Apple Calendar,
    none of which can be told to send a custom Authorization header."""
    token = request.args.get("token", "")
    user = User.query.filter_by(calendar_feed_token=token).first() if token else None
    if not user:
        raise APIError("Invalid calendar token", 404)
    items = (JobApplication.query.filter_by(user_id=user.id)
             .filter(JobApplication.interview_date.isnot(None)).all())
    vevents = [v for v in (_vevent(a) for a in items) if v]
    ics = _ics_calendar(vevents, "Noqeev — Interviews")
    return Response(ics, content_type="text/calendar; charset=utf-8")


@applications_bp.route("/<app_id>/calendar.ics", methods=["GET"])
def application_calendar(app_id):
    """Single-event download — the "Add to calendar" button on one
    application's card, not the subscribe feed above."""
    query, _, _ = _scope_filter(JobApplication.query.filter_by(id=app_id))
    app_row = query.first()
    if not app_row:
        raise APIError("Application not found", 404)
    vevent = _vevent(app_row)
    if not vevent:
        raise APIError("This application has no interview date set", 400)
    ics = _ics_calendar([vevent], f"{app_row.company} interview")
    return Response(ics, content_type="text/calendar; charset=utf-8", headers={
        "Content-Disposition": f'attachment; filename="interview-{app_row.id}.ics"',
    })
