// Plain localStorage wrapper for the JWT — split out from useAuth.js so
// shared/api.js (which needs to read the token on every request) doesn't
// have to import the hook itself and create a circular module dependency.
const KEY = "noqeev_auth_token";
// Survives logout on purpose — the one thing page.js needs to tell "never
// had an account on this device" (show Sign up) apart from "signed out of
// a real account" (show Sign in instead). Only ever set, never cleared:
// there's no action in the app that un-creates an account.
const HAS_ACCOUNT_KEY = "noqeev_has_account";

export function getToken() {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function setToken(token) {
  try {
    if (token) {
      localStorage.setItem(KEY, token);
      localStorage.setItem(HAS_ACCOUNT_KEY, "1");
    } else {
      localStorage.removeItem(KEY);
    }
  } catch { /* best-effort */ }
}

export function hasAccountOnDevice() {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(HAS_ACCOUNT_KEY) === "1"; } catch { return false; }
}
