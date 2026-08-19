"use client";
/**
 * ResumeDocument.js — the one component that actually renders a resume,
 * for both "My Resumes" (Resume.js) and Guest Mode AI (guest/GuestMode.js).
 * Replaces what used to be two separately-maintained, near-identical
 * implementations (Resume.js's own `Preview`, guest/components/
 * LivePreview.js) — same reasoning as blockBuilders.js's file-level
 * comment: one place to fix, one place to add a new layout.
 *
 * Callers keep their own page size (Letter vs A4 — "My Resumes" and Guest
 * Mode intentionally differ here) and page-sheet chrome (shadow/corner
 * styling also intentionally differs) by passing them in as props, not by
 * this component assuming one or the other.
 */
import React from "react";
import { FONTS, ACCENTS } from "../guest/constants";
import { DEFAULT_LAYOUT } from "./resumeLayouts/registry";
import { LAYOUT_BUILDERS, buildSidebarContent } from "./resumeLayouts/blockBuilders";
import { usePaginatedBlocks, useMeasuredHeight } from "./paginateBlocks";
import { ResumePageSheet } from "./ResumePageSheet";

const SIDEBAR_WIDTH_PX = 230;
const SIDEBAR_PAD_Y = 28;
const SIDEBAR_PAD_X = 18;

