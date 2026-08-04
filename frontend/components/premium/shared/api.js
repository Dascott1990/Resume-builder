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

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
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