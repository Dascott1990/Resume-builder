"use client";
/**
 * LivePreview.js — the real Guest Mode AI resume document, now rendered as
 * genuine multi-page output instead of one tall div silently overflowing a
 * fixed-size box. See shared/paginateBlocks.js for the measure-then-split
 * mechanics this builds on, and shared/ResumePageSheet.js for the visual
 * page-sheet itself. Owns its own page sizing/scaling now (previously the
 * caller, GuestMode.js, wrapped this in a single scale/A4 box from the
 * outside — that only worked for exactly one page; how many sheets exist
 * is inherently this component's own concern once there can be more than
 * one, so that responsibility moved in here).
 *
 * Block granularity: a job's title/company/period is glued to its FIRST
 * bullet (so it's never left alone at the bottom of a page with none of
 * its bullets following); every other bullet is its own block, so a long
 * job's later bullets can move to the next page independently. Education
 * entries and the summary/skills sections stay whole-block.
 *
 * This renders the actual resume document — its typography/colors are the
 * printed/exported output, not app chrome, and must not be restyled to
 * match the surrounding Tailwind/shadcn UI.
 */
import React from "react";
import { ACCENTS, FONTS } from "../constants";
import { EditableSpan } from "./EditableSpan";
import { usePaginatedBlocks } from "../../shared/paginateBlocks";
import { ResumePageSheet } from "../../shared/ResumePageSheet";

const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;
const PAGE_PADDING_Y_MM = 20;
const PAGE_PADDING_X_MM = 18;
const MM_TO_PX = 96 / 25.4; // CSS's own mm↔px ratio — a "reference pixel" is always 96/in, regardless of real device DPI.
const PAGE_CONTENT_WIDTH = A4_WIDTH_PX - PAGE_PADDING_X_MM * 2 * MM_TO_PX;
const PAGE_CONTENT_HEIGHT = A4_HEIGHT_PX - PAGE_PADDING_Y_MM * 2 * MM_TO_PX;

