"""
scripts/drop_artisan_tables.py — one-off cleanup for the artisan
marketplace's removal (2026-09-29). The Artisan/ArtisanPhoto/JobRequest/
Message/Review models were deleted from models.py; db.create_all() never
drops a table for a model that's gone, so the 5 tables below would
otherwise sit in the database forever, orphaned and unreferenced by any
code. This app has no formal migration framework (see app/__init__.py's
_sync_missing_columns docstring — schema changes here are ad-hoc ALTERs
run at boot, not Alembic) so this follows that same "plain script, run
once by hand" pattern rather than inventing a new one.

Run manually: python3 scripts/drop_artisan_tables.py
Reads DATABASE_URL the same way app/__init__.py does (falls back to the
local sqlite file if unset — dropping tables that don't exist there is a
harmless no-op via IF EXISTS).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine, text, inspect

TABLES = ["artisan_photos", "job_requests", "messages", "reviews", "artisans"]
# Drop order matters without CASCADE: children (FKs pointing at artisans/
# job_requests) before the parents they reference.


def main():
    db_url = os.environ.get("DATABASE_URL")
    if db_url and db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    elif not db_url:
        db_url = "sqlite:///resume.db"

    print(f"Connecting to: {db_url.split('@')[-1] if '@' in db_url else db_url}")
    engine = create_engine(db_url)

    try:
        with engine.connect() as conn:
            pass
    except Exception as exc:
        print(f"❌ Could not connect to the database: {exc}")
        sys.exit(1)

    inspector = inspect(engine)
    existing = set(inspector.get_table_names())
    to_drop = [t for t in TABLES if t in existing]

    if not to_drop:
        print("✅ None of the artisan tables exist — nothing to drop.")
        return

    print(f"Dropping: {to_drop}")
    with engine.begin() as conn:
        for table in TABLES:
            conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE' if engine.dialect.name == "postgresql" else f'DROP TABLE IF EXISTS "{table}"'))
            print(f"  🗑  dropped {table}")

    remaining = set(inspect(engine).get_table_names())
    still_there = [t for t in TABLES if t in remaining]
    if still_there:
        print(f"⚠️ Still present after drop: {still_there}")
        sys.exit(1)
    print("✅ All 5 artisan tables confirmed gone.")


if __name__ == "__main__":
    main()
