"use client";
/**
 * Logo.js — app/components/premium/Logo.js
 *
 * The Noqeev mark: Ascending Q.
 *
 * Same working principle as the mark it replaced — the geometry and the
 * color are both doing literal work, not decoration:
 *
 *   · A squared bowl — three sides of a bracket, deliberately NOT a circle.
 *     This is a page, a block, something built from the same straight
 *     edges as a resume's own layout, not a generic O.
 *   · The fourth side never closes. Instead the line keeps going: it dips
 *     out past the bowl's own corner, then breaks straight up and to the
 *     right, past the bowl's own top edge — the tail a real Q settles back
 *     down with, refusing to settle. Read together it's still legible as
 *     Noqeev's own initial, the same ownable-shape logic the previous mark
 *     used for its N.
 *   · ONE gradient carries the same emotional arc as before: deep, grounded
 *     bronze at the base, rising to bright warm gold at the top. The tail's
 *     own tip is the highest point in the whole mark — it physically
 *     reaches further into the light than the bowl it broke out of.
 *   · No dot, no full stop, same as before — the story isn't closed.
 *
 * One continuous stroked path — six points, five straight segments, flat
 * (butt) caps at the two ends, round joins at every bend so nothing spikes
 * at small sizes. Still one confident silhouette: flatten the gradient to a
 * single solid color and the bowl-and-tail shape still reads immediately,
 * and it still holds at 16px in a browser tab.
 *
 * The exact same point list drives the 3D extrusion in markGeometry.js —
 * see MARK_POINTS below; nothing there is hand-duplicated.
 *
 * Usage:
 *   import Logo, { LogoMark } from "./Logo";
 *
 *   <Logo />                                  // full lockup, dark theme, default size
 *   <Logo size={36} />                        // bigger
 *   <Logo iconOnly />                         // just the mark — mobile top bar, loading state
 *   <Logo tile />                             // mark in a rounded app-icon tile
 *   <Logo theme="light" />                    // for placement on a light/paper surface
 *   <Logo name="NOQEEV" onClick={goHome} />    // clickable brand mark, name stays editable
 *   <LogoMark size={20} />                    // bare icon only, e.g. favicon preview, spinner
 */

import React from "react";

// The gesture: three sides of a bowl (bracket, open on the fourth) → the
// line keeps going instead of closing → a tail that kicks out, then breaks
// upward past the bowl's own height. One continuous stroked path, six
// points, drawn as if it were a single structural beam bent at five
// straight joints — flat caps so the two ends read as "resting on ground"
// and "reaching into the air," not trailing off softly.
// MARK_POINTS is the single source of truth: MARK_PATH (this file's flat
// SVG) and markGeometry.js's 3D extrusion both derive from it, so the two
// can never drift out of sync with each other.
export const MARK_VIEWBOX   = "0 0 100 100";
export const MARK_POINTS    = [
  [22, 68],  // base of the bowl's left side — grounded, same role the old mark's short-pillar base played
  [22, 16],  // top-left corner
  [74, 16],  // top-right corner
  [74, 68],  // bottom-right corner — the bowl would close here; instead the line keeps going
  [88, 86],  // the tail kicks out, down and to the right
  [97, 8],   // then breaks straight up, past the bowl's own top edge — the highest point in the mark
];
export const MARK_PATH      = MARK_POINTS.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
export const MARK_STROKE    = 14;

/**
 * LogoMark — the icon alone, nothing else. Use this directly when you only
 * need the glyph: favicon preview, browser-tab-sized contexts, a subtle
 * watermark, a loading/processing indicator.
 *
 * Renders the bowl-and-tail silhouette filled with a single vertical
 * gradient (bright gold at the top, deep bronze at the base) so the color
 * itself encodes "rising into clarity." Deliberately just the one gradient
 * and nothing else layered on top — no separate sheen highlight, no
 * blended rim light. The previous mark carried both; dropped here on
 * purpose, since a squared, geometric shape reads as more precise with
 * fewer things drawn on top of it, not more polished. The clipPath still
 * reuses the exact stroke geometry, so a flattened, single-color version
 * of this mark has the identical silhouette.
 *
 * Uses React.useId() to scope its gradient/clip ids, so multiple <LogoMark />
 * or <Logo /> instances can sit on the same page without one's <defs>
 * colliding with another's.
 */
export function LogoMark({
  size = 28,
  color = "var(--primary)",
  style,
  className,
  title = "Noqeev",
  ...rest
}) {
  const uid = React.useId().replace(/[:]/g, "");
  const idBody = `noqeev-body-${uid}`;

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
        {/* Top of the mark = brightest, base = deepest bronze. The tail's
            own tip is the highest point (y=8, above the bowl's own top
            edge at y=16) — this single gradient is what makes "it reaches
            further into the light than the bowl it broke out of" a
            literal, not just implied, fact. */}
        <linearGradient id={idBody} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#F6E6B3" />
          <stop offset="38%"  stopColor={color} />
          <stop offset="100%" stopColor="#5C4419" />
        </linearGradient>
      </defs>

      {/* Stroked directly with the gradient — no clipPath/rect indirection.
          MARK_PATH is open (no closing Z), which matters here: a clipPath
          built from this same path would implicitly close it back to its
          start point and fill THAT polygon instead of the stroke outline,
          silently drawing a different silhouette than intended. Painting
          the stroke directly has no such trap. */}
      <path
        d={MARK_PATH}
        fill="none"
        stroke={`url(#${idBody})`}
        strokeWidth={MARK_STROKE}
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Logo — the full lockup (mark + wordmark) by default. This is what goes in
 * a header, a sidebar, a loading screen, an email signature.
 *
 * Props:
 *   size       icon size in px; wordmark type scale follows it. Default 28.
 *   name       the brand name to set as the wordmark. Default "NOQEEV" — pass
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
  name = "NOQEEV",
  iconOnly = false,
  tile = false,
  theme = "dark",
  onClick,
  className,
  style,
}) {
  const [hover, setHover] = React.useState(false);
  const wordColor = theme === "light" ? "#14151A" : "var(--foreground)";
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
        fontFamily: "var(--font-sans)",
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
            background: theme === "light" ? "#EDE8DC" : "var(--card)",
            border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.08)" : "var(--border)"}`,
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
            // Unbounded — see --font-wordmark in globals.css for why this
            // face specifically (its squared letterforms deliberately
            // rhyme with the mark's own squared bowl). It runs visually
            // wider and heavier than the old Helvetica Neue treatment at
            // the same point size, so the scale and tracking below are
            // tuned down from the previous 0.86/700/0.14em to match —
            // Unbounded's own letterforms already carry enough width and
            // weight that copying those old numbers over would have made
            // the wordmark overpower the icon next to it.
            fontFamily: "var(--font-wordmark)",
            fontSize: Math.round(size * 0.72),
            fontWeight: 800,
            letterSpacing: "0.02em",
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