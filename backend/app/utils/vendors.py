"""
app/utils/vendors.py — the admin "Vendors" panel's backend logic: which
third-party services this app is actually configured to use, detected
from real env-var presence (never guessed or hardcoded as "in use" when
it isn't), plus real status-page news for whichever ones an admin has
pointed at a feed.

CATALOG only covers services this backend process can actually see. Some
real dependencies (Vercel, for the frontend's hosting) live entirely in a
build environment this code never runs in — those are never auto-added;
an admin adds them by hand, same as any other vendor this list doesn't
know about yet.
"""
import os
from datetime import datetime, timezone

VENDOR_NEWS_POLL_SECONDS = 20 * 60


def _detect_neon(env):
    url = env.get("DATABASE_URL") or ""
    return "DATABASE_URL" if "neon.tech" in url else None


def _detect_mail(env):
    return "MAIL_SERVER" if env.get("MAIL_SERVER") else None


def _mail_name(env):
    host = (env.get("MAIL_SERVER") or "").lower()
    if "gmail" in host:
        return "Gmail SMTP"
    if "sendgrid" in host:
        return "SendGrid"
    if "mailgun" in host:
        return "Mailgun"
    return f"SMTP ({env.get('MAIL_SERVER')})"


# Each entry: a stable "key" (see Vendor.catalog_key), a detect(env) -> the
# env var name that proved it's configured (or None), and starting guesses
# for the fields an admin can freely correct afterward — detection only
# ever sets these ONCE, on first sight (see sync_vendor_catalog).
CATALOG = [
    {
        "key": "anthropic", "name": "Anthropic (Claude)", "category": "ai",
        "detect": lambda env: "CLAUDE_API_KEY" if env.get("CLAUDE_API_KEY") else None,
        "console_url": "https://console.anthropic.com", "plan": "Pay as you go", "is_free": False,
    },
    {
        "key": "groq", "name": "Groq", "category": "ai",
        "detect": lambda env: "GROQ_API_KEY" if env.get("GROQ_API_KEY") else None,
        "console_url": "https://console.groq.com", "plan": "Free tier — verify", "is_free": True,
    },
    {
        "key": "neon", "name": "Neon (Postgres)", "category": "database",
        "detect": _detect_neon,
        "console_url": "https://console.neon.tech", "plan": "Free tier — verify", "is_free": True,
    },
    {
        "key": "stripe", "name": "Stripe", "category": "payments",
        "detect": lambda env: "STRIPE_SECRET_KEY" if env.get("STRIPE_SECRET_KEY") else None,
        "console_url": "https://dashboard.stripe.com", "plan": "Pay as you go", "is_free": False,
    },
    {
        "key": "mail", "name": None, "dynamic_name": _mail_name, "category": "email",
        "detect": _detect_mail,
        "console_url": None, "plan": "Unknown — set your plan", "is_free": None,
    },
    {
        "key": "webpush", "name": "Web Push (VAPID)", "category": "push",
        "detect": lambda env: "VAPID_PRIVATE_KEY" if env.get("VAPID_PRIVATE_KEY") else None,
        "console_url": None, "plan": "Free — self-hosted, no vendor subscription", "is_free": True,
    },
    {
        "key": "render", "name": "Render", "category": "hosting",
        "detect": lambda env: "RENDER" if env.get("RENDER") else None,
        "console_url": "https://dashboard.render.com", "plan": "Unknown — set your plan", "is_free": None,
    },
]


def sync_vendor_catalog():
    """Upserts one row per CATALOG entry that's actually detected in this
    environment. Must run inside an app context that's already active (a
    request handler, or sync_vendor_catalog_at_boot below) — unlike the
    boot-time-only helpers elsewhere in this app, this one is also called
    directly from the admin "Re-scan" route, which already has a context.
    Returns how many new rows were added."""
    from app import db
    from app.models import Vendor

    env = os.environ
    added = 0
    for entry in CATALOG:
        detected_via = entry["detect"](env)
        if not detected_via:
            continue
        if Vendor.query.filter_by(catalog_key=entry["key"]).first():
            continue
        name = entry["dynamic_name"](env) if entry.get("dynamic_name") else entry["name"]
        db.session.add(Vendor(
            name=name, category=entry["category"], plan=entry["plan"],
            is_free=entry["is_free"], console_url=entry["console_url"],
            auto_detected=True, detected_via=detected_via, catalog_key=entry["key"],
        ))
        added += 1
    if added:
        db.session.commit()
        print(f"🔧 Vendor sync: added {added} auto-detected service(s)")
    return added


def sync_vendor_catalog_at_boot(app):
    """Runs once ever, not on every boot — an admin deleting an
    auto-detected row they don't want tracked shouldn't have it silently
    reappear the next time the process restarts (same reasoning as
    app/__init__.py's _bootstrap_brand_tasks). Re-detecting after that is
    an explicit admin action via the "Re-scan" button, not automatic."""
    from app.models import Vendor

    with app.app_context():
        if Vendor.query.first() is not None:
            return
        sync_vendor_catalog()


def refresh_vendor_news(app):
    """Pulls real status/incident items for whichever vendors an admin has
    set a status_feed_url on — reuses world_feed.py's generic RSS parser
    rather than duplicating it. Per-vendor try/except: one bad or
    unreachable feed costs only that vendor's items this poll, never the
    others, same defensive shape as refresh_world_feed."""
    from app import db
    from app.models import Vendor, VendorNewsItem
    from app.utils.world_feed import fetch_rss

    with app.app_context():
        vendors = Vendor.query.filter(Vendor.status_feed_url.isnot(None)).all()
        if not vendors:
            return

        existing_ids = {row[0] for row in db.session.query(VendorNewsItem.external_id).all()}
        added = 0
        for v in vendors:
            try:
                items = fetch_rss(f"vendor-{v.id}", "vendor", v.status_feed_url, limit=5)
            except Exception as exc:
                print(f"❌ Vendor news fetch failed ({v.name}): {exc}")
                continue
            for it in items:
                if it["external_id"] in existing_ids:
                    continue
                db.session.add(VendorNewsItem(
                    vendor_id=v.id, external_id=it["external_id"],
                    title=it["title"], url=it["url"], published_at=it["published_at"],
                ))
                existing_ids.add(it["external_id"])
                added += 1
        if added:
            db.session.commit()
            print(f"🔧 Vendor news: added {added} new item(s)")


def start_vendor_news_scheduler(scheduler, app):
    """Shares the one BackgroundScheduler instance task_reminders.py
    already starts (see app/__init__.py) rather than running a second
    scheduler thread."""
    from app.utils.scheduler_health import run_tracked
    scheduler.add_job(
        lambda: run_tracked(app, "vendor_news", refresh_vendor_news), "interval",
        seconds=VENDOR_NEWS_POLL_SECONDS, next_run_time=datetime.now(),
    )
