"use client";
/**
 * useBrightness.js — reactive access to the screen brightness the blocking
 * <script> in layout.js already applied before this component tree even
 * mounted. Same shape as useTheme.js, one level down (a numeric 0-200
 * value instead of a light/dark/system mode).
 */
import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_BRIGHTNESS, MIN_BRIGHTNESS, MAX_BRIGHTNESS,
  applyBrightness, getStoredBrightness, setStoredBrightness,
} from "./brightness";

export function useBrightness() {
  const [brightness, setBrightnessState] = useState(DEFAULT_BRIGHTNESS);

  useEffect(() => {
    setBrightnessState(getStoredBrightness() ?? DEFAULT_BRIGHTNESS);
  }, []);

  const setBrightness = useCallback((value) => {
    setBrightnessState(value);
    applyBrightness(value);
    setStoredBrightness(value);
  }, []);

  return { brightness, setBrightness, min: MIN_BRIGHTNESS, max: MAX_BRIGHTNESS, default: DEFAULT_BRIGHTNESS };
}
