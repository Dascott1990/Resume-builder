"""
scripts/ingest_jobs.py — run this by hand (or via the admin panel's "Run
ingestion now" button, see api/admin.py's trigger_jobs_ingest) to refresh
the Jobs Board's inventory. On the deployed service itself, this also
runs automatically every 6 hours (see app/__init__.py's scheduler
wiring) — this script is for a manual, on-demand run from a terminal.

    python3 scripts/ingest_jobs.py

All the real logic lives in app.jobs_ingest.pipeline.run_ingestion() —
this file just supplies the real Flask app it needs (DB access requires
a real app context, same as any other script in this app that touches
the database) and makes it callable from the command line.

Remotive and Arbeitnow's own API terms both ask not to be polled
excessively (Remotive: max ~4x/day) — the 6-hour scheduler interval
already respects that; don't run this script in a tight loop either.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.jobs_ingest.pipeline import run_ingestion

if __name__ == "__main__":
    app = create_app()
    result = run_ingestion(app)
    if result is None:
        sys.exit(1)
    print(f"\n✅ {result['new_jobs_this_run']} new, {result['expired_this_run']} expired, {result['total_jobs']} total live jobs.")
    if result["categories_still_empty"]:
        print(f"⚠️  Categories still empty after retry: {result['categories_still_empty']}")
