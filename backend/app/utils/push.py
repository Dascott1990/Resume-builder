"""
app/utils/push.py — real Web Push (VAPID), behind /brand's notification
bell only. One VAPID key pair for the whole app (env vars, not per-user),
same shape as mail.py's single MAIL_* config — this app has exactly one
sender identity for push, same as it has one for email.

Generating a pair (do this once, store the output as env vars, never
commit the private key):
    python3 -c "
    from py_vapid import Vapid02
    import base64
    v = Vapid02(); v.generate_keys()
    priv = v.private_key.private_numbers().private_value.to_bytes(32, 'big')
    pub_n = v.public_key.public_numbers()
    pub = b'\\x04' + pub_n.x.to_bytes(32,'big') + pub_n.y.to_bytes(32,'big')
    print('VAPID_PRIVATE_KEY=' + base64.urlsafe_b64encode(priv).rstrip(b'=').decode())
    print('VAPID_PUBLIC_KEY=' + base64.urlsafe_b64encode(pub).rstrip(b'=').decode())
    "
"""
import os

from pywebpush import webpush, WebPushException

VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY")
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY")
# mailto: is required by the spec (lets a push service's operator contact
# someone if a sender is misbehaving) — reuses the same address the rest
# of the app already sends real mail from, not a separate identity.
VAPID_CLAIMS = {"sub": f"mailto:{os.environ.get('MAIL_DEFAULT_SENDER') or 'admin@noqeev.local'}"}


def push_configured():
    return bool(VAPID_PRIVATE_KEY and VAPID_PUBLIC_KEY)


def send_push(subscription_dict, payload_json):
    """
    Sends to exactly one subscription. Returns True on success. Returns
    False (never raises) for a dead subscription — 404/410 means the
    browser unsubscribed or the push service expired it; the caller is
    expected to delete that row so it stops trying forever. Any other
    failure IS re-raised — that's a real, unexpected error worth seeing
    in logs, not something to silently swallow like a dead subscription.
    """
    try:
        webpush(
            subscription_info=subscription_dict,
            data=payload_json,
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=dict(VAPID_CLAIMS),
        )
        return True
    except WebPushException as e:
        status = getattr(e.response, "status_code", None)
        if status in (404, 410):
            return False
        raise


def send_push_to_all(subscriptions, payload_json):
    """
    Best-effort fan-out to every stored subscription. Returns the list of
    subscription ids that turned out to be dead (404/410) so the caller
    can delete them — pruning here, once, is what keeps this list from
    silently accumulating browsers that unsubscribed months ago.
    """
    dead_ids = []
    for sub in subscriptions:
        alive = send_push(sub.to_webpush_subscription(), payload_json)
        if not alive:
            dead_ids.append(sub.id)
    return dead_ids
