"""
app/utils/schedule_reminders.py — the background half of the post
scheduler (api/admin.py's /scheduled-posts routes). Same reminded_at-
gates-a-one-time-fire shape utils/task_reminders.py's check_due_tasks
already uses for BrandTask, applied to ScheduledPost: not an auto-poster
(nothing here talks to Instagram/TikTok/anything — this app has no API
integration with any social platform), just a nudge — an email that
says "this was due, go post it" — the moment scheduled_at arrives with
nobody necessarily watching the admin panel at that exact second.

The persistent in-app badge (AdminDashboard.js's Scheduler tab) is a
DIFFERENT signal from this file entirely: that's a live query ("how
many scheduled posts are at/past their time and not yet fully posted"),
recomputed on every page load — it doesn't need a background job at
all, and clears itself the instant every handle is marked posted. This
file exists only to make sure a human gets pinged even when they aren't
looking at that badge right when it's due.
"""
from datetime import datetime, timezone

REMINDER_POLL_SECONDS = 10 * 60


def _handle_lines(post):
    return "".join(
        f'<li>{h.handle.platform if h.handle else "?"} — {h.handle.handle_name if h.handle else "?"}</li>'
        for h in post.handles
    )


def check_due_scheduled_posts(app):
    """Emails exactly once per post per due occurrence — reminded_at
    gates against re-firing on every poll while a post sits due and
    un-posted. Skipped entirely (not an error, not a retry) when mail
    isn't configured, or when a post has no notify_email set at all."""
    from app import db
    from app.models import ScheduledPost
    from app.utils.mail import send_email, mail_configured

    with app.app_context():
        if not mail_configured():
            return
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        due = ScheduledPost.query.filter(
            ScheduledPost.status == "scheduled",
            ScheduledPost.scheduled_at <= now,
            ScheduledPost.reminded_at.is_(None),
            ScheduledPost.notify_email.isnot(None),
        ).all()
        if not due:
            return
        for post in due:
            try:
                send_email(
                    post.notify_email, f"Noqeev — time to post: {post.title}",
                    f"""<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:8px;">
                      <p style="font-weight:800;letter-spacing:0.02em;color:#111;margin:0 0 24px;">NOQEEV</p>
                      <h2 style="color:#111;margin:0 0 12px;">Time to post: {post.title}</h2>
                      <p style="color:#444;line-height:1.6;margin:0 0 12px;">Scheduled for right about now. Post it to:</p>
                      <ul style="color:#444;line-height:1.7;margin:0 0 16px;padding-left:20px;">{_handle_lines(post)}</ul>
                      <p style="color:#888;font-size:13px;margin:0;">Mark each handle done in the admin panel once you have — the reminder clears once every one is.</p>
                    </div>""",
                )
            except Exception as exc:
                print(f"❌ Reminder email failed for scheduled post {post.id}: {exc}")
                continue  # left un-reminded — the next poll retries it, not stuck silently forever
            post.reminded_at = now
        db.session.commit()


def start_schedule_reminders_scheduler(scheduler, app):
    """Shares the one BackgroundScheduler instance task_reminders.py
    already starts (see app/__init__.py) rather than running a second
    scheduler thread."""
    scheduler.add_job(
        lambda: check_due_scheduled_posts(app), "interval",
        seconds=REMINDER_POLL_SECONDS, next_run_time=datetime.now(),
    )
