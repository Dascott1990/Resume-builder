/**
 * theme.js — shared constants + the actual DOM-mutating logic for light/
 * dark/system mode. Kept framework-agnostic (no React) so the exact same
 * code can run both from the blocking <script> in layout.js (before
 * hydration, to avoid a flash of the wrong theme) and from useTheme.js
 * afterward.
 *
 * Three MODES a user can pick: "light", "dark", "system" — stored as-is,
 * "system" included explicitly (not just "nothing stored") so Settings can
 * show a real, always-reselectable third option instead of system only
 * ever being the implicit state before a first toggle. Whatever the mode
 * resolves to is the EFFECTIVE theme ("light"/"dark") actually applied to
 * the DOM — see resolveEffectiveTheme.
 */
export const THEME_KEY = "noqeev_theme";

// Fallback only for an environment where matchMedia itself is unavailable
// (see systemPrefersDark below).
export const DEFAULT_THEME = "dark";

export function getStoredMode() {
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : null;
  } catch {
    return null;
  }
}

// No explicit choice ever made (a fresh browser, or a stale value from
// before "system" existed as a real option) is treated exactly like
// "system" — same default this app has always had, just now nameable.
export function resolveMode() {
  return getStoredMode() || "system";
}

export function systemPrefersDark() {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return true; // DEFAULT_THEME's fallback
  }
}

// The MODE resolves to "light" or "dark" here — that resolved value is
// what actually gets applied to the DOM.
export function resolveEffectiveTheme() {
  const mode = resolveMode();
  if (mode === "light" || mode === "dark") return mode;
  return systemPrefersDark() ? "dark" : "light";
}

export function applyTheme(effectiveTheme) {
  const root = document.documentElement;
  if (effectiveTheme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  root.style.colorScheme = effectiveTheme;
  // Keeps the mobile browser chrome (Android status bar, iOS Safari's
  // toolbar tint) in sync with the actual surface color instead of always
  // reading the dark value baked into layout.js's static metadata.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", effectiveTheme === "dark" ? "#0a0a0a" : "#fafaf9");
}

export function setStoredMode(mode) {
  try { window.localStorage.setItem(THEME_KEY, mode); } catch { /* best-effort */ }
}

// The exact source run inline as a blocking <script> in layout.js's <head>
// — has to be a plain string (not imported and called), since it must
// execute before hydration and before this module's own JS bundle has
// necessarily loaded. Keep this in sync with the functions above by hand;
// it's intentionally a duplicate, not a shared function call, for that
// reason.
export const THEME_INIT_SCRIPT = `(function(){try{var m=localStorage.getItem("${THEME_KEY}");if(m!=="light"&&m!=="dark"&&m!=="system")m="system";var t=m==="system"?((window.matchMedia?window.matchMedia("(prefers-color-scheme: dark)").matches:true)?"dark":"light"):m;var r=document.documentElement;if(t==="dark")r.classList.add("dark");else r.classList.remove("dark");r.style.colorScheme=t;var me=document.querySelector('meta[name="theme-color"]');if(me)me.setAttribute("content",t==="dark"?"#0a0a0a":"#fafaf9");}catch(e){}})();`;
