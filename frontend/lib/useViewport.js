"use client";
import { useState, useEffect } from "react";

// ── Responsive viewport hook — tracks real width, updates on resize/rotate ────
// Breakpoints match Tailwind's own sm (640px) / lg (1024px) scale, so this
// stays in sync with any `sm:`/`lg:` classes elsewhere rather than drifting
// from them. Originally lived inline in GuestMode.js; extracted here so
// Artisans.js can share the exact same phone/tablet/desktop definition
// instead of a second, possibly-diverging copy.
export function useViewport() {
  const [w, setW] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1280));
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);
  return {
    width: w,
    isPhone: w < 640,
    isTablet: w >= 640 && w < 1024,
    isDesktop: w >= 1024,
  };
}
