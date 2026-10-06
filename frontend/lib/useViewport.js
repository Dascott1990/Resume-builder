"use client";
import { useState, useEffect } from "react";

// ── Responsive viewport hook — tracks real width, updates on resize/rotate ────
// Breakpoints match Tailwind's own sm (640px) / lg (1024px) scale, so this
// stays in sync with any `sm:`/`lg:` classes elsewhere rather than drifting
// from them. Originally lived inline in GuestMode.js; extracted here so
// every screen that needs a phone/tablet/desktop split can share the
// exact same definition instead of a second, possibly-diverging copy.
// `mounted` starts false on BOTH the server render and the client's first
// render — real window.innerWidth is only ever read inside the effect
// below, never during render itself. That used to not be true: reading
// window.innerWidth straight into the initial useState meant the
// server's "no window" render and the client's first render (which does
// have one) disagreed the instant a visitor wasn't on a desktop-width
// screen, and consumers like Dashboard.js pick between two structurally
// different component trees based on isDesktop — a real hydration
// mismatch, not a cosmetic flicker. Defaulting every size flag to the
// mobile-shaped answer pre-mount (not just width:0) means server HTML
// and the client's first paint render the identical tree; the effect
// then corrects to the real width on the same tick for anyone who isn't
// actually on mobile, same `mounted`-gate pattern already used in
// app/page.js and CorporateSkyline.js.
export function useViewport() {
  const [state, setState] = useState({ width: 0, mounted: false });
  useEffect(() => {
    const measure = () => setState({ width: window.innerWidth, mounted: true });
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);
  const { width: w, mounted } = state;
  return {
    mounted,
    width: w,
    isPhone: !mounted || w < 640,
    isTablet: mounted && w >= 640 && w < 1024,
    isDesktop: mounted && w >= 1024,
  };
}
