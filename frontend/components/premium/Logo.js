"use client";
/**
 * Logo.js — app/components/premium/Logo.js
 *
 * The Noviq mark, in glass.
 *
 * The gesture is unchanged from the original mark — it's the story that
 * matters, and the story was already right:
 *
 *   · A long, shallow line falls from upper-left toward the bottom —
 *     the slow, drawn-out years of looking for work.
 *   · A short, steep line rises sharply from that low point, ending
 *     HIGHER than where it started — not just relief, real advancement.
 *   · A single dot caps the end, like a period at the end of a sentence.
 *     The struggle, finally, has a full stop.
 *
 * What changed is the material. The line is now cut from a single piece
 * of glass: a gradient body (amber catching low light to deep amber in
 * shadow) gives it dimension, a soft diagonal sheen simulates a highlight
 * moving across a polished facet, and the full-stop dot reads as a glass
 * bead with its own specular catch-light. Read together, that's the
 * brand's whole idea in one object — something forged under pressure that
 * came out clear, warm, and worth catching the light.
 *
 * Deliberately one shape, no crest, no extra ornament — the same register
 * as the marks it's meant to sit alongside (X, Apple, Meta, Reddit): a
 * single confident gesture that still reads correctly at 16px in a
 * browser tab, not just at hero size. The glass treatment is additive —
 * flatten every gradient to one fill and the silhouette still works.
 *
 * Usage:
 *   import Logo, { LogoMark } from "./Logo";
 *
 *   <Logo />                                  // full lockup, dark theme, default size
 *   <Logo size={36} />                        // bigger
 *   <Logo iconOnly />                         // just the mark — mobile top bar, loading state
 *   <Logo tile />                             // mark in a rounded app-icon tile
 *   <Logo theme="light" />                    // for placement on a light/paper surface
 *   <Logo name="NOVIQ" onClick={goHome} />    // clickable brand mark, name stays editable
 *   <LogoMark size={20} />                    // bare icon only, e.g. favicon preview, spinner
 */

import React from "react";

// Same design tokens used across ErrorBoundary.js / Resume.js / ResumeGuestMode.js —
// keep this in sync with those if the palette ever moves.
const C = {
  bg:      "#0B0D14",
  panel:   "#111318",
  surface: "#15171D",
  border:  "rgba(255,255,255,0.10)",
  text:    "#F5F2EA",
  muted:   "#A6ABB4",
  gold:    "#C9A24E",
  goldFg:  "#1A1710",
  sans:    "'Helvetica Neue',Arial,sans-serif",
};

// The gesture itself — long shallow fall, short steep rise, full stop.
// Exported as constants (not hidden inside JSX) so the exact geometry is
// easy to reuse elsewhere: a favicon.svg, an app-icon export, a loading spinner.
// Unchanged from the original mark — only the rendering below is new.
export const MARK_VIEWBOX = "0 0 100 100";
export const MARK_PATH    = "M 12 34 L 70 76 L 86 14";
export const MARK_DOT     = { cx: 86, cy: 14, r: 9.5 };
const STROKE_WIDTH = 14;

/**
 * LogoMark — the icon alone, nothing else. Use this directly when you only
 * need the glyph: favicon preview, browser-tab-sized contexts, a subtle
 * watermark, a loading/processing indicator.
 *
 * Renders the gesture as a single glass facet: a gradient-filled ribbon
 * (clipped from the stroked path so the silhouette is identical to the
 * original mark), a diagonal sheen for the "light on glass" highlight, a
 * thin overlaid rim for edge definition at small sizes, and a glass-bead
 * dot with its own tiny catch-light.
 *
 * Uses React.useId() to scope its gradient/clip ids, so multiple <LogoMark />
 * or <Logo /> instances can sit on the same page without one's <defs>
 * colliding with another's.
 */
