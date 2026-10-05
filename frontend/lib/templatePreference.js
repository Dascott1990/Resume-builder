// templatePreference.js — which resume layout (see shared/resumeLayouts/
// registry.js's LAYOUTS) a person has explicitly picked, kept client-side
// since it's a per-device convenience, not account data worth a backend
// column. Once set, it wins over DEFAULT_STYLE's own "classic" default
// the next time GuestMode starts a fresh resume.
const KEY = "noqeev_preferred_template";

export function getPreferredTemplate() {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function setPreferredTemplate(layoutId) {
  try { localStorage.setItem(KEY, layoutId); } catch { /* best-effort */ }
}
