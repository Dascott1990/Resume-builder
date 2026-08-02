"use client";
/**
 * shared/Icon.js
 *
 * One icon system, two ways to call it — chosen so wiring this in touches
 * as little existing call-site code as possible:
 *
 *   <Icon d={ICONS.download} />     // Resume.js's path-prop style
 *   <Icon name="ChevronLeft" />     // ResumeGuestMode.js's name-prop style
 *
 * Both read from the same ICONS registry below, so there is exactly one
 * copy of every glyph in the app instead of two parallel sets.
 */
import React from "react";

// d = SVG path data (string or array of path strings for multi-path icons).
// Every entry chosen to literally depict the action it triggers.
export const ICONS = {
  // navigation
  chevronLeft:  "M15 18l-6-6 6-6",
  chevronRight: "M9 18l6-6-6-6",
  close:        "M18 6 6 18M6 6l12 12",
  check:        "M20 6 9 17l-5-5",
  plus:         "M12 5v14M5 12h14",
  refresh:      ["M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8", "M21 3v5h-5",
                  "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16", "M8 16H3v5"],
  trash:        "M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6",

  // files & actions
  download:     "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  doc:          ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M16 13H8", "M16 17H8", "M10 9H8"],
  fileDown:     ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6M12 18v-6M9 15l3 3 3-3"],

  // layout / studio chrome
  layers:       ["M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z",
                  "M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12",
                  "M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"],
  panel:        ["M3 4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M9 3v18"],
  layout:       ["M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z", "M3 9h18M9 21V9"],
  palette:      "M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.4-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4c3.1 0 5.6-2.5 5.6-5.6C23 6.5 18 2 12 2z",

  // AI / content
  sparkle:      "M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM5 17l.75 2.25L8 20l-2.25.75L5 23l-.75-2.25L2 20l2.25-.75L5 17zM19 3l.75 2.25L22 6l-2.25.75L19 9l-.75-2.25L16 6l2.25-.75L19 3z",
  sparkles:     "m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3z",

  // people & places
  user:         ["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", "M12 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"],
  mapPin:       ["M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z", "M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"],
  mail:         ["M2 4h20v16H2z", "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"],
  globe:        ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"],

  // status
  alertCircle:  ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M12 8v4", "M12 16h.01"],
  clipboard:    ["M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2", "M8 2h8v4H8z"],
  externalLink: ["M15 3h6v6", "M10 14 21 3", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"],

  phone:        "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z",
  search:       ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "m21 21-4.35-4.35"],
};

// Old ResumeGuestMode.js call sites use PascalCase names (e.g. "ChevronLeft").
// Mapped once here so those sites don't need touching one-by-one.
const LEGACY_NAME_MAP = {
  ChevronLeft: "chevronLeft", ChevronRight: "chevronRight", X: "close",
  Check: "check", Plus: "plus", Trash2: "trash", RefreshCw: "refresh",
  FileText: "doc", FileDown: "fileDown", Layout: "layout", Sparkles: "sparkles",
  User: "user", Clipboard: "clipboard", MapPin: "mapPin", Mail: "mail",
  Globe: "globe", ExternalLink: "externalLink", AlertCircle: "alertCircle",
  Settings2: "panel", Gear: "panel", Eye: "alertCircle", Tag: "sparkle",
};

export default function Icon({ d, name, size = 18, sw = 2, color = "currentColor", fill = "none", style, ...rest }) {
  const path = d || ICONS[name] || ICONS[LEGACY_NAME_MAP[name]] || ICONS.alertCircle;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
      stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }} {...rest}>
      {(Array.isArray(path) ? path : [path]).map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}