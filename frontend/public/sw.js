/**
 * sw.js — deliberately minimal. This app needs a live connection for
 * almost everything that matters (AI generation, saved resumes, the job
 * tracker, auth) — there's no meaningful "offline mode" to build, and
 * aggressively caching the JS/CSS bundle would risk serving a stale build
 * after a deploy, silently breaking whatever changed. The only two jobs
 * here: (1) exist with a fetch handler, which is what actually makes the
 * app installable in Chrome/Edge/Android, and (2) show a real, on-brand
 * page instead of the browser's own ugly offline error when there's truly
 * no connection for a page navigation.
 */
const OFFLINE_CACHE = "noqeev-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then((cache) => cache.add(OFFLINE_URL))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      // Drop any cache from a previous OFFLINE_CACHE name (e.g. a brand
      // rename that changed this constant) — otherwise it just sits
      // there forever, unreferenced, the first time that name ever
      // changes. Never deletes OFFLINE_CACHE itself, only stragglers.
      .then((keys) => Promise.all(keys.filter((k) => k !== OFFLINE_CACHE && k.startsWith("noqeev-offline")).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return; // everything else: normal network request, untouched
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL))
  );
});

// ── Web Push — behind /brand's notification bell only (see
// app/brand/NotificationBell.js for where a subscription gets created,
// backend/app/api/brand.py's /news route for the one thing that actually
// sends one). The payload is plain JSON, not the Push API's binary
// default, since the backend already sends it that way (see
// utils/push.py) — no encryption-format negotiation needed here. ────────
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* a non-JSON push is just shown with defaults below */ }
  const title = data.title || "Noqeev";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { link: data.link || "/brand" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/brand";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => new URL(c.url).pathname === link);
      if (existing) return existing.focus();
      return self.clients.openWindow(link);
    })
  );
});
