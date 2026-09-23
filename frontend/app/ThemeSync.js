"use client";
import { useEffect } from "react";
import { applyTheme, getStoredTheme } from "@/lib/theme";

// Always mounted (see layout.js), unlike useTheme() itself — that hook
// only runs inside whatever screen happens to call it, so a route that
// never renders ThemeToggle (the marketing landing page, for one) had no
// listener at all and silently stopped following the OS the moment the
// user left a screen that did. This is the one place that's guaranteed
// mounted for the whole session, so "my phone flips to dark while the
// app's already open" actually works everywhere, not just on some screens.
//
// No-ops the instant an explicit choice exists (see theme.js's
// resolveTheme/setStoredTheme) — from then on the OS no longer drives
// this tab, same as any native app's "System" vs. "Light"/"Dark" setting.
export function ThemeSync() {
  useEffect(() => {
    let mql;
    try {
      mql = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }
    const onChange = (e) => {
      if (getStoredTheme()) return;
      applyTheme(e.matches ? "dark" : "light");
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return null;
}
