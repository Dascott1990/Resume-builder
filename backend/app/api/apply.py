"""
app/api/apply.py — "Apply with AI": orchestrates one ApplicationRun end to
end. Everything genuinely novel about this feature lives here, not in the
agent/ modules — those are pure mechanics (browser, tools, LLM loop); this
file is the part that has to survive actually running on a single-worker,
no-queue Render dyno.

GET/PUT  /api/v1/apply/profile              — the CareerProfile (memory) this account/guest is building
POST     /api/v1/apply/runs                 — start a run (returns immediately, runs in a background thread)
GET      /api/v1/apply/runs                 — this scope's own runs
GET      /api/v1/apply/runs/<id>            — poll one run's status/progress
POST     /api/v1/apply/runs/<id>/answer     — answer a pending ask_user question, resumes the paused run
POST     /api/v1/apply/runs/<id>/confirm-submit — the ONE place a real submit click ever happens
POST     /api/v1/apply/runs/<id>/cancel     — cancel during execution or during the review window

Concurrency model: one automation running in-process at a time
(_RUN_LOCK), held for a run's ENTIRE lifetime — including the idle window
while a finished application sits at ready_for_review waiting on a human,
not just the active-automation portion. That's the direct consequence of
the founder's choice to keep the live browser session addressable so
confirm-submit can perform the real click (see agent/browser.py's
PendingReview) — a held Chromium process is real memory on a free-tier
dyno, so a 15-minute review timeout auto-expires an unattended run and
releases the lock rather than holding it indefinitely.

Threading, not Celery/RQ — render.yaml runs a single gunicorn worker and
there's no queue infrastructure anywhere in this app. A background
`threading.Thread` inside that one process doesn't block it from serving
other requests; see the plan doc for exactly when this stops being enough
(the moment two users realistically overlap) and what to replace it with
then. Not before — this is unproven; simplicity now, real infra when a
real second run collides with an active one.
"""
import re
import threading
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from flask import Blueprint, current_app, request, jsonify

from app import db, limiter
from app.models import CareerProfile, ApplicationRun, Media, JobApplication
from app.middleware.error_handlers import APIError
from app.utils.auth import get_scope
from app.agent.browser import AgentBrowserSession, PendingReview, register_session, get_pending, unregister_session, is_submit_classified
from app.agent.loop import run_agent_loop

apply_bp = Blueprint("apply", __name__)

REVIEW_TIMEOUT_MINUTES = 15
# Longest a run could legitimately hold the lock: automation (bounded by
# agent/loop.py's own step/wall-clock caps, generously a few minutes) plus
# the full review window, plus slack. Anything held longer than this is not
# a slow run — it's a background thread that died or hung without ever
# reaching its own `finally: _RUN_LOCK.release()` (a process kill mid-run,
# an unbounded call inside Playwright with no timeout, etc.), and the fix
# for that is not "wait for a redeploy to reset the process" — see
# _RunLock.try_acquire below.
MAX_LOCK_HOLD_SECONDS = (REVIEW_TIMEOUT_MINUTES + 10) * 60


class _RunLock:
    """A self-healing wrapper around threading.Lock — a stuck lock with no
    way to recover meant one dead/hung background thread could wedge this
    entire feature for every guest/user until the process happened to
    restart. try_acquire() forces the lock open first if it's been held
    implausibly long, rather than trusting every code path to have released
    it correctly.

    Ownership token, not just an open/closed lock: force-opening past
    max_hold_seconds doesn't mean the original holder actually died — it
    might just be a genuinely slow run that's about to finish and call its
    own release(). Without a token, that late release() would silently
    release whichever NEW run had since acquired the lock instead — one
    slow run corrupting a totally unrelated one's concurrency guarantee.
    Each acquire gets a fresh token; release(token) is a no-op unless it
    still matches the current holder, so only the run that actually holds
    the lock right now can ever release it."""

    def __init__(self, max_hold_seconds):
        self._lock = threading.Lock()
        self._acquired_at = None
        self._token = None
        self._next_token = 1
        self._max_hold_seconds = max_hold_seconds

    def try_acquire(self):
        if self._lock.locked() and self._acquired_at is not None:
            if time.monotonic() - self._acquired_at > self._max_hold_seconds:
                print(f"⚠️ ApplicationRun lock held over {self._max_hold_seconds}s — forcing it open (a background thread likely died without releasing it)")
                try:
                    self._lock.release()
                except RuntimeError:
                    pass
        acquired = self._lock.acquire(blocking=False)
        if not acquired:
            return None
        token = self._next_token
        self._next_token += 1
        self._token = token
        self._acquired_at = time.monotonic()
        return token

    def release(self, token):
        if token != self._token:
            # Stale caller — either this run was already force-reclaimed by
            # try_acquire's self-heal, or it never actually held the lock.
            # Releasing here would tear down whatever run holds it now.
            return
        self._token = None
        self._acquired_at = None
        try:
            self._lock.release()
        except RuntimeError:
            pass  # already released (e.g. force-opened above) — not an error


