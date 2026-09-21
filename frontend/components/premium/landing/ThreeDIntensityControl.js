"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Box } from "lucide-react";

// Floating control, always reachable, never blocking content — lets someone
// turn the hero's 3D mark down (or off entirely) if they'd rather have a
// quieter first screen, or a low-power device would rather skip WebGL work
// it doesn't strictly need. Value persists via the parent's use3DIntensity().
export function ThreeDIntensityControl({ intensity, setIntensity }) {
  const [open, setOpen] = useState(false);
  const pct = Math.round(intensity * 100);

  return (
    <div
      className="fixed right-4 bottom-4 z-40 sm:right-6 sm:bottom-6"
      style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 bottom-[calc(100%+10px)] w-[220px] rounded-2xl border border-white/[0.12] bg-card/95 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl"
          >
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[12px] font-bold text-foreground">3D effect</span>
              <span className="font-mono text-[11px] text-muted-foreground">{pct}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={pct}
              onChange={(e) => setIntensity(Number(e.target.value) / 100)}
              aria-label="3D effect intensity"
              className="w-full accent-primary"
            />
            <p className="m-0 mt-2 text-[11px] leading-relaxed text-muted-foreground/70">
              Adjust how visible the hero's 3D scene is.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileTap={{ scale: 0.92 }}
        // Must contain the button's own visible text ("3D" then the
        // percent, e.g. "3D 100%") as a literal CONTIGUOUS substring, not
        // just both words present somewhere — a screen reader's
        // accessible name entirely REPLACES visible text rather than
        // supplementing it, and axe's label-content-name-mismatch check
        // (confirmed live: a first attempt with other words split between
        // "3D" and the percent still failed this) wants the visible
        // sequence intact so voice-control users can say what they see.
        aria-label={`3D ${pct}% — adjust effect intensity`}
        aria-expanded={open}
        className="flex h-11 items-center gap-2 rounded-full border border-white/[0.12] bg-card/90 px-4 text-[12.5px] font-bold text-foreground shadow-[0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl"
      >
        <Box className="size-4 text-primary" />
        {/* One wrapping span, not two direct flex-item children — "3D" and
            the percent used to be separate flex items of this button, and
            innerText inserts a line break at that boundary, which is why
            the aria-label above (a literal space, not a newline, between
            them) kept failing axe's exact-substring check even though it
            "obviously" contained both pieces. Nested here as plain inline
            content instead, matching how they already visually read as
            one line. */}
        <span>
          3D <span className="font-mono text-[10.5px] font-normal text-muted-foreground">{pct}%</span>
        </span>
      </motion.button>
    </div>
  );
}
