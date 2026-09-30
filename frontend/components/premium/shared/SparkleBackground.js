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
// read as flickering static, not ambiance. Cut to 2 points (was 16) per
// the "system color only, professionally subtle" redesign pass — this is
// a bare hint of atmosphere in the corner, not a starfield competing with
// real content for attention.
const STARS = [
  { x: 88, y: 6, size: 2, delay: 0, dur: 3.2 },
  { x: 8, y: 45, size: 2, delay: 1.4, dur: 3.6 },
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
