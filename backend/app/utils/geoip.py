"""
app/utils/geoip.py — best-effort IP -> city/region/country, shared by
api/auth.py's new-login alert (login() there) and api/meta.py's public
GET /location (the landing page's visitor-city display).

No geo-IP provider is configured for this app (see CRUX_API_KEY in .env,
which is Chrome UX Report, unrelated) — ip-api.com's free, keyless tier is
used instead. That tier rate-limits by THIS SERVER's own outbound IP,
shared across every visitor who hits it (45 req/min total, not per
visitor) — a real scaling concern once real traffic lands, not a
theoretical one, so results are cached in-process per client IP for an
hour instead of re-fetched on every request. Per-process only (no shared
cache backend exists in this app), so a multi-worker deploy still repeats
the lookup once per worker the first time it sees a given IP — still a
large reduction versus once per request.
"""
import time
import requests

_CACHE = {}  # ip -> (expires_at, geo_dict_or_None)
_CACHE_TTL_SECONDS = 60 * 60
_CACHE_MAX_SIZE = 5000  # crude bound so this can't grow unbounded on a long-running process


def client_ip(request):
    # Same header Render/most proxies set — first entry is the original
    # client, everything after is the proxy chain.
    forwarded = request.headers.get("X-Forwarded-For", "")
    return (forwarded.split(",")[0].strip() if forwarded else request.remote_addr) or None


def lookup_geo(ip):
    """Best-effort {"city", "region", "country", "country_code"} for an
    IP — any value may be None, or the whole thing may be None (localhost,
    a lookup failure, or an unrecognized IP). Never raises: a slow or
    unreachable lookup just means no location, nothing here should ever
    be allowed to fail the caller's own request over it."""
    if not ip or ip in ("127.0.0.1", "::1", "localhost"):
        return None

    cached = _CACHE.get(ip)
    if cached and cached[0] > time.time():
        return cached[1]

    geo = None
    try:
        res = requests.get(
            f"http://ip-api.com/json/{ip}",
            params={"fields": "status,city,regionName,country,countryCode"},
            timeout=1.5,
        )
        data = res.json()
        if data.get("status") == "success":
            geo = {
                "city": data.get("city") or None,
                "region": data.get("regionName") or None,
                "country": data.get("country") or None,
                "country_code": data.get("countryCode") or None,
            }
    except Exception:
        geo = None

    if len(_CACHE) >= _CACHE_MAX_SIZE:
        _CACHE.clear()  # crude eviction — simpler than real LRU for a best-effort cache
    _CACHE[ip] = (time.time() + _CACHE_TTL_SECONDS, geo)
    return geo


def resolve_country_code(request):
    """2-letter country code for the login-geography dashboard (see
    models.LoginGeo) — CF-IPCountry first, since this app runs behind
    Cloudflare in production and that header is free, instant, and
    doesn't cost the ip-api.com rate limit lookup_geo above already has
    to protect. Falls back to lookup_geo's own ip-api.com lookup for
    local dev (no Cloudflare in front of `flask run`) or the rare request
    that reaches this app some other way. Never raises, may return None."""
    cf_country = request.headers.get("CF-IPCountry")
    if cf_country and cf_country != "XX":  # Cloudflare's own "unknown" sentinel
        return cf_country.upper()
    geo = lookup_geo(client_ip(request))
    return (geo or {}).get("country_code")
