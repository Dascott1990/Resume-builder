import logging
import os
import traceback
from datetime import datetime, timedelta, timezone

from flask import jsonify
from sqlalchemy.exc import OperationalError

from app.utils.mail import send_email, wrap_email_html, FRONTEND_URL, mail_configured

logger = logging.getLogger(__name__)


class APIError(Exception):
    """Raised deliberately, with a message that's safe to show the user."""

    def __init__(self, message, status_code=400, code=None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        # Optional machine-readable tag (e.g. "EMAIL_NOT_VERIFIED") so the
        # frontend can branch on specific cases (show a resend button)
        # without parsing the human-readable message string.
        self.code = code


# ── DB-outage admin alert ────────────────────────────────────────────────
# A dead database connection hits EVERY DB-backed route identically (login,
# signup, saving a resume, all of it) — without this, the only way anyone
# finds out is a user complaining, or someone happening to tail Render's
# logs. Module-level, not a DB row: the one thing this can't do is write to
# the database it's reporting as down. Resets on a process restart, which
# is an acceptable tradeoff for something this simple (see render.yaml's
# own single-worker comment — one process, one counter, no coordination
# needed) and genuinely fine either way: a restart happening at all is
# itself a reasonable point to re-arm the alert.
_last_outage_alert_at = None
_outage_count_since_alert = 0
_ALERT_INTERVAL = timedelta(hours=3)


def _note_db_outage():
    """Best-effort: log every occurrence, email the admin at most once per
    _ALERT_INTERVAL regardless of how many requests fail in between. Never
    raises — a failure here must never turn a 503 into a 500."""
    global _last_outage_alert_at, _outage_count_since_alert
    _outage_count_since_alert += 1
    now = datetime.now(timezone.utc)
    logger.error("DB_OUTAGE: database unreachable (%d since last alert)", _outage_count_since_alert)

    if _last_outage_alert_at and (now - _last_outage_alert_at) < _ALERT_INTERVAL:
        return
    to = os.environ.get("ADMIN_BOOTSTRAP_EMAIL")
    if not to or not mail_configured():
        return
    try:
        send_email(
            to,
            "Database outage detected",
            wrap_email_html(
                "Database outage detected",
                f"The database has been unreachable as of {now.strftime('%Y-%m-%d %H:%M UTC')}. "
                f"{_outage_count_since_alert} request(s) failed since the last alert. "
                "Users are seeing a plain, generic apology, nothing database-specific.",
                "Open admin", f"{FRONTEND_URL}/admin",
                "You'll get another alert like this at most once every 3 hours while this keeps happening.",
            ),
        )
        _last_outage_alert_at = now
        _outage_count_since_alert = 0
    except Exception:
        logger.error("Failed to send DB outage alert email", exc_info=True)


def register_error_handlers(app):
    @app.errorhandler(APIError)
    def handle_api_error(err):
        body = {"success": False, "error": err.message}
        if err.code:
            body["code"] = err.code
        return jsonify(body), err.status_code

    @app.errorhandler(404)
    def handle_404(err):
        return jsonify({"success": False, "error": "Not found"}), 404

    @app.errorhandler(500)
    def handle_500(err):
        logger.error("Unhandled 500 error", exc_info=True)
        return jsonify({"success": False, "error": "Internal server error"}), 500

    # Catch-all for anything not already handled above (e.g. raw DB errors).
    # This is the ONLY place unexpected exceptions land, so it must log the
    # full traceback — without this, "An unexpected error occurred" is the
    # last thing anyone (including us) ever sees.
    @app.errorhandler(Exception)
    def handle_generic_error(err):
        logger.error("Unhandled exception: %s", err, exc_info=True)
        # Also print for environments (like Render's basic log tail) that
        # don't surface the logging module's output distinctly from stdout.
        traceback.print_exc()

        # A dead database connection (wrong credentials, network partition,
        # a provider-side outage/quota like Neon's data-transfer cap) is by
        # far the most common thing to land here uncaught — every DB-backed
        # route hits it identically, including plain sign-in/sign-up. This
        # used to say so explicitly ("the database is temporarily
        # unavailable... use Emergency access instead") — admin-internal
        # language with an admin-only escape hatch, shown to every ordinary
        # user who just wanted to log in. Whether the database is the cause
        # is our problem, not theirs: the message now just owns the fault
        # and says so. (Admin already knows to go to /admin for break-glass
        # access — that's never surfaced through this generic path.)
        if isinstance(err, OperationalError):
            _note_db_outage()
            return jsonify({
                "success": False,
                "error": "Something went wrong on our end. We're already on it, please try again shortly.",
                "code": "SERVICE_UNAVAILABLE",
            }), 503

        return jsonify({"success": False, "error": "An unexpected error occurred"}), 500
