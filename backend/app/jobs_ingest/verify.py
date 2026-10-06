"""
verify.py — the multi-level verification gate. A job is written to the
snapshot only if it clears Level 1 and Level 4 (always checkable,
regardless of source); Levels 2/3 are attempted whenever a company domain
is known and additionally REQUIRED to pass once attempted — a domain that
fails to resolve, or a domain young enough to be a real scam signal, is a
hard reject, not a soft note.

Sources without a usable employer domain (Remotive's feed — see
sources.py's own docstring) simply can't attempt Levels 2/3 at all; they
cap out at Level 1, honestly, rather than being rejected outright for a
data-shape gap that has nothing to do with whether the job is real.

`level` on a stored job is the highest N such that levels 1..N were both
attempted AND passed — never a level that was skipped, even if nothing
about the job contradicts it. That's what makes the number trustworthy
enough to show a user: a 2 always means "domain confirmed live," never
"we didn't check."

Domain-level checks (2 and 3) are cached per-domain for the run — dozens
of jobs from the same employer share one domain check, not one each.
"""
import re
import time
import socket
import ipaddress
import logging
from datetime import datetime, timezone

import requests

logger = logging.getLogger("jobs_ingest")

KNOWN_ATS_SOURCES = {"greenhouse", "ashby"}
KNOWN_AGGREGATORS = {"remotive", "arbeitnow"}
# LLM-extracted from a hand-verified real company's own careers page (see
# company_seeds.py's SCRAPEGRAPHAI_COMPANIES) — trusted at Level 1 the
# same way an ATS source is, for the same reason: the seed list itself,
# not the payload shape, is what was verified.
KNOWN_SCRAPED_SOURCES = {"scrapegraphai"}

FREE_EMAIL_DOMAINS = {
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com",
    "icloud.com", "protonmail.com", "mail.com", "yandex.com",
}

# Real, common phrasing in job-scam postings — "pay to work here" in one
# form or another. Matched against the plain-text description, case-
# insensitive. Not an exhaustive scam-detection model, a blocklist of the
# most common tells; see the module docstring on what "reject" actually
# gates.
SCAM_PATTERNS = [
    r"pay(ment)?\s+for\s+(your\s+)?training",
    r"processing\s+fee",
    r"registration\s+fee",
    r"starter\s+kit\s+fee",
    r"wire\s+transfer\s+to\s+(begin|start|secure)",
    r"western\s+union",
    r"send\s+money\s+to",
    r"buy\s+your\s+own\s+equipment\s+(upfront|first|before)",
    r"background\s+check\s+fee",
    r"investment\s+(is\s+)?required\s+to\s+start",
]
_SCAM_RE = re.compile("|".join(SCAM_PATTERNS), re.IGNORECASE)
_EMAIL_RE = re.compile(r"[\w.+-]+@([\w-]+\.[\w.-]+)")

MIN_DOMAIN_AGE_DAYS = 30  # younger than this is a hard reject (level 3)
SOFT_DOMAIN_AGE_DAYS = 90  # younger than this passes, but is noted, not rejected


def _level1(job):
    """Source legitimacy. An ATS source (greenhouse/ashby) is trusted by
    construction — every company on that list was hand-verified before
    being seeded (see company_seeds.py). An aggregator (remotive/
    arbeitnow) counts as Level 1 the moment it names a real company and
    links back to a real posting URL — the two things every entry from
    either API always has."""
    if job["source"] in KNOWN_ATS_SOURCES or job["source"] in KNOWN_SCRAPED_SOURCES:
        return True
    if job["source"] in KNOWN_AGGREGATORS:
        return bool(job.get("company_name")) and bool(job.get("url"))
    return False


_domain_cache = {}


