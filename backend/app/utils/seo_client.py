"""
app/utils/seo_client.py — Google Search Console (OAuth2) + Chrome UX
Report (API key) clients for the /brand SEO dashboard. Same shape as
stripe_client.py: read credentials once from environment variables, set
GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET/CRUX_API_KEY directly
in Render's dashboard (or a local, gitignored .env for development).

Tracks noqeev.com's own site health — not per-user, not per-workspace,
there's exactly one property this ever queries.

Search Console needs a real OAuth dance (the refresh token it returns is
the only thing that can mint fresh access tokens indefinitely without an
admin re-approving consent every time — see models.py's
GoogleSearchConsoleCredential for where that token actually lives).
CrUX History needs only the API key — it's Google-hosted aggregate field
data, not tied to any particular Search Console account.

CrUX over PageSpeed Insights for Core Web Vitals specifically: PSI runs a
fresh synthetic Lighthouse pass every call, and this app's own Lighthouse
runs bounced between 51 and 82 on IDENTICAL code purely from local
machine-load variance during the SEO pass that preceded this dashboard —
a bad foundation for a trend chart. CrUX returns real-user p75 field data
in stable weekly buckets, actually built for trend tracking.
"""
import os

import requests

GOOGLE_OAUTH_CLIENT_ID = os.environ.get("GOOGLE_OAUTH_CLIENT_ID")
GOOGLE_OAUTH_CLIENT_SECRET = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET")
CRUX_API_KEY = os.environ.get("CRUX_API_KEY")
# Where Google redirects back to after the consent screen — has to be the
# BACKEND's own public URL (the callback is a backend route), not
# FRONTEND_URL (stripe_client.py's env var, a different destination
# entirely). Defaults to the known production backend so this works
# without extra config locally too, same reasoning FRONTEND_URL's own
# default already uses.
BACKEND_URL = os.environ.get("BACKEND_URL", "https://resume-builder-blfc.onrender.com")

SITE_URL = "https://www.noqeev.com/"
OAUTH_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
OAUTH_REDIRECT_URI = f"{BACKEND_URL}/api/v1/admin/seo/oauth/callback"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
SEARCH_CONSOLE_QUERY_URL = f"https://www.googleapis.com/webmasters/v3/sites/{requests.utils.quote(SITE_URL, safe='')}/searchAnalytics/query"
CRUX_HISTORY_URL = "https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord"


def google_oauth_configured() -> bool:
    return bool(GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET)


def crux_configured() -> bool:
    return bool(CRUX_API_KEY)


def build_oauth_url(state: str) -> str:
    """`state` should be a short random token the caller verifies on the
    way back (CSRF protection on the OAuth callback — a bare redirect
    with no state check lets anyone trick an authenticated admin's
    browser into completing a consent flow for an attacker-controlled
    authorization code)."""
    params = {
        "client_id": GOOGLE_OAUTH_CLIENT_ID,
        "redirect_uri": OAUTH_REDIRECT_URI,
        "response_type": "code",
        "scope": OAUTH_SCOPE,
        "access_type": "offline",  # required to actually get a refresh_token back
        "prompt": "consent",  # forces a refresh_token even on a repeat/reconnect
        "state": state,
    }
    query = "&".join(f"{k}={requests.utils.quote(str(v), safe='')}" for k, v in params.items())
    return f"https://accounts.google.com/o/oauth2/v2/auth?{query}"


def exchange_code_for_tokens(code: str) -> dict:
    """Returns Google's token response dict (access_token, refresh_token,
    expires_in, ...) — refresh_token is only present on this FIRST
    exchange (or any exchange where prompt=consent forced a fresh one),
    never on a later refresh_access_token() call, which is exactly why
    the one from here is what gets persisted."""
    res = requests.post(GOOGLE_TOKEN_URL, data={
        "code": code,
        "client_id": GOOGLE_OAUTH_CLIENT_ID,
        "client_secret": GOOGLE_OAUTH_CLIENT_SECRET,
        "redirect_uri": OAUTH_REDIRECT_URI,
        "grant_type": "authorization_code",
    }, timeout=15)
    res.raise_for_status()
    return res.json()


def refresh_access_token(refresh_token: str) -> str:
    """Mints a fresh, short-lived access token from the persisted
    refresh_token — called before every Search Console API call, not
    cached, since access tokens are only good for ~1 hour and this
    dashboard's own fetches are infrequent (once daily) enough that
    caching one would add complexity for no real benefit."""
    res = requests.post(GOOGLE_TOKEN_URL, data={
        "refresh_token": refresh_token,
        "client_id": GOOGLE_OAUTH_CLIENT_ID,
        "client_secret": GOOGLE_OAUTH_CLIENT_SECRET,
        "grant_type": "refresh_token",
    }, timeout=15)
    res.raise_for_status()
    return res.json()["access_token"]


def fetch_search_analytics(access_token: str, start_date: str, end_date: str) -> dict:
    """start_date/end_date are "YYYY-MM-DD" strings. No `dimensions`
    given on purpose — an empty dimensions list returns ONE aggregated
    row (site-wide totals for the date range) instead of one row per
    page/query, which is exactly the single daily number this dashboard
    stores. Returns {"clicks", "impressions", "avg_position"} — zeros if
    Search Console genuinely has no data yet for that range (a brand-new
    property, or before its own reporting lag catches up), not an error."""
    res = requests.post(
        SEARCH_CONSOLE_QUERY_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        json={"startDate": start_date, "endDate": end_date, "dimensions": []},
        timeout=15,
    )
    res.raise_for_status()
    rows = res.json().get("rows") or []
    if not rows:
        return {"clicks": 0, "impressions": 0, "avg_position": None}
    row = rows[0]
    return {
        "clicks": int(row.get("clicks") or 0),
        "impressions": int(row.get("impressions") or 0),
        "avg_position": row.get("position"),
    }


def fetch_crux_history() -> dict:
    """Returns the MOST RECENT weekly bucket's p75 values for LCP, CLS,
    and INP — {"lcp_p75", "cls_p75", "inp_p75"}, any of which may be
    None if CrUX doesn't have enough real-user traffic yet to report a
    metric (common for a smaller site; not an error). CrUX only updates
    weekly, so several consecutive daily snapshots will correctly show
    the same value until the underlying week rolls over — that's
    accurate behavior for a trend chart, not a bug to work around."""
    res = requests.post(
        f"{CRUX_HISTORY_URL}?key={CRUX_API_KEY}",
        json={
            "origin": SITE_URL.rstrip("/"),
            "metrics": ["largest_contentful_paint", "cumulative_layout_shift", "interaction_to_next_paint"],
        },
        timeout=15,
    )
    res.raise_for_status()
    series = (res.json().get("record") or {}).get("metrics") or {}

    def latest_p75(metric_key):
        percentiles = (series.get(metric_key) or {}).get("percentilesTimeseries") or {}
        p75_series = percentiles.get("p75s") or []
        return p75_series[-1] if p75_series else None

    return {
        "lcp_p75": latest_p75("largest_contentful_paint"),
        "cls_p75": latest_p75("cumulative_layout_shift"),
        "inp_p75": latest_p75("interaction_to_next_paint"),
    }
