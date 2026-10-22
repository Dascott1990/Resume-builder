"""
sources.py — one fetch function per data source, each returning a list of
jobs already normalized to this pipeline's own shape:

  {source, source_id, title, company_name, company_domain, location,
   remote, category_hint, description_text, url, posted_at}

`category_hint` is whatever the source itself calls it (only used for
logging/debugging) — the job's real `category` field is decided later by
categories.categorize() against the title, so every source ends up sorted
by the same rules regardless of its own taxonomy.

Every request goes through _get_json, which retries with backoff and
never raises past this module — a single source being down must not take
the whole run down with it (see pipeline.py's per-source try/except,
which is the second layer of the same guarantee).
"""
import os
import re
import time
import html
import hashlib
import logging
from datetime import datetime, timezone

import requests

from .company_seeds import GREENHOUSE_COMPANIES, ASHBY_COMPANIES, MAX_JOBS_PER_COMPANY, SCRAPEGRAPHAI_COMPANIES

logger = logging.getLogger("jobs_ingest")

REQUEST_TIMEOUT = 12
USER_AGENT = "NoqeevJobsBot/1.0 (+https://noqeev.com; job board aggregator, contact support@noqeev.com)"


def _get_json(url, params=None, retries=3):
    last_exc = None
    for attempt in range(retries):
        try:
            r = requests.get(
                url, params=params, timeout=REQUEST_TIMEOUT,
                headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            )
            if r.status_code == 200:
                return r.json()
            last_exc = f"HTTP {r.status_code}"
        except requests.RequestException as e:
            last_exc = str(e)
        if attempt < retries - 1:
            time.sleep(2 ** attempt)  # 1s, 2s
    logger.warning("fetch failed after %d attempts: %s (%s)", retries, url, last_exc)
    return None


_TAG_RE = re.compile(r"<[^>]+>")
_BLOCK_CLOSE_RE = re.compile(r"</(p|div|li|h[1-6])>", re.IGNORECASE)
_BR_RE = re.compile(r"<br\s*/?>", re.IGNORECASE)


