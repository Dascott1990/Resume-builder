import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { MARK_PATH, MARK_STROKE } from "@/components/premium/logoMarkPath";

// No `runtime: "edge"` — this image's content never varies per-request
// (no dynamic params), so the default Node runtime lets Next statically
// generate it once at build time instead of re-rendering on every
// crawler hit; edge runtime would disable that static generation for no
// benefit here.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Noqeev — Every career deserves a second chance.";

// Next auto-injects this into every route's og:image/twitter:image unless
// a route defines its own override (see app/layout.js's openGraph/twitter
// metadata, which deliberately omits `images` for exactly this reason).
// Literal hex colors, not CSS custom properties — Satori (what
// ImageResponse renders through) has no DOM cascade and can't resolve
// var(--foreground) etc. Values here are the real rendered colors of the
// app's dark theme: #0a0a0a background (same hardcoded value already used
// for viewport.themeColor in layout.js), #fafafa foreground, #a3a3a3
// muted-foreground, and the exact three-stop amber gradient Logo.js and
// app/brand/page.js already use verbatim for the mark.
export default async function Image() {
  // fetch(new URL("./opengraph-image-font.ttf", import.meta.url)) — the
  // pattern most next/og examples show — only resolves correctly under
  // edge runtime; under the default Node runtime (deliberately kept here
  // for static generation, see above) webpack rewrites that import into
  // a build-output asset path, not a real filesystem/http URL, and
  // `fetch()` on it fails at build time. Reading straight from disk via
  // process.cwd() is the reliable path for Node runtime.
  const fontData = await readFile(join(process.cwd(), "app/opengraph-image-font.ttf"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          gap: 28,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <svg viewBox="0 0 100 100" width="140" height="140">
            <defs>
              <linearGradient id="og-mark" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F6E6B3" />
                <stop offset="38%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#5C4419" />
              </linearGradient>
            </defs>
            <path d={MARK_PATH} fill="none" stroke="url(#og-mark)" strokeWidth={MARK_STROKE} strokeLinecap="butt" strokeLinejoin="round" />
          </svg>
          <span style={{ fontFamily: "Unbounded", fontWeight: 800, fontSize: 84, letterSpacing: "0.02em", color: "#fafafa" }}>
            NOQEEV
          </span>
        </div>
        <span style={{ fontSize: 30, color: "#a3a3a3", fontFamily: "Unbounded" }}>
          Every career deserves a second chance.
        </span>
      </div>
    ),
    { ...size, fonts: [{ name: "Unbounded", data: fontData, weight: 800, style: "normal" }] },
  );
}
