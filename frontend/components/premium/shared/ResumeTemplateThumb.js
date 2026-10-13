"use client";
/**
 * ResumeTemplateThumb.js — the real template preview used by Dashboard's
 * home carousel and TemplatesGallery's full picker. Renders through
 * ResumeDocument.js — the exact same renderer every real resume in the
 * product uses, and the same one the landing page's SeeItHappenSection
 * showcase already renders — instead of a hand-approximated miniature.
 * That's a deliberate correction, not a style choice: an earlier version
 * of this file hand-coded its own small JSX per layout, which looked
 * passable but could never actually match what the real renderer
 * produces, and drifted the moment blockBuilders.js changed. Reusing
 * RESUMES.it (shared/prebuiltResumes.js) — the same sample content the
 * landing page uses — means "see it on the landing page" and "see it in
 * your dashboard" are now provably the same promise, not two different
 * ones that happen to look similar.
 *
 * `name` lets the real signed-in user's own name replace the sample's
 * "John Doe" once they've set one up — everything else in the sample
 * (phone, email, location, every section) stays exactly as-is on
 * purpose: this is a dashboard screen, not a private one, so real
 * contact details never belong here. Only the name is worth
 * personalizing — it's what makes "this could be yours" land without
 * putting anyone's actual phone number or address on screen.
 */
import { ResumeDocument } from "./ResumeDocument";
import { RESUMES } from "./prebuiltResumes";

const LETTER_WIDTH = 816;
const LETTER_HEIGHT = 1056;
// Real A4 ratio (210mm:297mm), same constants LivePreview.js's own guest
// Mode A4 page already uses — not a new size invented here.
const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const THUMB_STYLE = { fontSize: 11, lineHeight: 1.4 };
const FALLBACK_NAME = RESUMES.it.contact.name; // "John Doe" — the existing sample default

// Sized to an actual Letter-page ratio (~0.77) so each one reads as a real
// document, not an icon. `active` drives the selected-card scale+shadow
// treatment both callers already use for their own selection state.
// `width` (explicit pixels) lets a caller override the size="md"/"lg"
// presets entirely — needed because ResumeDocument renders at a real,
// fixed pixel size (it's not a responsive image, so CSS alone can't
// shrink it to fit); TemplatesGallery.js computes the actual available
// grid-cell width itself and passes it here. Confirmed live as a real
// bug, not just tight spacing: the old fixed "lg" width (172px) was
// wider than its own 2-column grid cell on every phone from 320–414px,
// so the thumbnail bled into the neighboring card instead of resizing.
// accent/font: optional overrides for the Templates gallery's full
// (layout, accent, font) combinatorial grid — default to the same
// "navy"/"calibri" every caller already relied on before these existed,
// so Dashboard's own carousel (which never passes them) looks identical
// to before. pageSize: "letter" (default, unchanged) or "a4" — the real
// per-region page size the Templates gallery picks (see
// lib/resumeRegions.js), not a new size invented for this component.
export function DocThumb({ layoutId, active, size = "md", name, width, accent = "navy", font = "calibri", pageSize = "letter" }) {
  const pageWidth = pageSize === "a4" ? A4_WIDTH : LETTER_WIDTH;
  const pageHeight = pageSize === "a4" ? A4_HEIGHT : LETTER_HEIGHT;
  const dims = width
    ? { w: width }
    : size === "lg"
      ? { w: active ? 172 : 148 }
      : { w: active ? 148 : 122 };
  const scale = dims.w / pageWidth;
  const h = pageHeight * scale;

  const resume = {
    ...RESUMES.it,
    contact: { ...RESUMES.it.contact, name: (name || "").trim() || FALLBACK_NAME },
  };

  return (
    <div
      className="flex shrink-0 flex-col overflow-hidden transition-all duration-300 ease-out"
      style={{
        width: dims.w,
        height: h,
        background: "white",
        boxShadow: active ? "var(--doc-thumb-shadow)" : "none",
        opacity: active ? 1 : 0.5,
        border: "1px solid var(--border)",
      }}
    >
      {/* This renders real text (the same ResumeDocument any actual resume
          uses), not an image — without this, a tap-and-hold on a preview
          triggers the browser's native text-selection/callout instead of
          (or on top of) whatever gesture the card itself is meant for,
          here specifically the carousel's own swipe. pointer-events:none
          lets every tap/drag pass straight through to whatever actually
          handles it (the scroll track here, a picker button in
          TemplatesGallery) — these previews are never themselves
          something to select, click, or edit. */}
      <div className="pointer-events-none [-webkit-touch-callout:none] select-none">
        <ResumeDocument
          resume={resume}
          style={{ ...THUMB_STYLE, accent, font, layout: layoutId }}
          scale={scale}
          pageWidth={pageWidth}
          pageHeight={pageHeight}
          shadowClassName=""
        />
      </div>
    </div>
  );
}
