"use client";
/**
 * useAccentColor.js — reactive access to the accent color the blocking
 * <script> in layout.js already applied before this component tree even
 * mounted. Mirrors useTheme.js exactly, one level down (color instead of
 * light/dark).
 */
import { useCallback, useEffect, useState } from "react";
import { ACCENT_COLORS, DEFAULT_ACCENT, applyAccent, getStoredAccent, setStoredAccent } from "./accentColor";

export function useAccentColor() {
  const [accent, setAccentState] = useState(DEFAULT_ACCENT);

  useEffect(() => {
    setAccentState(getStoredAccent() || DEFAULT_ACCENT);
  }, []);

  const setAccent = useCallback((id) => {
    setAccentState(id);
    applyAccent(id);
    setStoredAccent(id);
  }, []);

  return { accent, setAccent, colors: ACCENT_COLORS };
}
