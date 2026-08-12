"""
app/utils/geocoding.py — turns a free-text city string into real
coordinates via Nominatim (OpenStreetMap's public geocoder): no signup, no
API key, no card, ever. In exchange, its usage policy requires at most 1
request/second and a descriptive User-Agent identifying the calling app —
both enforced here, not left to callers to remember. This only ever runs
on save (an artisan creating/editing their listing), never per-search, so
the 1/sec ceiling is nowhere close to a real constraint for this app's
actual traffic pattern.

If this app ever needs geocoding at a volume Nominatim's fair-use policy
doesn't comfortably cover, swapping providers is isolated to this one file
— every caller only ever sees geocode_city()'s (lat, lng) | None contract.
"""
import time
import threading
import requests

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
# Required by Nominatim's usage policy — identifies the app, not a bare
# "python-requests/x.y" default that their servers are known to block.
USER_AGENT = "Noviq-ArtisanMarketplace/1.0 (contact: support@noviq.app)"

_last_call_lock = threading.Lock()
_last_call_at = 0.0
MIN_INTERVAL_SECONDS = 1.05  # a hair over 1/sec — never race the policy's edge


def _throttle():
    global _last_call_at
    with _last_call_lock:
        wait = MIN_INTERVAL_SECONDS - (time.monotonic() - _last_call_at)
        if wait > 0:
            time.sleep(wait)
        _last_call_at = time.monotonic()


def geocode_city(city: str):
    """(lat, lng, display_name) for a free-text city string, or None.
    Best-effort — never raises. A network hiccup, an empty/nonsense city,
    or Nominatim finding nothing all just mean "no coordinates yet,"
    exactly the same as an artisan who's never saved a city at all."""
    city = (city or "").strip()
    if not city:
        return None

    _throttle()
    try:
        res = requests.get(
            NOMINATIM_URL,
            params={"q": city, "format": "json", "limit": 1},
            headers={"User-Agent": USER_AGENT},
            timeout=10,
        )
        if not res.ok:
            return None
        results = res.json()
        if not results:
            return None
        top = results[0]
        return float(top["lat"]), float(top["lon"]), top.get("display_name")
    except (requests.exceptions.RequestException, ValueError, KeyError, TypeError) as exc:
        print(f"⚠️ Geocoding failed for city={city!r}: {exc}")
        return None


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km between two lat/lng points — the actual
    distance calc behind browse's "near me" sort. Pure function, no
    external calls, safe to run on every row in a result set."""
    from math import radians, sin, cos, asin, sqrt

    r = 6371.0  # Earth's mean radius, km
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * r * asin(sqrt(a))
