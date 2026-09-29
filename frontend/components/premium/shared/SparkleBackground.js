"use client";
// SparkleBackground.js — a quiet field of twinkling points of light behind
// Dashboard's own content. Deliberately not a particle library or canvas:
// a fixed, small set of positioned dots with a staggered CSS opacity/scale
// animation is cheap enough to just always render, and easy to reason
// about (same "why not WebGL for something this simple" call the landing
// page's own DotNetworkBackground.js already made).
//
// Color comes from Tailwind's amber-400/emerald-300 utilities with a
// dark: pair, not a hardcoded hex or --primary — --primary is the site's
// deliberately monochrome accent (see globals.css), which would render as
// near-black dots in light mode, the opposite of "sparkling." Amber/
// emerald is the same pair Hero.js and the landing page's SectionGlow
// already use for their own ambient decoration, so this stays the same
// two-color vocabulary rather than inventing a third.
//
// pointer-events-none + a low z-index (rendered first, behind real
// content) throughout — this is atmosphere, never something a tap should
// land on.
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

// Fixed, not random per-render — a re-render (theme toggle, a state
// update elsewhere on the screen) reshuffling every star's position would
// read as flickering static, not ambiance. Spread loosely across the
// whole viewport, sizes/delays/durations varied by hand so the twinkle
// reads as organic rather than a uniform blinking grid.
const STARS = [
  { x: 8, y: 12, size: 3, delay: 0, dur: 3.2 },
  { x: 22, y: 6, size: 2, delay: 0.6, dur: 2.6 },
  { x: 38, y: 16, size: 2.5, delay: 1.4, dur: 3.6 },
  { x: 52, y: 4, size: 2, delay: 0.3, dur: 2.9 },
  { x: 68, y: 10, size: 3, delay: 1.9, dur: 3.1 },
  { x: 82, y: 5, size: 2, delay: 0.9, dur: 2.4 },
  { x: 92, y: 15, size: 2.5, delay: 2.2, dur: 3.4 },
  { x: 14, y: 28, size: 2, delay: 1.1, dur: 2.7 },
  { x: 46, y: 24, size: 2, delay: 0.2, dur: 3.0 },
  { x: 76, y: 26, size: 2.5, delay: 1.6, dur: 2.5 },
  { x: 6, y: 45, size: 2, delay: 0.7, dur: 3.3 },
  { x: 30, y: 40, size: 2.5, delay: 2.0, dur: 2.8 },
  { x: 60, y: 38, size: 2, delay: 1.3, dur: 3.5 },
  { x: 88, y: 42, size: 3, delay: 0.5, dur: 2.6 },
  { x: 18, y: 62, size: 2, delay: 1.8, dur: 3.0 },
  { x: 55, y: 58, size: 2.5, delay: 0.4, dur: 2.9 },
];

export function SparkleBackground({ className }) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    // fixed, not absolute — this sits inside Dashboard's own scrolling
    // content area, and an absolutely-positioned layer in there would
    // stretch to the full scrollable height and scroll away with it
    // instead of staying put as an ambient backdrop behind the viewport.
    <div aria-hidden="true" className={`pointer-events-none fixed inset-0 overflow-hidden ${className || ""}`}>
      <style>{`
        @keyframes sparkle-twinkle {
          0%, 100% { opacity: 0.12; transform: scale(0.7); }
          50% { opacity: 0.85; transform: scale(1.25); }
        }
      `}</style>
      {STARS.map((s, i) => (
        <span
          key={i}
          // text-* too, not just bg-* — the glow below reads currentColor,
          // which only tracks the `color` property, never background.
          // Without this the box-shadow was inheriting whatever text color
          // happened to be ambient instead of actually matching the dot.
          className="absolute rounded-full bg-amber-400 text-amber-400 dark:bg-emerald-300 dark:text-emerald-300"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            boxShadow: "0 0 6px 1px currentColor",
            animation: reducedMotion ? "none" : `sparkle-twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
            opacity: reducedMotion ? 0.35 : undefined,
          }}
        />
      ))}
    </div>
  );
}
