/**
 * shared/theme.js
 *
 * The ONE palette for the whole app. Before this file existed, six
 * components (Resume.js, ResumeGuestMode.js, Artisans.js, ErrorBoundary.js,
 * Logo.js, page.js) each hard-coded their own near-identical dark theme —
 * same intent, six slightly different hex values, one inevitable drift bug
 * away from a header that doesn't match its body.
 *
 * Every visual surface imports T from here. Nothing else defines a color.
 */

export const T = {
  bg:       "#0B0D14",
  panel:    "#111318",
  surface:  "#15171D",
  raised:   "#1B1E26",
  border:   "rgba(255,255,255,0.10)",
  borderHi: "rgba(255,255,255,0.22)",

  text:     "#F5F2EA",
  muted:    "#A6ABB4",
  faint:    "rgba(166,171,180,0.6)",

  gold:     "#C9A24E",
  goldFg:   "#1A1710",
  goldBg:   "rgba(201,162,78,0.10)",
  goldBr:   "rgba(201,162,78,0.22)",

  blue:     "#3B82F6",
  blueBg:   "rgba(59,130,246,0.10)",
  blueBr:   "rgba(59,130,246,0.22)",

  green:    "#2BB56A",
  greenBg:  "rgba(43,181,106,0.10)",
  greenBr:  "rgba(43,181,106,0.22)",

  red:      "#E0796A",
  danger:   "#E78A8A",
  dangerBg: "rgba(231,138,138,0.10)",

  sans:  "'Helvetica Neue',Arial,sans-serif",
  serif: "'Iowan Old Style','Palatino Linotype',Georgia,serif",
  mono:  "'SF Mono','JetBrains Mono','Courier New',monospace",
};

// App-shell type scale — the interface people tap and read quickly, kept
// separate from a resume's own printed-page type scale.
export const TS = { label: 14, body: 16, meta: 13, title: 19, nav: 12.5 };

export default T;