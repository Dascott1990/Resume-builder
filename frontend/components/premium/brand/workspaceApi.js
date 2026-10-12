"use client";
/**
 * workspaceApi.js — the one request helper every branding-workspace tool
 * uses, same shape as components/premium/shared/api.js's apiRequest but
 * attaching X-Workspace-Token instead of X-Guest-Id/Authorization — this
 * feature has no guest id, no login, only the token.
 */
export const WORKSPACE_TOKEN_HEADER = "X-Workspace-Token";

// workspaceFetch tags its own thrown errors with i18nKey/i18nParams so
// callers can localize them; a backend-provided json.error has neither
// (translating arbitrary backend text is out of scope here) and falls
// back to its own message as-is.
export function workspaceErrorMessage(e, t) {
  return e?.i18nKey ? t(e.i18nKey, e.i18nParams) : e?.message;
}

const BASE = process.env.NEXT_PUBLIC_API_URL;

export async function workspaceFetch(token, path, options = {}) {
  if (!BASE) {
    throw new Error("NEXT_PUBLIC_API_URL is not set — set it in Vercel → Project Settings → Environment Variables to the Render backend URL, then redeploy.");
  }
  const headers = { ...(options.headers || {}), [WORKSPACE_TOKEN_HEADER]: token };

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch {
    const err = new Error("Can't reach Noqeev's servers right now.");
    err.code = "NETWORK_ERROR";
    err.i18nKey = "brandWorkspaceApi.networkError";
    throw err;
  }

  if (res.status === 204) return null;

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    // A binary response (an exported PNG/GIF/video) — the caller wants
    // the raw Response to read .blob()/.arrayBuffer() itself, not a
    // parsed body this helper would have to guess the shape of.
    if (!res.ok) { const err = new Error(`Request failed (${res.status})`); err.i18nKey = "brandWorkspaceApi.requestFailed"; err.i18nParams = { status: res.status }; throw err; }
    return res;
  }

  let json;
  try {
    json = await res.json();
  } catch {
    const err = new Error(`Server returned an unreadable response (HTTP ${res.status}).`);
    err.i18nKey = "brandWorkspaceApi.unreadableResponse";
    err.i18nParams = { status: res.status };
    throw err;
  }
  if (!res.ok || json.success === false) {
    const err = new Error(json.error || `Request failed (${res.status})`);
    if (!json.error) { err.i18nKey = "brandWorkspaceApi.requestFailed"; err.i18nParams = { status: res.status }; }
    throw err;
  }
  return json.data;
}
