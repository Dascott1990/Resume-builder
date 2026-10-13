"use client";
import { useEffect, useState } from "react";
import { getPeriod } from "@/components/premium/landing/CorporateSkyline";

const KEY = "noqeev_skyline_lights";

// Whether the hero skyline's windows are lit — starts truthful to the
// viewer's own real local time (lit at night, dark in daytime, same
// automatic read CorporateSkyline has always used on its own), then a
// flip of the street-light switch overrides it and sticks across visits,
// same as a real light switch: it doesn't silently revert back to
// automatic the next time the clock crosses into night.
export function useSkylineLights() {
  const [on, setOnState] = useState(() => getPeriod() === "night");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw != null) setOnState(raw === "1");
    } catch { /* best-effort */ }
  }, []);

  const setOn = (v) => {
    setOnState(v);
    try { window.localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* best-effort */ }
  };

  return { on, setOn };
}
