"""
app/utils/auth.py — password hashing + JWT issuing/verification, and the
one function almost every data endpoint actually calls: get_scope().

Login is optional everywhere in this app. Every endpoint that stores
"your stuff" (saved resumes, job applications, CV scans) accepts either an
Authorization: Bearer <jwt> header (if the visitor signed in) or an
X-Guest-Id header (the anonymous default) and scopes by whichever is
present — preferring the authenticated user_id when both somehow show up.
"""
import os
import jwt
from datetime import datetime, timedelta, timezone
from werkzeug.security import generate_password_hash, check_password_hash

# Only a real secret in production — Render/Vercel both fail closed if this
# isn't set (JWT_SECRET missing at import time raises immediately, before
# any token is ever issued or trusted, rather than silently signing
# everything with a guessable fallback).
JWT_SECRET = os.environ.get("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = 30


def hash_password(password: str) -> str:
    return generate_password_hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return check_password_hash(password_hash, password)


def issue_token(user_id: str) -> str:
    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET is not configured")
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str):
    """Returns the user_id the token was issued for, or None if it's missing,
    expired, or was signed with a different secret. Never raises — every
    caller treats an invalid token exactly like "not logged in", not an error."""
    if not token or not JWT_SECRET:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None


def get_scope(request):
    """(user_id, guest_id) for the current request — exactly one is
    meaningful for a given caller, but both are returned so a route can
    decide (e.g. "prefer user_id, fall back to guest_id") without repeating
    the header-parsing logic itself."""
    user_id = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        user_id = verify_token(auth_header[len("Bearer "):].strip())
    guest_id = request.headers.get("X-Guest-Id") or None
    return user_id, guest_id


def get_admin_user(request):
    """The signed-in User row for this request if (and only if) they're
    flagged is_admin — every /api/v1/admin/* route's identity check. Never
    raises: returns None for anonymous guests, non-admin users, or a
    missing/invalid token, same as an unrecognized caller. Local imports to
    avoid a module-load-time cycle with app.models (see app/__init__.py's
    own deferred blueprint imports for the same pattern)."""
    from app import db
    from app.models import User

    user_id, _ = get_scope(request)
    if not user_id:
        return None
    user = db.session.get(User, user_id)
    if not user or not user.is_admin:
        return None
    return user


def require_admin(request):
    """Same as get_admin_user, but raises instead of returning None — the
    one-liner every admin route starts with. Returns the admin User row so
    routes that need to know "am I acting on myself" (e.g. revoking your
    own admin access) don't have to look it up twice."""
    from app.middleware.error_handlers import APIError

    user = get_admin_user(request)
    if not user:
        raise APIError("Admin access required", 403)
    return user