_RUN_LOCK = _RunLock(MAX_LOCK_HOLD_SECONDS)
# run_id -> PendingAnswer, only ever one entry per run since the loop fully
# pauses on ask_user rather than asking multiple questions in parallel.
_ANSWER_REGISTRY = {}
_ANSWER_REGISTRY_LOCK = threading.Lock()


class PendingAnswer:
    def __init__(self):
        self.answered = threading.Event()
        self.answer_text = None

    def provide(self, text):
        self.answer_text = text
        self.answered.set()


def _register_answer(run_id, pending):
    with _ANSWER_REGISTRY_LOCK:
        _ANSWER_REGISTRY[run_id] = pending


def _pop_answer(run_id):
    with _ANSWER_REGISTRY_LOCK:
        return _ANSWER_REGISTRY.pop(run_id, None)


def _peek_answer(run_id):
    with _ANSWER_REGISTRY_LOCK:
        return _ANSWER_REGISTRY.get(run_id)


# ── Scoping — identical shape to applications.py's _scope_filter; a leak
# here would be exactly the kind of bug already fixed once this session. ───
def _scope_filter(query):
    user_id, guest_id = get_scope(request)
    if user_id:
        return query.filter_by(user_id=user_id), user_id, guest_id
    if guest_id:
        return query.filter_by(guest_id=guest_id), user_id, guest_id
    return query.filter(db.false()), user_id, guest_id


def _serialize_run(run):
    return run.to_dict()


# ── CareerProfile ────────────────────────────────────────────────────────
@apply_bp.route("/profile", methods=["GET"])
def get_profile():
    query, user_id, guest_id = _scope_filter(CareerProfile.query)
    profile = query.first()
    if not profile:
        return jsonify({"success": True, "data": None}), 200
    return jsonify({"success": True, "data": profile.to_dict()}), 200


@apply_bp.route("/profile", methods=["PUT"])
def upsert_profile():
    user_id, guest_id = get_scope(request)
    if not user_id and not guest_id:
        raise APIError("Missing X-Guest-Id header", 400)

    query, _, _ = _scope_filter(CareerProfile.query)
    profile = query.first()
    if not profile:
        profile = CareerProfile(user_id=user_id, guest_id=None if user_id else guest_id)
        db.session.add(profile)

    body = request.get_json(force=True) or {}
    for field in ["full_name", "email", "phone", "location", "willing_to_relocate", "desired_salary_min"]:
        if field in body:
            setattr(profile, field, body[field])
    for field in ["work_authorization", "education", "work_history", "skills", "certifications", "eeo_demographics", "qa_answers"]:
        if field in body:
            setattr(profile, field, body[field])

    # Explicit confirm step — a human reviewing/saving this in the UI is
    # what promotes it from "AI proposal" to "the agent is allowed to treat
    # this as fact." See CareerProfile's docstring in models.py.
    if body.get("confirm"):
        profile.confirmed_at = datetime.now(timezone.utc)

    db.session.commit()
    return jsonify({"success": True, "data": profile.to_dict()}), 200


# ── Job-text extraction + resume tailoring (the "reading the job" and
# "preparing a resume" phases, before the fill-loop ever starts) ───────────
def _extract_job_text(session, max_chars=6000):
    try:
        text = session.page.inner_text("body")
    except Exception:
        text = ""
    return text.strip()[:max_chars]


