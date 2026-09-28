"use client";
import { useEffect } from "react";
import { applyTheme, resolveMode } from "@/lib/theme";

// Always mounted (see layout.js), unlike useTheme() itself — that hook
// only runs inside whatever screen happens to call it, so a route that
// never renders ThemeToggle (the marketing landing page, for one) had no
// listener at all and silently stopped following the OS the moment the
// user left a screen that did. This is the one place that's guaranteed
// mounted for the whole session, so "my phone flips to dark while the
// app's already open" actually works everywhere, not just on some screens.
//
// No-ops whenever the mode is an explicit "light"/"dark" (see theme.js's
// resolveMode/setStoredMode) — from then on the OS no longer drives this
// tab. Only "system" mode (explicit or, same thing, nothing stored yet)
// keeps this listener live.
export function ThemeSync() {
  useEffect(() => {
    let mql;
    try {
      mql = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }
    const onChange = (e) => {
      if (resolveMode() !== "system") return;
      applyTheme(e.matches ? "dark" : "light");
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return null;
}
