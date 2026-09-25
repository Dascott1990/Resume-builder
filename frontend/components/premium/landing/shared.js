"use client";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

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

// ── The full-screen-page scroll blend ───────────────────────────────────
// Each landing section is a full 100dvh page (see each section file's own
// `min-h-[100dvh]`). CSS scroll-snap was tried here too and pulled —
// real trackpad testing showed it trapping small scroll gestures near
// the top of a 100dvh-tall section (each small wheel tick landed "close
// enough" to the snap point to get pulled straight back), which read as
// the page fighting a normal scroll rather than helping it. This wrapper
// is what actually delivers the "blended" page-to-page feel now, with no
// native snap underneath it to fight the user's own scroll input:
// content dissolves + scales down slightly as its section leaves the
// viewport in either direction, and is fully settled (opacity 1, scale 1)
// only through the middle 40% of its own transit — tracked continuously
// against scroll position (useScroll+useTransform), not a one-shot
// whileInView, so scrolling back up re-plays it in reverse exactly like
// scrolling down played it forward.
export function ScrollBlend({ children, className }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center", "end start"] });
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.94, 1, 1, 0.94]);
  return (
    <motion.div ref={ref} style={{ opacity, scale }} className={className}>
      {children}
    </motion.div>
  );
}

export const SECTION_WRAP = "mx-auto w-full max-w-6xl px-6 sm:px-8 lg:px-12";

// text-primary-text, not text-primary — plain amber text directly on the
// light-mode background computes to 2.09:1, failing WCAG AA (needs
// 4.5:1). See globals.css's own --primary-text comment for the real
// contrast math; this eyebrow label is real text on every section that
// uses it, not an icon or button fill, so it needs the accessible variant.
export const EYEBROW = "mb-3 block font-mono text-[11px] font-bold tracking-[0.22em] text-primary-text uppercase";
