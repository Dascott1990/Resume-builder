"use client"

import { Toaster as Sonner } from "sonner"

// This app is dark-only (see app/layout.js's hardcoded className="dark") —
// no next-themes dependency needed just to pick a theme.
// sonner's default top offset is a flat 16px on mobile, which sits under the
// notch/Dynamic Island/status bar. Match the safe-area pattern used
// everywhere else in the app (BottomNav, page headers, etc).
const SAFE_AREA_OFFSET = { top: "calc(env(safe-area-inset-top, 0px) + 16px)" };

function Toaster({ ...props }) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      offset={SAFE_AREA_OFFSET}
      mobileOffset={SAFE_AREA_OFFSET}
      style={{
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
      }}
      {...props} />
  );
}

export { Toaster }
