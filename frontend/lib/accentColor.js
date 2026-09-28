/**
 * accentColor.js — the app used to let users pick a brand accent color
 * that recolored --primary/--ring/--sidebar-primary app-wide (Settings'
 * old AccentColorPicker, lib/useAccentColor.js, and a blocking init
 * script in layout.js). Removed in favor of one neutral, non-overridable
 * theme (see globals.css's own comment on --primary) — a light/dark
 * choice no longer changes the app's accent, because there isn't one to
 * change anymore.
 *
 * ACCENT_COLORS survives here as plain data only, for app/brand/
 * SignatureTheme.js's unrelated use as a curated list of brand-safe
 * colors to suggest for social post templates — that's about content the
 * user creates, not the app's own theme, so it's untouched by any of the
 * above.
 */
export const ACCENT_COLORS = [
  { id: "amber", label: "Amber", primary: "#f59e0b", foreground: "#1c1206" },
  { id: "red", label: "Red", primary: "#ef4444", foreground: "#2c0a0a" },
  { id: "orange", label: "Orange", primary: "#f97316", foreground: "#2c1206" },
  { id: "green", label: "Green", primary: "#22c55e", foreground: "#062012" },
  { id: "blue", label: "Blue", primary: "#3b82f6", foreground: "#06122c" },
  { id: "purple", label: "Purple", primary: "#a855f7", foreground: "#1c0a2c" },
  { id: "pink", label: "Pink", primary: "#ec4899", foreground: "#2c0a1c" },
];
