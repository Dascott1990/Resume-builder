const KEY = "noviq_guest_id";

// A random id generated once per browser and kept in localStorage — not an
// account, not tied to any real identity, just enough for the backend to
// tell "your saved resumes" apart from everyone else's without a login.
// Sent as the X-Guest-Id header on every request (see shared/api.js);
// clearing localStorage clears it, same as everything else this app keeps.
export function getGuestId() {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id = window.crypto?.randomUUID?.() || `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}
