"""
app/utils/world_feed.py — the auto-fetched half of /brand's news: real
content, polled on a timer (see start_world_feed_scheduler, called from
app/__init__.py), never written or fabricated by anyone here. Every
source is free and keyless — no signup this app can't complete on
someone's behalf, no API key to configure before any of this works:

- Hacker News (Firebase API)                  -> category "tech"
- Ars Technica (RSS)                          -> category "tech"
- BBC Technology (RSS)                        -> category "tech"
- arXiv (physics preprints)                   -> category "physics"
- The Guardian, Physics section (RSS)         -> category "physics"
- BBC Science & Environment (RSS)             -> category "physics"
- BBC World (RSS)                             -> category "world"
- NPR News (RSS)                              -> category "world"
- The Guardian, World section (RSS)           -> category "world"
- Wikipedia's "on this day" feed              -> category "history"
- The Guardian, Work & Careers section (RSS)  -> category "jobs"
- BBC Business (RSS)                          -> category "jobs"
- Indeed Hiring Lab (RSS)                     -> category "jobs"
- Fast Company, Work Life section (RSS)       -> category "jobs"

All genuine, editorially-run outlets (BBC, NPR, The Guardian, Ars
Technica) alongside the raw-source feeds (Hacker News, arXiv, Wikipedia)
— not one single source standing in for "the news," and not anything
scraped or generated. The "jobs" category is real labor-market reporting
and research (Guardian's own careers desk, BBC's business desk, Indeed's
in-house economist team), never a scraped or fabricated job listing — a
real posting would need a whole different trust model (verifying the
employer, the listing, expiry) this feed was never built for, and
promising "verifiable jobs" without that would be worse than not having
the category at all. Each fetcher is independent and wrapped in its own
try/except in refresh_world_feed — one source being down or slow costs
that one source's items for this poll, never the others, and never
crashes the poll job itself.
"""
import hashlib
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

import requests

USER_AGENT = "Noqeev-BrandFeed/1.0 (internal tool; contact via app settings)"
REQUEST_TIMEOUT = 10
POLL_SECONDS = 8 * 60  # within the requested 5-10 minute window
MAX_ITEMS_STORED = 300

_TAG_RE = re.compile(r"<[^>]+>")
_MEDIA_NS = "{http://search.yahoo.com/mrss/}"
# A card-sized thumbnail, not a hero image — this only ever renders at a
# few hundred px wide on the dashboard, so there's no reason to prefer a
# publisher's full-resolution original over whatever's closest to this.
_TARGET_IMAGE_WIDTH = 460


def _strip_html(text):
    if not text:
        return None
    clean = _TAG_RE.sub("", text).strip()
    return clean[:300] or None


def _rss_item_image(entry):
    """A real thumbnail straight from the feed's own <media:thumbnail> or
    <media:content> (RSS Media extension — see RSS_SOURCES' own comment on
    the xmlns:media namespace), never fabricated. <media:thumbnail> is
    usually already a single sensibly-sized image; <media:content> can
    list the same photo at several widths (Guardian does this), so this
    picks whichever entry is closest to _TARGET_IMAGE_WIDTH rather than
    always grabbing the first (often the smallest, blurry-when-scaled-up)
    or the last (often the largest, unnecessarily heavy to load)."""
    thumb = entry.find(f"{_MEDIA_NS}thumbnail")
    if thumb is not None and thumb.get("url"):
        return thumb.get("url")

    candidates = entry.findall(f"{_MEDIA_NS}content")
    best_url, best_diff = None, None
    for c in candidates:
        url = c.get("url")
        if not url:
            continue
        try:
            width = int(c.get("width", 0))
        except ValueError:
            width = 0
        diff = abs(width - _TARGET_IMAGE_WIDTH) if width else 10_000  # unlabeled width sorts last, not first
        if best_diff is None or diff < best_diff:
            best_url, best_diff = url, diff
    if best_url:
        return best_url

    enclosure = entry.find("enclosure")
    if enclosure is not None and (enclosure.get("type") or "").startswith("image/") and enclosure.get("url"):
        return enclosure.get("url")
    return None


def _stable_id(*parts):
    """Python's builtin hash() is randomized per-process (a security
    property, not a bug) — using it for a dedup key would mean the exact
    same story gets a different id after every restart, defeating dedup
    entirely and re-inserting everything on each deploy. md5 is
    deterministic across runs, which is the one property this needs."""
    return hashlib.md5("|".join(str(p) for p in parts).encode()).hexdigest()[:16]


def fetch_hn(limit=6):
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
            "image_url": None,  # HN's own API has no thumbnail field at all
            "published_at": datetime.utcfromtimestamp(d["time"]) if d.get("time") else None,
        })
    return items


