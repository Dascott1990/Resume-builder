"""
app/utils/stripe_client.py — Stripe SDK setup, same shape as CLAUDE_API_KEY/
GROQ_API_KEY in api/resume.py and JWT_SECRET in utils/auth.py: read once
from an environment variable, never hardcoded, never committed. Set
STRIPE_SECRET_KEY directly in Render's dashboard (or a local, gitignored
.env for development) — use a test-mode key (sk_test_...) for all
development and verification; only switch to a live key once this is
actually ready to move real money.

FRONTEND_URL is where Stripe redirects back to after Checkout/Connect
onboarding — defaults to the known production frontend so this works
without extra config, but is overridable for local development.
"""
import os
import stripe

STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://resume-builder-orpin-theta.vercel.app")

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


def stripe_configured() -> bool:
    """False until STRIPE_SECRET_KEY is actually set — every route that
    touches Stripe checks this first and fails with a clear message
    instead of a confusing SDK error, same "missing config fails
    obviously" reasoning as issue_token's JWT_SECRET check."""
    return bool(STRIPE_SECRET_KEY)
