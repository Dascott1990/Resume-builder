// ── Draft persistence ────────────────────────────────────────────────────────
// Everything below was previously only in React state, so any refresh wiped
// the in-progress build — form fields, the generated resume, cover letter,
// interview tips, apply info, all of it. This mirrors the current draft to
// localStorage (best-effort; a full/blocked storage just means no restore,
// never a crash) and reads it back once on mount.
export const DRAFT_KEY = "resumeBuilder:draft:v1";

export function loadDraft() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* best-effort */ }
}

// ── Profile persistence ──────────────────────────────────────────────────────
// The draft above is per-build (it includes the job description, the
// generated resume, cover letter, etc.) and gets wiped every time someone
// starts a new application. Name/contact/background/education/skills are
// different — they don't change per job, so they live in their own key and
// survive "Build another", browser refreshes, and full sessions. This is
// what makes a second (or twentieth) resume a 20-second job instead of a
// re-typing exercise.
export const PROFILE_KEY = "resumeBuilder:profile:v1";

export function loadProfile() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveProfile(info) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(PROFILE_KEY, JSON.stringify(info)); } catch { /* best-effort */ }
}

export function clearProfile() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(PROFILE_KEY); } catch { /* best-effort */ }
}
