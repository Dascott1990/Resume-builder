"use client";
/**
 * useTheme.js — reactive access to the theme the blocking script in
 * layout.js already applied before this component tree even mounted.
 * Reads the DOM's own current state on mount (not localStorage directly)
 * so it can never disagree with what's actually rendered.
 *
 * Exposes both the resolved `theme` ("light"/"dark" — what's actually on
 * screen right now) and the `mode` ("light"/"dark"/"system" — what the
 * user picked, if anything). `setMode` is the real 3-way setter Settings'
 * picker uses; `toggleTheme` stays as a simple 2-state light/dark flip for
 * the compact header button, which has no room for a 3-way control and
 * has never needed one — picking "system" is a deliberate, Settings-only
 * choice.
 */
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_THEME, applyTheme, getStoredMode, resolveMode, setStoredMode } from "./theme";

export function useTheme() {
  const [theme, setThemeState] = useState(DEFAULT_THEME);
  const [mode, setModeState] = useState("system");

  useEffect(() => {
    setThemeState(document.documentElement.classList.contains("dark") ? "dark" : "light");
    setModeState(resolveMode());

    // Mode "system" (explicit or, same thing, nothing stored yet) means
    // this is following the OS (see theme.js's resolveEffectiveTheme,
    // already applied before this component ever mounted) — keep
    // following it live for as long as that stays true. Picking "light"
    // or "dark" stops this listener from mattering for the rest of the
    // session, same as any native app's own System vs. explicit setting.
    let mql;
    try {
      mql = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }
    const onChange = (e) => {
      if (getStoredMode() && getStoredMode() !== "system") return; // explicit light/dark choice — OS no longer drives this
      const next = e.matches ? "dark" : "light";
      applyTheme(next);
      setThemeState(next);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // The real 3-way setter — "light"/"dark" apply directly, "system"
  // resolves against the OS right away (not just recorded for next time).
  const setMode = useCallback((nextMode) => {
    setModeState(nextMode);
    setStoredMode(nextMode);
    const effective = nextMode === "system"
      ? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : nextMode;
    applyTheme(effective);
    setThemeState(effective);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      setStoredMode(next);
      setModeState(next);
      return next;
    });
  }, []);

  return { theme, mode, setMode, toggleTheme };
}
