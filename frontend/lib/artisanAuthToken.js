"use client";

// A separate account system from the customer-facing User auth (see
// lib/authToken.js) — a browser can be signed in as BOTH a customer and an
// artisan at once, so this gets its own localStorage key and its own
// header (X-Artisan-Token, not Authorization: Bearer — see the backend's
// get_artisan_scope) rather than sharing either with the customer session.
const KEY = "noviq_artisan_token";

export function getArtisanToken() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function setArtisanToken(token) {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch { /* best-effort */ }
}
