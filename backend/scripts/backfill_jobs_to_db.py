"""
scripts/backfill_jobs_to_db.py — ONE-TIME migration: loads the existing
backend/data/jobs/jobs.json snapshot (the last real ingestion run, 626
jobs as of 2026-10-07) into the new `jobs` database table (see
models.Job), so cutting the Jobs Board over to reading from the database
doesn't start it from zero. Run once, by hand:

    python3 scripts/backfill_jobs_to_db.py

Safe to re-run: upserts by id (the same stable hash every row already
has), never duplicates. After this runs once against a given database,
every FUTURE ingestion run (scheduled or admin-triggered) writes
straight to this same table — this script's only job is carrying over
what already existed in the old file-based snapshot.
"""
import os
import sys
import json
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db
from app.models import Job

SNAPSHOT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "jobs", "jobs.json")


def _parse_fetched_at(value):
    if not value:
        return datetime.now(timezone.utc)
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return datetime.now(timezone.utc)


def main():
    with open(SNAPSHOT_PATH) as f:
        data = json.load(f)
    jobs = data.get("jobs", [])
    print(f"Loaded {len(jobs)} jobs from {SNAPSHOT_PATH}")

    app = create_app()
    with app.app_context():
        existing_ids = {row.id for row in Job.query.with_entities(Job.id).all()}
        inserted = 0
        updated = 0
        for j in jobs:
            verification = j.get("verification") or {}
            fields = dict(
                title=j["title"],
                company_name=j["company_name"],
                company_domain=j.get("company_domain"),
                location=j.get("location") or "",
                remote=bool(j.get("remote")),
                country=j.get("country"),
                category=j.get("category"),
                description_text=j.get("description_text"),
                url=j.get("url"),
                source=j.get("source"),
                posted_at=j.get("posted_at"),
                salary=j.get("salary"),
                fetched_at=_parse_fetched_at(j.get("fetched_at")),
                verification=verification,
                verification_level=verification.get("level", 0),
                expired=bool(j.get("expired")),
            )
            if j["id"] in existing_ids:
                db.session.query(Job).filter_by(id=j["id"]).update(fields)
                updated += 1
            else:
                db.session.add(Job(id=j["id"], **fields))
                inserted += 1

        db.session.commit()
        total_live = Job.query.filter_by(expired=False).count()
        print(f"✅ {inserted} inserted, {updated} updated, {total_live} total live jobs now in the database.")


if __name__ == "__main__":
    main()
