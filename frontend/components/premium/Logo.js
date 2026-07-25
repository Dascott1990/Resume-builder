"use client";
/**
 * Logo.js — app/components/premium/Logo.js
 *
 * The Noviq mark. One continuous stroke, drawn as a single gesture:
 *
 *   · A long, shallow line falls from upper-left toward the bottom —
 *     the slow, drawn-out years of looking for work.
 *   · A short, steep line rises sharply from that low point, ending
 *     HIGHER than where it started — not just relief, real advancement.
 *   · A single dot caps the end, like a period at the end of a sentence.
 *     The struggle, finally, has a full stop.
 *
 * Deliberately one shape, no crest, no extra ornament — the same register
 * as the marks it's meant to sit alongside (X, Apple, Meta, Reddit): a
 * single confident gesture that still reads correctly at 16px in a
 * browser tab, not just at hero size.
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
export const MARK_VIEWBOX = "0 0 100 100";
export const MARK_PATH    = "M 12 34 L 70 76 L 86 14";
export const MARK_DOT     = { cx: 86, cy: 14, r: 9 };

/**
 * LogoMark — the icon alone, nothing else. Use this directly when you only
 * need the glyph: favicon preview, browser-tab-sized contexts, a subtle
 * watermark, a loading/processing indicator.
 */
export function LogoMark({
  size = 28,
  color = C.gold,
  style,
  className,
  title = "Noviq",
  ...rest
}) {
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
      <path
        d={MARK_PATH}
        fill="none"
        stroke={color}
        strokeWidth={13}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={MARK_DOT.cx} cy={MARK_DOT.cy} r={MARK_DOT.r} fill={color} />
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