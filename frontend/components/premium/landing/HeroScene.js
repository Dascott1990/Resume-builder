"use client";
// HeroScene.js — the Hero's visual panel: a handful of abstract matte/frame
// blocks scattered in 3D space around THREE real resume pages — mobile,
// tablet, and desktop, the same document at three sizes rather than three
// different templates, since the point is "your resume looks right
// everywhere," not a template gallery. Rendered through the exact same
// ResumeDocument component (and prebuilt sample, RESUMES.it) SeeItHappenSection
// further down the page uses — never a screenshot image, same "the real
// renderer, not a mockup" rule that section's own file comment states.
// Previously this was two real but STATIC screenshots of the Dashboard
// (dashboard-desktop.jpg/dashboard-mobile.jpg) — swapped for a live-rendered
// resume per the actual product's own output, not a marketing photo that can
// drift out of date the moment the real UI changes.
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { ResumeDocument } from "../shared/ResumeDocument";
import { RESUMES } from "../shared/prebuiltResumes";

const TAG_STYLE = {
  position: "absolute",
  bottom: 8,
  left: 8,
  padding: "3px 8px",
  borderRadius: 999,
  background: "rgba(11,13,15,0.72)",
  color: "#f4f1ea",
  fontFamily: "var(--font-display, inherit)",
  fontSize: 8,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const ABSTRACT_BLOCKS = [
  { top: "8%", left: "10%", w: "14%", ratio: "4/3", kind: "matte", rot: "rotateX(10deg) rotateY(-16deg) rotateZ(5deg)" },
  { top: "84%", left: "14%", w: "12%", ratio: "1/1", kind: "frame", rot: "rotateX(-10deg) rotateY(14deg) rotateZ(10deg)" },
  { top: "6%", left: "86%", w: "13%", ratio: "3/4", kind: "matte", rot: "rotateX(10deg) rotateY(34deg) rotateZ(0deg)" },
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

// Real page metrics (US Letter at 96dpi) — same constants SeeItHappenSection
// uses, so "scale" below means the same thing it does there: a fraction of
// the actual rendered document, not an invented thumbnail size.
const PAGE_WIDTH = 816;
const PAGE_HEIGHT = 1056;
const SHOWCASE_STYLE = { font: "calibri", fontSize: 11, lineHeight: 1.4, accent: "navy", layout: "classic" };
// Landing-page-only: brief, not the real wait (see guest/components/
// ScanningResume.js for the actual generation-wait version, which loops
// until the AI call returns) — this always resolves fast, so looping would
// just be a lie about how long anything takes. Under a second per the brief.
const SCAN_MS = 700;

// Sweeps once over a plain pale panel, then reveals the real resume
// underneath — same visual language as ScanningResume's moving highlight
// band, just play-once instead of looping, since there's a real, final
// result to settle into here rather than an open-ended wait.
function ScanRevealResume({ displayWidth, label, delay = 0 }) {
  const reducedMotion = usePrefersReducedMotion();
  const [revealed, setRevealed] = useState(reducedMotion);
  useEffect(() => {
    if (reducedMotion) return;
    const t = setTimeout(() => setRevealed(true), SCAN_MS + delay);
    return () => clearTimeout(t);
  }, [reducedMotion, delay]);

  const scale = displayWidth / PAGE_WIDTH;
  const displayHeight = PAGE_HEIGHT * scale;

  return (
    <div style={{ width: displayWidth, height: displayHeight }} className="relative overflow-hidden rounded-2xl">
      <AnimatePresence mode="wait" initial={false}>
        {revealed ? (
          <motion.div key="resume" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <ResumeDocument
              resume={RESUMES.it}
              style={SHOWCASE_STYLE}
              scale={scale}
              pageWidth={PAGE_WIDTH}
              pageHeight={PAGE_HEIGHT}
              shadowClassName=""
            />
          </motion.div>
        ) : (
          <motion.div
            key="scanning" exit={{ opacity: 0 }}
            className="relative"
            style={{ width: displayWidth, height: displayHeight, background: "#f4f4f4" }}
          >
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 h-1/3"
              style={{ background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.08) 45%, rgba(0,0,0,0.16) 50%, rgba(0,0,0,0.08) 55%, transparent)" }}
              initial={{ top: "-30%" }}
              animate={{ top: "100%" }}
              transition={{ duration: (SCAN_MS + delay) / 1000, ease: "linear" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <span style={TAG_STYLE}>{label}</span>
    </div>
  );
}

export function HeroScene({ className }) {
  return (
    <div className={`relative h-full w-full ${className || ""}`} style={{ perspective: "1400px" }}>
      <div className="absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
        {ABSTRACT_BLOCKS.map((b, i) => <AbstractBlock key={i} {...b} />)}

        {/* Desktop — left, same size as Tablet on the right. */}
        <div
          className="absolute overflow-hidden rounded-2xl"
          style={{
            top: "50%", left: "24%", transform: "translate(-50%,-50%) rotateZ(-4deg)",
            border: "2px solid rgba(255,255,255,0.92)",
            boxShadow: "0 40px 90px -26px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.4)",
            zIndex: 1,
          }}
        >
          <ScanRevealResume displayWidth={92} label="Desktop" delay={80} />
        </div>

        {/* Tablet — right, same size as Desktop on the left. */}
        <div
          className="absolute overflow-hidden rounded-2xl"
          style={{
            top: "50%", left: "76%", transform: "translate(-50%,-50%) rotateZ(4deg)",
            border: "2px solid rgba(255,255,255,0.92)",
            boxShadow: "0 40px 90px -26px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.4)",
            zIndex: 1,
          }}
        >
          <ScanRevealResume displayWidth={92} label="Tablet" delay={160} />
        </div>

        {/* Mobile — tall, centered, in front of both. */}
        <div
          className="absolute overflow-hidden rounded-2xl"
          style={{
            top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            border: "2px solid rgba(255,255,255,0.95)",
            boxShadow: "0 55px 110px -24px rgba(0,0,0,0.78), 0 0 0 1px rgba(0,0,0,0.45)",
            zIndex: 2,
          }}
        >
          <ScanRevealResume displayWidth={128} label="Mobile" delay={0} />
        </div>
      </div>
    </div>
  );
}
