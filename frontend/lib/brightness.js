/**
 * brightness.js — shared constants + the actual DOM-mutating logic for an
 * in-app screen brightness control. Same framework-agnostic split as
 * theme.js/accentColor.js (no React), so the exact same code runs both from
 * the blocking <script> in layout.js (before hydration, to avoid a flash of
 * neutral brightness) and from useBrightness.js afterward.
 *
 * A page can't actually drive the display's hardware backlight — this
 * simulates the effect with two full-screen overlays instead of a CSS
 * filter on a content wrapper, specifically to avoid a real trap: `filter`
 * creates a new containing block for `position: fixed` descendants, which
 * would silently break every fixed-position surface in the app (BottomNav,
 * OfflineBanner, full-screen panels) the moment it's applied above them in
 * the tree. Two always-mounted, pointer-events:none siblings in layout.js
 * sidestep that entirely — same reasoning as OfflineBanner's own placement.
 *
 * Device-local only, same as light/dark mode and the accent color — a
 * display preference, not account data, and available to signed-out
 * guests without a backend field for it.
 */
export const BRIGHTNESS_KEY = "noviq_brightness";
export const DEFAULT_BRIGHTNESS = 100; // 0-200, 100 = neutral (no overlay at all)
export const MIN_BRIGHTNESS = 0;
export const MAX_BRIGHTNESS = 200;

// Deliberately short of the extremes: 0 still leaves the screen faintly
// legible (a black overlay one couldn't back out of would be a real trap,
// not a dim mode) and a 0.4 max on the white/screen-blend side is already a
// strong wash-out — higher starts to erase contrast rather than brighten it.
const MAX_DIM_OPACITY = 0.65;
const MAX_BOOST_OPACITY = 0.4;

export function clampBrightness(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_BRIGHTNESS;
  return Math.min(MAX_BRIGHTNESS, Math.max(MIN_BRIGHTNESS, n));
}

export function opacitiesFor(value) {
  const v = clampBrightness(value);
  if (v < 100) return { dim: ((100 - v) / 100) * MAX_DIM_OPACITY, boost: 0 };
  if (v > 100) return { dim: 0, boost: ((v - 100) / 100) * MAX_BOOST_OPACITY };
  return { dim: 0, boost: 0 };
}

export function getStoredBrightness() {
  try {
    const v = window.localStorage.getItem(BRIGHTNESS_KEY);
    return v == null ? null : clampBrightness(v);
  } catch {
    return null;
  }
}

export function applyBrightness(value) {
  const { dim, boost } = opacitiesFor(value);
  const root = document.documentElement;
  root.style.setProperty("--brightness-dim-opacity", String(dim));
  root.style.setProperty("--brightness-boost-opacity", String(boost));
}

export function setStoredBrightness(value) {
  try { window.localStorage.setItem(BRIGHTNESS_KEY, String(clampBrightness(value))); } catch { /* best-effort */ }
}

// Plain string, run as a blocking <script> in layout.js's <head> — has to
// execute before hydration, so this is intentionally a hand-kept duplicate
// of the logic above, not a shared function call (same reasoning as
// theme.js's THEME_INIT_SCRIPT / accentColor.js's ACCENT_INIT_SCRIPT).
export const BRIGHTNESS_INIT_SCRIPT = `(function(){try{
var v=parseFloat(localStorage.getItem("${BRIGHTNESS_KEY}"));
if(!isFinite(v))v=${DEFAULT_BRIGHTNESS};
v=Math.min(${MAX_BRIGHTNESS},Math.max(${MIN_BRIGHTNESS},v));
var dim=0,boost=0;
if(v<100){dim=((100-v)/100)*${MAX_DIM_OPACITY};}
else if(v>100){boost=((v-100)/100)*${MAX_BOOST_OPACITY};}
var r=document.documentElement;
r.style.setProperty("--brightness-dim-opacity",String(dim));
r.style.setProperty("--brightness-boost-opacity",String(boost));
}catch(e){}})();`;