def _prepare_tailored_resume(profile_dict, job_text, user_id, guest_id):
    """Reuses the exact prompt template + AI-calling helper /resume/optimize
    already uses (see app/api/resume.py) rather than a separate 'pick a
    resume' pipeline for this feature. Returns the new Media row, or None
    if there wasn't enough to work with (job_text too short) — callers
    treat that as non-fatal and fall back to no resume attached."""
    from app.api.resume import _ai_complete, SYSTEM, OPTIMIZE_PROMPT_TEMPLATE
    import json as _json
    import uuid as _uuid

    if len(job_text) < 50:
        return None

    work_history = profile_dict.get("work_history") or []
    latest_title = work_history[0].get("role") if work_history else "Professional"
    experience_text = "\n".join(
        f"{w.get('role', '')} at {w.get('company', '')} ({w.get('period', '')}): " + "; ".join(w.get("bullets") or [])
        for w in work_history
    ) or "Not provided"
    education_text = "\n".join(
        f"{e.get('degree', '')}, {e.get('school', '')} ({e.get('period', '')})" for e in (profile_dict.get("education") or [])
    ) or "Not provided"

    prompt = OPTIMIZE_PROMPT_TEMPLATE.format(
        name=profile_dict.get("full_name", ""), title=latest_title,
        location=profile_dict.get("location", ""), email=profile_dict.get("email", ""),
        phone=profile_dict.get("phone", ""), background=experience_text[:500],
        experience=experience_text, education=education_text,
        skills=", ".join(profile_dict.get("skills") or []) or "Not provided",
        job_description=job_text,
    )
    raw = _ai_complete(system=SYSTEM, prompt=prompt, effort="medium", max_tokens=3000, groq_temperature=0.5)
    clean = raw.replace("```json", "").replace("```", "").strip()
    parsed = _json.loads(clean)

    doc_bytes = _json.dumps(parsed).encode()
    record = Media(
        filename=f"resume_{_uuid.uuid4().hex[:8]}.json", media_type="document", mime_type="application/json",
        file_data=doc_bytes, file_size=len(doc_bytes),
        caption=f"{profile_dict.get('full_name')} — {parsed.get('contact', {}).get('title', latest_title)}",
        filter_name="guest_resume", user_id=user_id, guest_id=None if user_id else guest_id,
        metadata_json={"generated_at": datetime.now(timezone.utc).isoformat(), "tailored_for_apply_run": True},
    )
    db.session.add(record)
    db.session.flush()
    return record


def _build_review_snapshot(elements):
    """Turns raw extracted elements into what a human reviewer should
    actually see. Raw el['value'] is wrong for two of the three input
    shapes: a <select>'s .value is often a meaningless backend code (use
    the selected option's visible text instead), and a checkbox/radio's
    .value is usually a fixed constant like "on" regardless of whether it
    was checked (use .checked, and label the *group's* question — an
    option's own label is often just "Yes"/"No" with no context)."""
    entries = []
    for el in elements:
        is_choice = el.get("checked") is not None
        if el.get("tag") == "select":
            value = el.get("selected_label")
            field_label = el.get("label") or el.get("name") or ""
        elif is_choice:
            if not el.get("checked"):
                continue
            value = el.get("label") or "Selected"
            field_label = el.get("group_label") or el.get("label") or el.get("name") or ""
        else:
            value = el.get("value")
            field_label = el.get("label") or el.get("name") or ""
        if not value:
            continue
        entries.append({"label": field_label, "value": value})
    return entries


