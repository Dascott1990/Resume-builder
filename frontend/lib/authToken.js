// Plain localStorage wrapper for the JWT — split out from useAuth.js so
// shared/api.js (which needs to read the token on every request) doesn't
// have to import the hook itself and create a circular module dependency.
const KEY = "noviq_auth_token";

export function getToken() {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch { /* best-effort */ }
}