def fetch_arxiv_physics(limit=4):
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
            "image_url": None,  # preprints don't carry one
            "published_at": published_at,
        })
    return items


def fetch_wikipedia_on_this_day(limit=5):
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

    def page_image(e):
        pages = e.get("pages") or []
        if pages and pages[0].get("thumbnail"):
            return pages[0]["thumbnail"].get("source")
        return None

    # Prefer 1900-1999 events specifically (what this feed was asked for),
    # filling the rest of the quota from any other year — "on this day"
    # doesn't always have five from one century.
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
            "external_id": f"wiki-{_stable_id(now.month, now.day, year, text)}",
            "title": f"{year}: {text}" if year else text,
            "url": page_url(e), "summary": None,
            "image_url": page_image(e),
            "published_at": None,
        })
    return items


# ── Real editorial RSS feeds — one generic parser, many sources. Standard
# RSS 2.0 <channel><item> shape; title/link/description/pubDate are
# unprefixed even when the feed declares extra namespaces for optional
# fields, so no namespace map is needed for these four. ───────────────────
RSS_SOURCES = [
    {"name": "bbc_world", "category": "world", "url": "http://feeds.bbci.co.uk/news/world/rss.xml"},
    {"name": "npr_news", "category": "world", "url": "https://feeds.npr.org/1001/rss.xml"},
    {"name": "guardian_world", "category": "world", "url": "https://www.theguardian.com/world/rss"},
    {"name": "bbc_tech", "category": "tech", "url": "http://feeds.bbci.co.uk/news/technology/rss.xml"},
    {"name": "arstechnica", "category": "tech", "url": "https://arstechnica.com/feed/"},
    {"name": "bbc_science", "category": "physics", "url": "http://feeds.bbci.co.uk/news/science_and_environment/rss.xml"},
    {"name": "guardian_physics", "category": "physics", "url": "https://www.theguardian.com/science/physics/rss"},
    {"name": "guardian_careers", "category": "jobs", "url": "https://www.theguardian.com/money/work-and-careers/rss"},
    {"name": "bbc_business", "category": "jobs", "url": "https://feeds.bbci.co.uk/news/business/rss.xml"},
    {"name": "indeed_hiring_lab", "category": "jobs", "url": "https://www.hiringlab.org/feed/"},
    # Fast Company's own "Work Life" desk — the one source here that
    # regularly runs the "how job-hunting/hiring actually worked in the
    # past" retrospective genre alongside current workplace trends, not
    # just labor-market data like the other three.
    {"name": "fastcompany_worklife", "category": "jobs", "url": "https://www.fastcompany.com/work-life/rss"},
]


def fetch_rss(source_name, category, url, limit=5):
    resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT)
    root = ET.fromstring(resp.text)
    channel = root.find("channel")
    if channel is None:
        return []
    items = []
    for entry in channel.findall("item")[:limit]:
        title = (entry.findtext("title") or "").strip()
        link = (entry.findtext("link") or "").strip()
        if not title or not link:
            continue
        summary = _strip_html(entry.findtext("description"))
        pub_raw = entry.findtext("pubDate")
        try:
            published_at = parsedate_to_datetime(pub_raw).astimezone(timezone.utc).replace(tzinfo=None) if pub_raw else None
        except (TypeError, ValueError):
            published_at = None
        items.append({
            "source": source_name, "category": category,
            "external_id": f"{source_name}-{_stable_id(link)}",
            "title": title, "url": link, "summary": summary,
            "image_url": _rss_item_image(entry),
            "published_at": published_at,
        })
    return items


def refresh_world_feed(app):
    from app import db
    from app.models import WorldFeedItem

    with app.app_context():
        fetchers = [fetch_hn, fetch_arxiv_physics, fetch_wikipedia_on_this_day]
        fetched = []
        for fetcher in fetchers:
            try:
                fetched.extend(fetcher())
            except Exception as exc:
                print(f"❌ World feed fetch failed ({fetcher.__name__}): {exc}")

        for src in RSS_SOURCES:
            try:
                fetched.extend(fetch_rss(src["name"], src["category"], src["url"]))
            except Exception as exc:
                print(f"❌ World feed fetch failed ({src['name']}): {exc}")

        if not fetched:
            print("❌ World feed: every source failed this poll")
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
            print(f"🌐 World feed: added {added} new item(s) from {len(fetched)} fetched across {len(fetchers) + len(RSS_SOURCES)} sources")

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
    from app.utils.scheduler_health import run_tracked
    scheduler.add_job(lambda: run_tracked(app, "world_feed", refresh_world_feed), "interval", seconds=POLL_SECONDS, next_run_time=datetime.now())
