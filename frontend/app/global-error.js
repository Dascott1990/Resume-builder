"use client";
/**
 * app/global-error.js — the true last resort: fires only when the root
 * layout itself (app/layout.js) throws, which is also why this file must
 * render its own <html>/<body> — there's no layout left to provide them.
 *
 * Deliberately minimal and dependency-light: no Logo3D/WebGL, no Tailwind
 * utility classes, no shared UI primitives. If the root layout crashed,
 * this is the one screen that has to render on its own with nothing else
 * assumed to be working, so it's plain inline-styled markup and the flat
 * SVG mark (LogoMark) rather than anything that could itself fail.
 */
import { LogoMark } from "@/components/premium/Logo";

export default function GlobalError() {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: "2rem",
          textAlign: "center",
          background: "#0a0a0a",
          color: "#fafaf9",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
        }}
      >
        <LogoMark size={40} />
        <div style={{ fontSize: 18, fontWeight: 700 }}>Something went wrong</div>
        <div style={{ fontSize: 14.5, color: "#a8a29e", maxWidth: 380, lineHeight: 1.5 }}>
          Noviq hit a problem it couldn&apos;t recover from on its own. Reloading usually fixes it.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 8,
            height: 44,
            padding: "0 20px",
            borderRadius: 10,
            border: "none",
            background: "#f59e0b",
            color: "#1c1206",
            fontSize: 14.5,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