def _strip_html(raw, max_len=2000):
    # Source HTML (confirmed live against Arbeitnow/Greenhouse/Ashby) really
    # does carry real <p>/<h2>/<li> paragraph structure — turning every tag
    # into a single space before collapsing whitespace destroyed that
    # structure right here at ingestion, which is why description_text
    # ended up as one flat run with zero newlines regardless of source.
    # Converting block-closing tags to a real newline FIRST (same pattern
    # as the frontend's own stripTags()) preserves it instead of flattening
    # it into something a later heuristic has to reconstruct by guessing.
    #
    # unescape() has to run BEFORE any tag regex, not after: Greenhouse's
    # own "content" field comes back *double-encoded* (literal "&lt;p&gt;",
    # not "<p>") — confirmed by fetching it directly. Stripping tags first
    # and unescaping after (the original bug) finds nothing to strip, since
    # the tags are invisible as escaped text at that point, then unescape
    # turns the entities into literal, visible "<p>"/"<strong>" text that
    # ships straight into description_text. Unescaping first makes real
    # tags out of them in time for the regexes below to actually catch them
    # — and is a no-op for sources (Arbeitnow, Ashby) that hand over plain,
    # already-real HTML with no double-encoding.
    if not raw:
        return ""
    text = html.unescape(raw)
    text = _BR_RE.sub("\n", text)
    text = _BLOCK_CLOSE_RE.sub("\n", text)
    text = _TAG_RE.sub(" ", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text[:max_len]


def _stable_id(source, source_id):
    return hashlib.sha1(f"{source}:{source_id}".encode()).hexdigest()[:24]


def _unix_to_iso(ts):
    if ts is None:
        return None
    try:
        from datetime import datetime, timezone
        return datetime.fromtimestamp(int(ts), tz=timezone.utc).isoformat()
    except (ValueError, OSError, OverflowError):
        return None


def fetch_remotive(limit=100):
    """Remotive's free tier is currently serving a small, unfiltered batch
    regardless of ?limit/?category/?search (verified live while building
    this — all three came back identical) — pulled as-is, capped
    defensively at `limit` in case that changes. No employer domain in
    the payload, so these jobs cap at verification Level 1 (see verify.py)
    — attribution required by Remotive's own ToS: every job keeps its
    real remotive.com URL, never rehosted."""
    data = _get_json("https://remotive.com/api/remote-jobs")
    if not data:
        return []
    jobs = []
    for j in (data.get("jobs") or [])[:limit]:
        jobs.append({
            "source": "remotive", "source_id": str(j["id"]),
            "title": j.get("title") or "", "company_name": j.get("company_name") or "",
            "company_domain": None,
            "location": j.get("candidate_required_location") or "", "remote": True,
            "category_hint": j.get("category"),
            "description_text": _strip_html(j.get("description")),
            "url": j.get("url"), "posted_at": j.get("publication_date"),
            # Real, employer-entered text straight off Remotive's own
            # payload (confirmed live: roughly half of listings have it,
            # the rest an empty string) -- never parsed/reformatted, just
            # shown as-is, so it stays exactly what the employer wrote
            # ("$90k - $105k", "$120 - $170 /hour", "OTE $25k - $35k").
            # No other source here exposes real compensation data (checked
            # live: Arbeitnow's API has no salary field at all; Greenhouse
            # and Ashby's public job-list endpoints don't return one
            # either) -- so this stays empty for every job that isn't
            # Remotive rather than guessing at a range.
            "salary": (j.get("salary") or "").strip() or None,
        })
    return jobs


_ARBEITNOW_OWN_DOMAINS = {"arbeitnow.com", "arbeitnow.co.uk"}


def fetch_arbeitnow(limit=150, search=None):
    """Real pagination, real volume (300+/page, verified live) — page 1
    only, capped at `limit` to keep one run's processing/verification
    bounded. Supports optional search parameter to target specific intent keywords.

    `url` is NOT reliably the employer's own site — checked live against a
    150-job sample while building this: ~99% of entries point back at
    arbeitnow.com/arbeitnow.co.uk itself (their own apply-through-us
    listing page), not the employer's domain; only a small minority link
    directly to the employer. Treating arbeitnow.com as if it were the
    employer's domain would have handed nearly every job here a false
    Level 2/3 "domain confirmed" — verify.py checks THE EMPLOYER's site,
    and Arbeitnow's own domain being real proves nothing about that.
    Filtered out below; only a genuine employer domain is kept, so these
    jobs cap at Level 1 same as Remotive UNLESS Arbeitnow happens to give
    a real one."""
    params = {}
    if search:
        params["search"] = search
    data = _get_json("https://www.arbeitnow.com/api/job-board-api", params=params if params else None)
    if not data:
        return []
    jobs = []
    for j in (data.get("data") or [])[:limit]:
        employer_url = j.get("url") or ""
        domain = re.sub(r"^https?://(www\.)?", "", employer_url).split("/")[0] or None
        if domain in _ARBEITNOW_OWN_DOMAINS:
            domain = None
        jobs.append({
            "source": "arbeitnow", "source_id": j.get("slug") or employer_url,
            "title": j.get("title") or "", "company_name": j.get("company_name") or "",
            "company_domain": domain,
            "location": j.get("location") or "", "remote": bool(j.get("remote")),
            "category_hint": ", ".join(j.get("tags") or []),
            "description_text": _strip_html(j.get("description")),
            # arbeitnow's own job page, not the employer's site — same
            # "link back to the source" courtesy their API terms ask for.
            "url": f"https://www.arbeitnow.com/view/{j.get('slug')}" if j.get("slug") else employer_url,
            # created_at is a Unix timestamp here, unlike every other
            # source's own ISO-ish string — normalized so pipeline.py's
            # plain string sort on posted_at never has to compare an int
            # against a string (that mismatch is a real bug this caught
            # live: TypeError on the very first real run against mixed
            # sources).
            "posted_at": _unix_to_iso(j.get("created_at")),
        })
    return jobs


def fetch_greenhouse(limit_per_company=MAX_JOBS_PER_COMPANY, companies=None):
    """One request per seeded company (see company_seeds.py) — a company
    whose slug no longer resolves (renamed board, moved ATS) just
    contributes zero jobs, logged, not raised."""
    jobs = []
    for co in (companies if companies is not None else GREENHOUSE_COMPANIES):
        data = _get_json(f"https://boards-api.greenhouse.io/v1/boards/{co['slug']}/jobs", params={"content": "true"})
        if not data or not data.get("jobs"):
            logger.info("greenhouse: %s returned nothing", co["slug"])
            continue
        # updated_at descending — most-recently-touched postings first,
        # so the per-company cap keeps the freshest listings, not
        # whatever order the API happens to return.
        company_jobs = sorted(data["jobs"], key=lambda j: j.get("updated_at") or "", reverse=True)
        for j in company_jobs[:limit_per_company]:
            location = (j.get("location") or {}).get("name") or ""
            jobs.append({
                "source": "greenhouse", "source_id": str(j["id"]),
                "title": j.get("title") or "", "company_name": co["name"],
                "company_domain": co["domain"],
                "location": location, "remote": "remote" in location.lower(),
                "category_hint": ", ".join(d.get("name", "") for d in (j.get("departments") or [])),
                "description_text": _strip_html(j.get("content")),
                "url": j.get("absolute_url"), "posted_at": j.get("first_published") or j.get("updated_at"),
            })
    return jobs


def fetch_ashby(limit_per_company=MAX_JOBS_PER_COMPANY, companies=None):
    jobs = []
    for co in (companies if companies is not None else ASHBY_COMPANIES):
        data = _get_json(f"https://api.ashbyhq.com/posting-api/job-board/{co['slug']}")
        if not data or not data.get("jobs"):
            logger.info("ashby: %s returned nothing", co["slug"])
            continue
        company_jobs = sorted(data["jobs"], key=lambda j: j.get("publishedAt") or "", reverse=True)
        for j in company_jobs[:limit_per_company]:
            if not j.get("isListed", True):
                continue
            jobs.append({
                "source": "ashby", "source_id": str(j["id"]),
                "title": j.get("title") or "", "company_name": co["name"],
                "company_domain": co["domain"],
                "location": j.get("location") or "", "remote": bool(j.get("isRemote")),
                "category_hint": j.get("department") or j.get("team") or "",
                "description_text": _strip_html(j.get("descriptionPlain") or j.get("descriptionHtml")),
                "url": j.get("jobUrl"), "posted_at": j.get("publishedAt"),
            })
    return jobs


# ScrapeGraphAI schema — deliberately just title + location. `url` was
# dropped after testing showed it comes back "No content available" for
# sites whose job cards have no real per-listing href (see
# company_seeds.py's SCRAPEGRAPHAI_COMPANIES docstring) — asking the LLM
# for a field that structurally doesn't exist on the page just wastes a
# schema slot; every job from this source uses its company's real
# careers_url instead (set below), not a per-job deep link.
_SCRAPEGRAPHAI_SCHEMA = {
    "type": "object",
    "properties": {
        "jobs": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "location": {"type": "string"},
                },
            },
        },
    },
}


