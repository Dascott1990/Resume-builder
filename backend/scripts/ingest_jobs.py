"""
scripts/ingest_jobs.py — run this on a schedule (cron, launchd, whatever)
to refresh the verified-jobs snapshot the dashboard reads from.

    python3 scripts/ingest_jobs.py

All the real logic lives in app.jobs_ingest.pipeline.run_ingestion() —
this file just makes it callable from the command line. The same function
is what a later server-side scheduler (see app/utils/task_reminders.py
for this app's existing APScheduler pattern) would call directly, so
moving this from "runs on my laptop" to "runs on the server" later is a
one-line change there, not a rewrite here.

Remotive and Arbeitnow's own API terms both ask not to be polled
excessively (Remotive: max ~4x/day) — don't wire this into anything that
runs more often than a few times a day.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.jobs_ingest.pipeline import run_ingestion

if __name__ == "__main__":
    result = run_ingestion()
    if result is None:
        sys.exit(1)
    print(f"\n✅ {result['new_jobs_this_run']} new, {result['expired_this_run']} expired, {result['total_jobs']} total live jobs.")
    if result["categories_still_empty"]:
        print(f"⚠️  Categories still empty after retry: {result['categories_still_empty']}")
