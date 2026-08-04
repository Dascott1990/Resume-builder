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
