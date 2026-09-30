"""
pipeline.py — orchestrates one ingestion run: fetch every source, verify
every job, merge into the existing snapshot (incremental — new jobs added,
missing ones marked expired, nothing ever wiped wholesale), guarantee
every category got at least one new job (retrying against a wider
Greenhouse/Ashby pull if not), and write the result atomically.

Structured as a plain importable function (run_ingestion) specifically so
the exact same logic can be wired into this app's existing in-process
APScheduler (see app/utils/task_reminders.py for that pattern) later
without a rewrite — scripts/ingest_jobs.py is a thin CLI wrapper around
this, not a separate implementation.
"""
import os
import json
import time
import logging
from datetime import datetime, timezone

from .sources import fetch_remotive, fetch_arbeitnow, fetch_greenhouse, fetch_ashby, _stable_id
from .verify import verify_job, reset_run_caches
from .categories import categorize, CATEGORIES
from .geo_guess import guess_country
from .company_seeds import GREENHOUSE_COMPANIES, ASHBY_COMPANIES

logger = logging.getLogger("jobs_ingest")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "jobs")
SNAPSHOT_PATH = os.path.join(DATA_DIR, "jobs.json")
SNAPSHOTS_DIR = os.path.join(DATA_DIR, "snapshots")
LOG_PATH = os.path.join(DATA_DIR, "ingest_log.jsonl")
MAX_BACKUPS = 10

# Wider pull used only for the coverage-guarantee retry — a category with
# zero new jobs this run gets one more pass over the SAME seeded
# companies at a higher per-company cap (see verify.py's docstring on why
# ATS sources, not Remotive, are what the retry leans on: Remotive's own
# filters were confirmed live not to work, see sources.py's docstring).
COVERAGE_RETRY_CAP = 60


def _load_previous():
    if not os.path.exists(SNAPSHOT_PATH):
        return {}
    try:
        with open(SNAPSHOT_PATH) as f:
            data = json.load(f)
        return {j["id"]: j for j in data.get("jobs", [])}
    except (json.JSONDecodeError, OSError, KeyError) as e:
        logger.warning("couldn't read previous snapshot, treating as empty: %s", e)
        return {}


def _normalize_and_verify(raw_jobs, source_stats, source_name):
    """Turns each source's raw job dicts into verified, stored-ready jobs.
    Mutates source_stats[source_name] in place with counts."""
    stats = source_stats.setdefault(source_name, {"fetched": 0, "verified": 0, "rejected": 0})
    out = {}
    for raw in raw_jobs:
        stats["fetched"] += 1
        job_id = _stable_id(raw["source"], raw["source_id"])
        verification = verify_job(raw)
        if not verification:
            stats["rejected"] += 1
            continue
        stats["verified"] += 1
        out[job_id] = {
            "id": job_id,
            "title": raw["title"],
            "company_name": raw["company_name"],
            "company_domain": raw.get("company_domain"),
            "location": raw.get("location") or "",
            "remote": bool(raw.get("remote")),
            "country": guess_country(raw.get("location")),
            "category": categorize(raw["title"]),
            "description_text": raw["description_text"],
            "url": raw["url"],
            "source": raw["source"],
            "posted_at": raw.get("posted_at"),
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "verification": verification,
            "expired": False,
        }
    return out


