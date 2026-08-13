"use client";
/**
 * ResumePageSheet.js — one scaled, page-sized sheet: the on-screen visual
 * for a single physical page of a resume. Purely presentational — sizing
 * and scaling only, no pagination logic (see paginateBlocks.js for that)
 * and no resume-specific rendering. Each editor passes its own typography/
 * padding via `contentStyle` so every sheet of the same document looks
 * identical regardless of which page a given block landed on — the sheet
 * itself doesn't know or care what's inside it.
 *
 * `overflow: hidden` here is deliberate and load-bearing: it's what turns
 * "a page that got slightly too much content" into a clipped page instead
 * of a page that silently bleeds into the next one — the exact failure
 * mode the single-page-box version of both editors had before this.
 *
 * forwardRef matters here, not cosmetically: callers (LivePreview.js's
 * empty-state placeholder) attach a ref to this for the print/export path
 * to walk up from — a plain function component can't receive one.
 */
import React from "react";

export const ResumePageSheet = React.forwardRef(function ResumePageSheet({
  width, height, scale,
  shadowClassName = "shadow-[0_6px_40px_rgba(0,0,0,0.35)]",
  contentStyle, className,
  children,
}, ref) {
  const scaledW = Math.round(width * scale);
  const scaledH = Math.round(height * scale);
  return (
    <div ref={ref} style={{ width: scaledW, height: scaledH }} className={`relative shrink-0 ${className || ""}`}>
      <div
        style={{
          width, height, transform: `scale(${scale})`,
          background: "white", boxSizing: "border-box", overflow: "hidden",
          ...contentStyle,
        }}
        className={`resume-page-sheet absolute top-0 left-0 origin-top-left ${shadowClassName}`}
      >
        {children}
      </div>
    </div>
  );
});
