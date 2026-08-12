// Customer-side messaging calls — plain apiRequest, no artisan token (see
// artisan/api.js for the artisan-side equivalents, which attach
// X-Artisan-Token). Split the same way every other customer/artisan pair
// of API modules in this app already is.
import { apiRequest } from "../shared/api";

export const getThread = (jobId, sinceId = 0) =>
  apiRequest(`/api/v1/messages/threads/${jobId}?since_id=${sinceId}`);

export const postMessage = (jobId, body) => apiRequest(`/api/v1/messages/threads/${jobId}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ body }),
});

export const markThreadRead = (jobId) => apiRequest(`/api/v1/messages/threads/${jobId}/read`, { method: "POST" });

export const getUnreadCount = () => apiRequest("/api/v1/messages/unread-count");
