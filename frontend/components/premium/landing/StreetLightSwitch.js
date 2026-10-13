"use client";
import { motion } from "framer-motion";
import { Lightbulb } from "lucide-react";

// Floating control, same spot the old 3D-intensity dial used to live —
// now a literal light switch instead of a percentage slider. Flipping it
// manually overrides whether the hero skyline's windows are lit, on top
// of (not instead of) the automatic day/night read CorporateSkyline has
// always done on its own — see useSkylineLights.js for how the two
// combine. Just the icon as the toggle — no label, no separate track —
// the bulb itself lighting up amber (or not) is the on/off state.
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
        whileTap={{ scale: 0.9 }}
        className="flex size-11 items-center justify-center rounded-full border border-white/[0.12] bg-card/90 shadow-[0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl"
      >
        <Lightbulb
          className="size-5 transition-colors duration-200"
          style={{ color: on ? "#FFC94D" : "currentColor", opacity: on ? 1 : 0.5 }}
          fill={on ? "#FFC94D" : "none"}
        />
      </motion.button>
    </div>
  );
}
