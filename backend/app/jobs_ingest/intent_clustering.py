"""
app/jobs_ingest/intent_clustering.py — keyword abstraction and clustering for user search signals.

Aggregates raw search queries captured in user_search_intents, clusters them
into normalized job roles/families, and promotes high-intent targets to
dynamically expand crawling and search queries during pipeline ingestion runs.
"""
import re
import logging
from datetime import datetime, timezone
from app.jobs_ingest.categories import categorize

logger = logging.getLogger("intent_clustering")

# Mapping of common search variations to standardized job titles
_TITLE_CLUSTER_RULES = [
    (re.compile(r"\b(react|vue|angular|frontend|front\s*end|ui)\b", re.I), "Frontend Engineer"),
    (re.compile(r"\b(node|django|fastapi|backend|back\s*end|rails|golang|go|rust)\b", re.I), "Backend Engineer"),
    (re.compile(r"\b(full\s*stack|fullstack)\b", re.I), "Full Stack Engineer"),
    (re.compile(r"\b(data\s*scientist|data\s*science)\b", re.I), "Data Scientist"),
    (re.compile(r"\b(data\s*engineer|etl)\b", re.I), "Data Engineer"),
    (re.compile(r"\b(data\s*analyst|bi\s*analyst|analytics)\b", re.I), "Data Analyst"),
    (re.compile(r"\b(devops|sre|cloud|infrastructure|platform\s*eng|kubernetes|aws)\b", re.I), "DevOps / Infrastructure Engineer"),
    (re.compile(r"\b(security|infosec|cybersecurity|appsec|penetration)\b", re.I), "Security Engineer"),
    (re.compile(r"\b(product\s*manager|pm|product\s*owner)\b", re.I), "Product Manager"),
    (re.compile(r"\b(designer|ui/ux|ux|product\s*design)\b", re.I), "Product Designer"),
    (re.compile(r"\b(qa|quality\s*assurance|automation\s*test|sdet)\b", re.I), "QA Automation Engineer"),
    (re.compile(r"\b(ml|ai|machine\s*learning|deep\s*learning|llm)\b", re.I), "Machine Learning Engineer"),
]


def normalize_keyword_to_title(keyword: str) -> str:
    """
    Abstracts a user's free-form search query into a normalized job title / family.
    Example: 'react dev' -> 'Frontend Engineer'
    If no rule matches, uses title casing and category fallback.
    """
    kw = (keyword or "").strip()
    for pattern, canonical_title in _TITLE_CLUSTER_RULES:
        if pattern.search(kw):
            return canonical_title

    cat = categorize(kw)
    if cat != "Other":
        return f"{kw.title()} ({cat})"

    return kw.title()


def aggregate_and_cluster_intents(min_hits: int = 3, top_limit: int = 20):
    """
    Performs clustering and intent promotion:
    1. Normalizes all user_search_intents with canonical job titles.
    2. Identifies top keywords by hit_count >= min_hits.
    3. Promotes top `top_limit` intents to `is_active_ingestion_target = True`.
    4. Demotes stale or low-volume queries to `is_active_ingestion_target = False`.
    Returns dict summarizing the aggregation.
    """
    from app import db
    from app.models import UserSearchIntent

    all_intents = UserSearchIntent.query.order_by(UserSearchIntent.hit_count.desc()).all()
    if not all_intents:
        return {"total_intents": 0, "promoted_count": 0, "active_targets": []}

    promoted_targets = []
    promoted_count = 0
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    for i, intent in enumerate(all_intents):
        # Normalize title if missing or update it
        clustered = normalize_keyword_to_title(intent.keyword)
        if intent.normalized_title != clustered:
            intent.normalized_title = clustered

        # Promote if within top limit and meets volume threshold
        should_activate = (i < top_limit) and (intent.hit_count >= min_hits)
        if should_activate:
            if not intent.is_active_ingestion_target:
                intent.is_active_ingestion_target = True
                intent.updated_at = now
            promoted_targets.append(intent.keyword)
            promoted_count += 1
        else:
            if intent.is_active_ingestion_target:
                intent.is_active_ingestion_target = False
                intent.updated_at = now

    db.session.commit()
    logger.info("Aggregated %d intents, %d active crawling targets", len(all_intents), promoted_count)

    return {
        "total_intents": len(all_intents),
        "promoted_count": promoted_count,
        "active_targets": promoted_targets,
    }


def get_active_ingestion_targets(limit: int = 15) -> list[str]:
    """
    Returns list of active keyword strings for use in dynamic crawling and ingestion.
    """
    from app.models import UserSearchIntent

    intents = (
        UserSearchIntent.query
        .filter_by(is_active_ingestion_target=True)
        .order_by(UserSearchIntent.hit_count.desc())
        .limit(limit)
        .all()
    )
    return [intent.keyword for intent in intents]
