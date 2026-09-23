"""
app/utils/auth.py — password hashing + JWT issuing/verification, and the
one function almost every data endpoint actually calls: get_scope().

Login is optional everywhere in this app. Every endpoint that stores
"your stuff" (saved resumes, job applications, CV scans) accepts either an
Authorization: Bearer <jwt> header (if the visitor signed in) or an
X-Guest-Id header (the anonymous default) and scopes by whichever is
present — preferring the authenticated user_id when both somehow show up.
"""
import hmac
import os
import re
import jwt
from datetime import datetime, timedelta, timezone
from werkzeug.security import generate_password_hash, check_password_hash

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Only a real secret in production — Render/Vercel both fail closed if this
# isn't set (JWT_SECRET missing at import time raises immediately, before
# any token is ever issued or trusted, rather than silently signing
# everything with a guessable fallback).
JWT_SECRET = os.environ.get("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = 30

# Break-glass admin — the one login path that never touches the database,
# so the team keeps admin access even when Postgres itself is down (the
# exact scenario every other admin capability is powerless against, since
# the normal path below is a User row lookup). Credentials live only in
# env vars, generated once by scripts/generate_break_glass_admin.py — never
# a chosen username/password, never committed, and unset means the whole
# feature is off (see break_glass_configured()). The password is stored
# hashed here exactly like a real account's — never in plaintext.
BREAK_GLASS_USERNAME = os.environ.get("BREAK_GLASS_ADMIN_USERNAME")
BREAK_GLASS_PASSWORD_HASH = os.environ.get("BREAK_GLASS_ADMIN_PASSWORD_HASH")
BREAK_GLASS_SUBJECT = "break-glass-admin"
BREAK_GLASS_ROLE = "break-glass-admin"
BREAK_GLASS_TOKEN_HOURS = 12


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


def _decode_payload(token: str, expected_role: str = "user"):
    """Cryptographic verification only, no database access — returns the
    full decoded payload (sub, role, iat, exp) or None if the token is
    missing, expired, signed with a different secret, or issued for a
    different role than expected.

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
    return payload


def verify_token(token: str, expected_role: str = "user"):
    """Returns the subject id the token was issued for, or None if it's
    invalid — see _decode_payload. Never raises — every caller treats an
    invalid token exactly like "not logged in", not an error. Doesn't check
    password_changed_at (that needs a database lookup by subject id, which
    this deliberately stays free of) — callers that need that check use
    _decode_payload + _issued_before_password_change directly instead;
    this stays the plain "is this token real" helper for callers (like
    get_admin_user's break-glass short-circuit) that never reach it."""
    payload = _decode_payload(token, expected_role)
    return payload.get("sub") if payload else None


def _issued_before_password_change(iat, password_changed_at):
    """A token issued before the account's last password change is stale.
    Changing a password is supposed to end every OTHER session — with a
    stateless JWT and no session table to delete rows from, this iat-vs-
    password_changed_at comparison is what actually makes that true (see
    api/auth.py's change_password and api/artisans.py's
    artisan_change_password, which both set the column and re-issue a
    fresh token so the session that MADE the change isn't logged out of
    itself). password_changed_at is None for every account that hasn't
    explicitly changed its password since this existed, so this never
    retroactively invalidates a pre-existing token.

    The 5-second grace window matters: a JWT's iat is whole seconds (per
    the JWT spec), but password_changed_at is a microsecond-precision DB
    timestamp set a moment BEFORE the fresh token's iat is generated in
    the same request — without slack, that fresh token's truncated iat can
    land a fraction of a second "before" password_changed_at and get
    treated as stale immediately, logging out the very session that just
    changed its own password."""
    if not password_changed_at or iat is None:
        return False
    iat_dt = datetime.fromtimestamp(iat, tz=timezone.utc).replace(tzinfo=None)
    return iat_dt < password_changed_at - timedelta(seconds=5)


def break_glass_configured():
    return bool(BREAK_GLASS_USERNAME and BREAK_GLASS_PASSWORD_HASH)


def verify_break_glass_credentials(username: str, password: str) -> bool:
    """Both checks against env vars only — no database, no session table.
    hmac.compare_digest on the username (not just `==`) so a timing side
    channel can't be used to guess it character-by-character the same way
    check_password_hash already prevents that for the password."""
    if not break_glass_configured():
        return False
    got = (username or "").strip().encode()
    want = BREAK_GLASS_USERNAME.encode()
    if len(got) != len(want) or not hmac.compare_digest(got, want):
        return False
    return check_password_hash(BREAK_GLASS_PASSWORD_HASH, password or "")


def issue_break_glass_token() -> str:
    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET is not configured")
    payload = {
        "sub": BREAK_GLASS_SUBJECT,
        "role": BREAK_GLASS_ROLE,
        "exp": datetime.now(timezone.utc) + timedelta(hours=BREAK_GLASS_TOKEN_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode_break_glass_token(token: str):
    if not token or not JWT_SECRET:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
    if payload.get("role") != BREAK_GLASS_ROLE or payload.get("sub") != BREAK_GLASS_SUBJECT:
        return None
    return payload


class BreakGlassAdmin:
    """Stand-in for a User row, minted straight from a verified break-glass
    token rather than a database read — the whole point being that this
    works when the users table doesn't respond. Carries just the fields
    admin routes actually read off an admin (see api/admin.py's
    _serialize_user and the admin.id self-action checks)."""

    id = BREAK_GLASS_SUBJECT
    email = "break-glass-admin"
    email_verified = True
    is_admin = True
    created_at = None

    def to_dict(self):
        return {
            "id": self.id, "email": self.email, "email_verified": True,
            "is_admin": True, "created_at": None, "break_glass": True,
        }


def get_scope(request):
    """(user_id, guest_id) for the current request — exactly one is
    meaningful for a given caller, but both are returned so a route can
    decide (e.g. "prefer user_id, fall back to guest_id") without repeating
    the header-parsing logic itself.

    Does a User row lookup whenever a Bearer token is present (not just
    crypto verification) — the only way to check the token against
    password_changed_at, see _issued_before_password_change. That's a real
    added DB query on every authenticated request this app didn't pay
    before; the alternative is a password change that doesn't actually log
    anyone else out, which defeats the point of a password change."""
    user_id = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        payload = _decode_payload(auth_header[len("Bearer "):].strip(), expected_role="user")
        if payload:
            from app import db
            from app.models import User

            user = db.session.get(User, payload.get("sub"))
            if user and not _issued_before_password_change(payload.get("iat"), user.password_changed_at):
                user_id = user.id
    guest_id = request.headers.get("X-Guest-Id") or None
    return user_id, guest_id


def require_customer_scope(request):
    """user_id for the current request, or raises — the booking/messaging/
    payment gate. Deliberately NOT get_scope's (user_id, guest_id) pair: the
    rest of this app treats guest_id as an equally valid identity for
    "your stuff," but posting a job request, messaging about one, or paying
    for one are the three actions the product explicitly requires a real
    account for (see api/requests.py's create_request) — an anonymous
    visitor can still browse/search freely, this only gates the moment they
    try to act. Returns the user_id (not the User row) so callers that
    don't need the full row avoid an extra query, same shape as
    get_artisan_scope/require_artisan_scope's artisan_id-only return."""
    from app.middleware.error_handlers import APIError

    user_id, _ = get_scope(request)
    if not user_id:
        raise APIError("Sign in to book, message, or pay", 401)
    return user_id


def get_artisan_scope(request):
    """artisan_id for the current request, or None. Deliberately its own
    header (X-Artisan-Token), not Authorization — a browser can be signed
    in as BOTH a customer (User account) and an artisan at once, and reusing
    Authorization: Bearer for both would make the two sessions collide,
    each overwriting the other. No guest fallback: unlike the rest of this
    app, receiving/accepting job requests requires a real artisan account —
    see JobRequest's accept/complete routes in api/requests.py."""
    token = request.headers.get("X-Artisan-Token") or ""
    payload = _decode_payload(token, expected_role="artisan")
    if not payload:
        return None

    from app import db
    from app.models import Artisan

    artisan = db.session.get(Artisan, payload.get("sub"))
    if not artisan or _issued_before_password_change(payload.get("iat"), artisan.password_changed_at):
        return None
    return artisan.id


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
    own deferred blueprint imports for the same pattern).

    Checked first, before any database access: a break-glass token decodes
    and verifies entirely from JWT_SECRET + the signature, so this whole
    branch never reaches the database — the one auth path built specifically
    to survive Postgres being unreachable. A normal user token still goes
    through the User row lookup below, deliberately — that's what lets
    revoking someone's is_admin flag actually take effect immediately.

    Also accepts the token via ?token= query string, not just the
    Authorization header — same "fetch header OR query string" shape
    get_workspace already uses. Needed for routes an admin reaches via a
    real browser navigation rather than a fetch() call (the Search
    Console OAuth start redirect, api/admin.py's /seo/oauth/start —
    a top-level navigation can't attach a custom header the way a
    fetch() request can)."""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[len("Bearer "):].strip() if auth_header.startswith("Bearer ") else request.args.get("token")
    if token and _decode_break_glass_token(token):
        return BreakGlassAdmin()

    from app import db
    from app.models import User

    payload = _decode_payload(token, expected_role="user") if token else None
    if not payload:
        return None
    user = db.session.get(User, payload.get("sub"))
    if not user or not user.is_admin:
        return None
    if _issued_before_password_change(payload.get("iat"), user.password_changed_at):
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


def get_workspace(request):
    """The branding workspace's entire access model: the token IS the
    authorization, same bearer-secret shape as Artisan.edit_token (see
    api/artisans.py's _authorize_edit) — no login, no User row, nothing
    to look up beyond "does a workspace with this token exist." Checked
    in three places, in order, so the same request shape works whether
    the token's coming from a fetch header, a query string (a plain link
    someone opens in a browser), or a JSON body — never raises, mirrors
    get_admin_user's own "return None for anyone unrecognized" shape."""
    from app.models import BrandWorkspace

    token = (
        request.headers.get("X-Workspace-Token")
        or request.args.get("token")
        or (request.get_json(silent=True) or {}).get("token")
    )
    if not token:
        return None
    return BrandWorkspace.query.filter_by(token=token).first()


def require_workspace(request):
    """Same as get_workspace, but raises instead of returning None — the
    one-liner every branding-workspace route starts with."""
    from app.middleware.error_handlers import APIError

    ws = get_workspace(request)
    if not ws:
        raise APIError("Invalid or missing workspace token", 401)
    return ws


def require_brand_key(request):
    """Gates the handful of /brand routes that are genuinely internal-only
    — BrandNews/BrandTask are admin-authored content (their own docstrings
    in models.py say so), not per-visitor data, and posting a news item
    fans a real push notification out to every subscriber. Everything
    else in api/brand.py (news/world-feed reads, push subscribe, the AI
    suggest/render tools) stays open on purpose — those have real
    anonymous callers and are already rate-limited, matching the rest of
    this app's "anonymous but rate-limited" posture; only the actual
    admin-write surface needed a real gate.

    Same shared-secret shape as api/cron.py's own X-Cron-Secret check —
    fails CLOSED: BRAND_INTERNAL_KEY unset means every gated route 503s,
    not 200s, so this is secure the moment it deploys, before anyone
    remembers to configure the env var."""
    from app.middleware.error_handlers import APIError

    secret = os.environ.get("BRAND_INTERNAL_KEY")
    if not secret:
        raise APIError("BRAND_INTERNAL_KEY is not configured", 503)
    provided = request.headers.get("X-Brand-Key") or ""
    if not provided or not hmac.compare_digest(provided.encode(), secret.encode()):
        raise APIError("Invalid or missing brand key", 401)
