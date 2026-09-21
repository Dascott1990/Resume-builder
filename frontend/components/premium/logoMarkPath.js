/**
 * logoMarkPath.js — the Noqeev mark's raw geometry, with no "use client"
 * boundary. Extracted out of Logo.js so a context that can't import a
 * Client Component's exports (app/opengraph-image.js runs in an edge
 * route handler, not a component render) still has one real source for
 * the mark instead of a hand-copied duplicate — same reasoning
 * markGeometry.js's own header comment already gives for MARK_POINTS
 * being a single source of truth in the first place. Logo.js re-exports
 * these verbatim, so every existing import of MARK_PATH/MARK_STROKE/etc.
 * from "./Logo" keeps working unchanged.
 */

// The gesture: three sides of a bowl (bracket, open on the fourth) → the
// line keeps going instead of closing → a tail that kicks out, then breaks
// upward past the bowl's own height. One continuous stroked path, six
// points, drawn as if it were a single structural beam bent at five
// straight joints — flat caps so the two ends read as "resting on ground"
// and "reaching into the air," not trailing off softly.
export const MARK_VIEWBOX = "0 0 100 100";
export const MARK_POINTS = [
  [22, 68],  // base of the bowl's left side — grounded, same role the old mark's short-pillar base played
  [22, 16],  // top-left corner
  [74, 16],  // top-right corner
  [74, 68],  // bottom-right corner — the bowl would close here; instead the line keeps going
  [88, 86],  // the tail kicks out, down and to the right
  [97, 8],   // then breaks straight up, past the bowl's own top edge — the highest point in the mark
];
export const MARK_PATH = MARK_POINTS.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
export const MARK_STROKE = 14;
