"use client";
/**
 * CorporateSkyline.js — the Hero's showcase panel: a real isometric 3D
 * cluster of corporate office towers, not flat rectangles standing in for
 * buildings. Each tower is a genuine CSS 3D box (three real faces —
 * front curtain wall, side curtain wall, rooftop — built with
 * `transform-style: preserve-3d`), not an SVG illustration or a WebGL
 * scene — this stays as cheap to render as everything else on this page
 * while still reading as a volumetric building, not a sticker.
 *
 * Colored by the viewer's own real local time of day, not a light/dark
 * theme toggle — night gets a moonish amber glow in the windows, morning
 * a soft warm sunrise tint, afternoon bright white/paper-toned glass (the
 * one deliberate nod to "this is also a resume," not just a building:
 * afternoon's glass tone leans toward the app's own paper-cream rather
 * than a cold corporate gray). Computed client-side only (see getPeriod
 * below) — the server has no idea what timezone the visitor is in, so
 * this starts at a fixed, deliberately neutral default and corrects
 * itself the instant it mounts, the same safe pattern app/page.js's own
 * `mounted` gate already uses for exactly this class of problem.
 *
 * Window grids are `repeating-linear-gradient` layers (crisp mullions +
 * glass segments at any size, zero extra DOM nodes), with a handful of
 * real absolutely-positioned spans laid on top for the lit-window glow —
 * hand-placed in realistic floor clusters, not scattered randomly, so it
 * reads as "some floors are still working late," not static.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

// Each tower: footprint (w × d), height (h), a short rooftop setback tier,
// and which floor-bands glow at night — hand-placed per tower so the
// cluster reads as a real occupied building, not a uniform grid of dots.
// Floor bands are fractions of the tower's own height (0 = base, 1 = roof).
const TOWERS = [
  { w: 46, d: 26, h: 108, tier: { w: 26, d: 16, h: 16 }, glow: [[0.18, 0.3], [0.2, 0.62], [0.55, 0.42]] },
  { w: 56, d: 30, h: 176, tier: { w: 30, d: 18, h: 22 }, glow: [[0.1, 0.22], [0.14, 0.5], [0.2, 0.78], [0.48, 0.3], [0.52, 0.64], [0.8, 0.46]] },
  { w: 40, d: 22, h: 86, tier: { w: 22, d: 14, h: 12 }, glow: [[0.25, 0.35], [0.6, 0.55]] },
  { w: 60, d: 34, h: 214, tier: { w: 32, d: 20, h: 26 }, glow: [[0.08, 0.26], [0.12, 0.5], [0.16, 0.74], [0.42, 0.34], [0.46, 0.6], [0.46, 0.84], [0.74, 0.4], [0.78, 0.7]] },
  { w: 48, d: 26, h: 134, tier: { w: 26, d: 16, h: 18 }, glow: [[0.16, 0.28], [0.5, 0.46], [0.54, 0.74]] },
];
// Isometric-ish tilt shared by every tower (and its rooftop tier) so the
// whole row reads as one consistent camera angle, not five independent
// objects. True isometric is an orthographic 30°; CSS perspective is
// always a real perspective projection, so these angles are tuned to
// approximate it closely at this object size rather than being
// mathematically exact — the visual target, not a geometry proof.
const ROT = "rotateX(-14deg) rotateY(-30deg)";

function getPeriod(date = new Date()) {
  const h = date.getHours();
  if (h >= 19 || h < 6) return "night";
  if (h < 12) return "morning";
  return "afternoon";
}

// One real palette per time of day — every color a tower actually uses
// lives here, nothing hardcoded further down, so "what morning looks
// like" is one place to read or change.
const PALETTES = {
  night: {
    frontA: "#0c2230", frontB: "#142e3d",
    sideA: "#060f16", sideB: "#0a1a22",
    mullion: "rgba(210,225,235,0.22)",
    roof: "#0a1a22", roofEdge: "rgba(255,201,77,0.35)",
    lobby: "#1a1f24", lobbyEdge: "rgba(255,201,77,0.5)",
    cornerA: "rgba(255,255,255,0.35)", cornerB: "rgba(255,255,255,0.05)",
    glowColor: "#FFC94D", // moonish warm yellow, not a hard office amber
    glowShadow: "rgba(255,201,77,0.85)",
    reflection: null,
  },
  morning: {
    frontA: "#f3d9b0", frontB: "#ffeccb",
    sideA: "#d8b787", sideB: "#e9cda3",
    mullion: "rgba(120,80,40,0.22)",
    roof: "#e3c08f", roofEdge: "rgba(255,255,255,0.7)",
    lobby: "#c89b63", lobbyEdge: "rgba(255,255,255,0.55)",
    cornerA: "rgba(255,255,255,0.9)", cornerB: "rgba(255,255,255,0.3)",
    glowColor: null,
    reflection: "linear-gradient(115deg, transparent 25%, rgba(255,214,160,0.65) 45%, rgba(255,196,130,0.22) 55%, transparent 75%)",
  },
  afternoon: {
    // Deliberately paper-cream, not cold gray — the one place this reads
    // as "a resume" as much as "a building."
    frontA: "#e7e2d4", frontB: "#f7f4ea",
    sideA: "#b9c2c8", sideB: "#ccd4d8",
    mullion: "rgba(20,30,38,0.26)",
    roof: "#c7cdd1", roofEdge: "rgba(255,255,255,0.8)",
    lobby: "#4a5560", lobbyEdge: "rgba(255,255,255,0.55)",
    cornerA: "rgba(255,255,255,0.9)", cornerB: "rgba(255,255,255,0.3)",
    glowColor: null,
    reflection: "linear-gradient(115deg, transparent 28%, rgba(255,255,255,0.6) 46%, rgba(255,255,255,0.2) 53%, transparent 72%)",
  },
};

function WindowGrid({ w, h, palette, variant }) {
  // variant "front" is lit straight-on; "side" is the shadowed face —
  // same grid, just darker, same way a real building's side elevation
  // reads darker than the sun-facing wall (each palette already carries
  // its own separate front/side A-B pair below, not a derived shade).
  const glassA = variant === "front" ? palette.frontA : palette.sideA;
  const glassB = variant === "front" ? palette.frontB : palette.sideB;

  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: [
          `repeating-linear-gradient(90deg, ${palette.mullion} 0 1.5px, transparent 1.5px ${Math.max(w / 5, 8)}px)`,
          `repeating-linear-gradient(0deg, ${palette.mullion} 0 1.5px, transparent 1.5px ${Math.max(h / Math.round(h / 14), 10)}px)`,
          `linear-gradient(155deg, ${glassA}, ${glassB})`,
        ].join(","),
      }}
    >
      {/* Morning/afternoon only: a diagonal reflection sweeping across the
          glass from a top-left light source — real reflective glass, not
          a flat tint. Color shifts warm at sunrise, white/silver by
          afternoon (see PALETTES above). */}
      {palette.reflection && <div className="absolute inset-0" style={{ background: palette.reflection }} />}
    </div>
  );
}

