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


def issue_token(subject_id: str, role: str = "user") -> str:
    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET is not configured")
    payload = {
        "sub": subject_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str, expected_role: str = "user"):
    """Returns the subject id the token was issued for, or None if it's
    missing, expired, signed with a different secret, or issued for a
    different role than expected. Never raises — every caller treats an
    invalid token exactly like "not logged in", not an error.

    The role check matters once two separate account systems (User,
    Artisan) both issue Bearer-style tokens from the same JWT_SECRET —
    without it, a customer's token and an artisan's token would be
    interchangeable anywhere a raw id is trusted, even though they're rows
    in different tables. Tokens issued before this claim existed have none
    — treated as "user", the only role that existed back then, so no
    already-issued session breaks."""
    if not token or not JWT_SECRET:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
    if payload.get("role", "user") != expected_role:
        return None
    return payload.get("sub")


def get_scope(request):
    """(user_id, guest_id) for the current request — exactly one is
    meaningful for a given caller, but both are returned so a route can
    decide (e.g. "prefer user_id, fall back to guest_id") without repeating
    the header-parsing logic itself."""
    user_id = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        user_id = verify_token(auth_header[len("Bearer "):].strip(), expected_role="user")
    guest_id = request.headers.get("X-Guest-Id") or None
    return user_id, guest_id


def get_artisan_scope(request):
    """artisan_id for the current request, or None. Deliberately its own
    header (X-Artisan-Token), not Authorization — a browser can be signed
    in as BOTH a customer (User account) and an artisan at once, and reusing
    Authorization: Bearer for both would make the two sessions collide,
    each overwriting the other. No guest fallback: unlike the rest of this
    app, receiving/accepting job requests requires a real artisan account —
    see JobRequest's accept/complete routes in api/requests.py."""
    token = request.headers.get("X-Artisan-Token") or ""
    return verify_token(token, expected_role="artisan")


def require_artisan_scope(request):
    """Same as get_artisan_scope, but raises instead of returning None —
    the one-liner every artisan-only route starts with."""
    from app.middleware.error_handlers import APIError

    artisan_id = get_artisan_scope(request)
    if not artisan_id:
        raise APIError("Artisan sign-in required", 401)
    return artisan_id


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
