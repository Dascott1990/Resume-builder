import { apiRequest } from "../shared/api";
import { getArtisanToken } from "@/lib/artisanAuthToken";

// Every artisan-scoped call needs X-Artisan-Token — apiRequest itself only
// ever attaches X-Guest-Id/Authorization (the customer-side scoping), so
// this header is added explicitly on each call here rather than baked into
// the shared helper (see lib/artisanAuthToken.js for why it's a separate
// header from the customer session's Authorization: Bearer).
const authHeaders = () => ({ "X-Artisan-Token": getArtisanToken() || "" });

export const artisanSignup = (body) => apiRequest("/api/v1/artisans/signup", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const artisanLogin = (email, password) => apiRequest("/api/v1/artisans/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});

export const artisanMe = () => apiRequest("/api/v1/artisans/me", { headers: authHeaders() });

export const artisanSetAvailability = (is_available) => apiRequest("/api/v1/artisans/me/availability", {
  method: "PATCH",
  headers: { "Content-Type": "application/json", ...authHeaders() },
  body: JSON.stringify({ is_available }),
});

export const artisanPool = () => apiRequest("/api/v1/requests/pool", { headers: authHeaders() });

export const artisanAccepted = () => apiRequest("/api/v1/requests/accepted", { headers: authHeaders() });

export const artisanAcceptRequest = (id) => apiRequest(`/api/v1/requests/${id}/accept`, {
  method: "POST",
  headers: authHeaders(),
});

export const artisanDeclineRequest = (id) => apiRequest(`/api/v1/requests/${id}/decline`, {
  method: "POST",
  headers: authHeaders(),
});

export const artisanCompleteRequest = (id) => apiRequest(`/api/v1/requests/${id}/complete`, {
  method: "POST",
  headers: authHeaders(),
});

export const artisanProposeTime = (id, scheduledAt) => apiRequest(`/api/v1/requests/${id}/propose-time`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...authHeaders() },
  body: JSON.stringify({ scheduled_at: scheduledAt }),
});

export const artisanConfirmTime = (id) => apiRequest(`/api/v1/requests/${id}/confirm-time`, {
  method: "POST",
  headers: authHeaders(),
});

export const artisanGetThread = (jobId, sinceId = 0) =>
  apiRequest(`/api/v1/messages/threads/${jobId}?since_id=${sinceId}`, { headers: authHeaders() });

export const artisanPostMessage = (jobId, body) => apiRequest(`/api/v1/messages/threads/${jobId}`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...authHeaders() },
  body: JSON.stringify({ body }),
});

export const artisanMarkThreadRead = (jobId) => apiRequest(`/api/v1/messages/threads/${jobId}/read`, {
  method: "POST",
  headers: authHeaders(),
});

export const artisanUnreadCount = () => apiRequest("/api/v1/messages/unread-count", { headers: authHeaders() });

// Edits the signed-in artisan's own listing directly via their session —
// the fix for the old edit_token-only gap (see Settings.js).
export const artisanUpdateProfile = (fields) => apiRequest("/api/v1/artisans/me", {
  method: "PATCH",
  headers: { "Content-Type": "application/json", ...authHeaders() },
  body: JSON.stringify(fields),
});

export const artisanChangePassword = (currentPassword, newPassword) => apiRequest("/api/v1/artisans/me/change-password", {
  method: "POST",
  headers: { "Content-Type": "application/json", ...authHeaders() },
  body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
});

// Public route (same one ArtisanProfile.js uses for a customer's view of
// this artisan) — no X-Artisan-Token needed, just the artisan's own id.
export const artisanReviews = (artisanId, limit = 3) =>
  apiRequest(`/api/v1/artisans/${artisanId}/reviews?limit=${limit}`);
