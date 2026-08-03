"use client";
import { useState } from "react";
import { Star } from "lucide-react";

// ── Star rating — Uber-post-ride style ──────────────────────────────────────
// Two modes in one component so the card badge, the profile summary, and the
// rate-this-artisan widget all render identically:
//   - readOnly: static display of an average (rounds to nearest whole star —
//     no half-star clipping in v1, see StarRating's usage sites for why).
//   - interactive (onChange provided): tap a star to set 1-5, with a
//     hover-preview on pointer devices. Generous padding around each icon
//     keeps the actual tap target comfortable even though the glyph itself
//     is small.
export default function StarRating({ value = 0, onChange, readOnly = false, size = "size-5" }) {
  const [hover, setHover] = useState(null);
  const display = readOnly ? Math.round(value) : (hover ?? value);

  return (
    <div className="flex items-center gap-0.5" role={readOnly ? undefined : "radiogroup"} aria-label="Rating">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= display;
        const star = (
          <Star
            className={`${size} ${filled ? "fill-primary text-primary" : "fill-none text-muted-foreground"}`}
          />
        );
        if (readOnly) {
          return <span key={i}>{star}</span>;
        }
        return (
          <button
            key={i}
            type="button"
            aria-label={`${i} star${i === 1 ? "" : "s"}`}
            className="p-1.5"
            onClick={() => onChange?.(i)}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            {star}
          </button>
        );
      })}
    </div>
  );
}
