"""
app/utils/world_feed.py — the auto-fetched half of /brand's news: real
technology, physics, and history content, polled on a timer (see
start_world_feed_scheduler, called from app/__init__.py), not written by
anyone or fabricated. Three sources, all free and keyless — no signup
this app can't complete on someone's behalf, no API key to configure
before this works at all:

- Hacker News (Firebase API)          -> category "tech"
- arXiv (physics preprints)           -> category "physics"
- Wikipedia's "on this day" feed      -> category "history"

Each fetcher is independent and wrapped in its own try/except in
refresh_world_feed — one source being down or rate-limiting shouldn't
lose the other two, and NEVER shouldn't take the poll job down entirely.
"""
import hashlib
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import requests

USER_AGENT = "Noqeev-BrandFeed/1.0 (internal tool; contact via app settings)"
REQUEST_TIMEOUT = 10
POLL_SECONDS = 10 * 60
MAX_ITEMS_STORED = 150


def fetch_hn(limit=8):
    ids = requests.get("https://hacker-news.firebaseio.com/v0/topstories.json", timeout=REQUEST_TIMEOUT).json()[:limit]
    items = []
    for item_id in ids:
        d = requests.get(f"https://hacker-news.firebaseio.com/v0/item/{item_id}.json", timeout=REQUEST_TIMEOUT).json()
        if not d or not d.get("title"):
            continue
        items.append({
            "source": "hn", "category": "tech",
            "external_id": f"hn-{d['id']}",
            "title": d["title"],
            "url": d.get("url") or f"https://news.ycombinator.com/item?id={d['id']}",
            "summary": None,
            "published_at": datetime.utcfromtimestamp(d["time"]) if d.get("time") else None,
        })
    return items


def fetch_arxiv_physics(limit=5):
    resp = requests.get(
        "http://export.arxiv.org/api/query",
        params={
            "search_query": "cat:physics.gen-ph OR cat:physics.hist-ph OR cat:gr-qc",
            "sortBy": "submittedDate", "sortOrder": "descending", "max_results": limit,
        },
        headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT,
    )
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    root = ET.fromstring(resp.text)
    items = []
    for entry in root.findall("atom:entry", ns):
        id_url = (entry.findtext("atom:id", default="", namespaces=ns) or "").strip()
        title = (entry.findtext("atom:title", default="", namespaces=ns) or "").strip().replace("\n", " ")
        summary = (entry.findtext("atom:summary", default="", namespaces=ns) or "").strip().replace("\n", " ")[:280]
        published = entry.findtext("atom:published", default="", namespaces=ns)
        if not id_url or not title:
            continue
        try:
            published_at = datetime.strptime(published, "%Y-%m-%dT%H:%M:%SZ") if published else None
        except ValueError:
            published_at = None
        items.append({
            "source": "arxiv", "category": "physics",
            "external_id": f"arxiv-{id_url.rsplit('/', 1)[-1]}",
            "title": title, "url": id_url, "summary": summary or None,
            "published_at": published_at,
        })
    return items


def fetch_wikipedia_on_this_day(limit=6):
    now = datetime.now(timezone.utc)
    resp = requests.get(
        f"https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/{now.month:02d}/{now.day:02d}",
        headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT,
    )
    events = resp.json().get("events", [])

    def page_url(e):
        pages = e.get("pages") or []
        if pages and pages[0].get("content_urls"):
            return pages[0]["content_urls"]["desktop"]["page"]
        return "https://en.wikipedia.org/wiki/Portal:Current_events"

    # Prefer 1900-1999 events specifically (what this feed was asked for),
    # filling out the rest of the quota from any other year if there
    # aren't enough — "on this day" doesn't always have six from one century.
    century = [e for e in events if isinstance(e.get("year"), int) and 1900 <= e["year"] < 2000]
    rest = [e for e in events if e not in century]
    chosen = (century + rest)[:limit]

    items = []
    for e in chosen:
        year, text = e.get("year"), e.get("text")
        if not text:
            continue
        items.append({
            "source": "wikipedia", "category": "history",
            # Python's builtin hash() is randomized per-process (a security
            # feature, not a bug) — using it here would mean the SAME
            # Wikipedia event gets a different external_id after every
            # restart, defeating dedup entirely and re-inserting the whole
            # day's events on every deploy. md5 is deterministic across
            # runs, which is the one property this actually needs.
            "external_id": f"wiki-{now.month}-{now.day}-{year}-{hashlib.md5(text.encode()).hexdigest()[:10]}",
            "title": f"{year}: {text}" if year else text,
            "url": page_url(e), "summary": None,
            "published_at": None,
        })
    return items


def refresh_world_feed(app):
    from app import db
    from app.models import WorldFeedItem

    with app.app_context():
        fetched = []
        for fetcher in (fetch_hn, fetch_arxiv_physics, fetch_wikipedia_on_this_day):
            try:
                fetched.extend(fetcher())
            except Exception as exc:
                print(f"❌ World feed fetch failed ({fetcher.__name__}): {exc}")

        if not fetched:
            return

        existing_ids = {row[0] for row in db.session.query(WorldFeedItem.external_id).all()}
        added = 0
        for it in fetched:
            if it["external_id"] in existing_ids:
                continue
            db.session.add(WorldFeedItem(**it))
            existing_ids.add(it["external_id"])
            added += 1
        if added:
            db.session.commit()
            print(f"🌐 World feed: added {added} new item(s)")

        total = WorldFeedItem.query.count()
        if total > MAX_ITEMS_STORED:
            stale = WorldFeedItem.query.order_by(WorldFeedItem.fetched_at.asc()).limit(total - MAX_ITEMS_STORED).all()
            for row in stale:
                db.session.delete(row)
            db.session.commit()


def start_world_feed_scheduler(scheduler, app):
    """Shares the one BackgroundScheduler instance task_reminders.py
    already starts, rather than running a second scheduler thread — both
    are guarded against Flask's dev-mode reloader double-start at the one
    call site in app/__init__.py, so this doesn't need its own guard."""
    scheduler.add_job(lambda: refresh_world_feed(app), "interval", seconds=POLL_SECONDS, next_run_time=datetime.now())
