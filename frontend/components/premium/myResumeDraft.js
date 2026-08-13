// ── "My Resumes" draft persistence ─────────────────────────────────────────
// Unlike Guest Mode AI (see guest/useGuestDraft.js), this editor never had
// any persistence at all — resumeData/style/activeResume/mode all reset to
// the default template on every mount, silently wiping out however much of
// a prebuilt resume someone had just edited the moment they refreshed.
// Same mirror-to-localStorage-on-change, read-once-on-mount shape as the
// guest draft; best-effort, since a full/blocked storage should mean "no
// restore," never a crash.
export const MY_RESUME_DRAFT_KEY = "resumeBuilder:myResumeDraft:v1";

export function loadMyResumeDraft() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MY_RESUME_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveMyResumeDraft(draft) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(MY_RESUME_DRAFT_KEY, JSON.stringify(draft)); } catch { /* best-effort */ }
}
