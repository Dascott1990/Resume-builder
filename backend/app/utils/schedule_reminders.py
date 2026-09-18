"""
app/utils/schedule_reminders.py — the post scheduler's reminder pass:
same reminded_at-gates-a-one-time-fire shape task_reminders.py's
check_due_tasks already uses for BrandTask, applied to ScheduledPost.
Not an auto-poster (nothing here talks to Instagram/TikTok/anything —
this app has no API integration with any social platform), just a
nudge — an email that says "this was due, go post it" — the moment
scheduled_at arrives.

Driven by api/cron.py's externally-triggered /api/v1/cron/due-reminders
(a GitHub Action on a schedule, see .github/workflows/
scheduler-reminders.yml) rather than an in-process timer — this
function itself has no scheduling logic at all, just "find what's due,
email it, mark it reminded." Runs inside the request that calls it, so
it needs no app_context of its own.

The persistent in-app badge (SchedulerTool.js) is a DIFFERENT signal
from this file entirely: that's a live query (GET /scheduled-posts/
due-count — "how many scheduled posts are at/past their time and not
yet fully posted"), recomputed on every load — it doesn't need this
pass to have run at all, and clears itself the instant every handle is
marked posted. This file exists only to make sure a human gets pinged
by email even when nobody's looking at that badge right when it's due.
"""
import os
from datetime import datetime, timezone

FRONTEND_URL = (os.environ.get("FRONTEND_URL") or "http://localhost:3000").rstrip("/")


def _handle_lines(post):
    return "".join(
        f'<li>{h.handle.platform if h.handle else "?"} — {h.handle.handle_name if h.handle else "?"}</li>'
        for h in post.handles
    )


def check_due_scheduled_posts():
    """Emails exactly once per post per due occurrence — reminded_at
    gates against re-firing while a post sits due and un-posted. A post
    with no notify_email of its own falls back to its workspace's
    default (BrandWorkspace.notify_email) — set once when the workspace
    is created/edited, so scheduling a post doesn't require re-typing an
    email every time. Skipped entirely (not an error, not a retry) when
    mail isn't configured. Returns {checked, emailed} for the caller
    (api/cron.py) to report back to whatever triggered it."""
    from app import db
    from app.models import ScheduledPost
    from app.utils.mail import send_email, mail_configured

    if not mail_configured():
        return {"checked": 0, "emailed": 0, "skipped": "mail not configured"}

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    due = ScheduledPost.query.filter(
        ScheduledPost.status == "scheduled",
        ScheduledPost.scheduled_at <= now,
        ScheduledPost.reminded_at.is_(None),
    ).all()

    emailed = 0
    for post in due:
        recipient = post.notify_email or (post.workspace.notify_email if post.workspace else None)
        if not recipient:
            continue
        workspace_link = f"{FRONTEND_URL}/?ws={post.workspace.token}" if post.workspace else FRONTEND_URL
        try:
            send_email(
                recipient, f"Noqeev — time to post: {post.title}",
                f"""<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:8px;">
                  <p style="font-weight:800;letter-spacing:0.02em;color:#111;margin:0 0 24px;">NOQEEV</p>
                  <h2 style="color:#111;margin:0 0 12px;">Time to post: {post.title}</h2>
                  <p style="color:#444;line-height:1.6;margin:0 0 12px;">Scheduled for right about now. Post it to:</p>
                  <ul style="color:#444;line-height:1.7;margin:0 0 16px;padding-left:20px;">{_handle_lines(post)}</ul>
                  <p style="margin:0 0 16px;"><a href="{workspace_link}" style="color:#f59e0b;font-weight:700;">Open your branding workspace</a></p>
                  <p style="color:#888;font-size:13px;margin:0;">Mark each handle done there once you have — the reminder clears once every one is.</p>
                </div>""",
            )
            emailed += 1
        except Exception as exc:
            print(f"❌ Reminder email failed for scheduled post {post.id}: {exc}")
            continue  # left un-reminded — the next scheduled ping retries it, not stuck silently forever
        post.reminded_at = now

    db.session.commit()
    return {"checked": len(due), "emailed": emailed}