def _resolves_to_public_address(domain):
    """SSRF guard — company_domain can originate from a third-party
    source's own free-text field (sources.py's Arbeitnow fetcher derives
    it straight from a listing's employer_url, unlike the hand-seeded
    domains in company_seeds.py), so a crafted listing could point this
    at an internal host or a cloud metadata address. Every domain reaching
    _check_domain goes through this first, regardless of which source
    produced it — resolving once and rejecting any private/loopback/
    link-local/reserved result before a single request is made."""
    try:
        addrs = {info[4][0] for info in socket.getaddrinfo(domain, None)}
    except socket.gaierror:
        return False
    if not addrs:
        return False
    for addr in addrs:
        try:
            ip = ipaddress.ip_address(addr)
        except ValueError:
            return False
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            return False
    return True


def _check_domain(domain):
    """Level 2 + 3 for one domain, cached — HTTPS reachability (root, plus
    a couple of common careers paths as a bonus signal) and WHOIS domain
    age. Returns a dict: {level2_pass, level2_note, level3_pass,
    level3_note, age_days_or_None}."""
    if domain in _domain_cache:
        return _domain_cache[domain]

    if not _resolves_to_public_address(domain):
        result = {
            "level2_pass": False, "level2_note": "domain did not resolve to a public address",
            "level3_pass": False, "level3_note": "",
        }
        _domain_cache[domain] = result
        return result

    result = {"level2_pass": False, "level2_note": "", "level3_pass": False, "level3_note": ""}

    # Level 2 — resolves + serves HTTPS. A plain requests.get already
    # verifies the TLS cert chain by default; that alone is most of what
    # "serves HTTPS" needs to mean here. Retried: this result is cached
    # and reused for EVERY job from this company for the rest of the run
    # (see the cache check above), so one transient DNS/connection blip on
    # the single request that happens to run first must not permanently
    # zero out an entire real company for the whole run — confirmed this
    # actually happening live while building this (openai.com, an
    # unambiguously real 2007-registered domain, got wrongly rejected on
    # a run where its one-shot check hit a transient network error).
    last_error = None
    for attempt in range(3):
        try:
            r = requests.get(f"https://{domain}", timeout=8, headers={"User-Agent": "Mozilla/5.0 (compatible; NoqeevJobsBot/1.0)"}, allow_redirects=True)
            if r.status_code < 400:
                result["level2_pass"] = True
                careers_found = False
                for path in ("/careers", "/jobs"):
                    try:
                        rc = requests.get(f"https://{domain}{path}", timeout=6, headers={"User-Agent": "Mozilla/5.0"}, allow_redirects=True)
                        if rc.status_code < 400:
                            careers_found = True
                            break
                    except requests.RequestException:
                        pass
                result["level2_note"] = "careers page found" if careers_found else "root domain only"
            else:
                result["level2_note"] = f"root returned HTTP {r.status_code}"
            break
        except requests.RequestException as e:
            last_error = e
            if attempt < 2:
                time.sleep(1.5 * (attempt + 1))
            else:
                result["level2_note"] = f"unreachable after 3 attempts: {last_error.__class__.__name__}"

    # Level 3 — WHOIS domain age. A lookup failure (rate-limited registry,
    # a TLD whois doesn't cover well) is genuinely common and NOT itself
    # suspicious — it's recorded as "unknown" and doesn't block the job,
    # same reasoning the spec's own "sanity check" framing implies (a
    # signal to weigh, not a hard requirement every legitimate domain can
    # always satisfy on demand). Also retried, same reasoning as Level 2
    # above — WHOIS in particular bounces between several registrar
    # servers internally and is the flakier of the two checks in practice.
    created = None
    whois_error = None
    for attempt in range(3):
        try:
            import whois
            socket.setdefaulttimeout(8)
            w = whois.whois(domain)
            created = w.creation_date
            if isinstance(created, list):
                created = created[0] if created else None
            if created:
                whois_error = None
                break
        except Exception as e:
            whois_error = e
        finally:
            socket.setdefaulttimeout(None)
        if attempt < 2:
            time.sleep(1.5 * (attempt + 1))

    if created:
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        age_days = (datetime.now(timezone.utc) - created).days
        result["age_days"] = age_days
        if age_days < MIN_DOMAIN_AGE_DAYS:
            result["level3_pass"] = False
            result["level3_note"] = f"domain registered only {age_days}d ago"
        else:
            result["level3_pass"] = True
            result["level3_note"] = (
                f"domain age {age_days}d (recently registered)" if age_days < SOFT_DOMAIN_AGE_DAYS
                else f"domain age {age_days}d"
            )
    else:
        result["level3_pass"] = None  # unknown — doesn't block, doesn't count as passed
        result["level3_note"] = (
            f"WHOIS unavailable after 3 attempts: {whois_error.__class__.__name__}" if whois_error
            else "WHOIS returned no creation date"
        )

    _domain_cache[domain] = result
    return result


