// Plain localStorage wrapper for the shared secret backend/app/utils/
// auth.py's require_brand_key checks (X-Brand-Key header) — same shape
// as authToken.js. /brand's task center and news composer are admin-
// authored content gated by that shared secret; this is where the one
// prompt to enter it (see BrandKeyGate in NotificationBell.js) stores it,
// so every apiRequest call can attach it without /brand needing an
// actual login wall.
const KEY = "noqeev_brand_key";

export function getBrandKey() {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function setBrandKey(key) {
  try {
    if (key) localStorage.setItem(KEY, key);
    else localStorage.removeItem(KEY);
  } catch { /* best-effort */ }
}
