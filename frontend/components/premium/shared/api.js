/**
 * shared/api.js
 *
 * One request helper for the whole frontend. Every backend endpoint speaks
 * the same {success, data, error} envelope (see backend/app/utils/response.py
 * and error_handlers.py), so one function covers all of them — Artisans.js
 * and ResumeGuestMode.js each previously carried their own copy of exactly
 * this logic.
 */
import { getGuestId } from "@/lib/guestId";
import { getToken } from "@/lib/authToken";

const BASE = process.env.NEXT_PUBLIC_API_URL;

export async function apiRequest(path, options = {}) {
  if (!BASE) {
    // No silent fallback to localhost here on purpose — that fallback is
    // exactly the trap that makes "works on localhost, nothing on Vercel"
    // happen: it works on your machine because you happen to have a Flask
    // server on :5002, and every visitor's browser tries their OWN
    // localhost:5002 in production, where nothing is listening.
    throw new Error("NEXT_PUBLIC_API_URL is not set. Set it in Vercel → Project Settings → Environment Variables to your Render backend URL, then redeploy (NEXT_PUBLIC_ vars are baked in at build time, so saving the setting alone isn't enough).");
  }

  // Attached to every request, not just the resume-saving ones — a single
  // anonymous per-browser id, generic enough for any future feature that
  // needs "this visitor's own X" without ever needing an account.
  const headers = { ...(options.headers || {}), "X-Guest-Id": getGuestId() };
  // Optional — only set once someone's actually signed in. The backend
  // prefers this over X-Guest-Id whenever both are present (see
  // app/utils/auth.get_scope), which is what makes "your stuff follows you
  // across devices" true for whoever opts into an account.
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch {
    // Fetch itself throwing (as opposed to resolving with a non-2xx status)
    // means the request never reached a server at all — dropped connection,
    // DNS failure, backend down. Tagged so the UI can show a calm "check
    // your connection" screen instead of the raw dev-facing message below,
    // which is still attached (as .detail) for the technical-details panel.
    const err = new Error("Can't reach Noviq's servers right now.");
    err.code = "NETWORK_ERROR";
    err.detail = `Could not reach the server at ${BASE}. Is the backend running and is NEXT_PUBLIC_API_URL set correctly?`;
    throw err;
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
    const err = new Error(json.error || json.message || `Error ${res.status}`);
    // Machine-readable tag (e.g. "EMAIL_NOT_VERIFIED") for the handful of
    // cases the UI needs to branch on, not just display — see auth.py.
    if (json.code) err.code = json.code;
    throw err;
  }
  return json.data ?? json;
}

export default apiRequest;