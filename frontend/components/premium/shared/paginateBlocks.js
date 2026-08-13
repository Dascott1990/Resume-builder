"use client";
/**
 * paginateBlocks.js — shared measure-then-split pagination engine used by
 * both resume editors (guest/components/LivePreview.js for Guest Mode AI,
 * Resume.js's own Preview for "My Resumes"). Neither editor previously
 * measured its real rendered content height at all — a resume longer than
 * one page just silently overflowed a fixed-size box. This hook is the one
 * place that math happens now, so a fix here fixes both editors at once.
 *
 * Two-pass approach, since text height can't be known without actually
 * laying it out:
 *   1. Render every block once, off-screen, unbounded height, at the real
 *      target content width (text wrapping depends on width, so the
 *      measurement pass has to use the same width the real page will).
 *   2. After that commits, read each block's real rendered height and walk
 *      the list accumulating height per page, starting a new page whenever
 *      the next block would overflow the current one.
 *
 * A "block" is both the unit of measurement and the unit of pagination —
 * each block's `node` must be something that never needs to be cut in
 * half. It's the caller's job to build blocks at the right granularity
 * (see each editor's own block-building logic — a job's header glued to
 * its first bullet, each subsequent bullet its own block, etc.) — this
 * hook doesn't know or care what a "job" or "bullet" is, it just measures
 * and splits whatever blocks it's handed.
 */
import React, { useLayoutEffect, useRef, useState } from "react";

export function usePaginatedBlocks(blocks, { pageContentWidth, pageContentHeight }, deps) {
  const measureRefs = useRef({});
  // Until the first real measurement lands, everything sits on one page —
  // better than a blank screen while waiting for layout to settle.
  const [pageIds, setPageIds] = useState(() => [blocks.map((b) => b.id)]);

  useLayoutEffect(() => {
    // offsetHeight, not getBoundingClientRect().height — the latter
    // reflects the element's on-screen PROJECTED size, which collapses
    // toward zero while an ancestor's CSS transform is mid-transition
    // (e.g. Resume.js's own "book-flip" animation when switching between
    // "My Resumes" and "Guest Mode" — this measurement can fire on mount
    // while that flip is still rotating). offsetHeight is the actual
    // layout box size and doesn't care what any ancestor's transform is
    // doing visually.
    const heights = blocks.map((b) => measureRefs.current[b.id]?.offsetHeight || 0);
    const result = [[]];
    let used = 0;
    blocks.forEach((b, i) => {
      const h = heights[i];
      const page = result[result.length - 1];
      // Never start a fresh page for the very first block of a page —
      // an empty page followed by one oversized block is still better
      // than an infinite loop of empty pages for a block taller than a
      // whole page (a real but rare edge case; it just overflows that
      // one page slightly rather than vanishing or looping forever).
      if (page.length > 0 && used + h > pageContentHeight) {
        result.push([]);
        used = 0;
      }
      result[result.length - 1].push(b.id);
      used += h;
    });
    setPageIds(result);
    // deps is caller-supplied (resume content + font/size/lineHeight) —
    // that's what actually needs to trigger a remeasure; pageContentWidth/
    // pageContentHeight are included directly since they aren't always
    // threaded through the caller's own deps array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageContentWidth, pageContentHeight, ...deps]);

  // A plain element, not a component defined inline here — an inline
  // `() => (...)` component's identity is a fresh function on every
  // render, which React treats as a brand-new component TYPE each time,
  // tearing down and remounting the whole measurement layer (and its
  // refs) on every single render for no reason. A plain element's type
  // ("div") stays stable across renders, so React just reconciles it
  // normally.
  const measureLayer = (
    <div
      aria-hidden="true"
      style={{ position: "absolute", top: 0, left: -99999, width: pageContentWidth, visibility: "hidden", pointerEvents: "none" }}
    >
      {blocks.map((b) => (
        // display: flow-root establishes a new block-formatting context —
        // without it, a block's own trailing margin can collapse through
        // this plain wrapper div and escape its measured height.
        <div key={b.id} ref={(el) => { measureRefs.current[b.id] = el; }} style={{ display: "flow-root" }}>
          {b.node}
        </div>
      ))}
    </div>
  );

  // Wrapped in a keyed Fragment here (not left to the caller) — a page's
  // blocks end up as a plain array passed straight through as JSX
  // children, and React requires a key on every array item at that point
  // regardless of whether the block's own node happens to have one.
  const blocksById = Object.fromEntries(blocks.map((b) => [b.id, b.node]));
  const pages = pageIds.map((ids) =>
    ids.filter((id) => blocksById[id] !== undefined).map((id) => <React.Fragment key={id}>{blocksById[id]}</React.Fragment>)
  );

  return { pages, measureLayer };
}
