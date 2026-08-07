"use client";
/**
 * useTheme.js — reactive access to the theme the blocking script in
 * layout.js already applied before this component tree even mounted.
 * Reads the DOM's own current state on mount (not localStorage directly)
 * so it can never disagree with what's actually rendered.
 */
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_THEME, applyTheme, setStoredTheme } from "./theme";

export function useTheme() {
  const [theme, setThemeState] = useState(DEFAULT_THEME);

  useEffect(() => {
    setThemeState(document.documentElement.classList.contains("dark") ? "dark" : "light");
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