function GlowWindows({ glow, w, h, palette }) {
  if (!palette.glowColor) return null;
  return (
    <>
      {glow.map(([top, left], i) => (
        <span
          key={i}
          className="absolute rounded-[1px]"
          style={{
            top: `${top * 100}%`, left: `${left * 100}%`,
            width: Math.max(w * 0.1, 3), height: Math.max(h * 0.022, 3),
            background: palette.glowColor,
            boxShadow: `0 0 5px 1.5px ${palette.glowShadow}, 0 0 1px ${palette.glowColor}`,
          }}
        />
      ))}
    </>
  );
}

// One real 3D box — front curtain wall, side curtain wall, rooftop —
// plus a smaller setback tier box stacked on top for a multi-tiered
// rooftop, and a distinct lobby band at the base.
function Tower({ w, d, h, tier, glow, palette, delay }) {
  const reducedMotion = usePrefersReducedMotion();

  const Box = ({ w, d, h, children, lobby }) => (
    <div
      className="absolute bottom-0 left-1/2"
      style={{ width: w, height: h, transformStyle: "preserve-3d", transform: `translateX(-50%) ${ROT}` }}
    >
      {/* Front curtain wall */}
      <div className="absolute inset-0 overflow-hidden" style={{ transform: `translateZ(${d / 2}px)` }}>
        <WindowGrid w={w} h={h} palette={palette} variant="front" />
        {children}
        {lobby && (
          <div
            className="absolute inset-x-0 bottom-0"
            style={{ height: Math.min(h * 0.14, 16), background: palette.lobby, borderTop: `2px solid ${palette.lobbyEdge}` }}
          />
        )}
      </div>
      {/* Side curtain wall — shadowed face */}
      <div
        className="absolute top-0 overflow-hidden"
        style={{ width: d, height: h, left: w, transformOrigin: "left center", transform: "rotateY(90deg)" }}
      >
        <WindowGrid w={d} h={h} palette={palette} variant="side" />
      </div>
      {/* Rooftop */}
      <div
        className="absolute top-0 left-0"
        style={{
          width: w, height: d, transformOrigin: "top left", transform: "rotateX(-90deg)",
          background: palette.roof, borderTop: `1px solid ${palette.roofEdge}`,
        }}
      />
      {/* Corner mullion — a crisp metallic edge where front meets side,
          the one structural line that actually sells "a real facade
          seam," not just two flat planes touching. */}
      <div
        className="absolute top-0"
        style={{ left: w - 1, width: 2, height: h, transform: `translateZ(${d / 2}px)`, background: `linear-gradient(180deg, ${palette.cornerA}, ${palette.cornerB})` }}
      />
    </div>
  );

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className="relative shrink-0"
      style={{ width: w + d * 0.6, height: h + tier.h + tier.d * 0.6 }}
    >
      <Box w={w} d={d} h={h} lobby>
        <GlowWindows glow={glow} w={w} h={h} palette={palette} />
      </Box>
      {/* Rooftop setback tier — a second, smaller box stacked on the main
          tower's roof, the "multi-tiered glass rooftop" real corporate
          towers actually have instead of a flat top. */}
      <div className="absolute left-1/2" style={{ bottom: h, transform: "translateX(-50%)" }}>
        <Box w={tier.w} d={tier.d} h={tier.h} />
      </div>
    </motion.div>
  );
}

export function CorporateSkyline() {
  // Fixed, neutral default until mount (server/client first-render
  // parity — see file comment); corrects to the visitor's real local
  // time immediately after.
  const [period, setPeriod] = useState("night");
  useEffect(() => { setPeriod(getPeriod()); }, []);
  const palette = PALETTES[period];

  return (
    <div className="relative flex h-full w-full items-end justify-center overflow-hidden" style={{ perspective: 1400 }}>
      <div
        className="flex origin-bottom scale-[0.52] items-end gap-3 sm:scale-[0.8] sm:gap-4 lg:scale-100"
        // Completely removes the flat platform a skyline used to sit on —
        // this mask fades the whole cluster's own bottom edge to
        // transparent instead, so the towers read as rising directly out
        // of the panel's own background rather than standing on a block.
        // The TOP is never faded — only the base — so a tall tower's own
        // rooftop tier always reads as fully resolved, never cut off.
        style={{
          WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
        }}
      >
        {TOWERS.map((t, i) => (
          <Tower key={i} {...t} palette={palette} delay={i * 0.06} />
        ))}
      </div>
    </div>
  );
}
