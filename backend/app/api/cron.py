"""
app/api/cron.py — the ONE endpoint an external scheduled ping (a GitHub
Action on a cron schedule, see .github/workflows/scheduler-reminders.yml)
hits to drive the post scheduler's reminders, instead of an in-process
timer or a task queue. Deliberately outside /api/v1/workspace: this isn't
scoped by any one workspace's token — it walks every workspace's due
ScheduledPost rows in one pass — so it's gated by a separate shared
secret instead, checked before anything else runs.
"""
import os

from flask import Blueprint, request, jsonify

from app.middleware.error_handlers import APIError
from app.utils.schedule_reminders import check_due_scheduled_posts

cron_bp = Blueprint("cron", __name__)


def _require_cron_secret(request):
    secret = os.environ.get("CRON_SECRET")
    if not secret:
        raise APIError("CRON_SECRET is not configured", 503)
    provided = request.headers.get("X-Cron-Secret") or ""
    if not provided or provided != secret:
        raise APIError("Invalid cron secret", 401)


@cron_bp.route("/due-reminders", methods=["POST"])
def due_reminders():
    _require_cron_secret(request)
    result = check_due_scheduled_posts()
    return jsonify({"success": True, "data": result}), 200
