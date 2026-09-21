"""
app/utils/seo_scheduler.py — once-daily job that turns a connected Google
Search Console credential + CrUX's public API into one SeoSnapshot row.
Same shape as vendors.py/world_feed.py: shares the one BackgroundScheduler
instance task_reminders.py already starts (see app/__init__.py) rather than
running a second scheduler thread.

fetch_and_store_snapshot is also called directly by api/admin.py's
POST /seo/refresh-now — the manual "don't wait for the daily job" button —
so the fetch/store logic only lives in one place.
"""
from datetime import date, datetime, timedelta, timezone

from app import db
from app.utils import seo_client

SEO_POLL_SECONDS = 24 * 60 * 60


def fetch_and_store_snapshot(app):
    with app.app_context():
        from app.models import GoogleSearchConsoleCredential, SeoSnapshot

        credential = GoogleSearchConsoleCredential.query.first()
        if not credential:
            return None

        try:
            access_token = seo_client.refresh_access_token(credential.refresh_token)
            today = date.today()
            # Search Console's own data has a reporting lag — yesterday is
            # the most recent day it can reliably report on, querying
            # today itself would just come back empty.
            yesterday = (today - timedelta(days=1)).isoformat()
            analytics = seo_client.fetch_search_analytics(access_token, yesterday, yesterday)
            cwv = seo_client.fetch_crux_history() if seo_client.crux_configured() else {}
        except Exception as exc:
            print(f"❌ SEO snapshot fetch failed: {exc}")
            return None

        snapshot = SeoSnapshot.query.filter_by(snapshot_date=today).first()
        if not snapshot:
            snapshot = SeoSnapshot(snapshot_date=today)
            db.session.add(snapshot)

        snapshot.clicks = analytics["clicks"]
        snapshot.impressions = analytics["impressions"]
        snapshot.avg_position = analytics["avg_position"]
        snapshot.cwv_lcp_p75 = cwv.get("lcp_p75")
        snapshot.cwv_cls_p75 = cwv.get("cls_p75")
        snapshot.cwv_inp_p75 = cwv.get("inp_p75")
        db.session.commit()
        print(f"🔧 SEO snapshot stored for {today.isoformat()}")
        return snapshot


def start_seo_scheduler(scheduler, app):
    """Shares the one BackgroundScheduler instance task_reminders.py
    already starts (see app/__init__.py) rather than running a second
    scheduler thread. A silent no-op each run until an admin actually
    connects Search Console — fetch_and_store_snapshot returns None
    immediately when no credential row exists, same "non-fatal if not
    configured yet" posture as every other optional integration here."""
    scheduler.add_job(
        lambda: fetch_and_store_snapshot(app), "interval",
        seconds=SEO_POLL_SECONDS, next_run_time=datetime.now(),
    )
