"use client";
// HeroScene.js — the Hero's visual panel: a real isometric 3D corporate
// tower cluster (see CorporateSkyline.js), not abstract rectangles and
// not resume-template swatches — a literal "Job Hub" skyline, glass
// curtain walls and all. Colored by the viewer's own real local time of
// day (CorporateSkyline's own concern, not this file's) rather than the
// app's light/dark theme toggle.
import { CorporateSkyline } from "./CorporateSkyline";

export function HeroScene({ className }) {
  return (
    <div className={`relative h-full w-full ${className || ""}`}>
      <CorporateSkyline />
    </div>
  );
}
