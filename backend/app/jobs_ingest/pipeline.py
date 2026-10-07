"""
pipeline.py — orchestrates one ingestion run: fetch every source, verify
every job, merge into the existing inventory (incremental — new jobs
added, missing ones marked expired, nothing ever wiped wholesale),
guarantee every category got at least one new job (retrying against a
wider Greenhouse/Ashby pull if not), and write the result to the database.

Structured as a plain importable function (run_ingestion) so the exact
same logic can be wired into this app's existing in-process APScheduler
(see app/utils/task_reminders.py for that pattern) AND triggered on
demand from the admin panel — scripts/ingest_jobs.py is a thin CLI
wrapper around this, not a separate implementation.

Used to write a ~2MB JSON file to local disk instead of the database —
switched because Render's web service filesystem is ephemeral (no
persistent disk configured), so a run scheduled to happen ON the
deployed service would have its own writes silently discarded on the
very next deploy or restart, reverting to whatever snapshot was last
committed from someone's own laptop. That's confirmed as exactly what
was happening: the live Jobs Board sat 7 days stale because nothing was
ever actually refreshing it on the server. The database is the one
storage layer that survives a restart, same as every other piece of
real data in this app.
"""
import time
import logging
from datetime import datetime, timezone

from .sources import fetch_remotive, fetch_arbeitnow, fetch_greenhouse, fetch_ashby, fetch_scrapegraph, _stable_id
from .verify import verify_job, reset_run_caches
from .categories import categorize, CATEGORIES
from .geo_guess import guess_country
from .company_seeds import GREENHOUSE_COMPANIES, ASHBY_COMPANIES

logger = logging.getLogger("jobs_ingest")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# Wider pull used only for the coverage-guarantee retry — a category with
# zero new jobs this run gets one more pass over the SAME seeded
# companies at a higher per-company cap (see verify.py's docstring on why
# ATS sources, not Remotive, are what the retry leans on: Remotive's own
# filters were confirmed live not to work, see sources.py's docstring).
COVERAGE_RETRY_CAP = 60


def _normalize_and_verify(raw_jobs, source_stats, source_name):
    """Turns each source's raw job dicts into verified, stored-ready job
    dicts — same shape as models.Job.to_dict(), so a dict from here can
    be used to construct OR update a real Job row with no translation
    step. Mutates source_stats[source_name] in place with counts."""
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
            "salary": raw.get("salary"),
            "fetched_at": datetime.now(timezone.utc),
            "verification": verification,
            "verification_level": verification.get("level", 0),
            "expired": False,
        }
    return out


def run_ingestion(app):
    """Requires a real Flask app (pass the live app object, not a request
    context) — same contract as every other scheduled job in this app
    (see utils/world_feed.py's refresh_world_feed for the identical
    shape), so it can run both from the APScheduler and from a plain
    script/background thread that isn't itself inside a request."""
    with app.app_context():
        from app import db
        from app.models import Job, JobsIngestRun

        started_at = time.time()
        reset_run_caches()

        previous_rows = {row.id: row for row in Job.query.all()}

        source_stats = {}
        source_errors = {}
        all_new = {}

        for name, fetch_fn in (("remotive", fetch_remotive), ("arbeitnow", fetch_arbeitnow),
                                ("greenhouse", fetch_greenhouse), ("ashby", fetch_ashby),
                                ("scrapegraphai", fetch_scrapegraph)):
            try:
                raw = fetch_fn()
                all_new.update(_normalize_and_verify(raw, source_stats, name))
            except Exception as e:
                logger.exception("source %s failed entirely", name)
                source_errors[name] = str(e)
                source_stats.setdefault(name, {"fetched": 0, "verified": 0, "rejected": 0})

        total_fetched_this_run = sum(s["fetched"] for s in source_stats.values())
        if total_fetched_this_run == 0 and not previous_rows:
            # Every source failed on what would otherwise be the very
            # first run — nothing to merge into, nothing safe to write.
            logger.error("every source failed and there is no existing inventory — aborting without writing")
            db.session.add(JobsIngestRun(run_meta={
                "run_at": datetime.now(timezone.utc).isoformat(), "aborted": True,
                "reason": "all sources failed, no existing inventory to fall back to",
                "source_stats": source_stats, "source_errors": source_errors,
            }))
            db.session.commit()
            return None

        # Coverage guarantee — a category with zero NEW jobs this run
        # gets one retry against a wider pull of the same seeded ATS
        # companies.
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

        # Merge: every existing row defaults to expired unless this run
        # re-confirms it; new/re-confirmed jobs upsert in place. Same
        # "nothing ever wiped wholesale" guarantee the old JSON version
        # had — a row is only ever marked expired, never deleted, so
        # anything pointing at an old job URL doesn't 404.
        newly_added_count = 0
        previously_expired_count = sum(1 for row in previous_rows.values() if row.expired)
        for row in previous_rows.values():
            row.expired = True
        for job_id, job in all_new.items():
            row = previous_rows.get(job_id)
            if row is None:
                newly_added_count += 1
                db.session.add(Job(**job))
            else:
                for key, value in job.items():
                    setattr(row, key, value)

        db.session.flush()
        total_live = Job.query.filter_by(expired=False).count()
        now_expired_count = Job.query.filter_by(expired=True).count()
        expired_this_run = max(now_expired_count - previously_expired_count, 0)

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
            "total_jobs": total_live,
            "new_jobs_this_run": newly_added_count,
            "expired_this_run": expired_this_run,
        }

        db.session.add(JobsIngestRun(run_meta=run_meta))
        db.session.commit()

        logger.info("ingestion run complete: %s", run_meta)
        return run_meta


def start_jobs_ingest_scheduler(scheduler, app):
    """Shares the one BackgroundScheduler instance task_reminders.py
    already starts, same pattern as world_feed.py/vendors.py/
    seo_scheduler.py's own start_* functions. Every 6 hours — 4x/day,
    the exact ceiling Remotive's and Arbeitnow's own API terms ask not to
    be exceeded (see this module's own docstring and sources.py)."""
    from app.utils.scheduler_health import run_tracked
    scheduler.add_job(
        lambda: run_tracked(app, "jobs_ingest", run_ingestion),
        "interval", hours=6, next_run_time=datetime.now(),
    )