# ── The automation phase — reading_job through ready_for_review ───────────
def _do_automation_phase(run):
    session = AgentBrowserSession(run.id)
    session.start(run.target_url)

    run.status = "reading_job"
    db.session.commit()
    job_text = _extract_job_text(session)

    profile = CareerProfile.query.filter_by(user_id=run.user_id).first() if run.user_id else \
        CareerProfile.query.filter_by(guest_id=run.guest_id).first()
    if not profile or not profile.confirmed_at:
        run.status = "failed"
        run.error_message = "No confirmed career profile on file — review and confirm your profile before running Apply with AI."
        run.completed_at = datetime.now(timezone.utc)
        db.session.commit()
        session.close()
        return None

    profile_snapshot = profile.to_dict()

    run.status = "preparing_resume"
    db.session.commit()
    try:
        resume_media = _prepare_tailored_resume(profile_snapshot, job_text, run.user_id, run.guest_id)
    except Exception:
        resume_media = None  # non-fatal — the run proceeds, upload_file will surface as unfillable if actually needed
    if resume_media:
        run.resume_id = resume_media.id
        db.session.commit()

    run.status = "filling_form"
    run.profile_snapshot = profile_snapshot
    db.session.commit()

    pending_questions = list(run.pending_questions or [])
    unfillable_fields = list(run.unfillable_fields or [])

    def on_step(entry):
        steps = list(run.steps_log or [])
        steps.append({**entry, "timestamp": datetime.now(timezone.utc).isoformat()})
        run.steps_log = steps
        db.session.commit()

    while True:
        result = run_agent_loop(session, profile_snapshot, pending_questions, unfillable_fields, on_step)
        run.pending_questions = pending_questions
        run.unfillable_fields = unfillable_fields
        db.session.commit()

        if result["stop_reason"] == "needs_input":
            run.status = "needs_input"
            db.session.commit()
            pending_answer = PendingAnswer()
            _register_answer(run.id, pending_answer)
            got_answer = pending_answer.answered.wait(timeout=REVIEW_TIMEOUT_MINUTES * 60)
            _pop_answer(run.id)
            if not got_answer:
                run.status = "expired"
                run.completed_at = datetime.now(timezone.utc)
                db.session.commit()
                session.close()
                return None
            for q in pending_questions:
                if not q["answered"]:
                    q["answered"] = True
                    q["answer"] = pending_answer.answer_text
                    break
            run.pending_questions = pending_questions
            run.status = "filling_form"
            db.session.commit()
            continue

        if result["stop_reason"] == "done":
            break

        # Every non-"done"/non-"needs_input" stop_reason lands here, including
        # "step_limit_exceeded"/"time_limit_exceeded" — those used to be
        # written straight into run.status, but the frontend's status maps
        # (ProgressChecklist, TerminalScreen) only recognize the DB enum's
        # actual terminal values, so a capped run stuck displaying nothing
        # ever, forever "in progress" from the user's point of view. Always
        # land on "failed"; the real reason still reaches the user via
        # error_message, and whatever got filled survives in
        # filled_form_snapshot/steps_log either way.
        run.status = "failed"
        run.error_message = result.get("error") or {
            "step_limit_exceeded": "The application took too many steps to fill out automatically — review what was completed so far.",
            "time_limit_exceeded": "The application took too long to fill out automatically — review what was completed so far.",
        }.get(result["stop_reason"], f"Stopped: {result['stop_reason']}")
        run.completed_at = datetime.now(timezone.utc)
        db.session.commit()
        session.close()
        return None

    screenshot_bytes = session.screenshot_bytes()
    shot = Media(
        filename=f"apply_review_{run.id}.png", media_type="image", mime_type="image/png",
        file_data=screenshot_bytes, file_size=len(screenshot_bytes),
        guest_id=run.guest_id, user_id=run.user_id, filter_name="apply_review_screenshot",
    )
    db.session.add(shot)
    db.session.flush()
    run.review_screenshot_media_id = shot.id

    final_state = session.extract_state()
    run.filled_form_snapshot = {"elements": _build_review_snapshot(final_state["elements"])}
    run.status = "ready_for_review"
    db.session.commit()
    return session  # kept alive on purpose — the caller owns the review-wait phase


def _company_name_from_url(target_url):
    """filled_form_snapshot has no "company" key — it's a flat list of
    {label, value} pairs (see _build_review_snapshot), and even if some
    ATS form happened to have a field literally labeled "company", that's
    just as likely to be "current employer" (a PREVIOUS company) as the
    one being applied to — scraping it would risk mislabeling the tracker
    entry with the wrong company entirely. The URL's own hostname is the
    one signal that's always present and unambiguous."""
    try:
        host = urlparse(target_url).netloc
    except ValueError:
        host = ""
    host = re.sub(r"^www\.", "", host)
    return host or "Unknown"


def _find_submit_ref(session):
    state = session.extract_state()
    for el in state["elements"]:
        if is_submit_classified(el["label"], el["tag"], el["type"], el["in_form"]):
            return el["ref"]
    return None


