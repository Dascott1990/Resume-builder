"use client";
// HeroScene.js — the Hero's visual panel. A skyline of real resume
// templates — the three actual layouts (shared/resumeLayouts/registry.js),
// rendered through TemplatePreview.js's own crisp abstract swatch (the
// same component Dashboard's Templates card and the full Templates gallery
// already use), bottom-aligned at varying heights like buildings downtown,
// windows lighting up amber (the brand's own gold, #f59e0b) once each one
// has risen into place. Previously this rendered the real ResumeDocument at
// a few dozen pixels wide — real typeset text at that scale reads as an
// illegible blur, not "clear," which is exactly the problem TemplatePreview's
// bars-not-text approach was already built to avoid (see its own file
// comment) — swapped to that instead of inventing a second small-scale
// treatment. Heights are percentages of the panel, not fixed px, so the
// same skyline silhouette holds proportionally whether the panel itself is
// 160px tall (mobile) or 420px (desktop) — see Hero.js's own breakpoints.
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { TemplatePreview } from "../shared/TemplatePreview";

const ABSTRACT_BLOCKS = [
  { top: "8%", left: "10%", w: "14%", ratio: "4/3", kind: "matte", rot: "rotateX(10deg) rotateY(-16deg) rotateZ(5deg)" },
  { top: "10%", left: "88%", w: "12%", ratio: "3/4", kind: "frame", rot: "rotateX(10deg) rotateY(34deg) rotateZ(0deg)" },
];

function AbstractBlock({ top, left, w, ratio, kind, rot }) {
  const isFrame = kind === "frame";
  return (
    <div
      className="absolute rounded-2xl"
      style={{
        top, left, width: w, aspectRatio: ratio,
        transform: `translate(-50%,-50%) ${rot}`,
        background: isFrame ? "transparent" : "linear-gradient(155deg, #34383d, #1c1f22)",
        border: isFrame ? "1.5px solid rgba(110,231,183,0.5)" : "1px solid rgba(255,255,255,0.07)",
        boxShadow: isFrame ? "0 30px 70px -34px rgba(0,0,0,0.55)" : "0 46px 90px -30px rgba(0,0,0,0.65)",
      }}
    />
  );
}

// Six "buildings" cycling the three real layouts — varying heights read as
// a skyline silhouette, not a 1-to-1 "here are our 3 templates" picker
// (TemplatesGallery already does that job properly elsewhere). heightPct
// is a fraction of the panel's own height (see file comment above); each
// also carries its own small grid of "window" positions, fractions of the
// BUILDING's own box, hand-placed rather than generated so they read as
// windows, not a random scatter.
const BUILDINGS = [
  { layoutId: "sidebar", width: 36, heightPct: 0.5, lights: [[0.5, 0.3]] },
  { layoutId: "classic", width: 42, heightPct: 0.8, lights: [[0.3, 0.25], [0.7, 0.25], [0.3, 0.55], [0.7, 0.55]] },
  { layoutId: "minimal", width: 34, heightPct: 0.62, lights: [[0.5, 0.3], [0.5, 0.6]] },
  { layoutId: "classic", width: 44, heightPct: 0.96, lights: [[0.3, 0.2], [0.7, 0.2], [0.3, 0.45], [0.7, 0.45], [0.3, 0.7], [0.7, 0.7]] },
  { layoutId: "sidebar", width: 38, heightPct: 0.7, lights: [[0.35, 0.3], [0.65, 0.55]] },
  { layoutId: "minimal", width: 36, heightPct: 0.54, lights: [[0.5, 0.35]] },
];
const RISE_MS = 460;

// Small amber squares (the brand's own gold, #f59e0b — same token Logo.js's
// mark and every CTA in the app already use) fading in once their building
// has finished rising — "turn on like a yellow light downtown," not a
// decoration invented from nothing.
function Windows({ lights, delay }) {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <>
      {lights.map(([left, top], i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          initial={reducedMotion ? { opacity: 0.9 } : { opacity: 0 }}
          animate={{ opacity: [0, 0.95, 0.75, 0.95] }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.9, delay: delay + i * 0.08, times: [0, 0.4, 0.7, 1] }}
          className="absolute rounded-[1px]"
          style={{
            left: `${left * 100}%`, top: `${top * 100}%`, width: 3, height: 3,
            background: "#f59e0b",
            boxShadow: "0 0 4px 1px rgba(245,158,11,0.9)",
          }}
        />
      ))}
    </>
  );
}

function Building({ layoutId, width, heightPct, lights, delay }) {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <motion.div
      initial={reducedMotion ? false : { height: 0, opacity: 0 }}
      animate={{ height: `${heightPct * 100}%`, opacity: 1 }}
      transition={{ duration: RISE_MS / 1000, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{ width }}
      className="relative flex items-end"
    >
      <TemplatePreview layoutId={layoutId} width={width} height="100%" />
      <Windows lights={lights} delay={delay + RISE_MS / 1000 + 0.1} />
    </motion.div>
  );
}

export function HeroScene({ className }) {
  return (
    <div className={`relative h-full w-full ${className || ""}`} style={{ perspective: "1400px" }}>
      <div className="absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
        {ABSTRACT_BLOCKS.map((b, i) => <AbstractBlock key={i} {...b} />)}
      </div>

      <div className="absolute inset-0 flex items-end justify-center pb-[10%]">
        <div className="flex h-[78%] items-end gap-1.5 sm:gap-2">
          {BUILDINGS.map((b, i) => (
            <Building key={i} {...b} delay={i * 0.07} />
          ))}
        </div>
      </div>
    </div>
  );
}
