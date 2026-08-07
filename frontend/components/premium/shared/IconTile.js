"use client";
/**
 * IconTile.js — a squircle "app icon" badge: gradient fill, soft shadow,
 * rounded-square (not a circle, not a sharp box) — the same shape language
 * as an iOS/App Store icon. Used anywhere a single icon stands in for a
 * whole feature (Dashboard's quick-action tiles, each feature screen's own
 * header) so the glyph and color read as one consistent "icon" for that
 * feature everywhere it appears, the way a real app's icon looks the same
 * on the home screen and inside the app itself.
 */
const SIZES = {
  sm: { box: "size-8", icon: "size-3.5", radius: "rounded-[24%]" },
  md: { box: "size-11", icon: "size-5", radius: "rounded-[26%]" },
  lg: { box: "size-14", icon: "size-6", radius: "rounded-[28%]" },
};

export function IconTile({ icon: Icon, size = "md", className = "" }) {
  const s = SIZES[size] || SIZES.md;
  return (
    <div
      className={`flex ${s.box} ${s.radius} shrink-0 items-center justify-center bg-gradient-to-br from-primary to-primary/75 shadow-[0_6px_16px_-4px_color-mix(in_oklch,var(--primary)_55%,transparent)] ${className}`}
    >
      <Icon className={`${s.icon} text-primary-foreground`} strokeWidth={2.25} />
    </div>
  );
}