def fetch_scrapegraph(companies=None):
    """Gap-filler tier for real companies with neither a Greenhouse nor
    Ashby board — LLM-extracted from their own careers page via
    ScrapeGraphAI (metered, unlike every other source here). Silently
    contributes nothing (not an error) if SCRAPEGRAPHAI_API_KEY isn't
    set, so this stays a genuinely optional add-on, never a hard
    dependency the rest of the pipeline needs to function."""
    api_key = os.environ.get("SCRAPEGRAPHAI_API_KEY")
    if not api_key:
        return []
    try:
        from scrapegraph_py import ScrapeGraphAI, FetchConfig
    except ImportError:
        logger.warning("scrapegraph-py not installed; skipping the ScrapeGraphAI source")
        return []

    client = ScrapeGraphAI(api_key=api_key)
    jobs = []
    for co in (companies if companies is not None else SCRAPEGRAPHAI_COMPANIES):
        try:
            result = client.extract(
                prompt="Extract every open job listing visible on this page: its exact title and location. Only real listings actually shown on the page.",
                url=co["careers_url"],
                schema=_SCRAPEGRAPHAI_SCHEMA,
                fetch_config=FetchConfig(mode="js", wait=4000, scrolls=2),
            )
            if result.status != "success" or not result.data:
                logger.warning("scrapegraphai: %s returned %s", co["name"], result.status)
                continue
            fetched_at = datetime.now(timezone.utc).isoformat()
            for j in (result.data.json_data or {}).get("jobs", []):
                title = (j.get("title") or "").strip()
                if not title:
                    continue
                jobs.append({
                    "source": "scrapegraphai",
                    "source_id": hashlib.sha1(f"{co['domain']}:{title}:{j.get('location', '')}".encode()).hexdigest()[:16],
                    "title": title, "company_name": co["name"], "company_domain": co["domain"],
                    "location": j.get("location") or "", "remote": "remote" in (j.get("location") or "").lower(),
                    "category_hint": "", "description_text": "",
                    "url": co["careers_url"], "posted_at": fetched_at,
                })
        except Exception as e:
            logger.warning("scrapegraphai: %s failed: %s", co["name"], e)
    return jobs


def fetch_intent_targets(targets, limit_per_target=25):
    """Dynamically fetches jobs targeting high-volume user search intents.
    Uses Arbeitnow's search query API to pull listings matching top intent keywords."""
    jobs = []
    seen_ids = set()
    for term in (targets or [])[:5]:
        results = fetch_arbeitnow(limit=limit_per_target, search=term)
        for j in results:
            if j["source_id"] not in seen_ids:
                seen_ids.add(j["source_id"])
                jobs.append(j)
    return jobs


SOURCE_FETCHERS = {
    "remotive": fetch_remotive,
    "arbeitnow": fetch_arbeitnow,
    "greenhouse": fetch_greenhouse,
    "ashby": fetch_ashby,
    "scrapegraphai": fetch_scrapegraph,
    "intent_targets": fetch_intent_targets,
}

