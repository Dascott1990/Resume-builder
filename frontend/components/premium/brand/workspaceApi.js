"use client";
/**
 * workspaceApi.js — the one request helper every branding-workspace tool
 * uses, same shape as components/premium/shared/api.js's apiRequest but
 * attaching X-Workspace-Token instead of X-Guest-Id/Authorization — this
 * feature has no guest id, no login, only the token.
 */
export const WORKSPACE_TOKEN_HEADER = "X-Workspace-Token";

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
    throw err;
  }

  if (res.status === 204) return null;

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    // A binary response (an exported PNG/GIF/video) — the caller wants
    // the raw Response to read .blob()/.arrayBuffer() itself, not a
    // parsed body this helper would have to guess the shape of.
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res;
  }

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Server returned an unreadable response (HTTP ${res.status}).`);
  }
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json.data;
}
