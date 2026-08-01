/**
 * shared/api.js
 *
 * One request helper for the whole frontend. Every backend endpoint speaks
 * the same {success, data, error} envelope (see backend/app/utils/response.py
 * and error_handlers.py), so one function covers all of them — Artisans.js
 * and ResumeGuestMode.js each previously carried their own copy of exactly
 * this logic.
 */
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5002";

export async function apiRequest(path, options) {
  if (!BASE) {
    throw new Error("NEXT_PUBLIC_API_URL is not set. Add it to frontend/.env.local and restart `npm run dev`.");
  }

  let res;
  try {
    res = await fetch(`${BASE}${path}`, options);
  } catch {
    throw new Error(`Could not reach the server at ${BASE}. Is the backend running and is NEXT_PUBLIC_API_URL set correctly?`);
  }

  if (res.status === 204) return null;

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Server returned an unreadable response (HTTP ${res.status}).`);
  }

  if (!res.ok || json.success === false) {
    // Backend error envelope uses "error", success envelope uses "message" —
    // check both so real backend error text always reaches the user.
    throw new Error(json.error || json.message || `Error ${res.status}`);
  }
  return json.data ?? json;
}

export default apiRequest;