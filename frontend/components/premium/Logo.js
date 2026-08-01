"use client";
/**
 * Logo.js — app/components/premium/Logo.js
 *
 * The Noviq mark: two pillars, bridged.
 *
 * This isn't a decorative gesture — the geometry and the color are both
 * doing literal work:
 *
 *   · A SHORT pillar on the left — where you're standing now. Potential,
 *     unproven, still finding its footing.
 *   · A TALL pillar on the right — where you land. Real, higher ground.
 *   · A rising diagonal SPANS the two — the actual bridge between potential
 *     and opportunity the brand is built on, not a metaphor bolted onto an
 *     arrow. Read the whole silhouette together and it also traces an N —
 *     Noviq's own initial, which is why the shape is ownable in a way a
 *     generic swoosh or checkmark never could be.
 *   · ONE gradient carries the emotional arc: deep, grounded bronze at the
 *     base (both pillars start in the same uncertainty) rising to bright
 *     warm gold at the top. Because the right pillar is taller, it
 *     physically reaches further into the light than the left one — the
 *     metaphor and the geometry are the same fact, not two separate ideas.
 *   · No dot, no full stop. A period says the story ends; this one
 *     doesn't — "every career deserves a second chance" isn't a closed
 *     sentence.
 *
 * Deliberately one shape, no crest, no extra ornament — flat (not rounded)
 * base edges so it reads as something BUILT, not a soft gesture. Still a
 * single confident silhouette that holds up at 16px in a browser tab, not
 * just at hero size — flatten the gradient to one solid color and the
 * pillars-and-bridge shape still reads immediately.
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
import { T as C } from "./shared/theme";

// The gesture: short pillar (potential) → rising span (the bridge) → tall
// pillar (opportunity). One continuous stroked path, drawn as if it were a
// single structural beam bent at two joints — flat caps so the base reads
// as "resting on ground," not trailing off softly.
// Exported as constants so the exact geometry is easy to reuse elsewhere:
// a favicon.svg, an app-icon export, a loading spinner.
export const MARK_VIEWBOX   = "0 0 100 100";
export const MARK_PATH      = "M 22 90 L 22 52 L 78 10 L 78 90";
export const MARK_STROKE    = 16;

/**
 * LogoMark — the icon alone, nothing else. Use this directly when you only
 * need the glyph: favicon preview, browser-tab-sized contexts, a subtle
 * watermark, a loading/processing indicator.
 *
 * Renders the pillars-and-bridge silhouette filled with a single vertical
 * gradient (bright gold at the top, deep bronze at the base) so the color
 * itself encodes "rising into clarity" — plus a restrained glass sheen
 * along the span, and a thin blended rim to keep edges crisp at small
 * sizes. The clipPath reuses the exact stroke geometry, so a flattened,
 * single-color version of this mark has the identical silhouette.
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
        {/* Top of the canvas = brightest, base = deepest bronze. Because
            the right (tall) pillar's peak sits near the top of the
            gradient and the short pillar's peak only reaches the middle,
            this single gradient is what makes "the right pillar reaches
            further into the light" a literal, not just implied, fact. */}
        <linearGradient id={idBody} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#F6E6B3" />
          <stop offset="38%"  stopColor={color} />
          <stop offset="100%" stopColor="#5C4419" />
        </linearGradient>
        {/* A single restrained highlight along the span — the moment the
            bridge catches the light, not a decorative glare. */}
        <linearGradient id={idSheen} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"  stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        {/* Reuses the exact stroke geometry of the mark as a clip, so the
            silhouette here is pixel-identical to a flat single-color
            version — the glass treatment is additive, never a departure
            from the underlying shape. */}
        <clipPath id={idClip}>
          <path
            d={MARK_PATH}
            fill="none"
            stroke="#000"
            strokeWidth={MARK_STROKE}
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
        </clipPath>
      </defs>

      <g clipPath={`url(#${idClip})`}>
        <rect x="0" y="0" width="100" height="100" fill={`url(#${idBody})`} />
        <ellipse
          cx="52" cy="26" rx="46" ry="11"
          transform="rotate(-37 52 26)"
          fill={`url(#${idSheen})`}
        />
      </g>

      {/* Thin rim on the same path, blended so it lightens the top edge and
          darkens the bottom edge slightly — reads as a bevel catching
          light, and keeps the silhouette crisp once this shrinks to 16px. */}
      <path
        d={MARK_PATH}
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={MARK_STROKE}
        strokeLinecap="butt"
        strokeLinejoin="round"
        style={{ mixBlendMode: "overlay" }}
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