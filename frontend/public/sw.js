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
const OFFLINE_CACHE = "noviq-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then((cache) => cache.add(OFFLINE_URL))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return; // everything else: normal network request, untouched
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL))
  );
});
