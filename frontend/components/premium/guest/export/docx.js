import { ACCENTS, FONTS } from "../constants";
import { zipDocx } from "./zip";

// ═══════════════════════════════════════════════════════════════════════════════
// DOCX GENERATION — produces a real editable Word document
// Uses raw Office Open XML — no library needed, validated structure
// ═══════════════════════════════════════════════════════════════════════════════
export function buildDocx(resume, docStyle) {
  const { contact, sections } = resume;
  const accentHex = (ACCENTS.find(a => a.id === docStyle.accent)?.hex || "#1F3864").replace("#", "");
  const fontName  = FONTS.find(f => f.id === docStyle.font)?.label || "Calibri";
  const sz        = Math.round((docStyle.fontSize || 11) * 2);
  const szSm      = sz - 2;
  const szLg      = sz + 8;

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }

  function rpr(opts = {}) {
    const b     = opts.bold   ? "<w:b/><w:bCs/>" : "";
    const i     = opts.italic ? "<w:i/><w:iCs/>" : "";
    const size  = opts.sz ?? sz;
    const col   = opts.color ? `<w:color w:val="${opts.color}"/>` : "";
    const spc   = opts.spacing ? `<w:spacing w:val="${opts.spacing}"/>` : "";
    return `<w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}" w:cs="${fontName}"/>${b}${i}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${col}${spc}</w:rPr>`;
  }

  function r(text, opts = {}) {
    return `<w:r>${rpr(opts)}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
  }

  function ppr(opts = {}) {
    const jc     = opts.align  ? `<w:jc w:val="${opts.align}"/>` : "";
    const sp     = `<w:spacing w:before="${opts.before ?? 0}" w:after="${opts.after ?? 120}"/>`;
    const bdr    = opts.border ? `<w:pBdr><w:bottom w:val="single" w:sz="${opts.bdrSz ?? 6}" w:space="1" w:color="${accentHex}"/></w:pBdr>` : "";
    const num    = opts.bullet ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>` : "";
    const ind    = opts.indent ? `<w:ind w:left="${opts.indent}"/>` : "";
    return `<w:pPr>${num}${sp}${jc}${bdr}${ind}</w:pPr>`;
  }

  function p(runs, opts = {}) {
    return `<w:p>${ppr(opts)}${runs}</w:p>`;
  }

  function sectionHeading(label) {
    return p(
      r(label.toUpperCase(), { bold: true, sz: sz + 2, color: accentHex, spacing: 40 }),
      { before: 200, after: 80, border: true, bdrSz: 4 }
    );
  }

  let body = "";

  // Header
  body += p(r(contact.name || "", { bold: true, sz: szLg, color: accentHex, spacing: 20 }), { align: "center", after: 40 });
  body += p(r(contact.title || "", { italic: true, sz: sz + 2, color: "595959" }), { align: "center", after: 60 });
  const contactParts = [contact.location, contact.phone, contact.email].filter(Boolean);
  body += p(r(contactParts.join("  |  "), { sz: szSm, color: "595959" }), { align: "center", after: 200, border: true, bdrSz: 6 });

  // Sections
  for (const sec of (sections || [])) {
    body += sectionHeading(sec.label || "");

    if (sec.type === "text") {
      body += p(r(sec.content || "", { sz }), { after: 100 });

    } else if (sec.type === "bullets") {
      for (const item of (sec.items || [])) {
        body += p(r(item, { sz }), { bullet: true, after: 60 });
      }

    } else if (sec.type === "jobs") {
      for (const job of (sec.jobs || [])) {
        const loc = job.location ? `  •  ${job.location}` : "";
        body += p(
          r(job.role || "", { bold: true, sz }) +
          r(`  —  ${job.company || ""}${loc}`, { sz, color: "444444" }) +
          `<w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:sz w:val="${szSm}"/></w:rPr><w:tab/></w:r>` +
          r(job.period || "", { sz: szSm, color: "595959" }),
          { before: 120, after: 60 }
        );
        for (const bullet of (job.bullets || [])) {
          body += p(r(bullet, { sz }), { bullet: true, after: 40 });
        }
      }

    } else if (sec.type === "education") {
      for (const deg of (sec.degrees || [])) {
        body += p(
          r(deg.degree || "", { bold: true, sz }) +
          r(`  •  ${deg.school || ""}`, { sz }) +
          r(`  •  ${deg.location || ""}`, { sz: szSm, color: "595959" }),
          { before: 80, after: 30 }
        );
        body += p(r(deg.period || "", { italic: true, sz: szSm, color: "595959" }), { after: 80 });
      }
    }
  }

  // ── XML files ────────────────────────────────────────────────────────────
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>${body}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const num = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:multiLevelType w:val="singleLevel"/>
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/><w:numFmt w:val="bullet"/>
      <w:lvlText w:val="&#x2022;"/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr>
      <w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol"/><w:sz w:val="${sz}"/></w:rPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}" w:cs="${fontName}"/>
        <w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>
        <w:lang w:val="en-CA"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`;

  const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:defaultTabStop w:val="720"/>
  <w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>
</w:settings>`;

  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`;

  const pkgRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/word/document.xml"   ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml"     ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml"  ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/word/settings.xml"   ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/docProps/core.xml"   ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml"    ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:creator>${esc(contact.name)}</dc:creator>
  <dc:title>${esc(contact.title)}</dc:title>
</cp:coreProperties>`;

  const app = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Microsoft Office Word</Application>
  <DocSecurity>0</DocSecurity>
</Properties>`;

  return { doc, num, styles, settings, docRels, pkgRels, contentTypes, core, app };
}

export async function downloadDocx(resume, docStyle, filename) {
  if (!resume?.contact?.name)    throw new Error("Resume is missing contact name.");
  if (!resume?.sections?.length) throw new Error("Resume has no sections.");
  const xml  = buildDocx(resume, docStyle);
  const zip  = await zipDocx(xml);
  const blob = new Blob([zip], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: filename || "Resume.docx" });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
