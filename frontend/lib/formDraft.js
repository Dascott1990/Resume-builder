// ── Generic in-progress form persistence ───────────────────────────────────
// Same shape as guest/useGuestDraft.js and premium/myResumeDraft.js, pulled
// out generic since it's now needed by more than one plain multi-field form
// (the artisan listing form, the job tracker's add/edit form) that would
// otherwise just be copy-pasted per caller. Best-effort — a full/blocked
// storage means no restore, never a crash.
export function loadFormDraft(key) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveFormDraft(key, value) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* best-effort */ }
}

export function clearFormDraft(key) {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(key); } catch { /* best-effort */ }
}
