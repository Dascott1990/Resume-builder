"use client"

import { Toaster as Sonner } from "sonner"

// This app is dark-only (see app/layout.js's hardcoded className="dark") —
// no next-themes dependency needed just to pick a theme.
function Toaster({ ...props }) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      style={{
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
      }}
      {...props} />
  );
}

export { Toaster }
