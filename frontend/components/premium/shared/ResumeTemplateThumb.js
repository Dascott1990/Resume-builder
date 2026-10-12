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

const PAGE_WIDTH = 816;
const PAGE_HEIGHT = 1056;
const THUMB_STYLE = { font: "calibri", fontSize: 11, lineHeight: 1.4, accent: "navy" };
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
export function DocThumb({ layoutId, active, size = "md", name, width }) {
  const dims = width
    ? { w: width }
    : size === "lg"
      ? { w: active ? 172 : 148 }
      : { w: active ? 148 : 122 };
  const scale = dims.w / PAGE_WIDTH;
  const h = PAGE_HEIGHT * scale;

  const resume = {
    ...RESUMES.it,
    contact: { ...RESUMES.it.contact, name: (name || "").trim() || FALLBACK_NAME },
  };

  return (
    <div
      className="flex shrink-0 flex-col overflow-hidden rounded-xl transition-all duration-300 ease-out"
      style={{
        width: dims.w,
        height: h,
        background: "white",
        boxShadow: active ? "var(--doc-thumb-shadow)" : "none",
        opacity: active ? 1 : 0.5,
        border: "1px solid var(--border)",
      }}
    >
      <ResumeDocument
        resume={resume}
        style={{ ...THUMB_STYLE, layout: layoutId }}
        scale={scale}
        pageWidth={PAGE_WIDTH}
        pageHeight={PAGE_HEIGHT}
        shadowClassName=""
      />
    </div>
  );
}
