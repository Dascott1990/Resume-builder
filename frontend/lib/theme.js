/**
 * theme.js — shared constants + the actual DOM-mutating logic for light/
 * dark mode. Kept framework-agnostic (no React) so the exact same code can
 * run both from the blocking <script> in layout.js (before hydration, to
 * avoid a flash of the wrong theme) and from useTheme.js afterward.
 */
export const THEME_KEY = "noqeev_theme";

// Fallback only for an environment where matchMedia itself is unavailable
// (see systemPrefersDark below) — every real browser follows the OS
// instead, live, until someone explicitly taps the theme toggle. That tap
// is what setStoredTheme records; from then on their choice wins over the
// OS, same as any native app's own "System" vs. "Light"/"Dark" setting.
export const DEFAULT_THEME = "dark";

export function getStoredTheme() {
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

export function systemPrefersDark() {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return true; // DEFAULT_THEME's fallback
  }
}

export function resolveTheme() {
  const stored = getStoredTheme();
  if (stored) return stored;
  return systemPrefersDark() ? "dark" : "light";
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
// necessarily loaded. Keep this in sync with getStoredTheme/applyTheme/
// resolveTheme above by hand; it's intentionally a duplicate, not a
// shared function call, for that reason.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark")t=(window.matchMedia?window.matchMedia("(prefers-color-scheme: dark)").matches:true)?"dark":"light";var r=document.documentElement;if(t==="dark")r.classList.add("dark");else r.classList.remove("dark");r.style.colorScheme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="dark"?"#0a0a0a":"#fafaf9");}catch(e){}})();`;
