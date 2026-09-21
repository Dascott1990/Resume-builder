"""
app/utils/mail.py
Email sender via Resend's HTTP API (api.resend.com) — used for account
emails (verification, password reset) and, since api/brand.py, an
optional single attachment for "email this post" / story exports. One
function, used from several places, same shape either way.

Replaced the previous raw smtplib-over-Gmail sender: that was failing
in production with connection timeouts (Gmail throttles/blocks SMTP
from hosting-provider IP ranges — a known, common failure mode, not a
one-off). An HTTP API call doesn't have that exposure at all, and
sending from Noqeev's own verified domain (noqeev.com, set up on
Resend) is also just more correct than relaying through a personal
Gmail account.
"""
import base64
import os

import requests

RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
RESEND_API_URL = "https://api.resend.com/emails"
# The address mail actually sends from — needs no real inbox behind it,
# just a domain verified with Resend (SPF/DKIM added in Cloudflare's DNS
# for noqeev.com). Overridable via env in case a different verified
# sender is ever needed without a code change.
MAIL_FROM = os.environ.get("MAIL_FROM", "Noqeev <noreply@noqeev.com>")


def mail_configured():
    """Same shape as utils/push.py's push_configured() — a guard a
    background job can check before attempting to send, instead of every
    caller having to wrap send_email() in its own try/except for the
    "not configured" case specifically (send_email itself still raises
    if called without credentials; this just lets a caller skip the
    attempt entirely, silently, when that's the more correct response)."""
    return bool(RESEND_API_KEY)


def send_email(to, subject, html_body, attachment=None):
    """attachment, if given, is either ONE (filename, bytes, mime_subtype)
    tuple e.g. ("post.png", b"...", "png") — every existing call site
    (auth verification/reset, job-request/message notifications, single-
    image "email this post") passes it this way — or a LIST of such
    tuples, for sending several attachments in one email (multi-select
    "email these posts"). Kept optional and additive: nothing existing
    changes shape. Resend accepts attachment content as plain base64, no
    MIME subtype distinction needed the way the old smtplib version
    required (MIMEImage vs MIMEBase)."""
    if not RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY is not configured")

    payload = {
        "from": MAIL_FROM,
        "to": [to],
        "subject": subject,
        "html": html_body,
    }
    if attachment:
        attachments = attachment if isinstance(attachment, list) else [attachment]
        payload["attachments"] = [
            {"filename": filename, "content": base64.b64encode(file_bytes).decode("ascii")}
            for filename, file_bytes, _mime_subtype in attachments
        ]

    res = requests.post(
        RESEND_API_URL,
        headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
        json=payload,
        timeout=15,
    )
    if res.status_code >= 400:
        # Resend's error body is JSON with a "message" field — surfaced
        # here so a failure reads as "recipient address invalid" instead
        # of a bare, unhelpful HTTP status code.
        try:
            detail = res.json().get("message", res.text)
        except ValueError:
            detail = res.text
        raise RuntimeError(f"Resend API error ({res.status_code}): {detail}")
