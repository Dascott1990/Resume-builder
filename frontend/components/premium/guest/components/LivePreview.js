"use client";
/**
 * LivePreview.js — Guest Mode AI's resume preview. A thin wrapper around
 * the shared renderer now (see shared/ResumeDocument.js and shared/
 * resumeLayouts/ for why: this and Resume.js's own Preview used to each
 * hand-build the exact same layout independently, which is exactly the
 * kind of triple-maintenance that's caused repeat bugs this session — the
 * avatar precedence needing updates in five places was the same class of
 * problem). A4 pages and this component's own page-sheet chrome (lighter
 * corners-off shadow) are the two things that intentionally stay
 * different from "My Resumes"'s Letter-sized pages — passed in, not
 * hardcoded upstream.
 *
 * This renders the actual resume document — its typography/colors are the
 * printed/exported output, not app chrome, and must not be restyled to
 * match the surrounding Tailwind/shadcn UI.
 */
import React from "react";
import { ResumeDocument } from "../../shared/ResumeDocument";

const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

export const LivePreview = React.forwardRef(function LivePreview(
  { resume, docStyle, onEdit, scale = 1 }, ref
) {
  return (
    <ResumeDocument
      ref={ref} resume={resume} style={docStyle} onEdit={onEdit} scale={scale}
      pageWidth={A4_WIDTH_PX} pageHeight={A4_HEIGHT_PX}
      paddingXMm={18} paddingYMm={20}
      emptyState="Your generated resume will appear here"
    />
  );
});
