"use client";
import { useEffect, useState } from "react";

const KEY = "noviq_3d_intensity";

// A person's chosen level for the hero's 3D mark (0 = off, 1 = full) —
// persisted so it sticks across visits instead of resetting every load.
// Defaults to full: the effect is the whole point of the first impression,
// so it only recedes once someone deliberately says they'd rather not.
export function use3DIntensity() {
  const [intensity, setIntensityState] = useState(1);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw != null) {
        const n = parseFloat(raw);
        if (!Number.isNaN(n)) setIntensityState(Math.min(1, Math.max(0, n)));
      }
    } catch { /* best-effort */ }
    setHydrated(true);
  }, []);

  const setIntensity = (v) => {
    const clamped = Math.min(1, Math.max(0, v));
    setIntensityState(clamped);
    try { window.localStorage.setItem(KEY, String(clamped)); } catch { /* best-effort */ }
  };

  return { intensity, setIntensity, hydrated };
}
