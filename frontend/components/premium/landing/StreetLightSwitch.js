"use client";
import { motion } from "framer-motion";
import { Lightbulb } from "lucide-react";

// Floating control, same spot the old 3D-intensity dial used to live —
// now a literal light switch instead of a percentage slider. Flipping it
// manually overrides whether the hero skyline's windows are lit, on top
// of (not instead of) the automatic day/night read CorporateSkyline has
// always done on its own — see useSkylineLights.js for how the two
// combine. Self-contained (no popover): a two-state switch doesn't need
// the extra panel a 0–100 slider did.
export function StreetLightSwitch({ on, setOn }) {
  return (
    <div
      className="fixed right-4 bottom-4 z-40 sm:right-6 sm:bottom-6"
      style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <motion.button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`Street lights, currently ${on ? "on" : "off"} — tap to turn ${on ? "off" : "on"}`}
        onClick={() => setOn(!on)}
        whileTap={{ scale: 0.95 }}
        className="flex h-11 items-center gap-2.5 rounded-full border border-white/[0.12] bg-card/90 pr-3.5 pl-4 text-[12.5px] font-bold text-foreground shadow-[0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl"
      >
        <Lightbulb
          className="size-4 shrink-0 transition-colors duration-200"
          style={{ color: on ? "#FFC94D" : "currentColor", opacity: on ? 1 : 0.5 }}
          fill={on ? "#FFC94D" : "none"}
        />
        <span className="hidden sm:inline">{on ? "Lights on" : "Lights off"}</span>
        {/* The actual switch track — a real on/off toggle, not just an
            icon color change, so the control reads as flippable at a
            glance even before anyone taps it. */}
        <span
          className="relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200"
          style={{ background: on ? "#FFC94D" : "var(--muted)" }}
        >
          <motion.span
            className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.4)]"
            animate={{ x: on ? 16 : 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
          />
        </span>
      </motion.button>
    </div>
  );
}
