"""
app/utils/mail.py
Plain smtplib sender for account emails (verification, password reset).
No Flask-Mail dependency — one function, used from two places.
"""
import os
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import certifi

MAIL_SERVER = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
MAIL_PORT = int(os.environ.get("MAIL_PORT", "587"))
MAIL_USE_TLS = os.environ.get("MAIL_USE_TLS", "True").strip().lower() == "true"
MAIL_USERNAME = os.environ.get("MAIL_USERNAME")
MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD")
MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER") or MAIL_USERNAME


def send_email(to, subject, html_body):
    if not MAIL_USERNAME or not MAIL_PASSWORD:
        raise RuntimeError("MAIL_USERNAME/MAIL_PASSWORD are not configured")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = MAIL_DEFAULT_SENDER
    msg["To"] = to
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(MAIL_SERVER, MAIL_PORT, timeout=15) as server:
        if MAIL_USE_TLS:
            # Some Python installs (notably python.org's macOS build without
            # "Install Certificates.command" run) ship without a usable
            # system trust store, so ssl.create_default_context() fails
            # every TLS handshake with CERTIFICATE_VERIFY_FAILED. certifi's
            # bundle is guaranteed present (it's a transitive dep of
            # requests, already in requirements.txt) and works identically
            # in prod, so it removes the dependency on the host's own store.
            server.starttls(context=ssl.create_default_context(cafile=certifi.where()))
        server.login(MAIL_USERNAME, MAIL_PASSWORD)
        server.sendmail(MAIL_DEFAULT_SENDER, [to], msg.as_string())
