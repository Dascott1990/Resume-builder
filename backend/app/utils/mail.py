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

# Same per-file convention every other module reads this from (auth.py,
# schedule_reminders.py) rather than one shared constant — matched here,
# not "fixed," since this isn't the file to go relitigate that in.
FRONTEND_URL = (os.environ.get("FRONTEND_URL") or "http://localhost:3000").rstrip("/")
# A static, transparent-background PNG render of Logo.js's own mark +
# wordmark (public/email-logo.png) — pixel-matched to the real in-app
# logo (same MARK_PATH geometry, same bronze-to-gold gradient, same
# self-hosted Unbounded wordmark font), not a redrawn approximation. A
# real hosted image, not inline SVG: Outlook desktop's rendering engine
# (Word, not a browser) has no SVG support at all, so an <img src> is
# the only logo format guaranteed to actually show up there.
LOGO_URL = f"{FRONTEND_URL}/email-logo.png"


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


def wrap_email_html(heading, body_html, cta_label=None, cta_link=None, footnote=None):
    """The one visual shell every transactional email in this app sends
    through — previously seven near-identical hand-copies of the same
    plain bold-text "NOQEEV" + heading + footer shell, independently
    pasted into auth.py, messages.py, requests.py, brand.py, story.py,
    schedule_reminders.py, and admin.py's broadcast tool, each one free
    to drift from the others. One real template now: the actual logo
    image (LOGO_URL above, not text standing in for it), a gold accent
    bar, and a consistent footer carrying the company's real mailing
    address (CASL — Canada's anti-spam law; Noqeev is Ottawa-based).

    cta_label/cta_link are optional together — pass both for a real
    button, leave both out for a plain body-only email (a message
    notification has nothing to click but "sign in", for instance).
    footnote is small print below the button/body — a link's expiry, a
    "didn't request this?" disclaimer, that kind of thing.

    Table-based layout, every style inline, no external stylesheet, no
    inline SVG, no CSS gradient — deliberately: this has to render
    correctly in Outlook's Word-based engine, not just modern browsers,
    and Word supports none of those. The gold accent is a flat color for
    the same reason (a gradient here would just silently not paint in
    Outlook, leaving a blank bar instead of degrading gracefully)."""
    cta_html = ""
    if cta_label and cta_link:
        cta_html = f"""
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
          <tr>
            <td style="background-color:#f59e0b;border-radius:10px;">
              <a href="{cta_link}" style="display:inline-block;padding:13px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:14.5px;font-weight:700;color:#14151a;text-decoration:none;">{cta_label}</a>
            </td>
          </tr>
        </table>
        """
    footnote_html = f'<p style="margin:20px 0 0;color:#888;font-size:12.5px;line-height:1.6;">{footnote}</p>' if footnote else ""

    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f1ea;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;border:1px solid #e8e3d8;">
            <tr><td style="height:6px;line-height:6px;font-size:0;background-color:#f59e0b;border-radius:16px 16px 0 0;">&nbsp;</td></tr>
            <tr>
              <td style="padding:36px 36px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
                <img src="{LOGO_URL}" alt="Noqeev" width="140" style="display:block;height:auto;margin:0 0 28px;border:0;" />
                <h1 style="margin:0 0 14px;color:#14151a;font-size:21px;font-weight:800;line-height:1.3;">{heading}</h1>
                <div style="color:#444;font-size:14.5px;line-height:1.65;">{body_html}</div>
                {cta_html}
                {footnote_html}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 36px 28px;border-top:1px solid #eee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
                <p style="margin:0;color:#aaa;font-size:11px;line-height:1.6;">Noqeev Technology &middot; 305 Rideau St, Ottawa, ON, Canada</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    """
