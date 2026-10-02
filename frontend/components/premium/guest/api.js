import { apiRequest } from "../shared/api";

export const apiGenerate = (userInfo, jobDesc) => apiRequest("/api/v1/resume/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ user_info: userInfo, job_description: jobDesc }),
});

export const apiOptimize = (userInfo, jobDesc) => apiRequest("/api/v1/resume/optimize", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ user_info: userInfo, job_description: jobDesc }),
});

// Real enforcement point for the guest 3-download cap (see backend/app/
// models.py's GuestDownloadCount) — call before actually building a file,
// not after. A signed-in caller always resolves {count: 0, capped: false}
// as a no-op; a guest already at 3 throws with err.code ===
// "DOWNLOAD_CAP_REACHED" (see shared/api.js's apiRequest), which the
// caller is expected to catch and show the sign-up gate for instead of
// letting the error bubble up as a generic failure toast.
export const apiConsumeDownload = () => apiRequest("/api/v1/resume/downloads/consume", { method: "POST" });
export const apiGetDownloadCount = () => apiRequest("/api/v1/resume/downloads/count").catch(() => ({ count: 0, capped: false }));

export const apiListSaved = () => apiRequest("/api/v1/resume/saved").catch(() => []);
export const apiGetSaved  = (id) => apiRequest(`/api/v1/resume/${id}`);
export const apiDelete    = (id) => apiRequest(`/api/v1/resume/${id}`, { method: "DELETE" }).catch(() => null);
