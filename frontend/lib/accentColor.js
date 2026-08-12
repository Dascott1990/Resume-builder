/**
 * accentColor.js — shared constants + the actual DOM-mutating logic for
 * the app's brand accent color. Same framework-agnostic split as theme.js
 * (no React), so the exact same code runs both from the blocking <script>
 * in layout.js (before hydration, to avoid a flash of the wrong color)
 * and from useAccentColor.js afterward.
 *
 * Device-local only, deliberately — same as light/dark mode, not synced
 * to the account. Everyone (including signed-out guests) can pick a
 * color without needing to be signed in, and it doesn't require a
 * backend field for something that's purely a display preference.
 *
 * globals.css hardcodes the same amber hex across six custom properties
 * (--primary, --ring, --sidebar-primary, --sidebar-ring, plus the two
 * -foreground pairs) — setting all six as inline styles on <html>
 * overrides the stylesheet in both light and dark mode at once, since
 * both themes already use the identical amber value there.
 */
export const ACCENT_KEY = "noviq_accent_color";

export const ACCENT_COLORS = [
  { id: "amber", label: "Amber", primary: "#f59e0b", foreground: "#1c1206" },
  { id: "red", label: "Red", primary: "#ef4444", foreground: "#2c0a0a" },
  { id: "orange", label: "Orange", primary: "#f97316", foreground: "#2c1206" },
  { id: "green", label: "Green", primary: "#22c55e", foreground: "#062012" },
  { id: "blue", label: "Blue", primary: "#3b82f6", foreground: "#06122c" },
  { id: "purple", label: "Purple", primary: "#a855f7", foreground: "#1c0a2c" },
  { id: "pink", label: "Pink", primary: "#ec4899", foreground: "#2c0a1c" },
];

export const DEFAULT_ACCENT = "amber";

const PRIMARY_VARS = ["--primary", "--ring", "--sidebar-primary", "--sidebar-ring"];
const FOREGROUND_VARS = ["--primary-foreground", "--sidebar-primary-foreground"];

export function getStoredAccent() {
  try {
    const v = window.localStorage.getItem(ACCENT_KEY);
    return ACCENT_COLORS.some((c) => c.id === v) ? v : null;
  } catch {
    return null;
  }
}

export function applyAccent(id) {
  const color = ACCENT_COLORS.find((c) => c.id === id) || ACCENT_COLORS.find((c) => c.id === DEFAULT_ACCENT);
  const root = document.documentElement;
  PRIMARY_VARS.forEach((v) => root.style.setProperty(v, color.primary));
  FOREGROUND_VARS.forEach((v) => root.style.setProperty(v, color.foreground));
}

export function setStoredAccent(id) {
  try { window.localStorage.setItem(ACCENT_KEY, id); } catch { /* best-effort */ }
}

// Plain string, run as a blocking <script> in layout.js's <head> — has to
// execute before hydration, so this is intentionally a hand-kept
// duplicate of the logic above, not a shared function call (same reasoning
// as theme.js's THEME_INIT_SCRIPT).
export const ACCENT_INIT_SCRIPT = `(function(){try{
var colors=${JSON.stringify(ACCENT_COLORS)};
var id=localStorage.getItem("${ACCENT_KEY}");
var c=null;
for(var i=0;i<colors.length;i++){if(colors[i].id===id){c=colors[i];break;}}
if(!c){for(var j=0;j<colors.length;j++){if(colors[j].id==="${DEFAULT_ACCENT}"){c=colors[j];break;}}}
if(!c)return;
var r=document.documentElement;
["--primary","--ring","--sidebar-primary","--sidebar-ring"].forEach(function(v){r.style.setProperty(v,c.primary);});
["--primary-foreground","--sidebar-primary-foreground"].forEach(function(v){r.style.setProperty(v,c.foreground);});
}catch(e){}})();`;
