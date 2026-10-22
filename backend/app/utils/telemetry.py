"""
app/utils/telemetry.py — search-intent telemetry with strict anti-poisoning sanitization.

Captures user job board search queries asynchronously in a background thread
so search requests never pay a database write penalty. Validates and sanitizes
every query to prevent database junk accumulation, poisoning, or injection.
"""
import re
import html
import threading
import logging
from datetime import datetime, timezone
from flask import current_app

logger = logging.getLogger("search_telemetry")

# Query length boundaries
MIN_QUERY_LENGTH = 2
MAX_QUERY_LENGTH = 64

# Prohibited patterns (scripts, HTML tags, SQL injection primitives)
_DISALLOWED_PATTERNS = [
    re.compile(r"<[^>]+>", re.IGNORECASE),                         # HTML/XML tags
    re.compile(r"javascript\s*:", re.IGNORECASE),                  # JS scheme
    re.compile(r"\b(union\s+select|drop\s+table|insert\s+into|delete\s+from|update\s+\w+\s+set)\b", re.IGNORECASE), # SQL
    re.compile(r"(--|/\*|\*/|;|\|\||&&)", re.IGNORECASE),          # SQL comments/delimiters
]

# Whitelist of allowed characters: alphanumeric, spaces, and safe tech symbols (. - / + #)
_ALLOWED_CHARS_RE = re.compile(r"^[a-zA-Z0-9\s\.\-#\+/]{2,64}$")

# Stop words to ignore when submitted as solitary search terms
_SOLITARY_STOPWORDS = {
    "and", "or", "the", "a", "an", "in", "on", "at", "to", "for", "of", "with",
    "by", "from", "up", "about", "into", "over", "after", "is", "are", "was", "all"
}


def sanitize_search_query(raw_query: str) -> str | None:
    """
    Cleans and validates a user search query.
    Returns the normalized keyword string if valid, or None if rejected.
    """
    if not raw_query or not isinstance(raw_query, str):
        return None

    # Unescape HTML entities and normalize whitespace
    cleaned = html.unescape(raw_query).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)

    if len(cleaned) < MIN_QUERY_LENGTH or len(cleaned) > MAX_QUERY_LENGTH:
        return None

    # Check against anti-poisoning / injection patterns
    for pattern in _DISALLOWED_PATTERNS:
        if pattern.search(cleaned):
            logger.warning("Rejected suspicious search query pattern: %s", cleaned[:30])
            return None

    # Enforce safe character set
    if not _ALLOWED_CHARS_RE.match(cleaned):
        return None

    # Lowercase canonical representation
    normalized = cleaned.lower()

    # Reject solitary stopwords
    if normalized in _SOLITARY_STOPWORDS:
        return None

    return normalized


def _record_intent_worker(app, cleaned_keyword: str):
    """Worker executed in background thread with app context."""
    with app.app_context():
        from app import db
        from app.models import UserSearchIntent

        try:
            intent = UserSearchIntent.query.filter_by(keyword=cleaned_keyword).first()
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            if intent:
                intent.hit_count += 1
                intent.updated_at = now
            else:
                intent = UserSearchIntent(
                    keyword=cleaned_keyword,
                    hit_count=1,
                    is_active_ingestion_target=False,
                    created_at=now,
                    updated_at=now,
                )
                db.session.add(intent)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error("Failed to record search intent '%s': %s", cleaned_keyword, e)


def record_search_intent_async(raw_query: str, app=None):
    """
    Sanitizes query and kicks off an asynchronous background thread to record the intent.
    Never blocks the calling request thread and never raises to callers.
    """
    cleaned = sanitize_search_query(raw_query)
    if not cleaned:
        return

    if app is None:
        try:
            app = current_app._get_current_object()
        except Exception:
            return

    thread = threading.Thread(
        target=_record_intent_worker,
        args=(app, cleaned),
        daemon=True,
    )
    thread.start()
