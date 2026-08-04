"use client";
import { motion } from "framer-motion";

// ── Shared scroll-reveal — the "feels like 3D" cue used across every section ──
// Content rises out of a slight depth (translateY + a few degrees of
// rotateX under a real CSS perspective) rather than just fading in place.
// `once: true` so it plays on the way in and never re-triggers on scroll-up
// — a premium landing page settles, it doesn't keep re-animating at you.
export function Reveal({ children, delay = 0, className, y = 56, ...rest }) {
  return (
    <motion.div
      initial={{ opacity: 0, y, rotateX: -6, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformPerspective: 1200 }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export const SECTION_WRAP = "mx-auto w-full max-w-6xl px-6 sm:px-8 lg:px-12";

export const EYEBROW = "mb-3 block font-mono text-[11px] font-bold tracking-[0.22em] text-primary uppercase";