export const ResumeDocument = React.forwardRef(function ResumeDocument({
  resume, style, onEdit, scale = 1,
  pageWidth, pageHeight, paddingXMm = 18, paddingYMm = 20,
  shadowClassName, className, emptyState,
}, ref) {
  const font = FONTS.find((f) => f.id === style.font)?.css || FONTS[0].css;
  const accent = ACCENTS.find((a) => a.id === style.accent)?.hex || "#1F3864";
  const fs = style.fontSize || 11;
  const lh = style.lineHeight || 1.4;
  const layout = style.layout || DEFAULT_LAYOUT;

  const MM_TO_PX = 96 / 25.4; // CSS's own mm↔px ratio — a "reference pixel" is always 96/in, regardless of real device DPI.
  const contentWidth = pageWidth - paddingXMm * 2 * MM_TO_PX;
  const contentHeight = pageHeight - paddingYMm * 2 * MM_TO_PX;

  if (!resume?.contact || !resume?.sections) {
    return (
      <ResumePageSheet
        ref={ref} width={pageWidth} height={pageHeight} scale={scale}
        shadowClassName={shadowClassName} className={className}
        contentStyle={{ padding: `${paddingYMm}mm ${paddingXMm}mm`, fontFamily: font, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <p style={{ color: "#aaa", fontFamily: font, fontSize: 14, textAlign: "center" }}>
          {emptyState || "Your resume will appear here"}
        </p>
      </ResumePageSheet>
    );
  }

  if (layout === "sidebar") {
    return (
      <SidebarDocument
        ref={ref} resume={resume} font={font} accent={accent} fs={fs} lh={lh} onEdit={onEdit}
        scale={scale} pageWidth={pageWidth} pageHeight={pageHeight}
        paddingXMm={paddingXMm} paddingYMm={paddingYMm}
        contentHeight={contentHeight} shadowClassName={shadowClassName} className={className}
      />
    );
  }

  const buildBlocks = LAYOUT_BUILDERS[layout] || LAYOUT_BUILDERS[DEFAULT_LAYOUT];
  const blocks = buildBlocks({ resume, font, accent, fs, lh, onEdit });
  const { pages, measureLayer } = usePaginatedBlocks(
    blocks,
    { pageContentWidth: contentWidth, pageContentHeight: contentHeight },
    [resume, fs, lh, font, layout]
  );

  const contentStyle = {
    padding: `${paddingYMm}mm ${paddingXMm}mm`,
    fontFamily: font, fontSize: `${fs}pt`, lineHeight: lh, color: "#1A1A1A",
  };

  return (
    <>
      {measureLayer}
      <div ref={ref} className="flex flex-col items-center gap-6">
        {pages.map((pageBlocks, pi) => (
          <ResumePageSheet key={pi} width={pageWidth} height={pageHeight} scale={scale}
            shadowClassName={shadowClassName} className={className} contentStyle={contentStyle}>
            {pageBlocks}
          </ResumePageSheet>
        ))}
      </div>
    </>
  );
});

// Two columns: a colored sidebar whose contact header repeats on every
// page but whose bullet content (skills/languages/etc.) is genuinely
// paginated — continuing onto the next page's sidebar rather than
// restarting from the top, so a list too long for one page's sidebar
// doesn't silently lose whatever didn't fit (see blockBuilders.js's
// file-level comment). The main column paginates normally at its own
// narrower width. Page count is the max of the two — a page whose sidebar
// or main content ran out early just shows that column empty on the
// trailing pages, standard behavior for independently-paginated columns.
// Kept as a separate component (not inlined into the switch above) purely
// so its own hooks aren't called conditionally, which the Rules of Hooks
// don't allow.
const SidebarDocument = React.forwardRef(function SidebarDocument({
  resume, font, accent, fs, lh, onEdit, scale, pageWidth, pageHeight,
  paddingXMm, paddingYMm, contentHeight, shadowClassName, className,
}, ref) {
  const { contactNode, sidebarBlocks, mainBlocks } = buildSidebarContent({ resume, font, accent, fs, lh, onEdit });
  const MM_TO_PX = 96 / 25.4;
  const mainContentWidth = pageWidth - SIDEBAR_WIDTH_PX - paddingXMm * MM_TO_PX;
  const sidebarInnerWidth = SIDEBAR_WIDTH_PX - SIDEBAR_PAD_X * 2;

  const { height: contactHeight, measureLayer: contactMeasureLayer } = useMeasuredHeight(
    contactNode, sidebarInnerWidth, [resume.contact, fs, lh, font]
  );
  const sidebarContentHeight = Math.max(pageHeight - SIDEBAR_PAD_Y * 2 - contactHeight, 40);

  const { pages: sidebarPages, measureLayer: sidebarMeasureLayer } = usePaginatedBlocks(
    sidebarBlocks,
    { pageContentWidth: sidebarInnerWidth, pageContentHeight: sidebarContentHeight },
    [resume, fs, lh, font, "sidebar-skills", contactHeight]
  );
  const { pages: mainPages, measureLayer: mainMeasureLayer } = usePaginatedBlocks(
    mainBlocks,
    { pageContentWidth: mainContentWidth, pageContentHeight: contentHeight },
    [resume, fs, lh, font, "sidebar-main"]
  );

  const totalPages = Math.max(sidebarPages.length, mainPages.length, 1);

  return (
    <>
      {contactMeasureLayer}
      {sidebarMeasureLayer}
      {mainMeasureLayer}
      <div ref={ref} className="flex flex-col items-center gap-6">
        {Array.from({ length: totalPages }, (_, pi) => (
          <ResumePageSheet key={pi} width={pageWidth} height={pageHeight} scale={scale}
            shadowClassName={shadowClassName} className={className}
            contentStyle={{ padding: 0, fontFamily: font, fontSize: `${fs}pt`, lineHeight: lh, color: "#1A1A1A", display: "flex" }}>
            <div style={{ width: SIDEBAR_WIDTH_PX, flexShrink: 0, background: accent, color: "#fff", boxSizing: "border-box", padding: `${SIDEBAR_PAD_Y}px ${SIDEBAR_PAD_X}px` }}>
              {contactNode}
              {sidebarPages[pi]}
            </div>
            <div style={{ flex: 1, minWidth: 0, padding: `${paddingYMm}mm ${paddingXMm}mm` }}>
              {mainPages[pi]}
            </div>
          </ResumePageSheet>
        ))}
      </div>
    </>
  );
});
