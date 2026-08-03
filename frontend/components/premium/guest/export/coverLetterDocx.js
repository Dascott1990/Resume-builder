import { FONTS } from "../constants";
import { zipDocx } from "./zip";

// ═══════════════════════════════════════════════════════════════════════════════
// COVER LETTER DOCX — same raw-XML approach as buildDocx, simpler layout
// (letterhead + date + paragraphs, no bullets/headings needed)
// ═══════════════════════════════════════════════════════════════════════════════
export function buildCoverLetterDocx(coverLetter, contact, docStyle) {
  const fontName = FONTS.find(f => f.id === docStyle?.font)?.label || "Calibri";
  const sz   = Math.round((docStyle?.fontSize || 11) * 2);
  const szSm = sz - 2;

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }
  function rpr(opts = {}) {
    const b    = opts.bold ? "<w:b/><w:bCs/>" : "";
    const size = opts.sz ?? sz;
    const col  = opts.color ? `<w:color w:val="${opts.color}"/>` : "";
    return `<w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}" w:cs="${fontName}"/>${b}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${col}</w:rPr>`;
  }
  function r(text, opts = {}) {
    return `<w:r>${rpr(opts)}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
  }
  function ppr(opts = {}) {
    const jc = opts.align ? `<w:jc w:val="${opts.align}"/>` : "";
    const sp = `<w:spacing w:before="${opts.before ?? 0}" w:after="${opts.after ?? 200}" w:line="${Math.round((docStyle?.lineHeight || 1.4) * 240)}" w:lineRule="auto"/>`;
    return `<w:pPr>${sp}${jc}</w:pPr>`;
  }
  function p(runs, opts = {}) {
    return `<w:p>${ppr(opts)}${runs}</w:p>`;
  }

  let body = "";
  const headerBits = [contact?.name, contact?.email, contact?.phone, contact?.location].filter(Boolean);
  if (headerBits.length) {
    body += p(r(contact.name || "", { bold: true, sz: sz + 2 }), { after: 20 });
    body += p(r(headerBits.slice(1).join("  |  "), { sz: szSm, color: "595959" }), { after: 260 });
  }

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  body += p(r(today, { sz }), { after: 260 });

  const paragraphs = (coverLetter || "").split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  for (const para of paragraphs) {
    body += p(r(para, { sz }), { after: 220 });
  }

  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>${body}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const num = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`;

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
  <dc:creator>${esc(contact?.name)}</dc:creator>
  <dc:title>Cover Letter</dc:title>
</cp:coreProperties>`;

  const app = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Microsoft Office Word</Application>
  <DocSecurity>0</DocSecurity>
</Properties>`;

  return { doc, num, styles, settings, docRels, pkgRels, contentTypes, core, app };
}

export async function downloadCoverLetterDocx(coverLetter, contact, docStyle, filename) {
  if (!coverLetter) throw new Error("No cover letter to download yet.");
  const xml  = buildCoverLetterDocx(coverLetter, contact, docStyle);
  const zip  = await zipDocx(xml);
  const blob = new Blob([zip], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: filename || "Cover_Letter.docx" });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
