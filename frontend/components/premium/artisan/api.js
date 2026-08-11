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

export const artisanCompleteRequest = (id) => apiRequest(`/api/v1/requests/${id}/complete`, {
  method: "POST",
  headers: authHeaders(),
});