export const LivePreview = React.forwardRef(function LivePreview(
  { resume, docStyle, onEdit, scale = 1 }, ref
) {
  const accentColor = ACCENTS.find(a => a.id === docStyle.accent)?.hex || "#1F3864";
  const fs          = docStyle.fontSize || 11;
  const lh          = docStyle.lineHeight || 1.4;
  const fontFamily  = FONTS.find(f => f.id === docStyle.font)?.css || FONTS[0].css;

  const contentStyle = {
    padding: `${PAGE_PADDING_Y_MM}mm ${PAGE_PADDING_X_MM}mm`,
    fontFamily, fontSize: `${fs}pt`, lineHeight: lh, color: "#1A1A1A",
  };

  if (!resume?.contact || !resume?.sections) {
    return (
      <ResumePageSheet
        ref={ref} width={A4_WIDTH_PX} height={A4_HEIGHT_PX} scale={scale}
        contentStyle={{ ...contentStyle, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <p style={{ color: "#aaa", fontFamily, fontSize: 14, textAlign: "center" }}>
          Your generated resume will appear here
        </p>
      </ResumePageSheet>
    );
  }

  const { contact, sections } = resume;

  const SectionHead = ({ label }) => (
    <div style={{ marginTop: 14, marginBottom: 5,
      borderBottom: `1.5px solid ${accentColor}`, paddingBottom: 2 }}>
      <span style={{ fontFamily, fontSize: `${fs + 0.5}pt`, fontWeight: "bold",
        color: accentColor, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {label}
      </span>
    </div>
  );

  // ── Flat block list — see the file-level comment for the granularity rules ──
  const blocks = [];

  blocks.push({
    id: "header",
    node: (
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <div style={{ fontSize: `${fs + 6}pt`, fontWeight: "bold", color: accentColor,
          letterSpacing: "0.03em", marginBottom: 3 }}>
          <EditableSpan value={contact.name || ""} onChange={v => onEdit("contact", "name", v)}
            bold style={{ color: accentColor }} />
        </div>
        <div style={{ fontSize: `${fs + 1}pt`, fontStyle: "italic", color: "#595959", marginBottom: 5 }}>
          <EditableSpan value={contact.title || ""} onChange={v => onEdit("contact", "title", v)}
            italic style={{ color: "#595959" }} />
        </div>
        <div style={{ fontSize: `${fs - 1}pt`, color: "#595959",
          borderBottom: `1.5px solid ${accentColor}`, paddingBottom: 6 }}>
          {/* Unconditional separators: EditableSpan always renders *something*
              (the real value, or a "Click to edit" ghost prompt when empty),
              so gating " · " on a real value left empty fields' ghost text
              running straight into its neighbor with no space at all. */}
          <EditableSpan value={contact.location || ""} onChange={v => onEdit("contact", "location", v)} />
          {" · "}
          <EditableSpan value={contact.phone || ""} onChange={v => onEdit("contact", "phone", v)} />
          {" · "}
          <EditableSpan value={contact.email || ""} onChange={v => onEdit("contact", "email", v)} />
        </div>
      </div>
    ),
  });

  sections.forEach((sec, si) => {
    if (sec.type === "text") {
      blocks.push({
        id: `sec-${si}`,
        node: (
          <div>
            <SectionHead label={sec.label} />
            <p style={{ fontFamily, fontSize: `${fs}pt`, lineHeight: lh,
              color: "#2C2C2C", margin: "3px 0 8px" }}>
              <EditableSpan value={sec.content || ""}
                onChange={v => onEdit("section-text", si, v)} multiline />
            </p>
          </div>
        ),
      });
    }

    if (sec.type === "bullets") {
      blocks.push({
        id: `sec-${si}`,
        node: (
          <div>
            <SectionHead label={sec.label} />
            <ul style={{ margin: "3px 0 6px", paddingLeft: 18 }}>
              {(sec.items || []).map((item, ii) => (
                <li key={ii} style={{ fontFamily, fontSize: `${fs}pt`,
                  lineHeight: lh, marginBottom: 2, color: "#2C2C2C" }}>
                  <EditableSpan value={item} onChange={v => onEdit("bullet", si, ii, v)} />
                </li>
              ))}
            </ul>
          </div>
        ),
      });
    }

    if (sec.type === "jobs") {
      (sec.jobs || []).forEach((job, ji) => {
        const bullets = job.bullets || [];
        // Job header glued to its first bullet — a title/company alone at
        // the bottom of a page with all its bullets pushed to the next one
        // would read as broken, not just awkward.
        blocks.push({
          id: `sec-${si}-job-${ji}-head`,
          node: (
            <div>
              {ji === 0 && <SectionHead label={sec.label} />}
              <div style={{ marginBottom: bullets.length > 1 ? 0 : 9 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontFamily, fontSize: `${fs}pt` }}>
                    <strong>
                      <EditableSpan value={job.role || ""} onChange={v => onEdit("job-role", si, ji, v)} bold />
                    </strong>
                    <span style={{ color: "#595959", marginLeft: 6 }}>
                      <EditableSpan value={job.company || ""} onChange={v => onEdit("job-company", si, ji, v)} />
                      {job.location && <span style={{ color: "#999" }}> · <EditableSpan value={job.location || ""} onChange={v => onEdit("job-location", si, ji, v)} /></span>}
                    </span>
                  </div>
                  <span style={{ fontFamily, fontSize: `${fs - 1}pt`, color: "#595959", whiteSpace: "nowrap", marginLeft: 8 }}>
                    <EditableSpan value={job.period || ""} onChange={v => onEdit("job-period", si, ji, v)} />
                  </span>
                </div>
                {bullets.length > 0 && (
                  <ul style={{ margin: "2px 0 2px", paddingLeft: 18 }}>
                    <li style={{ fontFamily, fontSize: `${fs}pt`, lineHeight: lh, marginBottom: 2, color: "#2C2C2C" }}>
                      <EditableSpan value={bullets[0]} onChange={v => onEdit("job-bullet", si, ji, 0, v)} />
                    </li>
                  </ul>
                )}
              </div>
            </div>
          ),
        });

        bullets.slice(1).forEach((b, idx) => {
          const bi = idx + 1;
          const isLast = bi === bullets.length - 1;
          blocks.push({
            id: `sec-${si}-job-${ji}-bullet-${bi}`,
            node: (
              <ul style={{ margin: "0 0 2px", paddingLeft: 18, marginBottom: isLast ? 9 : 2 }}>
                <li style={{ fontFamily, fontSize: `${fs}pt`, lineHeight: lh, marginBottom: 2, color: "#2C2C2C" }}>
                  <EditableSpan value={b} onChange={v => onEdit("job-bullet", si, ji, bi, v)} />
                </li>
              </ul>
            ),
          });
        });
      });
    }

    if (sec.type === "education") {
      (sec.degrees || []).forEach((deg, di) => {
        blocks.push({
          id: `sec-${si}-deg-${di}`,
          node: (
            <div>
              {di === 0 && <SectionHead label={sec.label} />}
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontFamily, fontSize: `${fs}pt` }}>
                    <strong><EditableSpan value={deg.degree || ""} onChange={v => onEdit("deg-degree", si, di, v)} bold /></strong>
                    <span style={{ color: "#595959" }}>
                      {" · "}<EditableSpan value={deg.school || ""} onChange={v => onEdit("deg-school", si, di, v)} />
                      {" · "}<EditableSpan value={deg.location || ""} onChange={v => onEdit("deg-location", si, di, v)} />
                    </span>
                  </div>
                  <span style={{ fontFamily, fontSize: `${fs - 1}pt`, color: "#595959",
                    fontStyle: "italic", whiteSpace: "nowrap", marginLeft: 8 }}>
                    <EditableSpan value={deg.period || ""} onChange={v => onEdit("deg-period", si, di, v)} />
                  </span>
                </div>
              </div>
            </div>
          ),
        });
      });
    }
  });

  const { pages, measureLayer } = usePaginatedBlocks(
    blocks,
    { pageContentWidth: PAGE_CONTENT_WIDTH, pageContentHeight: PAGE_CONTENT_HEIGHT },
    [resume, fs, lh, fontFamily]
  );

  return (
    <>
      {measureLayer}
      <div ref={ref} className="flex flex-col items-center gap-6">
        {pages.map((pageBlocks, pi) => (
          <ResumePageSheet key={pi} width={A4_WIDTH_PX} height={A4_HEIGHT_PX} scale={scale} contentStyle={contentStyle}>
            {pageBlocks}
          </ResumePageSheet>
        ))}
      </div>
    </>
  );
});
