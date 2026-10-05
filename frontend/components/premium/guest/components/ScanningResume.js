"use client";
/**
 * ScanningResume.js — shown in the canvas while a resume is actively being
 * generated (Quick Build and the normal wizard both hit this — same AI
 * wait, same empty canvas beforehand). ResumeSkeleton's own gray-bar page
 * as the backdrop, with a scan line sweeping top-to-bottom on loop —
 * black/neutral only, no color, matching the brand everywhere else in this
 * app. Reduced-motion users get the static skeleton with no sweep at all
 * rather than a jammed/instant version of the animation.
 */
import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { ResumeSkeleton } from "./ResumeSkeleton";

export function ScanningResume() {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <div className="relative overflow-hidden">
      <ResumeSkeleton />
      {!reducedMotion && (
        <>
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 h-24"
            style={{ background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.10) 45%, rgba(0,0,0,0.22) 50%, rgba(0,0,0,0.10) 55%, transparent)" }}
            initial={{ top: "-12%" }}
            animate={{ top: "100%" }}
            transition={{ duration: 1.7, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 h-[2px] bg-foreground/60"
            initial={{ top: "0%" }}
            animate={{ top: "100%" }}
            transition={{ duration: 1.7, repeat: Infinity, ease: "linear" }}
          />
        </>
      )}
    </div>
  );
}
