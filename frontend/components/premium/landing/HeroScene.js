"use client";
// HeroScene.js — the Hero's visual panel: a real isometric 3D corporate
// tower cluster (see CorporateSkyline.js), not abstract rectangles and
// not resume-template swatches — a literal "Job Hub" skyline, glass
// curtain walls and all. Colored by the viewer's own real local time of
// day (CorporateSkyline's own concern, not this file's) rather than the
// app's light/dark theme toggle.
import { CorporateSkyline } from "./CorporateSkyline";
import { LedgerTicker } from "./LedgerTicker";

export function HeroScene({ className, lightsOverride }) {
  return (
    <div className={`relative h-full w-full ${className || ""}`}>
      {/* Behind the towers, not a change to CorporateSkyline.js itself —
          see LedgerTicker.js's own file comment. Explicit z-index on both
          (not just DOM order) since CorporateSkyline's own root is
          `relative`, not positioned in a way that guarantees it stacks
          above an earlier absolutely-positioned sibling on its own. */}
      <LedgerTicker className="z-0" />
      <div className="relative z-10 h-full w-full">
        <CorporateSkyline lightsOverride={lightsOverride} />
      </div>
    </div>
  );
}
