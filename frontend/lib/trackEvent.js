// lib/trackEvent.js — fire-and-forget funnel event tracking, same shape as
// app/page.js's own track-visit call: no guest/auth header, never blocks
// the UI on a failed/slow network call. event must be one of the backend's
// own allowlist (backend/app/models.py's FUNNEL_EVENTS) or it's rejected
// server-side, not here.
export function trackEvent(event) {
  fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/meta/track-event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
  }).catch(() => {});
}
