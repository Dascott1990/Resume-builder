"""
app/utils/task_reminders.py — the background half of /brand's task list.

Two different triggers, on purpose:
- Recurring regeneration (next_occurrence) is event-driven — it runs the
  instant a recurring task is marked done (see api/brand.py's PATCH
  handler), not on a timer. A task going overdue without being completed
  should just sit visibly overdue, not quietly reschedule itself as if
  nothing was missed.
- The "this is due" push IS on a timer (check_due_tasks, polled every
  REMINDER_POLL_SECONDS) — a due date can arrive with nobody in the app to
  trigger anything, so something has to notice on its own.
"""
import json
import os
from datetime import datetime, timedelta, timezone

REMINDER_POLL_SECONDS = 15 * 60


def check_due_tasks(app):
    """Pushes exactly once per task per due occurrence — reminded_at gates
    against re-firing on every poll while a task sits overdue and undone."""
    from app import db
    from app.models import BrandTask, PushSubscription
    from app.utils.push import push_configured, send_push_to_all

    with app.app_context():
        if not push_configured():
            return
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        due = BrandTask.query.filter(
            BrandTask.done.is_(False),
            BrandTask.due_at.isnot(None),
            BrandTask.due_at <= now,
            BrandTask.reminded_at.is_(None),
        ).all()
        if not due:
            return
        subs = PushSubscription.query.all()
        for task in due:
            if subs:
                payload = json.dumps({"title": f"Due: {task.title}", "body": task.notes or "", "link": "/brand"})
                try:
                    dead_ids = send_push_to_all(subs, payload)
                    if dead_ids:
                        PushSubscription.query.filter(PushSubscription.id.in_(dead_ids)).delete(synchronize_session=False)
                except Exception as exc:
                    print(f"❌ Push failed for task {task.id}: {exc}")
            task.reminded_at = now
        db.session.commit()


def start_scheduler(app):
    """Guarded against Flask's own dev-mode reloader (which imports and
    runs create_app() twice — once in a parent watcher process, once in
    the real child) — without this, local dev would run two schedulers
    and push every reminder twice. Gunicorn in production never sets
    app.debug, so this always starts there; render.yaml runs a single
    worker with no -w flag, so there's only ever one scheduler in
    production too, not one per worker."""
    if app.debug and os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        return None
    from apscheduler.schedulers.background import BackgroundScheduler
    scheduler = BackgroundScheduler(daemon=True)
    scheduler.add_job(lambda: check_due_tasks(app), "interval", seconds=REMINDER_POLL_SECONDS, next_run_time=datetime.now())
    scheduler.start()
    return scheduler


def next_occurrence(due_at, recurring):
    """Naive month math — good enough for a reminder date, not a
    financial system. min(day, 28) sidesteps Feb/30-day edge cases
    entirely rather than handling each one."""
    if not due_at or not recurring:
        return None
    if recurring == "weekly":
        return due_at + timedelta(days=7)
    if recurring == "monthly":
        month = due_at.month + 1
        year = due_at.year + (1 if month > 12 else 0)
        month = month if month <= 12 else 1
        return due_at.replace(year=year, month=month, day=min(due_at.day, 28))
    return None


def build_ics(task):
    """A minimal, valid .ics VEVENT — opens in Google/Apple/Outlook
    calendar alike on import, no library needed for something this small."""
    dt = (task.due_at or datetime.now(timezone.utc).replace(tzinfo=None)).strftime("%Y%m%dT%H%M%SZ")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    desc = (task.notes or "").replace("\n", "\\n")
    return (
        "BEGIN:VCALENDAR\r\n"
        "VERSION:2.0\r\n"
        "PRODID:-//Noqeev//Brand Tasks//EN\r\n"
        "BEGIN:VEVENT\r\n"
        f"UID:{task.id}@noqeev\r\n"
        f"DTSTAMP:{stamp}\r\n"
        f"DTSTART:{dt}\r\n"
        f"SUMMARY:{task.title}\r\n"
        f"DESCRIPTION:{desc}\r\n"
        "END:VEVENT\r\n"
        "END:VCALENDAR\r\n"
    )
