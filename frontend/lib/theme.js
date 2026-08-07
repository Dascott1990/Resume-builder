/**
 * theme.js — shared constants + the actual DOM-mutating logic for light/
 * dark mode. Kept framework-agnostic (no React) so the exact same code can
 * run both from the blocking <script> in layout.js (before hydration, to
 * avoid a flash of the wrong theme) and from useTheme.js afterward.
 */
export const THEME_KEY = "noviq_theme";

// Dark is the brand's actual default — not a neutral "respect the OS"
// choice. The whole visual identity (every screenshot, every design
// decision this app has gone through) was built against a dark, gold-on-
// black surface; light mode is the opt-in alternative for people who want
// it, not what a first-time visitor should be switched into just because
// their OS happens to be in light mode.
export const DEFAULT_THEME = "dark";

export function getStoredTheme() {
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  root.style.colorScheme = theme;
  // Keeps the mobile browser chrome (Android status bar, iOS Safari's
  // toolbar tint) in sync with the actual surface color instead of always
  // reading the dark value baked into layout.js's static metadata.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#0a0a0a" : "#fafaf9");
}

export function setStoredTheme(theme) {
  try { window.localStorage.setItem(THEME_KEY, theme); } catch { /* best-effort */ }
}

// The exact source run inline as a blocking <script> in layout.js's <head>
// — has to be a plain string (not imported and called), since it must
// execute before hydration and before this module's own JS bundle has
// necessarily loaded. Keep this in sync with getStoredTheme/applyTheme
// above by hand; it's intentionally a duplicate, not a shared function
// call, for that reason.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark")t="${DEFAULT_THEME}";var r=document.documentElement;if(t==="dark")r.classList.add("dark");else r.classList.remove("dark");r.style.colorScheme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="dark"?"#0a0a0a":"#fafaf9");}catch(e){}})();`;
