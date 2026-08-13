/**
 * sw.js — the app shell (JS/CSS bundle + HTML) is cached at runtime so a
 * repeat visitor who goes offline can still load Noviq and reach an
 * already-saved localStorage draft (Guest Mode is 100% client-side once
 * loaded — see guest/useGuestDraft.js — and both PDF and DOCX export are
 * client-side too). This SW still does NOT attempt to make anything
 * server-dependent work offline — AI generation, saved-resume sync, the
 * Artisan marketplace, and auth all still need a live connection and are
 * untouched here; see shared/api.js's NETWORK_ERROR path for how those
 * failures already surface gracefully.
 *
 * Caching strategy:
 *  - /_next/static/*  → cache-first, forever. Safe because Next content-
 *    hashes these filenames per build — a stale cache entry just becomes an
 *    unused key after a redeploy (new HTML references new hashed URLs), it
 *    is never served in place of new code.
 *  - navigations (full page loads) → network-first, falling back to the
 *    last successfully cached copy of that exact URL, and only to
 *    offline.html if there's no cached copy of that URL at all (e.g. a
 *    route never visited on this device).
 *  - /api/* and everything cross-origin (the real backend) → untouched,
 *    exactly as before. Never cached — caching those would risk stale
 *    saved-resume lists / job-tracker state.
 */
const CACHE_VERSION = "v2";
const STATIC_CACHE = `noviq-static-${CACHE_VERSION}`;
const PAGES_CACHE = `noviq-pages-${CACHE_VERSION}`;
const OFFLINE_CACHE = `noviq-offline-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";
const CURRENT_CACHES = [STATIC_CACHE, PAGES_CACHE, OFFLINE_CACHE];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then((cache) => cache.add(OFFLINE_URL))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n.startsWith("noviq-") && !CURRENT_CACHES.includes(n))
            .map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never intercept mutating calls

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // real backend, untouched
  if (url.pathname.startsWith("/api/")) return; // e.g. /api/geo, untouched

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  // everything else: normal network request, untouched
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone()); // don't cache error pages
    return response;
  } catch {
    return (await cache.match(request)) || caches.match(OFFLINE_URL);
  }
}
