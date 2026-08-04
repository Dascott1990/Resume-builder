"use client";
import React from "react";
import { ACCENTS, FONTS } from "../constants";
import { EditableSpan } from "./EditableSpan";

// This renders the actual resume document — its typography/colors are the
// printed/exported output, not app chrome, and must not be restyled to match
// the surrounding Tailwind/shadcn UI.
export const LivePreview = React.forwardRef(function LivePreview(
  { resume, docStyle, onEdit }, ref
) {
  const accentColor = ACCENTS.find(a => a.id === docStyle.accent)?.hex || "#1F3864";
  const fs          = docStyle.fontSize || 11;
  const lh          = docStyle.lineHeight || 1.4;
  const fontFamily  = FONTS.find(f => f.id === docStyle.font)?.css || FONTS[0].css;

  if (!resume?.contact || !resume?.sections) {
    return (
      <div ref={ref} style={{ background: "white", padding: "40mm 20mm",
        width: "210mm", minHeight: "297mm", boxSizing: "border-box",
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#aaa", fontFamily, fontSize: 14, textAlign: "center" }}>
          Your generated resume will appear here
        </p>
      </div>
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

  return (
    <div ref={ref} style={{ background: "white", padding: "20mm 18mm",
      width: "210mm", minHeight: "297mm", boxSizing: "border-box",
      fontFamily, fontSize: `${fs}pt`, lineHeight: lh, color: "#1A1A1A" }}>

      {/* Header */}
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

      {/* Sections */}
      {sections.map((sec, si) => (
        <div key={sec.id || si}>
          <SectionHead label={sec.label} />

          {sec.type === "text" && (
            <p style={{ fontFamily, fontSize: `${fs}pt`, lineHeight: lh,
              color: "#2C2C2C", margin: "3px 0 8px" }}>
              <EditableSpan value={sec.content || ""}
                onChange={v => onEdit("section-text", si, v)} multiline />
            </p>
          )}

          {sec.type === "bullets" && (
            <ul style={{ margin: "3px 0 6px", paddingLeft: 18 }}>
              {(sec.items || []).map((item, ii) => (
                <li key={ii} style={{ fontFamily, fontSize: `${fs}pt`,
                  lineHeight: lh, marginBottom: 2, color: "#2C2C2C" }}>
                  <EditableSpan value={item} onChange={v => onEdit("bullet", si, ii, v)} />
                </li>
              ))}
            </ul>
          )}

          {sec.type === "jobs" && (sec.jobs || []).map((job, ji) => (
            <div key={ji} style={{ marginBottom: 9 }}>
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
              <ul style={{ margin: "2px 0 2px", paddingLeft: 18 }}>
                {(job.bullets || []).map((b, bi) => (
                  <li key={bi} style={{ fontFamily, fontSize: `${fs}pt`,
                    lineHeight: lh, marginBottom: 2, color: "#2C2C2C" }}>
                    <EditableSpan value={b} onChange={v => onEdit("job-bullet", si, ji, bi, v)} />
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {sec.type === "education" && (sec.degrees || []).map((deg, di) => (
            <div key={di} style={{ marginBottom: 6 }}>
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
          ))}
        </div>
      ))}
    </div>
  );
});
