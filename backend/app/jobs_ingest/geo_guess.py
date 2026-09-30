"""
geo_guess.py — best-effort country code for a job's free-text location
field. Every source shapes this differently (Remotive's
candidate_required_location is often already country-like — "USA", "UK";
Greenhouse/Ashby give a real office location — "Dublin", "New York, NY
(HQ)"; Arbeitnow gives a city), so this is pattern matching against a
short list of common names/abbreviations, not a geocoding service —
honestly partial by design. A job whose location doesn't match anything
here just gets country=None and is still fully usable everywhere except
the country filter, never dropped or miscategorized because of it.
"""
import re

# name/abbreviation (lowercased) -> ISO 3166-1 alpha-2. Deliberately not
# exhaustive — the companies and aggregators seeded in this pipeline skew
# heavily US/EU/India/Canada, so that's what's covered; add to this as
# real location strings show up uncovered rather than guessing ahead of
# actual data.
_COUNTRY_PATTERNS = [
    (r"\busa\b|\bunited states\b|\bu\.s\.a?\.?\b", "US"),
    (r"\bremote \(us\)\b|, ny\b|, ca\b|, tx\b|, wa\b|, il\b|, ma\b|, ga\b|, co\b|, fl\b", "US"),
    (r"\buk\b|united kingdom|london|england", "GB"),
    (r"\bcanada\b|toronto|vancouver|, on\b|, bc\b", "CA"),
    (r"\bgermany\b|berlin|munich|frankfurt", "DE"),
    (r"\bfrance\b|paris", "FR"),
    (r"\bireland\b|dublin", "IE"),
    (r"\bindia\b|bengaluru|bangalore|mumbai|hyderabad|pune|delhi", "IN"),
    (r"\bnetherlands\b|amsterdam", "NL"),
    (r"\bspain\b|madrid|barcelona", "ES"),
    (r"\bportugal\b|lisbon", "PT"),
    (r"\bsingapore\b", "SG"),
    (r"\baustralia\b|sydney|melbourne", "AU"),
    (r"\bjapan\b|tokyo", "JP"),
    (r"\bbrazil\b|s[ãa]o paulo", "BR"),
    (r"\bmexico\b", "MX"),
    (r"\bpoland\b|warsaw", "PL"),
    (r"\bsweden\b|stockholm", "SE"),
    (r"\bswitzerland\b|zurich", "CH"),
    (r"\beu\b|european union", "EU"),  # not a real ISO country — kept as an honest "region, not a country" bucket
]
_COMPILED = [(re.compile(pat, re.IGNORECASE), code) for pat, code in _COUNTRY_PATTERNS]


def guess_country(location_text):
    if not location_text:
        return None
    for pattern, code in _COMPILED:
        if pattern.search(location_text):
            return code
    return None
