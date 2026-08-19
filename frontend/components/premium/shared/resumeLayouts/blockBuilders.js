"use client";
/**
 * blockBuilders.js — the actual visual layouts, each expressed as a
 * function that turns { resume, font, accent, fs, lh, onEdit } into
 * renderable content. This is the ONE place any of the three layouts'
 * markup lives now — previously the exact same "classic" structure was
 * hand-duplicated three times (Resume.js's Preview, guest/LivePreview.js,
 * and independently again in the raw-OOXML DOCX builder), which is
 * exactly the kind of triple-maintenance that's caused repeat bugs this
 * session (the avatar precedence needing updates in five places was the
 * same class of problem). New layouts only ever get built here once, then
 * both "My Resumes" and Guest Mode AI (see shared/ResumeDocument.js)
 * consume them identically.
 *
 * Two shapes come out of here:
 *   - Classic / Minimal: a flat block list, straight into
 *     usePaginatedBlocks exactly like the old code did — genuinely one
 *     column, so the existing measure-then-split pagination just works.
 *   - Sidebar: { sidebarNode, mainBlocks }. The sidebar (contact + every
 *     "bullets"-type section — skills, languages, certifications,
 *     whatever an AI-generated resume happens to call them) is short by
 *     nature and renders in full on every page rather than trying to
 *     paginate a second, independent column — real multi-page CVs with a
 *     persistent side panel do exactly this. Only mainBlocks (summary,
 *     jobs, education — the sections that actually grow long) goes
 *     through the normal pagination engine, at the narrower width the
 *     main column actually has.
 *
 * All three read the SAME resume.sections shape (type: "text" | "bullets"
 * | "jobs" | "education") — nothing about the underlying data changes
 * between layouts, only how it's drawn.
 */
import { EditableSpan } from "../../guest/components/EditableSpan";