def run_ingestion():
    started_at = time.time()
    reset_run_caches()
    os.makedirs(SNAPSHOTS_DIR, exist_ok=True)

    previous = _load_previous()
    previous_ids = set(previous.keys())

    source_stats = {}
    source_errors = {}
    all_new = {}

    for name, fetch_fn in (("remotive", fetch_remotive), ("arbeitnow", fetch_arbeitnow),
                            ("greenhouse", fetch_greenhouse), ("ashby", fetch_ashby)):
        try:
            raw = fetch_fn()
            all_new.update(_normalize_and_verify(raw, source_stats, name))
        except Exception as e:
            logger.exception("source %s failed entirely", name)
            source_errors[name] = str(e)
            source_stats.setdefault(name, {"fetched": 0, "verified": 0, "rejected": 0})

    total_fetched_this_run = sum(s["fetched"] for s in source_stats.values())
    if total_fetched_this_run == 0 and not previous:
        # Every source failed on what would otherwise be the very first
        # run — nothing to merge into, nothing safe to write. Log and
        # bail rather than writing an empty snapshot.
        logger.error("every source failed and there is no previous snapshot — aborting without writing")
        _append_log({
            "run_at": datetime.now(timezone.utc).isoformat(), "aborted": True,
            "reason": "all sources failed, no previous snapshot to fall back to",
            "source_stats": source_stats, "source_errors": source_errors,
        })
        return None

    # Coverage guarantee — a category with zero NEW jobs this run gets one
    # retry against a wider pull of the same seeded ATS companies.
    new_by_category = {}
    for job in all_new.values():
        new_by_category.setdefault(job["category"], 0)
        new_by_category[job["category"]] += 1

    categories_retried = []
    categories_still_empty = []
    for category in CATEGORIES:
        if new_by_category.get(category, 0) > 0:
            continue
        categories_retried.append(category)
        retry_raw = fetch_greenhouse(limit_per_company=COVERAGE_RETRY_CAP) + fetch_ashby(limit_per_company=COVERAGE_RETRY_CAP)
        retry_raw = [j for j in retry_raw if categorize(j["title"]) == category]
        retry_verified = _normalize_and_verify(retry_raw, source_stats, "coverage_retry")
        found = {jid: j for jid, j in retry_verified.items() if jid not in all_new}
        if found:
            all_new.update(found)
            new_by_category[category] = len(found)
        else:
            categories_still_empty.append(category)

    # Merge: previous jobs default to expired unless this run re-confirms
    # them; new/re-confirmed jobs overwrite in place.
    merged = {}
    for job_id, job in previous.items():
        merged[job_id] = {**job, "expired": True}
    newly_added_count = 0
    for job_id, job in all_new.items():
        if job_id not in previous:
            newly_added_count += 1
        merged[job_id] = job

    expired_this_run = sum(1 for j in merged.values() if j["expired"]) - sum(1 for j in previous.values() if j.get("expired"))

    run_meta = {
        "last_run_at": datetime.now(timezone.utc).isoformat(),
        "duration_seconds": round(time.time() - started_at, 1),
        "source_health": {
            name: {**stats, "error": source_errors.get(name)}
            for name, stats in source_stats.items()
        },
        "category_coverage": new_by_category,
        "categories_retried": categories_retried,
        "categories_still_empty": categories_still_empty,
        "total_jobs": sum(1 for j in merged.values() if not j["expired"]),
        "new_jobs_this_run": newly_added_count,
        "expired_this_run": max(expired_this_run, 0),
    }

    # Backup the current file before overwriting, then write the new one
    # atomically (write to a temp path, os.replace — never a partially-
    # written jobs.json on disk even if the process dies mid-write).
    if os.path.exists(SNAPSHOT_PATH):
        import shutil
        backup_path = os.path.join(SNAPSHOTS_DIR, f"jobs.{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json")
        shutil.copy2(SNAPSHOT_PATH, backup_path)
        _prune_backups()

    tmp_path = SNAPSHOT_PATH + ".tmp"
    with open(tmp_path, "w") as f:
        json.dump({"meta": run_meta, "jobs": list(merged.values())}, f, indent=2)
    os.replace(tmp_path, SNAPSHOT_PATH)

    _append_log(run_meta)
    logger.info("ingestion run complete: %s", run_meta)
    return run_meta


def _prune_backups():
    files = sorted(
        (f for f in os.listdir(SNAPSHOTS_DIR) if f.startswith("jobs.") and f.endswith(".json")),
    )
    excess = len(files) - MAX_BACKUPS
    for f in files[:max(excess, 0)]:
        try:
            os.remove(os.path.join(SNAPSHOTS_DIR, f))
        except OSError:
            pass


def _append_log(entry):
    with open(LOG_PATH, "a") as f:
        f.write(json.dumps(entry) + "\n")


if __name__ == "__main__":
    run_ingestion()