def _execute_run(app, run_id, lock_token):
    try:
        with app.app_context():
            run = db.session.get(ApplicationRun, run_id)
            if not run:
                return
            try:
                session = _do_automation_phase(run)
            except Exception as e:
                run.status = "failed"
                run.error_message = str(e)[:1000]
                run.completed_at = datetime.now(timezone.utc)
                db.session.commit()
                return

            if session is None:
                return  # already resolved (failed/expired) inside _do_automation_phase

            pending = PendingReview()
            session_id = register_session(pending)
            # Everything below owns a live Chromium process (`session`) and a
            # registry entry (`session_id`) that a concurrent /confirm-submit
            # or /cancel request thread may be blocked on right now
            # (`pending.decided.wait`) or about to block on (`pending.acted.wait`
            # — see PendingReview usage in the routes below). Any unhandled
            # exception here — a dropped DB connection, a Playwright crash —
            # must still release all three, or the browser leaks forever and
            # the other thread hangs until its own timeout instead of getting
            # an answer.
            try:
                run.browser_session_id = session_id
                run.review_expires_at = datetime.now(timezone.utc) + timedelta(minutes=REVIEW_TIMEOUT_MINUTES)
                db.session.commit()

                pending.decided.wait(timeout=REVIEW_TIMEOUT_MINUTES * 60)

                if pending.outcome == "submit":
                    try:
                        ref = _find_submit_ref(session)
                        if not ref:
                            raise RuntimeError("Could not find the submit button on the page.")
                        session.click(ref)
                        run.status = "submitted"
                        if run.resume_id:
                            db.session.add(JobApplication(
                                company=_company_name_from_url(run.target_url),
                                role="Applied via Apply with AI", status="applied",
                                resume_id=run.resume_id, user_id=run.user_id,
                                guest_id=None if run.user_id else run.guest_id,
                            ))
                        pending.result = {"ok": True}
                    except Exception as e:
                        run.status = "failed"
                        run.error_message = f"Submit failed: {e}"[:1000]
                        pending.result = {"ok": False}
                        pending.error = str(e)
                elif pending.outcome == "cancel":
                    run.status = "cancelled"
                    pending.result = {"ok": True}
                else:
                    run.status = "expired"

                run.completed_at = datetime.now(timezone.utc)
                db.session.commit()
            except Exception as e:
                pending.result = {"ok": False}
                pending.error = str(e)
                try:
                    run.status = "failed"
                    run.error_message = f"Review-wait phase error: {e}"[:1000]
                    run.completed_at = datetime.now(timezone.utc)
                    db.session.commit()
                except Exception:
                    db.session.rollback()
            finally:
                pending.acted.set()
                unregister_session(session_id)
                try:
                    session.close()
                except Exception:
                    pass
    finally:
        _RUN_LOCK.release(lock_token)


# ── Routes ──────────────────────────────────────────────────────────────
_URL_RE = re.compile(r"^https?://", re.IGNORECASE)


@apply_bp.route("/runs", methods=["POST"])
@limiter.limit("5 per hour")
def create_run():
    user_id, guest_id = get_scope(request)
    if not user_id and not guest_id:
        raise APIError("Missing X-Guest-Id header", 400)

    body = request.get_json(force=True) or {}
    target_url = (body.get("target_url") or "").strip()
    if not _URL_RE.match(target_url):
        raise APIError("target_url must be a valid http(s) URL", 400)

    lock_token = _RUN_LOCK.try_acquire()
    if lock_token is None:
        raise APIError("An automation is already running for this app — please try again shortly.", 429)

    # The lock is held from here on — anything that fails before the
    # background thread takes ownership of lock_token (in its own
    # finally: _RUN_LOCK.release(lock_token)) must release it itself, or a
    # DB hiccup on this one request would wedge every future run behind a
    # lock nothing will ever release.
    try:
        run = ApplicationRun(
            target_url=target_url, status="queued",
            user_id=user_id, guest_id=None if user_id else guest_id,
            steps_log=[], pending_questions=[], unfillable_fields=[],
        )
        db.session.add(run)
        db.session.commit()

        app_obj = current_app._get_current_object()
        threading.Thread(target=_execute_run, args=(app_obj, run.id, lock_token), daemon=True).start()
    except Exception:
        _RUN_LOCK.release(lock_token)
        raise

    return jsonify({"success": True, "data": _serialize_run(run)}), 201


