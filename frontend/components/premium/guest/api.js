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

export const apiListSaved = () => apiRequest("/api/v1/resume/saved").catch(() => []);
export const apiGetSaved  = (id) => apiRequest(`/api/v1/resume/${id}`);
export const apiDelete    = (id) => apiRequest(`/api/v1/resume/${id}`, { method: "DELETE" }).catch(() => null);