_content_hash_domains = {}  # content hash -> first-seen domain, for level 4's duplicate-across-domains check


def _content_hash(job):
    basis = f"{job['title'].strip().lower()}|{job['company_name'].strip().lower()}|{job['description_text'][:200].strip().lower()}"
    import hashlib
    return hashlib.sha1(basis.encode()).hexdigest()


def _level4(job):
    """Scam-pattern rejection. Returns (passed, notes[])."""
    notes = []
    text = job["description_text"] or ""

    if _SCAM_RE.search(text):
        return False, ["scam-pattern phrase found in description"]

    email_match = _EMAIL_RE.search(text)
    if email_match and not job.get("company_domain"):
        contact_domain = email_match.group(1).lower()
        if contact_domain in FREE_EMAIL_DOMAINS:
            return False, [f"only contact is a free-email address ({contact_domain}) and no employer domain is known"]

    if not job.get("company_name", "").strip():
        return False, ["no company name given"]

    content_hash = _content_hash(job)
    seen_domain = _content_hash_domains.get(content_hash)
    this_domain = job.get("company_domain") or job["source"]
    if seen_domain is not None and seen_domain != this_domain:
        return False, [f"identical posting already seen from a different source/domain ({seen_domain})"]
    _content_hash_domains[content_hash] = this_domain

    return True, notes


def verify_job(job):
    """Returns None if the job should be rejected, otherwise the
    verification dict to attach to it."""
    checks_passed = []
    checks_not_attempted = []
    notes = []

    if not _level1(job):
        return None
    checks_passed.append("level1_source_legitimacy")

    level4_ok, level4_notes = _level4(job)
    notes.extend(level4_notes)
    if not level4_ok:
        return None
    checks_passed.append("level4_no_scam_patterns")

    level = 1
    domain = job.get("company_domain")
    if domain:
        d = _check_domain(domain)
        if not d["level2_pass"]:
            return None  # a known domain that doesn't resolve/serve HTTPS is a real red flag, not a shrug
        checks_passed.append("level2_domain_https_reachable")
        notes.append(f"level2: {d['level2_note']}")
        level = 2

        if d["level3_pass"] is False:
            return None  # domain younger than MIN_DOMAIN_AGE_DAYS — real scam signal
        if d["level3_pass"] is True:
            checks_passed.append("level3_domain_age_sane")
            notes.append(f"level3: {d['level3_note']}")
            level = 3
        else:
            checks_not_attempted.append("level3_domain_age_unknown")
            notes.append(f"level3: {d['level3_note']}")
    else:
        checks_not_attempted.extend(["level2_domain_check", "level3_domain_age"])
        notes.append("no employer domain available from this source")

    return {
        "level": level,
        "checks_passed": checks_passed,
        "checks_not_attempted": checks_not_attempted,
        "notes": notes,
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "sources": [job["source"]],
    }


def reset_run_caches():
    """Call once per ingestion run — domain checks and content-hash dedup
    are meant to be per-run, not permanently accumulating in memory across
    scheduled runs of a long-lived process."""
    _domain_cache.clear()
    _content_hash_domains.clear()