function ContactLine({ contact, onEdit, style }) {
  return (
    <>
      <EditableSpan value={contact.location || ""} onChange={(v) => onEdit("contact", "location", v)} style={style} />
      {" · "}
      <EditableSpan value={contact.phone || ""} onChange={(v) => onEdit("contact", "phone", v)} style={style} />
      {" · "}
      <EditableSpan value={contact.email || ""} onChange={(v) => onEdit("contact", "email", v)} style={style} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CLASSIC — centered header, accent-colored uppercase section rules.
// Extracted verbatim from the pre-existing (duplicated) layout, not a
// redesign — this is what every resume already looked like, now built
// once.
// ═══════════════════════════════════════════════════════════════════════
export function buildClassicBlocks({ resume, font, accent, fs, lh, onEdit }) {
  const { contact, sections } = resume;
  const blocks = [];

  const SectionHead = ({ label }) => (
    <div style={{ marginTop: 14, marginBottom: 5, borderBottom: `1.5px solid ${accent}`, paddingBottom: 2 }}>
      <span style={{ fontFamily: font, fontSize: `${fs + 0.5}pt`, fontWeight: "bold", color: accent, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {label}
      </span>
    </div>
  );

  blocks.push({
    id: "header",
    node: (
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <div style={{ fontSize: `${fs + 6}pt`, fontWeight: "bold", color: accent, letterSpacing: "0.03em", marginBottom: 3 }}>
          <EditableSpan value={contact.name || ""} onChange={(v) => onEdit("contact", "name", v)} bold style={{ color: accent }} />
        </div>
        <div style={{ fontSize: `${fs + 1}pt`, fontStyle: "italic", color: "#595959", marginBottom: 5 }}>
          <EditableSpan value={contact.title || ""} onChange={(v) => onEdit("contact", "title", v)} italic style={{ color: "#595959" }} />
        </div>
        <div style={{ fontSize: `${fs - 1}pt`, color: "#595959", borderBottom: `1.5px solid ${accent}`, paddingBottom: 6 }}>
          <ContactLine contact={contact} onEdit={onEdit} />
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
            <p style={{ fontFamily: font, fontSize: `${fs}pt`, lineHeight: lh, color: "#2C2C2C", margin: "3px 0 8px" }}>
              <EditableSpan value={sec.content || ""} onChange={(v) => onEdit("section-text", si, v)} multiline />
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
                <li key={ii} style={{ fontFamily: font, fontSize: `${fs}pt`, lineHeight: lh, marginBottom: 2, color: "#2C2C2C" }}>
                  <EditableSpan value={item} onChange={(v) => onEdit("bullet", si, ii, v)} />
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
        blocks.push({
          id: `sec-${si}-job-${ji}-head`,
          node: (
            <div>
              {ji === 0 && <SectionHead label={sec.label} />}
              <div style={{ marginBottom: bullets.length > 1 ? 0 : 9 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontFamily: font, fontSize: `${fs}pt` }}>
                    <strong><EditableSpan value={job.role || ""} onChange={(v) => onEdit("job-role", si, ji, v)} bold /></strong>
                    <span style={{ color: "#595959", marginLeft: 6 }}>
                      <EditableSpan value={job.company || ""} onChange={(v) => onEdit("job-company", si, ji, v)} />
                      {job.location && <span style={{ color: "#999" }}> · <EditableSpan value={job.location || ""} onChange={(v) => onEdit("job-location", si, ji, v)} /></span>}
                    </span>
                  </div>
                  <span style={{ fontFamily: font, fontSize: `${fs - 1}pt`, color: "#595959", whiteSpace: "nowrap", marginLeft: 8 }}>
                    <EditableSpan value={job.period || ""} onChange={(v) => onEdit("job-period", si, ji, v)} />
                  </span>
                </div>
                {bullets.length > 0 && (
                  <ul style={{ margin: "2px 0 2px", paddingLeft: 18 }}>
                    <li style={{ fontFamily: font, fontSize: `${fs}pt`, lineHeight: lh, marginBottom: 2, color: "#2C2C2C" }}>
                      <EditableSpan value={bullets[0]} onChange={(v) => onEdit("job-bullet", si, ji, 0, v)} />
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
                <li style={{ fontFamily: font, fontSize: `${fs}pt`, lineHeight: lh, marginBottom: 2, color: "#2C2C2C" }}>
                  <EditableSpan value={b} onChange={(v) => onEdit("job-bullet", si, ji, bi, v)} />
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
                  <div style={{ fontFamily: font, fontSize: `${fs}pt` }}>
                    <strong><EditableSpan value={deg.degree || ""} onChange={(v) => onEdit("deg-degree", si, di, v)} bold /></strong>
                    <span style={{ color: "#595959" }}>
                      {" · "}<EditableSpan value={deg.school || ""} onChange={(v) => onEdit("deg-school", si, di, v)} />
                      {" · "}<EditableSpan value={deg.location || ""} onChange={(v) => onEdit("deg-location", si, di, v)} />
                    </span>
                  </div>
                  <span style={{ fontFamily: font, fontSize: `${fs - 1}pt`, color: "#595959", fontStyle: "italic", whiteSpace: "nowrap", marginLeft: 8 }}>
                    <EditableSpan value={deg.period || ""} onChange={(v) => onEdit("deg-period", si, di, v)} />
                  </span>
                </div>
              </div>
            </div>
          ),
        });
      });
    }
  });

  return blocks;
}

// ═══════════════════════════════════════════════════════════════════════
// MINIMAL — left-aligned, no colored boxes/underlines, quiet small-caps
// section labels with a hairline rule, generous whitespace. The accent
// color still shows up (just subtly, as the hairline) so the Accent
// Color picker stays meaningful on every layout, not just Classic/Sidebar.
// ═══════════════════════════════════════════════════════════════════════
export function buildMinimalBlocks({ resume, font, accent, fs, lh, onEdit }) {
  const { contact, sections } = resume;
  const blocks = [];
  const ink = "#1A1A1A";
  const muted = "#6B6B6B";

  const SectionHead = ({ label }) => (
    <div style={{ marginTop: 20, marginBottom: 8, borderTop: `1px solid ${accent}`, paddingTop: 6 }}>
      <span style={{ fontFamily: font, fontSize: `${fs - 1}pt`, fontWeight: "bold", color: ink, letterSpacing: "0.14em", textTransform: "uppercase" }}>
        {label}
      </span>
    </div>
  );

  blocks.push({
    id: "header",
    node: (
      <div style={{ textAlign: "left", marginBottom: 18 }}>
        <div style={{ fontSize: `${fs + 7}pt`, fontWeight: "bold", color: ink, letterSpacing: "0.01em", marginBottom: 4 }}>
          <EditableSpan value={contact.name || ""} onChange={(v) => onEdit("contact", "name", v)} bold style={{ color: ink }} />
        </div>
        <div style={{ fontSize: `${fs + 1}pt`, color: muted, marginBottom: 8 }}>
          <EditableSpan value={contact.title || ""} onChange={(v) => onEdit("contact", "title", v)} style={{ color: muted }} />
        </div>
        <div style={{ fontSize: `${fs - 1}pt`, color: muted }}>
          <ContactLine contact={contact} onEdit={onEdit} style={{ color: muted }} />
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
            <p style={{ fontFamily: font, fontSize: `${fs}pt`, lineHeight: lh, color: ink, margin: "0 0 10px" }}>
              <EditableSpan value={sec.content || ""} onChange={(v) => onEdit("section-text", si, v)} multiline />
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
            <ul style={{ margin: "0 0 8px", paddingLeft: 16, listStyleType: "'– '" }}>
              {(sec.items || []).map((item, ii) => (
                <li key={ii} style={{ fontFamily: font, fontSize: `${fs}pt`, lineHeight: lh, marginBottom: 3, color: ink }}>
                  <EditableSpan value={item} onChange={(v) => onEdit("bullet", si, ii, v)} />
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
        blocks.push({
          id: `sec-${si}-job-${ji}-head`,
          node: (
            <div>
              {ji === 0 && <SectionHead label={sec.label} />}
              <div style={{ marginBottom: bullets.length > 1 ? 0 : 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontFamily: font, fontSize: `${fs}pt` }}>
                    <strong><EditableSpan value={job.role || ""} onChange={(v) => onEdit("job-role", si, ji, v)} bold /></strong>
                    <span style={{ color: muted, marginLeft: 6 }}>
                      <EditableSpan value={job.company || ""} onChange={(v) => onEdit("job-company", si, ji, v)} />
                      {job.location && <span style={{ color: muted }}> · <EditableSpan value={job.location || ""} onChange={(v) => onEdit("job-location", si, ji, v)} /></span>}
                    </span>
                  </div>
                  <span style={{ fontFamily: font, fontSize: `${fs - 1}pt`, color: muted, whiteSpace: "nowrap", marginLeft: 8 }}>
                    <EditableSpan value={job.period || ""} onChange={(v) => onEdit("job-period", si, ji, v)} />
                  </span>
                </div>
                {bullets.length > 0 && (
                  <ul style={{ margin: "3px 0 2px", paddingLeft: 16, listStyleType: "'– '" }}>
                    <li style={{ fontFamily: font, fontSize: `${fs}pt`, lineHeight: lh, marginBottom: 3, color: ink }}>
                      <EditableSpan value={bullets[0]} onChange={(v) => onEdit("job-bullet", si, ji, 0, v)} />
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
              <ul style={{ margin: "0 0 2px", paddingLeft: 16, marginBottom: isLast ? 10 : 3, listStyleType: "'– '" }}>
                <li style={{ fontFamily: font, fontSize: `${fs}pt`, lineHeight: lh, marginBottom: 3, color: ink }}>
                  <EditableSpan value={b} onChange={(v) => onEdit("job-bullet", si, ji, bi, v)} />
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
              <div style={{ marginBottom: 7 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontFamily: font, fontSize: `${fs}pt` }}>
                    <strong><EditableSpan value={deg.degree || ""} onChange={(v) => onEdit("deg-degree", si, di, v)} bold /></strong>
                    <span style={{ color: muted }}>
                      {" · "}<EditableSpan value={deg.school || ""} onChange={(v) => onEdit("deg-school", si, di, v)} />
                      {" · "}<EditableSpan value={deg.location || ""} onChange={(v) => onEdit("deg-location", si, di, v)} />
                    </span>
                  </div>
                  <span style={{ fontFamily: font, fontSize: `${fs - 1}pt`, color: muted, whiteSpace: "nowrap", marginLeft: 8 }}>
                    <EditableSpan value={deg.period || ""} onChange={(v) => onEdit("deg-period", si, di, v)} />
                  </span>
                </div>
              </div>
            </div>
          ),
        });
      });
    }
  });

  return blocks;
}

// ═══════════════════════════════════════════════════════════════════════
// SIDEBAR — two columns. `contactNode` (name/title/contact lines) is short
// and fixed-height, so it repeats in full at the top of every page. Every
// "bullets"-type section (skills, languages, certifications, whatever an
// AI-generated resume happens to call a plain list) is returned as
// `sidebarBlocks` — real pagination units, not a single blob — so a list
// too tall for one page CONTINUES onto the next page's sidebar instead of
// restarting from the top and silently losing whatever didn't fit (the
// bug this replaced: a fixed-height "renders in full on every page"
// sidebar clips identically on every page, so any item past that one
// clipping point never appears anywhere in the document). "text"/"jobs"/
// "education" sections go in the main column, which paginates normally at
// its own (narrower) width.
// ═══════════════════════════════════════════════════════════════════════
export function buildSidebarContent({ resume, font, accent, fs, lh, onEdit }) {
  const { contact, sections } = resume;
  const sidebarSections = sections.filter((s) => s.type === "bullets");
  const mainSections = sections
    .map((s, si) => ({ s, si }))
    .filter(({ s }) => s.type !== "bullets");

  const SidebarHead = ({ label }) => (
    <div style={{ marginTop: 18, marginBottom: 6 }}>
      <span style={{ fontFamily: font, fontSize: `${fs - 1}pt`, fontWeight: "bold", color: "#fff", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.85 }}>
        {label}
      </span>
    </div>
  );

  const contactNode = (
    <div>
      <div style={{ fontSize: `${fs + 5}pt`, fontWeight: "bold", marginBottom: 3, lineHeight: 1.2 }}>
        <EditableSpan value={contact.name || ""} onChange={(v) => onEdit("contact", "name", v)} bold style={{ color: "#fff" }} />
      </div>
      <div style={{ fontSize: `${fs}pt`, opacity: 0.85, marginBottom: 14, fontStyle: "italic" }}>
        <EditableSpan value={contact.title || ""} onChange={(v) => onEdit("contact", "title", v)} italic style={{ color: "#fff" }} />
      </div>
      <div style={{ fontSize: `${fs - 1.5}pt`, opacity: 0.9, lineHeight: 1.7 }}>
        <div><EditableSpan value={contact.location || ""} onChange={(v) => onEdit("contact", "location", v)} style={{ color: "#fff" }} /></div>
        <div><EditableSpan value={contact.phone || ""} onChange={(v) => onEdit("contact", "phone", v)} style={{ color: "#fff" }} /></div>
        <div><EditableSpan value={contact.email || ""} onChange={(v) => onEdit("contact", "email", v)} style={{ color: "#fff" }} /></div>
      </div>
    </div>
  );

  const sidebarBlocks = [];
  sidebarSections.forEach((sec) => {
    const si = sections.indexOf(sec);
    (sec.items || []).forEach((item, ii) => {
      sidebarBlocks.push({
        id: `sidebar-${si}-${ii}`,
        node: (
          <div>
            {ii === 0 && <SidebarHead label={sec.label} />}
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              <li style={{ fontFamily: font, fontSize: `${fs - 1}pt`, lineHeight: lh, marginBottom: 4 }}>
                <EditableSpan value={item} onChange={(v) => onEdit("bullet", si, ii, v)} style={{ color: "#fff" }} />
              </li>
            </ul>
          </div>
        ),
      });
    });
  });

  const MainHead = ({ label }) => (
    <div style={{ marginTop: 14, marginBottom: 5, borderBottom: `1.5px solid ${accent}`, paddingBottom: 2 }}>
      <span style={{ fontFamily: font, fontSize: `${fs + 0.5}pt`, fontWeight: "bold", color: accent, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {label}
      </span>
    </div>
  );

  const mainBlocks = [];
  mainSections.forEach(({ s: sec, si }) => {
    if (sec.type === "text") {
      mainBlocks.push({
        id: `sec-${si}`,
        node: (
          <div>
            <MainHead label={sec.label} />
            <p style={{ fontFamily: font, fontSize: `${fs}pt`, lineHeight: lh, color: "#2C2C2C", margin: "3px 0 8px" }}>
              <EditableSpan value={sec.content || ""} onChange={(v) => onEdit("section-text", si, v)} multiline />
            </p>
          </div>
        ),
      });
    }

    if (sec.type === "jobs") {
      (sec.jobs || []).forEach((job, ji) => {
        const bullets = job.bullets || [];
        mainBlocks.push({
          id: `sec-${si}-job-${ji}-head`,
          node: (
            <div>
              {ji === 0 && <MainHead label={sec.label} />}
              <div style={{ marginBottom: bullets.length > 1 ? 0 : 9 }}>
                <div style={{ fontFamily: font, fontSize: `${fs}pt` }}>
                  <strong><EditableSpan value={job.role || ""} onChange={(v) => onEdit("job-role", si, ji, v)} bold /></strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontFamily: font, fontSize: `${fs - 1}pt`, color: "#595959" }}>
                    <EditableSpan value={job.company || ""} onChange={(v) => onEdit("job-company", si, ji, v)} />
                    {job.location && <span> · <EditableSpan value={job.location || ""} onChange={(v) => onEdit("job-location", si, ji, v)} /></span>}
                  </span>
                  <span style={{ fontFamily: font, fontSize: `${fs - 1}pt`, color: "#595959", whiteSpace: "nowrap", marginLeft: 8 }}>
                    <EditableSpan value={job.period || ""} onChange={(v) => onEdit("job-period", si, ji, v)} />
                  </span>
                </div>
                {bullets.length > 0 && (
                  <ul style={{ margin: "3px 0 2px", paddingLeft: 18 }}>
                    <li style={{ fontFamily: font, fontSize: `${fs}pt`, lineHeight: lh, marginBottom: 2, color: "#2C2C2C" }}>
                      <EditableSpan value={bullets[0]} onChange={(v) => onEdit("job-bullet", si, ji, 0, v)} />
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
          mainBlocks.push({
            id: `sec-${si}-job-${ji}-bullet-${bi}`,
            node: (
              <ul style={{ margin: "0 0 2px", paddingLeft: 18, marginBottom: isLast ? 9 : 2 }}>
                <li style={{ fontFamily: font, fontSize: `${fs}pt`, lineHeight: lh, marginBottom: 2, color: "#2C2C2C" }}>
                  <EditableSpan value={b} onChange={(v) => onEdit("job-bullet", si, ji, bi, v)} />
                </li>
              </ul>
            ),
          });
        });
      });
    }

    if (sec.type === "education") {
      (sec.degrees || []).forEach((deg, di) => {
        mainBlocks.push({
          id: `sec-${si}-deg-${di}`,
          node: (
            <div>
              {di === 0 && <MainHead label={sec.label} />}
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontFamily: font, fontSize: `${fs}pt` }}>
                  <strong><EditableSpan value={deg.degree || ""} onChange={(v) => onEdit("deg-degree", si, di, v)} bold /></strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontFamily: font, fontSize: `${fs - 1}pt`, color: "#595959" }}>
                    <EditableSpan value={deg.school || ""} onChange={(v) => onEdit("deg-school", si, di, v)} />
                    {" · "}<EditableSpan value={deg.location || ""} onChange={(v) => onEdit("deg-location", si, di, v)} />
                  </span>
                  <span style={{ fontFamily: font, fontSize: `${fs - 1}pt`, color: "#595959", fontStyle: "italic", whiteSpace: "nowrap", marginLeft: 8 }}>
                    <EditableSpan value={deg.period || ""} onChange={(v) => onEdit("deg-period", si, di, v)} />
                  </span>
                </div>
              </div>
            </div>
          ),
        });
      });
    }
  });

  return { contactNode, sidebarBlocks, mainBlocks };
}

export const LAYOUT_BUILDERS = {
  classic: buildClassicBlocks,
  minimal: buildMinimalBlocks,
};