export function LogoMark({
  size = 28,
  color = C.gold,
  style,
  className,
  title = "Noviq",
  ...rest
}) {
  const uid = React.useId().replace(/[:]/g, "");
  const idBody  = `noviq-body-${uid}`;
  const idSheen = `noviq-sheen-${uid}`;
  const idDot   = `noviq-dot-${uid}`;
  const idClip  = `noviq-clip-${uid}`;

  return (
    <svg
      viewBox={MARK_VIEWBOX}
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={className}
      style={{ display: "block", flexShrink: 0, ...style }}
      {...rest}
    >
      <defs>
        {/* Amber catching light at the top edge, deepening into shadow along
            the lower-right — this diagonal is what makes a flat gradient
            read as a dimensional, cut facet rather than a painted line. */}
        <linearGradient id={idBody} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"  stopColor="#F3DFA0" />
          <stop offset="45%" stopColor={color} />
          <stop offset="100%" stopColor="#7A5B24" />
        </linearGradient>
        {/* Soft highlight streak, like a reflection sliding across polished
            glass. Confined to the ribbon by the clipPath below. */}
        <linearGradient id={idSheen} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#FFFFFF" stopOpacity="0.8" />
          <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        {/* Bright core fading to a darker amber rim — the same "glass bead"
            treatment used on physical jewelry renders for a full stop. */}
        <radialGradient id={idDot} cx="35%" cy="30%" r="75%">
          <stop offset="0%"  stopColor="#FFF8E7" />
          <stop offset="55%" stopColor="#ECC97E" />
          <stop offset="100%" stopColor="#93712E" />
        </radialGradient>
        {/* Reuses the exact stroke geometry of the original mark as a clip,
            so the silhouette this renders is pixel-identical to a flat
            single-color version — the glass treatment is additive, never
            a redesign of the shape. */}
        <clipPath id={idClip}>
          <path
            d={MARK_PATH}
            fill="none"
            stroke="#000"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </clipPath>
      </defs>

      <g clipPath={`url(#${idClip})`}>
        <rect x="0" y="0" width="100" height="100" fill={`url(#${idBody})`} />
        <ellipse
          cx="34" cy="24" rx="58" ry="17"
          transform="rotate(-30 34 24)"
          fill={`url(#${idSheen})`}
        />
      </g>

      {/* Thin rim on the same path, blended so it lightens the top edge and
          darkens the bottom edge slightly — reads as a bevel catching light,
          and keeps the silhouette crisp once this shrinks to 16px. */}
      <path
        d={MARK_PATH}
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ mixBlendMode: "overlay" }}
      />

      <circle cx={MARK_DOT.cx} cy={MARK_DOT.cy} r={MARK_DOT.r} fill={`url(#${idDot})`} />
      <circle cx={MARK_DOT.cx - 2.6} cy={MARK_DOT.cy - 2.6} r={2.4} fill="#FFFFFF" opacity="0.85" />
    </svg>
  );
}

/**
 * Logo — the full lockup (mark + wordmark) by default. This is what goes in
 * a header, a sidebar, a loading screen, an email signature.
 *
 * Props:
 *   size       icon size in px; wordmark type scale follows it. Default 28.
 *   name       the brand name to set as the wordmark. Default "NOVIQ" — pass
 *              a different string if the name changes again before it's final.
 *   iconOnly   true = render just the mark, no wordmark. Good for tight mobile
 *              headers or anywhere the full lockup won't fit.
 *   tile       true = wrap the mark in a rounded app-icon-style tile with a
 *              soft panel background. Good for favicons/app-icon previews,
 *              or a launcher-style tile in a dashboard.
 *   theme      "dark" (default, wordmark in off-white) | "light" (wordmark in
 *              near-black) — for dropping the lockup onto a light surface.
 *   onClick    optional — if provided, the lockup renders as a real <button>
 *              (so it's keyboard/focus accessible) with a subtle hover lift,
 *              for use as a "go to home" brand mark. Omit for a static logo.
 *   className, style   passthrough to the outer wrapper.
 */
export default function Logo({
  size = 28,
  name = "NOVIQ",
  iconOnly = false,
  tile = false,
  theme = "dark",
  onClick,
  className,
  style,
}) {
  const [hover, setHover] = React.useState(false);
  const wordColor = theme === "light" ? "#14151A" : C.text;
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      {...(onClick ? { onClick, type: "button" } : {})}
      onMouseEnter={onClick ? () => setHover(true) : undefined}
      onMouseLeave={onClick ? () => setHover(false) : undefined}
      onFocus={onClick ? () => setHover(true) : undefined}
      onBlur={onClick ? () => setHover(false) : undefined}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: Math.round(size * 0.36),
        background: "none",
        border: "none",
        padding: 0,
        margin: 0,
        cursor: onClick ? "pointer" : "default",
        opacity: onClick && hover ? 0.86 : 1,
        transform: onClick && hover ? "translateY(-1px)" : "none",
        transition: "opacity .15s ease, transform .15s ease",
        fontFamily: C.sans,
        WebkitTapHighlightColor: "transparent",
        ...style,
      }}
    >
      {tile ? (
        <div
          style={{
            width: size + 20,
            height: size + 20,
            borderRadius: Math.round((size + 20) * 0.28),
            background: theme === "light" ? "#EDE8DC" : C.panel,
            border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.08)" : C.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <LogoMark size={size} title={name} />
        </div>
      ) : (
        <LogoMark size={size} title={name} />
      )}

      {!iconOnly && (
        <span
          style={{
            fontSize: Math.round(size * 0.86),
            fontWeight: 700,
            letterSpacing: "0.14em",
            color: wordColor,
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </span>
      )}
    </Tag>
  );
}