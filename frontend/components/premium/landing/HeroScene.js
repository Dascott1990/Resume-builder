"use client";
// HeroScene.js — the Hero's visual panel: a real isometric 3D corporate
// tower cluster (see CorporateSkyline.js), not abstract rectangles and
// not resume-template swatches — a literal "Job Hub" skyline, glass
// curtain walls and all, that reads correctly in both themes (amber-lit
// windows at night, reflective glass by day).
import { useTheme } from "@/lib/useTheme";
import { CorporateSkyline } from "./CorporateSkyline";

export function HeroScene({ className }) {
  const { theme } = useTheme();
  return (
    <div className={`relative h-full w-full ${className || ""}`}>
      <CorporateSkyline theme={theme} />
    </div>
  );
}
