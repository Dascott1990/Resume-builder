"""
company_seeds.py — the curated list of real companies to pull from
Greenhouse and Ashby's public per-company job-board APIs.

Neither ATS has a "search every company" endpoint — each one only serves
postings for one company's own board at a time (e.g.
boards-api.greenhouse.io/v1/boards/<slug>/jobs). There is no directory API
to discover which companies use which ATS, so this list is hand-verified:
every slug below was actually queried against the real API and confirmed
to return real job postings before being added here (see the session that
built this file — every entry returned a nonzero job count at the time of
writing). A slug that stops returning jobs (company moved ATS, renamed
their board) is simply skipped at ingest time, not treated as an error —
see sources.py's fetch_greenhouse/fetch_ashby.

domain is the company's real, well-known homepage — used for Level 2/3
verification (HTTPS + careers-page reachability, WHOIS domain age), since
neither ATS's own job payload reliably gives back the employer's actual
corporate domain (Greenhouse's absolute_url is only the employer's domain
for companies that host their board on a custom subdomain; many don't).
"""

GREENHOUSE_COMPANIES = [
    {"slug": "stripe", "name": "Stripe", "domain": "stripe.com"},
    {"slug": "airbnb", "name": "Airbnb", "domain": "airbnb.com"},
    {"slug": "coinbase", "name": "Coinbase", "domain": "coinbase.com"},
    {"slug": "robinhood", "name": "Robinhood", "domain": "robinhood.com"},
    {"slug": "pinterest", "name": "Pinterest", "domain": "pinterest.com"},
    {"slug": "squarespace", "name": "Squarespace", "domain": "squarespace.com"},
    {"slug": "gitlab", "name": "GitLab", "domain": "gitlab.com"},
    {"slug": "okta", "name": "Okta", "domain": "okta.com"},
    {"slug": "datadog", "name": "Datadog", "domain": "datadoghq.com"},
    {"slug": "asana", "name": "Asana", "domain": "asana.com"},
    {"slug": "dropbox", "name": "Dropbox", "domain": "dropbox.com"},
    {"slug": "reddit", "name": "Reddit", "domain": "reddit.com"},
    {"slug": "discord", "name": "Discord", "domain": "discord.com"},
    {"slug": "figma", "name": "Figma", "domain": "figma.com"},
    {"slug": "cloudflare", "name": "Cloudflare", "domain": "cloudflare.com"},
    {"slug": "twilio", "name": "Twilio", "domain": "twilio.com"},
]

ASHBY_COMPANIES = [
    {"slug": "ramp", "name": "Ramp", "domain": "ramp.com"},
    {"slug": "openai", "name": "OpenAI", "domain": "openai.com"},
    {"slug": "linear", "name": "Linear", "domain": "linear.app"},
    {"slug": "vanta", "name": "Vanta", "domain": "vanta.com"},
    {"slug": "notion", "name": "Notion", "domain": "notion.so"},
    {"slug": "watershed", "name": "Watershed", "domain": "watershed.com"},
    {"slug": "attio", "name": "Attio", "domain": "attio.com"},
    {"slug": "temporal", "name": "Temporal", "domain": "temporal.io"},
    {"slug": "warp", "name": "Warp", "domain": "warp.dev"},
    {"slug": "modal", "name": "Modal", "domain": "modal.com"},
    {"slug": "harvey", "name": "Harvey", "domain": "harvey.ai"},
]

# Bounded per-company pull — see pipeline.py's docstring on why this stays
# small: 16 Greenhouse + 11 Ashby companies at even 30 jobs each is nearly
# a thousand raw candidates before verification even runs.
MAX_JOBS_PER_COMPANY = 15

# ScrapeGraphAI gap-filler tier (see sources.py's fetch_scrapegraph) — for
# real companies with neither a Greenhouse nor Ashby board, whose careers
# page has to be LLM-extracted instead of hit via a clean JSON API. Small
# and hand-tested on purpose: this runs against a metered free-credit
# budget (500 credits total, ~5-10 per extraction), unlike the two ATS
# sources above which are free and unlimited. `careers_url` is used as
# the job's own `url` for every listing from this company — confirmed
# live while building this that Spotify's job list has no real per-
# listing href at all (the cards are client-side-routed, not real <a>
# tags; extraction honestly returned "No content available" every time
# rather than a fabricated link) — so every job from a given company
# here points at that company's real, working jobs list page, not a
# deep link into one specific posting.
SCRAPEGRAPHAI_COMPANIES = [
    {"name": "Spotify", "domain": "spotify.com", "careers_url": "https://www.lifeatspotify.com/jobs"},
]
