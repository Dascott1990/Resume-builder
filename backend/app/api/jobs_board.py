"""
app/api/jobs_board.py — the public read side of the verified-jobs
pipeline (see app/jobs_ingest/). No auth, no guest scoping: this is a
shared catalog, the same for every visitor, the same shape "browse
artisans" used to be before that feature was removed.

GET /api/v1/jobs        — filtered, paginated list of currently-live (non-expired) jobs
GET /api/v1/jobs/meta   — last_updated + per-source health + category coverage of the latest run

Reads straight off the JSON snapshot on disk (app/jobs_ingest/pipeline.py's
SNAPSHOT_PATH) on every request — deliberately not cached in memory: the
file is only rewritten a few times a day by the ingestion script (see
scripts/ingest_jobs.py), and a plain disk read of a ~2MB JSON file is fast
enough that an in-memory cache would be solving a problem that doesn't
exist yet. If/when this moves to a real database table (same shape, per
the product spec this was built against), this file's own two routes are
the only thing that needs to change — every frontend caller already just
calls GET /api/v1/jobs.
"""
import os
import json

from flask import Blueprint, request, jsonify

from app import limiter
from app.middleware.error_handlers import APIError
from app.jobs_ingest.pipeline import SNAPSHOT_PATH
from app.jobs_ingest.categories import CATEGORIES
from app.jobs_ingest.trending import TRENDING_FIELDS, trending_counts, field_matches

jobs_board_bp = Blueprint("jobs_board", __name__)

# The app-wide default (200/hour, see app/__init__.py) is sized for
# auth and AI-generation routes an anonymous caller could otherwise
# abuse -- these routes are the opposite profile: public, read-only,
# no cost per request (a disk read of a static JSON snapshot), and
# legitimately called on every Dashboard load AND every filter/search
# change on the Jobs Board. Sharing the default bucket meant ordinary
# browsing (confirmed live: a Dashboard reload plus a few Jobs Board
# searches) could burn through it and make "Recommended for you" go
# blank -- exactly what this higher limit exists to prevent.
_JOBS_LIMIT = "1000 per hour"


def _load_snapshot():
    if not os.path.exists(SNAPSHOT_PATH):
        return {"meta": None, "jobs": []}
    try:
        with open(SNAPSHOT_PATH) as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {"meta": None, "jobs": []}


@jobs_board_bp.route("", methods=["GET"])
@limiter.limit(_JOBS_LIMIT)
def list_jobs():
    data = _load_snapshot()
    jobs = [j for j in data.get("jobs", []) if not j.get("expired")]

    category = request.args.get("category")
    if category:
        if category not in CATEGORIES and category != "Other":
            raise APIError(f"category must be one of {CATEGORIES + ['Other']}", 400)
        jobs = [j for j in jobs if j["category"] == category]

    country = request.args.get("country")
    if country:
        jobs = [j for j in jobs if (j.get("country") or "").upper() == country.upper()]

    remote_param = request.args.get("remote")
    if remote_param is not None:
        want_remote = remote_param.lower() in ("1", "true", "yes")
        jobs = [j for j in jobs if bool(j.get("remote")) == want_remote]

    min_level = request.args.get("min_verification_level")
    if min_level is not None:
        try:
            min_level = int(min_level)
        except ValueError:
            raise APIError("min_verification_level must be a whole number", 400)
        jobs = [j for j in jobs if j["verification"]["level"] >= min_level]

    posted_after = request.args.get("posted_after")  # ISO date string, e.g. 2026-09-01
    if posted_after:
        jobs = [j for j in jobs if (j.get("posted_at") or "") >= posted_after]

    search = (request.args.get("search") or "").strip().lower()
    if search:
        jobs = [j for j in jobs if search in j["title"].lower() or search in j["company_name"].lower()]

    trending_id = request.args.get("trending")
    if trending_id:
        if trending_id not in {f["id"] for f in TRENDING_FIELDS}:
            raise APIError(f"trending must be one of {[f['id'] for f in TRENDING_FIELDS]}", 400)
        jobs = [j for j in jobs if field_matches(j, trending_id)]

    # Newest first — posted_at is ISO-ish across every source (normalized
    # at ingest time, see sources.py's _unix_to_iso). str() defensively:
    # an old snapshot written before that normalization existed, or a
    # future source with its own quirks, must never 500 this route over
    # a sort-key type mismatch.
    jobs.sort(key=lambda j: str(j.get("posted_at") or ""), reverse=True)

    limit, offset = _clean_pagination()
    page = jobs[offset:offset + limit]

    return jsonify({"success": True, "data": {
        "jobs": page, "total": len(jobs), "limit": limit, "offset": offset,
    }}), 200


@jobs_board_bp.route("/meta", methods=["GET"])
@limiter.limit(_JOBS_LIMIT)
def jobs_meta():
    """Run health (from pipeline.py's own meta) plus live totals over the
    current, non-expired inventory — a distinct thing from the run meta's
    own category_coverage, which only counts jobs NEW to this run. Filter
    dropdowns need "how many live jobs exist in category X right now,"
    not "how many were added most recently" — computed here instead of
    hardcoding a list on the frontend that would drift from real data."""
    data = _load_snapshot()
    meta = dict(data.get("meta") or {})
    live_jobs = [j for j in data.get("jobs", []) if not j.get("expired")]

    category_totals = {}
    country_totals = {}
    for j in live_jobs:
        category_totals[j["category"]] = category_totals.get(j["category"], 0) + 1
        country = j.get("country")
        if country:
            country_totals[country] = country_totals.get(country, 0) + 1

    meta["live_category_totals"] = category_totals
    meta["live_country_totals"] = dict(sorted(country_totals.items(), key=lambda kv: -kv[1]))
    return jsonify({"success": True, "data": meta}), 200


@jobs_board_bp.route("/categories", methods=["GET"])
@limiter.limit(_JOBS_LIMIT)
def jobs_categories():
    return jsonify({"success": True, "data": CATEGORIES}), 200


@jobs_board_bp.route("/trending", methods=["GET"])
@limiter.limit(_JOBS_LIMIT)
def jobs_trending():
    """Real, cited labor-market growth data (see trending.py) plus a live
    count of how many currently-verified jobs in this pipeline's own
    inventory match each field right now."""
    data = _load_snapshot()
    counts = trending_counts(data.get("jobs", []))
    fields = [{**f, "live_count": counts.get(f["id"], 0)} for f in TRENDING_FIELDS]
    return jsonify({"success": True, "data": fields}), 200


def _clean_pagination(default_limit=30, max_limit=100):
    try:
        limit = int(request.args.get("limit", default_limit))
        offset = int(request.args.get("offset", 0))
    except (TypeError, ValueError):
        raise APIError("limit and offset must be whole numbers", 400)
    if limit < 1 or limit > max_limit:
        raise APIError(f"limit must be between 1 and {max_limit}", 400)
    if offset < 0:
        raise APIError("offset must be zero or greater", 400)
    return limit, offset
