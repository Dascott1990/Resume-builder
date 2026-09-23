"use client";
/**
 * useTheme.js — reactive access to the theme the blocking script in
 * layout.js already applied before this component tree even mounted.
 * Reads the DOM's own current state on mount (not localStorage directly)
 * so it can never disagree with what's actually rendered.
 */
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_THEME, applyTheme, getStoredTheme, setStoredTheme } from "./theme";

export function useTheme() {
  const [theme, setThemeState] = useState(DEFAULT_THEME);

  useEffect(() => {
    setThemeState(document.documentElement.classList.contains("dark") ? "dark" : "light");

    // No explicit choice stored means this is following the OS (see
    // theme.js's resolveTheme, already applied before this component ever
    // mounted) — keep following it live for as long as that stays true.
    // The moment someone uses the toggle, getStoredTheme stops returning
    // null and this listener becomes a no-op for the rest of the session.
    let mql;
    try {
      mql = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }
    const onChange = (e) => {
      if (getStoredTheme()) return; // explicit choice already made — OS no longer drives this
      const next = e.matches ? "dark" : "light";
      applyTheme(next);
      setThemeState(next);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    applyTheme(next);
    setStoredTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      setStoredTheme(next);
      return next;
    });
  }, []);

  return { theme, setTheme, toggleTheme };
}
