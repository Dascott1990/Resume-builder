"""
app/utils/email_logo.py — the Noqeev mark for transactional email.

Two wrong versions before this one, in order:

  1. A hand-drawn bordered-<div> approximation (three sides of a box,
     open on the fourth) — read as a plain "C", not the brand's actual
     asymmetric bowl-and-tail mark at all.

  2. That shape's bytes replaced with the REAL logo — but embedded as a
     base64 `data:` URI <img>, verified only by rendering the raw HTML in
     a headless Chromium browser and screenshotting it. That screenshot
     looked exactly right, and was still the wrong fix: browsers happily
     render data: URI images; several major EMAIL clients (Gmail
     foremost) strip or refuse to render them AT ALL, as a long-standing
     anti-phishing measure — a real inbox would have shown broken-image
     space where this logo should be, the exact bug this was supposed to
     fix, just moved. Confirmed as the actual cause of "still broken"
     after that version shipped. A browser screenshot of raw HTML proves
     the markup is well-formed; it does NOT prove an email client will
     render it — those are different rendering engines with different,
     deliberately stricter rules around embedded content.

This version: a REAL, normally-hosted `<img src="https://.../api/v1/
email-logo.png">` — the single most universally-supported way to put an
image in an email, used by virtually every transactional-email sender
that exists, for exactly this reason. The two things that made the
ORIGINAL frontend-hosted <img> unreliable (see the old version of this
docstring, preserved in git history) were FRONTEND_URL being wrong/
unreachable and Vercel being a second service that could be down
independently of whether mail could still send — neither applies here:
this serves the PNG from THIS backend's own Flask app, in the same
process that sends the email, with the exact bytes baked in below (no
disk read, no dependency on the frontend repo at runtime). If this
process is up enough to send the email, its own route is up too.

Used by mail.py's wrap_email_html() — the ONE shared template every
transactional email in this app sends through, so fixing the logo here
fixes it everywhere at once, not just for auth emails.
"""
import base64
import os

from flask import Response

# Same real 446x124 PNG as before (frontend/public/email-logo.png,
# byte-for-byte — verified via sha256 against that source file), just
# served as a real hosted image now instead of inlined as a data: URI.
# Regenerate with:
#   python3 -c "import base64; print(base64.b64encode(open('frontend/public/email-logo.png','rb').read()).decode())"
# any time that source PNG changes, and paste the output back in below.
_LOGO_PNG_BASE64 = (
    "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"
)
_LOGO_PNG_BYTES = base64.b64decode(_LOGO_PNG_BASE64)
_LOGO_WIDTH = 190
_LOGO_HEIGHT = 53  # 190 * (124 / 446), rounded — preserves the source PNG's aspect ratio

# RENDER_EXTERNAL_URL: platform-injected on every Render service, no
# dashboard setup needed — unlike FRONTEND_URL (see mail.py's own
# docstring on that one), there's no "declared in render.yaml but never
# actually synced onto the live service" gap possible here, since this
# isn't a value anyone has to declare at all. BACKEND_URL is a plain
# manual override for the rare case this ever needs to point somewhere
# else on purpose. Local dev falls back to the same port run.py itself
# listens on.
if os.environ.get("BACKEND_URL"):
    _BACKEND_URL = os.environ["BACKEND_URL"].rstrip("/")
elif os.environ.get("RENDER_EXTERNAL_URL"):
    _BACKEND_URL = os.environ["RENDER_EXTERNAL_URL"].rstrip("/")
else:
    _BACKEND_URL = "http://localhost:5002"


def email_logo_html():
    """Ready-to-embed HTML: a single real hosted <img> pointing at
    serve_email_logo() below, the real mark + wordmark lockup."""
    return (
        f'<img src="{_BACKEND_URL}/api/v1/email-logo.png" '
        f'width="{_LOGO_WIDTH}" height="{_LOGO_HEIGHT}" alt="NOQEEV" '
        f'style="display:block;border:0;outline:none;margin:0 0 24px;">'
    )


def serve_email_logo():
    """The actual route handler (registered in app/__init__.py as GET
    /api/v1/email-logo.png) — serves the exact bytes decoded above.
    Long max-age: this is a fixed asset baked into the deployed code
    itself, never changes without a new deploy, which gets a fresh URL
    anyway (nothing here needs cache-busting)."""
    return Response(
        _LOGO_PNG_BYTES,
        mimetype="image/png",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
