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

// Richer version of the above — the full (layout, accent, font) triple a
// person picked from the Templates gallery's combinatorial grid, not just
// the layout. Kept as a genuinely separate key rather than reshaping the
// old one, so a browser that already has a plain noqeev_preferred_template
// string from before this existed keeps working unchanged (see
// getEffectiveStyle below) — nothing silently breaks for a returning
// visitor who never opens the new gallery.
const STYLE_KEY = "noqeev_preferred_style";

export function getPreferredStyle() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STYLE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch { return null; }
}

export function setPreferredStyle({ layout, accent, font }) {
  try {
    localStorage.setItem(STYLE_KEY, JSON.stringify({ layout, accent, font }));
    // Keep the old key in sync too — anything still reading only
    // getPreferredTemplate() (pre-gallery code paths) still sees the
    // right layout.
    localStorage.setItem(KEY, layout);
  } catch { /* best-effort */ }
}

// The new, richer preference wins when present; a plain pre-existing
// layout-only preference (or none at all) falls back to DEFAULT_STYLE's
// own accent/font with just the layout overridden — same effective
// behavior GuestMode.js already had before this file grew a second key.
export function getEffectiveStyle(defaultStyle) {
  const rich = getPreferredStyle();
  if (rich) return { ...defaultStyle, ...rich };
  const layout = getPreferredTemplate();
  return layout ? { ...defaultStyle, layout } : defaultStyle;
}

// Per-device only, same spirit as the layout/style preferences above —
// never sent to the backend, never tied to an account. null means "use
// whatever region was auto-detected," a real region id means the visitor
// explicitly chose a different one than detection landed on.
const REGION_KEY = "noqeev_region_override";

export function getRegionOverride() {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(REGION_KEY); } catch { return null; }
}

export function setRegionOverride(regionId) {
  try {
    if (regionId) localStorage.setItem(REGION_KEY, regionId);
    else localStorage.removeItem(REGION_KEY);
  } catch { /* best-effort */ }
}