@apply_bp.route("/runs", methods=["GET"])
def list_runs():
    query, _, _ = _scope_filter(ApplicationRun.query)
    items = query.order_by(ApplicationRun.created_at.desc()).limit(20).all()
    return jsonify({"success": True, "data": [_serialize_run(r) for r in items]}), 200


@apply_bp.route("/runs/<run_id>", methods=["GET"])
def get_run(run_id):
    query, _, _ = _scope_filter(ApplicationRun.query.filter_by(id=run_id))
    run = query.first()
    if not run:
        raise APIError("Run not found", 404)
    return jsonify({"success": True, "data": _serialize_run(run)}), 200


@apply_bp.route("/runs/<run_id>/answer", methods=["POST"])
def answer_run(run_id):
    query, _, _ = _scope_filter(ApplicationRun.query.filter_by(id=run_id))
    run = query.first()
    if not run:
        raise APIError("Run not found", 404)
    if run.status != "needs_input":
        raise APIError("This run isn't waiting on an answer right now.", 400)

    body = request.get_json(force=True) or {}
    answer_text = (body.get("answer") or "").strip()
    if not answer_text:
        raise APIError("answer is required", 400)

    pending = _peek_answer(run_id)
    if not pending:
        raise APIError("This run's automation isn't actively waiting — it may have expired.", 409)
    pending.provide(answer_text)
    return jsonify({"success": True, "data": _serialize_run(run)}), 200


@apply_bp.route("/runs/<run_id>/confirm-submit", methods=["POST"])
def confirm_submit(run_id):
    query, _, _ = _scope_filter(ApplicationRun.query.filter_by(id=run_id))
    run = query.first()
    if not run:
        raise APIError("Run not found", 404)
    if run.status != "ready_for_review":
        raise APIError("This run isn't ready for submission.", 400)

    pending = get_pending(run.browser_session_id) if run.browser_session_id else None
    if not pending:
        raise APIError("This run's review session has expired — please start a new application.", 409)

    result, error = pending.confirm(timeout=30)
    db.session.refresh(run)
    if error or not (result or {}).get("ok"):
        raise APIError(error or "Submission failed.", 502)
    return jsonify({"success": True, "data": _serialize_run(run)}), 200


@apply_bp.route("/runs/<run_id>/cancel", methods=["POST"])
def cancel_run(run_id):
    query, _, _ = _scope_filter(ApplicationRun.query.filter_by(id=run_id))
    run = query.first()
    if not run:
        raise APIError("Run not found", 404)

    if run.status == "ready_for_review" and run.browser_session_id:
        pending = get_pending(run.browser_session_id)
        if pending:
            pending.cancel(timeout=30)
            db.session.refresh(run)
            return jsonify({"success": True, "data": _serialize_run(run)}), 200

    if run.status in ("submitted", "failed", "cancelled", "expired"):
        return jsonify({"success": True, "data": _serialize_run(run)}), 200

    # Mid-automation cancel: no clean interrupt point in the tool loop for
    # v1 — mark it and let the background thread's own completion no-op
    # once it notices (checked nowhere yet — acceptable MVP gap, the run
    # will simply keep going to its natural stop and this flag is mostly
    # informative). A real interrupt point is a reasonable fast-follow.
    run.status = "cancelled"
    run.completed_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({"success": True, "data": _serialize_run(run)}), 200


def sweep_stuck_runs(app):
    """Boot-time cleanup — a redeploy mid-run leaves rows stuck in an
    active status with no code path left that will ever update them
    (their owning thread is gone). Called once from create_app()."""
    with app.app_context():
        stuck = ApplicationRun.query.filter(
            ApplicationRun.status.in_(["queued", "reading_job", "preparing_resume", "filling_form", "needs_input", "ready_for_review"])
        ).all()
        for run in stuck:
            run.status = "failed"
            run.error_message = "Interrupted by a server restart."
            run.completed_at = datetime.now(timezone.utc)
        if stuck:
            db.session.commit()
            print(f"🔧 Swept {len(stuck)} stuck ApplicationRun row(s) after restart")
