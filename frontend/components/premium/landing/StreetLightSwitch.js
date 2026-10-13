"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb } from "lucide-react";

// Floating control, same spot the old 3D-intensity dial used to live —
// now a literal light switch instead of a percentage slider. Flipping it
// manually overrides whether the hero skyline's windows are lit, on top
// of (not instead of) the automatic day/night read CorporateSkyline has
// always done on its own — see useSkylineLights.js for how the two
// combine. Just the icon as the toggle — no label, no separate track —
// the bulb itself lighting up amber (or not) is the on/off state.
//
// Only meaningful while the skyscraper it controls is actually on screen —
// it's rendered as a sibling of every section (see LandingPage.js), not
// scoped to Hero, so without this it stayed fixed and visible for the
// entire rest of the scroll with nothing left for it to control.
// IntersectionObserver on Hero's own `#top` section (not a scrollY/
// viewport-height guess) so this tracks Hero's real rendered height,
// whatever that actually is on a given device.
export function StreetLightSwitch({ on, setOn }) {
  const [heroVisible, setHeroVisible] = useState(true);

  useEffect(() => {
    const hero = document.getElementById("top");
    if (!hero) return;
    const observer = new IntersectionObserver(
      ([entry]) => setHeroVisible(entry.isIntersecting),
      { threshold: 0.15 }
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="fixed right-4 bottom-4 z-40 sm:right-6 sm:bottom-6"
      style={{ marginBottom: "env(safe-area-inset-bottom, 0px)", pointerEvents: heroVisible ? "auto" : "none" }}
    >
      <AnimatePresence>
        {heroVisible && (
          <motion.button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={`Street lights, currently ${on ? "on" : "off"} — tap to turn ${on ? "off" : "on"}`}
            onClick={() => setOn(!on)}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            whileTap={{ scale: 0.9 }}
            className="flex size-11 items-center justify-center rounded-full border border-white/[0.12] bg-card/90 shadow-[0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl"
          >
            <Lightbulb
              className="size-5 transition-colors duration-200"
              style={{ color: on ? "#FFC94D" : "currentColor", opacity: on ? 1 : 0.5 }}
              fill={on ? "#FFC94D" : "none"}
            />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
