"""
app/utils/mail.py
Plain smtplib sender for account emails (verification, password reset).
No Flask-Mail dependency — one function, used from two places.
"""
import os
import socket
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

_real_getaddrinfo = socket.getaddrinfo


def _ipv4_only_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    # smtplib resolves the SMTP host via socket.getaddrinfo() with no
    # family preference, so if DNS returns an AAAA (IPv6) record first,
    # socket.create_connection() tries that address first. On Render (and
    # some other PaaS hosts) the container has no outbound IPv6 route at
    # all, so that attempt fails immediately with "[Errno 101] Network is
    # unreachable" — and the working IPv4 address never even gets a
    # try, because ENETUNREACH looks like a real connection failure, not
    # "this address family isn't available, skip to the next one." Forcing
    # AF_INET here is scoped to just this lookup (see the try/finally
    # below), so it can't affect any other outbound connection the process
    # makes — this fixed a case where the exact same credentials worked
    # from a local machine but failed 100% of the time in production.
    return _real_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)


def send_email(to, subject, html_body):
    if not MAIL_USERNAME or not MAIL_PASSWORD:
        raise RuntimeError("MAIL_USERNAME/MAIL_PASSWORD are not configured")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = MAIL_DEFAULT_SENDER
    msg["To"] = to
    msg.attach(MIMEText(html_body, "html"))

    # Some Python installs (notably python.org's macOS build without
    # "Install Certificates.command" run) ship without a usable system
    # trust store, so ssl.create_default_context() fails every TLS
    # handshake with CERTIFICATE_VERIFY_FAILED. certifi's bundle is
    # guaranteed present (it's a transitive dep of requests, already in
    # requirements.txt) and works identically in prod, so it removes the
    # dependency on the host's own store.
    tls_context = ssl.create_default_context(cafile=certifi.where())

    socket.getaddrinfo = _ipv4_only_getaddrinfo
    try:
        if MAIL_PORT == 465:
            # Implicit TLS — the connection is encrypted from the first
            # byte, never a plaintext handshake. Port 587 (plaintext then
            # STARTTLS) kept failing from Render with "[Errno 101] Network
            # is unreachable" even after forcing IPv4, while the exact same
            # Gmail account works from a different Render project that
            # uses 465 — the two ports can hit genuinely different network
            # policy on a given host, so this isn't a redundant fallback,
            # it's the config that's actually known to work here.
            with smtplib.SMTP_SSL(MAIL_SERVER, MAIL_PORT, timeout=15, context=tls_context) as server:
                server.login(MAIL_USERNAME, MAIL_PASSWORD)
                server.sendmail(MAIL_DEFAULT_SENDER, [to], msg.as_string())
        else:
            with smtplib.SMTP(MAIL_SERVER, MAIL_PORT, timeout=15) as server:
                if MAIL_USE_TLS:
                    server.starttls(context=tls_context)
                server.login(MAIL_USERNAME, MAIL_PASSWORD)
                server.sendmail(MAIL_DEFAULT_SENDER, [to], msg.as_string())
    finally:
        socket.getaddrinfo = _real_getaddrinfo
