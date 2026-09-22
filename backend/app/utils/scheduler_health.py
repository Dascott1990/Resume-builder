"""
app/utils/scheduler_health.py — tracks whether each background job
actually ran, and whether it raised, without changing what any of them
do. Wraps the SAME lambda: fn(app) call app/__init__.py already passes
to scheduler.add_job — nothing about the 4 existing jobs' own behavior
changes, this just records a timestamp + outcome around each run so the
admin Health tab (see api/admin.py's /health route) can show "still
alive" instead of a black box.

Deliberately coarse: "ok" means the job returned without raising, not
that everything it tried to do internally succeeded — several of these
jobs already catch their own real failures (a bad Search Console token,
one failed push) and print an error rather than raise, exactly so one
bad row/subscriber never kills the whole polling loop. Those failures
still show up in Render's real logs; this tracks the coarser "is the
scheduler itself still cycling" question, not a replacement for reading
logs when something's actually wrong.
"""
import time
from datetime import datetime, timezone


def run_tracked(app, job_name, fn):
    with app.app_context():
        from app import db
        from app.models import SchedulerStatus

        start = time.monotonic()
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        status = db.session.get(SchedulerStatus, job_name)
        if not status:
            status = SchedulerStatus(job_name=job_name)
            db.session.add(status)

        try:
            fn(app)
            status.last_run_at = now
            status.last_success_at = now
            status.last_status = "ok"
            status.last_error = None
        except Exception as exc:
            status.last_run_at = now
            status.last_status = "error"
            status.last_error = str(exc)[:2000]
            print(f"❌ Scheduled job '{job_name}' failed: {exc}")
        finally:
            status.last_duration_ms = int((time.monotonic() - start) * 1000)
            db.session.commit()
