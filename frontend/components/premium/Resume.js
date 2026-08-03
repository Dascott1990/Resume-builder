"use client";
/**
 * Resume.js — Noviq Studio + Guest Mode
 *
 * Two modes:
 *  1. "My Resumes"  — the four pre-built resumes (original behaviour, untouched)
 *  2. "Guest Mode"  — 3-step wizard: your info → paste job description → AI tailors resume
 *
 * Guest flow:
 *   Step 1 · Who are you?        (name, title, location, contact, brief background)
 *   Step 2 · Paste job posting   (raw text from any job board)
 *   Step 3 · AI generates        (keyword-matched bullets, ATS-ready, downloads as DOCX/PDF)
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Palette, Check, PanelLeft, FileText, Sparkle, Download, X } from "lucide-react";
import ResumeGuestMode from "./guest";
import Logo from "./Logo";

// This file's icons were drawn at a slightly thinner default stroke (1.6 vs
// lucide's default of 2) — preserved here so nothing on screen shifts.
const ICON_STROKE = 1.6;

// ── The four pre-built resumes (unchanged) ─────────────────────────────────────
const RESUMES = {
  it: {
    label: "IT Support",
    title: "Bilingual Service Desk Analyst",
    contact: {
      name:  "Rasheed Tajudeen",
      title: "Bilingual Service Desk Analyst",
      phone: "(416) 505-6927",
      email: "oluwagbengarasheed2@gmail.com",
      location: "Ottawa, ON",
    },
    sections: [
      {
        id: "objective", label: "Objective", type: "text",
        content: "Customer-focused and technically inclined professional seeking a Level 1 Help Desk / IT Support role. Brings strong communication skills, bilingual proficiency (English/French), and hands-on experience troubleshooting hardware, software, and network issues. Committed to delivering excellent end-user support, resolving tickets efficiently, and escalating issues as needed in a fast-paced IT environment.",
      },
      {
        id: "skills", label: "Technical Skills & Qualifications", type: "bullets",
        items: [
          "End-user support: password resets, account management, software installation and configuration",
          "Microsoft 365 (M365), MS Teams and MS Exchange: navigating and supporting users day-to-day",
          "Microsoft Windows OS: installation, configuration and troubleshooting",
          "Active Directory: adding and removing user accounts and managing access",
          "Hardware troubleshooting: printer setup, network connectivity and peripheral devices",
          "ITSM / ticketing systems: creating, tracking and escalating support tickets",
          "Knowledge base usage: applying FAQs, troubleshooting guides and standard procedures",
          "Bilingual: English and French (spoken, written and comprehension)",
        ],
      },
      {
        id: "experience", label: "Experience", type: "jobs",
        jobs: [
          {
            role: "Grocery Clerk / Customer Support",
            company: "Farm Boy",
            period: "2021 – 2025",
            bullets: [
              "Served as front-line resource for customer inquiries, resolving issues calmly and professionally in real time — directly paralleling L1 help desk interactions",
              "Communicated clearly with both non-technical customers and supervisors, adapting tone and language based on the audience",
              "Managed inventory discrepancies by identifying, documenting and escalating problems to management — mirroring ticket creation and escalation in an ITSM environment",
              "Operated and maintained powered equipment applying safety standards and following documented procedures",
              "Maintained consistent communication with team leads, flagging operational issues and supporting colleagues",
            ],
          },
        ],
      },
      {
        id: "education", label: "Education", type: "education",
        degrees: [
          { degree: "Business Accounting — Diploma", school: "Algonquin College", location: "Ottawa, Ontario", period: "Jan 2023 – Jan 2024" },
          { degree: "Computer Science — Bachelor", school: "Humber College", location: "Toronto, Ontario", period: "Jan 2018 – Jan 2022" },
        ],
      },
      {
        id: "qualifications", label: "Additional Qualifications", type: "bullets",
        items: [
          "Strong problem-solving skills with an ability to work through issues systematically",
          "Comfortable interacting with both technical and non-technical users; patient, clear and professional",
          "Self-motivated and able to work with minimal supervision in a structured support environment",
          "Positive attitude, punctual and dependable; clean certificate of conduct available upon request",
          "Flexible availability, including evening and weekend shifts",
        ],
      },
    ],
  },

  grocery: {
    label: "Grocery Clerk",
    title: "Grocery Clerk",
    contact: {
      name:  "Rasheed Tajudeen",
      title: "Grocery Clerk",
      phone: "(416) 505-6927",
      email: "oluwagbengarasheed2@gmail.com",
      location: "Ottawa, ON",
    },
    sections: [
      {
        id: "objective", label: "Objective", type: "text",
        content: "Skilled grocery store clerk with 4+ years of experience providing excellent customer service, increasing customer loyalty, and supporting colleagues. Eager to apply meticulous attention to detail and proficiency in retail environments to drive efficient inventory management and contribute to critical supply chain operations.",
      },
      {
        id: "interests", label: "Profile", type: "text",
        content: "Willing to work in a retail environment with minimal supervision. Able to perform repetitive tasks while maintaining a high level of quality control, consistency, and a positive attitude.",
      },
      {
        id: "experience", label: "Experience", type: "jobs",
        jobs: [
          {
            role: "Grocery Clerk",
            company: "Farm Boy",
            period: "2021 – 2025",
            bullets: [
              "Ensured shelves are fully stocked with high-quality products, including rotating stock, checking expiration dates, and maintaining proper signage and pricing",
              "Maintained accurate inventory levels by conducting regular stock counts and reporting discrepancies to management using Microsoft Excel and Python",
              "Provided exceptional floor service to customers by greeting them, answering questions, and helping them find products",
              "Safely operated powered equipment such as forklifts and pallet jacks",
              "Kept communication lines open with supervisors and adhered to safety standards and procedures",
            ],
          },
        ],
      },
      {
        id: "education", label: "Education", type: "education",
        degrees: [
          { degree: "Business Accounting — Diploma", school: "Algonquin College", location: "Ottawa, Ontario", period: "Jan 2023 – Jan 2024" },
          { degree: "Supply Chain Management — Advanced Diploma", school: "Humber College", location: "Toronto, Ontario", period: "Jan 2018 – Jan 2020" },
        ],
      },
      {
        id: "skills", label: "Skills & Qualifications", type: "bullets",
        items: [
          "Strong work ethic and a positive attitude",
          "Ability to lift and carry up to 70 lbs",
          "Teamwork skills and flexibility for night shift",
          "Clean certificate of conduct",
          "Time management and attention to detail skills",
        ],
      },
    ],
  },

  admin: {
    label: "Admin / Coordinator",
    title: "Bilingual Administrative & Customer Service Coordinator",
    contact: {
      name:  "Rasheed Tajudeen",
      title: "Bilingual Administrative & Customer Service Coordinator",
      phone: "(416) 505-6927",
      email: "oluwagbengarasheed2@gmail.com",
      location: "Ottawa, ON",
    },
    sections: [
      {
        id: "objective", label: "Objective", type: "text",
        content: "Bilingual administrative and customer service professional with 4+ years of experience supporting customer inquiries, order coordination, documentation, and day-to-day business operations. Proficient with Google Workspace and Microsoft Office. Recognized for strong communication, accuracy, organization, and problem-solving skills.",
      },
      {
        id: "skills", label: "Core Competencies", type: "bullets",
        items: [
          "Client Relationship Management & Customer Service",
          "Order Intake & Order Processing",
          "Data Entry & Documentation",
          "Administrative Support",
          "Google Workspace (Gmail, Docs, Sheets) & Microsoft Office Suite",
          "Inventory Management & Invoicing",
          "Stakeholder Communication & Business Development Support",
          "English & French Communication",
        ],
      },
      {
        id: "experience", label: "Experience", type: "jobs",
        jobs: [
          {
            role: "Customer Service & Operations Associate",
            company: "Giant Tiger",
            period: "2021 – 2025",
            bullets: [
              "Served as first point of contact for customer inquiries, requests, and issue resolution",
              "Built and maintained positive customer relationships through professional and timely service",
              "Maintained accurate records and completed data entry with strong attention to detail",
              "Resolved customer issues efficiently while ensuring a positive customer experience",
              "Collaborated with supervisors and team members to support daily operational objectives",
              "Demonstrated strong organizational skills managing multiple priorities in a fast-paced environment",
            ],
          },
          {
            role: "Order Processing Associate",
            company: "Metro Distribution Centre",
            period: "2018 – 2019",
            bullets: [
              "Processed customer orders and verified order details for accuracy",
              "Maintained inventory and order records in a fast-paced environment",
              "Coordinated with team members to meet service and delivery timelines",
              "Followed established procedures and safety standards",
            ],
          },
        ],
      },
      {
        id: "education", label: "Education", type: "education",
        degrees: [
          { degree: "Business Accounting — Diploma", school: "Algonquin College", location: "Ottawa, Ontario", period: "Jan 2023 – Jan 2024" },
          { degree: "Supply Chain Management — Advanced Diploma", school: "Humber College", location: "Toronto, Ontario", period: "Jan 2018 – Jan 2020" },
        ],
      },
      {
        id: "qualifications", label: "Additional Qualifications", type: "bullets",
        items: [
          "Fluent in English and French",
          "Strong customer-centric mindset with excellent verbal and written communication",
          "Self-motivated, results-driven, and a quick learner",
          "Professional, dependable, and detail-oriented",
        ],
      },
    ],
  },

  popeye: {
    label: "Pop-Eye / Retail",
    title: "Grocery Clerk",
    contact: {
      name:  "Rasheed Tajudeen",
      title: "Grocery Clerk",
      phone: "(416) 505-6927",
      email: "oluwagbengarasheed2@gmail.com",
      location: "Ottawa, ON",
    },
    sections: [
      {
        id: "objective", label: "Objective", type: "text",
        content: "Skilled grocery store clerk with 4+ years of experience providing excellent customer service, increasing customer loyalty, and supporting colleagues. Eager to apply meticulous attention to detail and proficiency in retail environments to drive efficient inventory management.",
      },
      {
        id: "interests", label: "Profile", type: "text",
        content: "Willing to work in a retail environment with minimal supervision. Able to perform repetitive tasks while maintaining a high level of quality control, consistency, and a positive attitude.",
      },
      {
        id: "experience", label: "Experience", type: "jobs",
        jobs: [
          {
            role: "Grocery Clerk",
            company: "Farm Boy",
            period: "2021 – 2025",
            bullets: [
              "Ensured shelves are fully stocked with high-quality products, including rotating stock, checking expiration dates, and maintaining proper signage and pricing",
              "Maintained accurate inventory levels by conducting regular stock counts and reporting any discrepancies to management",
              "Provided exceptional floor service to customers by greeting them, answering questions, and helping them find products",
              "Safely operated powered equipment such as forklifts and pallet jacks",
              "Kept the communication lines open with supervisors and adhered to safety standards and procedures",
            ],
          },
        ],
      },
      {
        id: "education", label: "Education", type: "education",
        degrees: [
          { degree: "Business Accounting — Diploma", school: "Algonquin College", location: "Ottawa, Ontario", period: "Jan 2023 – Jan 2024" },
          { degree: "Supply Chain Management — Advanced Diploma", school: "Humber College", location: "Toronto, Ontario", period: "Jan 2018 – Jan 2020" },
        ],
      },
      {
        id: "skills", label: "Skills & Qualifications", type: "bullets",
        items: [
          "Strong work ethic and a positive attitude",
          "Ability to lift and carry up to 70 lbs",
          "Teamwork skills and flexibility for night shift",
          "Clean certificate of conduct",
          "Time management and attention to detail skills",
        ],
      },
    ],
  },
};

// ── Style presets ──────────────────────────────────────────────────────────────
const FONTS = [
  { id: "calibri",   label: "Calibri",         css: "Calibri, 'Gill Sans', sans-serif" },
  { id: "times",     label: "Times New Roman",  css: "'Times New Roman', Times, serif" },
  { id: "arial",     label: "Arial",            css: "Arial, Helvetica, sans-serif" },
  { id: "garamond",  label: "Garamond",         css: "Garamond, 'EB Garamond', Georgia, serif" },
  { id: "georgia",   label: "Georgia",          css: "Georgia, 'Times New Roman', serif" },
  { id: "helvetica", label: "Helvetica",        css: "Helvetica, Arial, sans-serif" },
];

const ACCENTS = [
  { id: "navy",   label: "Navy",    hex: "#1F3864" },
  { id: "black",  label: "Classic", hex: "#1A1A1A" },
  { id: "teal",   label: "Teal",    hex: "#0D5C6B" },
  { id: "forest", label: "Forest",  hex: "#1E4D2B" },
  { id: "wine",   label: "Wine",    hex: "#6B1A3A" },
  { id: "steel",  label: "Steel",   hex: "#2C4A6B" },
];

// ── DOCX / ZIP generation (unchanged from original) ───────────────────────────
function generateDocx(resume, style) {
  const { contact, sections } = resume;
  const font = FONTS.find(f => f.id === style.font)?.label || "Calibri";
  const accent = ACCENTS.find(a => a.id === style.accent)?.hex || "#1F3864";
  const accentHex = accent.replace("#", "");
  const sz = Math.round(style.fontSize * 2);
  const szSm = Math.round((style.fontSize - 1) * 2);

  const escXml = (s) => String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

  const para = (runs, opts = {}) => {
    const spacing = opts.spacingAfter ?? 120;
    const spacingBefore = opts.spacingBefore ?? 0;
    const align = opts.align ?? "left";
    const border = opts.border ?? "";
    const indent = opts.indent ?? "";
    const numXml = opts.bullet ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>` : "";
    return `<w:p><w:pPr>${numXml}<w:spacing w:before="${spacingBefore}" w:after="${spacing}"/><w:jc w:val="${align}"/>${border}${indent}</w:pPr>${runs}</w:p>`;
  };

  const run = (text, opts = {}) => {
    const bold   = opts.bold ? "<w:b/>" : "";
    const italic = opts.italic ? "<w:i/>" : "";
    const size   = opts.size ?? sz;
    const color  = opts.color ?? "auto";
    const colorXml = color !== "auto" ? `<w:color w:val="${color.replace("#","")}"/>` : "";
    const spacing = opts.charSpacing ? `<w:spacing w:val="${opts.charSpacing}"/>` : "";
    return `<w:r><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}"/>${bold}${italic}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${colorXml}${spacing}</w:rPr><w:t xml:space="preserve">${escXml(text)}</w:t></w:r>`;
  };

  let body = "";
  body += para(run(contact.name, { bold: true, size: Math.round(style.fontSize * 2 + 8), color: accentHex, charSpacing: 20 }), { align: "center", spacingAfter: 40 });
  body += para(run(contact.title, { size: sz + 2, italic: true, color: "595959" }), { align: "center", spacingAfter: 60 });
  const contactLine = [contact.location, contact.phone, contact.email].filter(Boolean).join("  |  ");
  body += para(run(contactLine, { size: szSm, color: "595959" }), {
    align: "center", spacingAfter: 200,
    border: `<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="${accentHex}"/></w:pBdr>`,
  });

  for (const section of sections) {
    body += para(run(section.label.toUpperCase(), { bold: true, size: sz + 2, color: accentHex, charSpacing: 40 }), {
      spacingBefore: 180, spacingAfter: 80,
      border: `<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="${accentHex}"/></w:pBdr>`,
    });
    if (section.type === "text") {
      body += para(run(section.content, { size: sz }), { spacingAfter: 100 });
    } else if (section.type === "bullets") {
      for (const item of (section.items || [])) {
        body += para(run(item, { size: sz }), { bullet: true, spacingAfter: 60 });
      }
    } else if (section.type === "jobs") {
      for (const job of (section.jobs || [])) {
        body += para(
          run(job.role, { bold: true, size: sz }) + run(`  ${job.company}`, { size: sz }) +
          `<w:r><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}"/><w:sz w:val="${sz}"/></w:rPr><w:tab/></w:r>` +
          run(job.period, { size: szSm, color: "595959" }),
          { spacingAfter: 60, spacingBefore: 100 }
        );
        for (const b of (job.bullets || [])) {
          body += para(run(b, { size: sz }), { bullet: true, spacingAfter: 40 });
        }
      }
    } else if (section.type === "education") {
      for (const deg of (section.degrees || [])) {
        body += para(
          run(deg.degree, { bold: true, size: sz }) + run(`  •  ${deg.school}`, { size: sz }) + run(`  •  ${deg.location}`, { size: szSm, color: "595959" }),
          { spacingAfter: 40, spacingBefore: 80 }
        );
        body += para(run(deg.period, { size: szSm, italic: true, color: "595959" }), { spacingAfter: 80 });
      }
    }
  }

  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr></w:body></w:document>`;
  const numXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="&#x2022;"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol"/></w:rPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:lang w:val="en-CA"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;
  const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Office Word</Application></Properties>`;
  const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>${escXml(contact.name)}</dc:creator><dc:title>${escXml(contact.title)}</dc:title></cp:coreProperties>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const pkgRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
  return { docXml, numXml, relsXml, stylesXml, appXml, coreXml, contentTypes, pkgRels };
}

async function buildZip(files) {
  const enc = new TextEncoder();
  function crc32(bytes) {
    const table = [];
    for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); table[i] = c; }
    let crc = 0xFFFFFFFF;
    for (const b of bytes) crc = table[(crc ^ b) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function u32le(n) { const b = new Uint8Array(4); b[0]=n&0xFF; b[1]=(n>>8)&0xFF; b[2]=(n>>16)&0xFF; b[3]=(n>>24)&0xFF; return b; }
  function u16le(n) { const b = new Uint8Array(2); b[0]=n&0xFF; b[1]=(n>>8)&0xFF; return b; }
  const entries = []; let offset = 0; const parts = [];
  for (const [name, content] of files) {
    const nameBytes = enc.encode(name); const data = enc.encode(content); const crc = crc32(data);
    const local = new Uint8Array([0x50,0x4B,0x03,0x04,0x14,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,...u32le(crc),...u32le(data.length),...u32le(data.length),...u16le(nameBytes.length),0x00,0x00,...nameBytes]);
    parts.push(local, data); entries.push({ name: nameBytes, crc, size: data.length, offset }); offset += local.length + data.length;
  }
  const central = [];
  for (const e of entries) { const c = new Uint8Array([0x50,0x4B,0x01,0x02,0x14,0x00,0x14,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,...u32le(e.crc),...u32le(e.size),...u32le(e.size),...u16le(e.name.length),0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,...u32le(e.offset),...e.name]); central.push(c); }
  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array([0x50,0x4B,0x05,0x06,0x00,0x00,0x00,0x00,...u16le(entries.length),...u16le(entries.length),...u32le(centralSize),...u32le(offset),0x00,0x00]);
  const allParts = [...parts, ...central, eocd];
  const totalLen = allParts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalLen); let pos = 0;
  for (const p of allParts) { result.set(p, pos); pos += p.length; }
  return result;
}

async function downloadDocx(resume, style) {
  const xmls = generateDocx(resume, style);
  const files = [
    ["[Content_Types].xml", xmls.contentTypes],
    ["_rels/.rels", xmls.pkgRels],
    ["word/document.xml", xmls.docXml],
    ["word/styles.xml", xmls.stylesXml],
    ["word/numbering.xml", xmls.numXml],
    ["word/_rels/document.xml.rels", xmls.relsXml],
    ["docProps/app.xml", xmls.appXml],
    ["docProps/core.xml", xmls.coreXml],
  ];
  const zip = await buildZip(files);
  const blob = new Blob([zip], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `${resume.contact.name.replace(/\s+/g, "_")}_Resume.docx`;
  a.click(); URL.revokeObjectURL(url);
}

function downloadPdf(previewRef) {
  const style = document.createElement("style");
  style.textContent = `@media print { body > * { display: none !important; } #nova-resume-print { display: block !important; position: fixed; inset: 0; z-index: 99999; background: white; } }`;
  document.head.appendChild(style);
  const el = previewRef.current;
  if (el) el.id = "nova-resume-print";
  window.print();
  setTimeout(() => { document.head.removeChild(style); if (el) el.removeAttribute("id"); }, 1000);
}

// ── Live preview (unchanged) ──────────────────────────────────────────────────
const Preview = React.forwardRef(({ resume, style, onEditContact, onEditText, onEditBullet, onEditJob, onEditDegree }, ref) => {
  const font = FONTS.find(f => f.id === style.font)?.css || FONTS[0].css;
  const accent = ACCENTS.find(a => a.id === style.accent)?.hex || "#1F3864";
  const fs = style.fontSize;
  const lh = style.lineHeight;
  const base = { fontFamily: font, fontSize: `${fs}pt`, lineHeight: lh, color: "#1A1A1A" };

  const EditableText = ({ value, onChange, style: extraStyle = {}, multiline }) => {
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(value);
    const inputRef = useRef(null);
    useEffect(() => { setVal(value); }, [value]);
    useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
    if (editing) {
      // iOS Safari auto-zooms the whole page on focus if the focused
      // field's real font-size is under 16px. The resume's own type scale
      // (9–13pt ≈ 12–17px) sits right in that trap, so the moment someone
      // tapped a bullet on their phone the screen would zoom in and never
      // zoom back out on blur. Bumping the *editing* size to 16px (view
      // mode still renders at the true pt size) fixes it without touching
      // the printed/exported output at all.
      const editFontSize = fs * 1.333 < 16 ? "16px" : `${fs}pt`;
      const sharedStyle = { fontFamily: font, fontSize: editFontSize, lineHeight: lh, border: `2px solid ${accent}`, borderRadius: 3, background: `${accent}10`, outline: "none", padding: "1px 3px", width: "100%", boxSizing: "border-box", ...extraStyle };
      if (multiline) return <textarea ref={inputRef} value={val} onChange={e => setVal(e.target.value)} onBlur={() => { onChange(val); setEditing(false); }} rows={Math.max(2, val.split("\n").length)} style={{ ...sharedStyle, resize: "vertical" }} />;
      return <input ref={inputRef} value={val} type="text" onChange={e => setVal(e.target.value)} onBlur={() => { onChange(val); setEditing(false); }} onKeyDown={e => e.key === "Enter" && (onChange(val), setEditing(false))} style={sharedStyle} />;
    }
    return <span onClick={() => setEditing(true)} title="Click to edit" style={{ cursor: "text", borderBottom: "1.5px dashed transparent", WebkitTapHighlightColor: "transparent", touchAction: "manipulation", ...extraStyle, transition: "border-color 0.15s" }} onMouseEnter={e => e.currentTarget.style.borderBottomColor = accent + "60"} onMouseLeave={e => e.currentTarget.style.borderBottomColor = "transparent"}>{val}</span>;
  };

  const SectionHeading = ({ label }) => (
    <div style={{ marginTop: 14, marginBottom: 5 }}>
      <div style={{ fontFamily: font, fontSize: `${fs + 0.5}pt`, fontWeight: "bold", color: accent, letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: `1.5px solid ${accent}`, paddingBottom: 2 }}>{label}</div>
    </div>
  );

  return (
    <div ref={ref} style={{ ...base, background: "white", padding: "22mm 20mm", minHeight: "279mm", width: "216mm", boxSizing: "border-box", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", borderRadius: 2 }}>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <div style={{ fontSize: `${fs + 6}pt`, fontWeight: "bold", color: accent, letterSpacing: "0.04em", marginBottom: 3, fontFamily: font }}>
          <EditableText value={resume.contact.name} onChange={v => onEditContact("name", v)} style={{ fontSize: `${fs + 6}pt`, fontWeight: "bold", color: accent }} />
        </div>
        <div style={{ fontSize: `${fs + 1}pt`, fontStyle: "italic", color: "#595959", marginBottom: 5, fontFamily: font }}>
          <EditableText value={resume.contact.title} onChange={v => onEditContact("title", v)} />
        </div>
        <div style={{ fontSize: `${fs - 1}pt`, color: "#595959", fontFamily: font, borderBottom: `1.5px solid ${accent}`, paddingBottom: 6 }}>
          <EditableText value={resume.contact.location} onChange={v => onEditContact("location", v)} />{"  |  "}
          <EditableText value={resume.contact.phone} onChange={v => onEditContact("phone", v)} />{"  |  "}
          <EditableText value={resume.contact.email} onChange={v => onEditContact("email", v)} />
        </div>
      </div>
      {resume.sections.map((section) => (
        <div key={section.id}>
          <SectionHeading label={section.label} />
          {section.type === "text" && (
            <div style={{ fontFamily: font, fontSize: `${fs}pt`, lineHeight: lh, color: "#2C2C2C" }}>
              <EditableText value={section.content} onChange={v => onEditText(section.id, v)} multiline style={{ display: "block", width: "100%" }} />
            </div>
          )}
          {section.type === "bullets" && (
            <ul style={{ margin: "2px 0 6px", paddingLeft: 20 }}>
              {(section.items || []).map((item, i) => (
                <li key={i} style={{ fontFamily: font, fontSize: `${fs}pt`, lineHeight: lh, color: "#2C2C2C", marginBottom: 2 }}>
                  <EditableText value={item} onChange={v => onEditBullet(section.id, i, v)} />
                </li>
              ))}
            </ul>
          )}
          {section.type === "jobs" && (section.jobs || []).map((job, ji) => (
            <div key={ji} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontFamily: font, fontWeight: "bold", fontSize: `${fs}pt` }}>
                  <EditableText value={job.role} onChange={v => onEditJob(section.id, ji, "role", v)} />
                  <span style={{ fontWeight: "normal", marginLeft: 6, color: "#595959" }}>
                    <EditableText value={job.company} onChange={v => onEditJob(section.id, ji, "company", v)} />
                  </span>
                </div>
                <div style={{ fontFamily: font, fontSize: `${fs - 1}pt`, color: "#595959", whiteSpace: "nowrap" }}>
                  <EditableText value={job.period} onChange={v => onEditJob(section.id, ji, "period", v)} />
                </div>
              </div>
              <ul style={{ margin: "2px 0 4px", paddingLeft: 20 }}>
                {(job.bullets || []).map((b, bi) => (
                  <li key={bi} style={{ fontFamily: font, fontSize: `${fs}pt`, lineHeight: lh, color: "#2C2C2C", marginBottom: 2 }}>
                    <EditableText value={b} onChange={v => onEditBullet(section.id + "_" + ji, bi, v, section.id, ji)} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {section.type === "education" && (section.degrees || []).map((deg, di) => (
            <div key={di} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontFamily: font, fontSize: `${fs}pt` }}>
                  <strong><EditableText value={deg.degree} onChange={v => onEditDegree(section.id, di, "degree", v)} /></strong>
                  <span style={{ color: "#595959", margin: "0 4px" }}>•</span>
                  <EditableText value={deg.school} onChange={v => onEditDegree(section.id, di, "school", v)} />
                  <span style={{ color: "#595959", margin: "0 4px" }}>•</span>
                  <span style={{ color: "#595959" }}><EditableText value={deg.location} onChange={v => onEditDegree(section.id, di, "location", v)} /></span>
                </div>
                <div style={{ fontFamily: font, fontSize: `${fs - 1}pt`, color: "#595959", fontStyle: "italic", whiteSpace: "nowrap" }}>
                  <EditableText value={deg.period} onChange={v => onEditDegree(section.id, di, "period", v)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
});
Preview.displayName = "Preview";

// ── Window width hook ──────────────────────────────────────────────────────────
function useWindowWidth() {
  const [w, setW] = useState(1024);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    fn(); window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return w;
}

// ── Book-flip transition — turns like a page, used when switching "My Resumes" ⇄ "Guest Mode" ──
const FLIP_VARIANTS = {
  enter:  (dir) => ({ rotateY: dir > 0 ? 90 : -90, opacity: 0 }),
  center: { rotateY: 0, opacity: 1, transition: { duration: 0.52, ease: [0.32, 0.72, 0, 1] } },
  exit:   (dir) => ({ rotateY: dir > 0 ? -90 : 90, opacity: 0, transition: { duration: 0.42, ease: [0.32, 0.72, 0, 1] } }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN Resume component
// ═══════════════════════════════════════════════════════════════════════════════
const Resume = ({ onClose }) => {
  // "mine" = pre-built resumes, "guest" = AI wizard
  const [mode,         setMode]         = useState("mine");
  const [flipDir,      setFlipDir]      = useState(1); // 1 = flipping forward (mine→guest), -1 = flipping back
  const [activeResume, setActiveResume] = useState("it");
  const [resumeData,   setResumeData]   = useState(() => JSON.parse(JSON.stringify(RESUMES["it"])));
  const [style,        setStyle]        = useState({ font: "calibri", fontSize: 11, lineHeight: 1.4, accent: "navy" });
  const [panel,        setPanel]        = useState("style");
  const [downloading,  setDownloading]  = useState(null);
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [scale,        setScale]        = useState(1);
  const previewRef = useRef(null);
  const canvasRef  = useRef(null);
  const vw         = useWindowWidth();
  const isMobile   = vw < 700;
  const sidebarW   = 240;
  const A4W        = 816;
  const A4H        = 1056;

  useEffect(() => {
    const compute = () => {
      if (!canvasRef.current) return;
      const available = canvasRef.current.clientWidth - 40;
      setScale(Math.min(1, Math.max(0.3, available / A4W)));
    };
    compute();
    const ro = window.ResizeObserver ? new ResizeObserver(compute) : null;
    if (ro && canvasRef.current) ro.observe(canvasRef.current);
    window.addEventListener("resize", compute);
    return () => { ro?.disconnect(); window.removeEventListener("resize", compute); };
  }, [sidebarOpen, isMobile]);

  const switchResume = (key) => {
    setActiveResume(key);
    setResumeData(JSON.parse(JSON.stringify(RESUMES[key])));
    if (isMobile) setSidebarOpen(false);
  };

  // Drives the book-flip page-turn transition — direction depends on which way we're navigating
  const goToMode = (next) => {
    if (next === mode) return;
    setFlipDir(next === "guest" ? 1 : -1);
    setMode(next);
  };

  const onEditContact  = useCallback((f, v) => setResumeData(r => ({ ...r, contact: { ...r.contact, [f]: v } })), []);
  const onEditText     = useCallback((sid, v) => setResumeData(r => ({ ...r, sections: r.sections.map(s => s.id === sid ? { ...s, content: v } : s) })), []);
  const onEditBullet   = useCallback((key, idx, v, sectionId, jobIdx) => setResumeData(r => ({ ...r, sections: r.sections.map(s => { if (sectionId && s.id === sectionId) { const jobs = s.jobs.map((j, ji) => ji === jobIdx ? { ...j, bullets: j.bullets.map((b, bi) => bi === idx ? v : b) } : j); return { ...s, jobs }; } if (s.id === key && s.items) return { ...s, items: s.items.map((it, i) => i === idx ? v : it) }; return s; }) })), []);
  const onEditJob      = useCallback((sid, ji, f, v) => setResumeData(r => ({ ...r, sections: r.sections.map(s => s.id === sid ? { ...s, jobs: s.jobs.map((j, jj) => jj === ji ? { ...j, [f]: v } : j) } : s) })), []);
  const onEditDegree   = useCallback((sid, di, f, v) => setResumeData(r => ({ ...r, sections: r.sections.map(s => s.id === sid ? { ...s, degrees: s.degrees.map((d, dd) => dd === di ? { ...d, [f]: v } : d) } : s) })), []);

  const handleDownloadDocx = async () => {
    setDownloading("docx");
    try { await downloadDocx(resumeData, style); } finally { setDownloading(null); }
  };
  const handleDownloadPdf = () => {
    setDownloading("pdf");
    setTimeout(() => { downloadPdf(previewRef); setDownloading(null); }, 100);
  };

  const Label = ({ children }) => (
    <p className="m-0 mb-1.5 font-mono text-[9px] tracking-[0.1em] text-muted-foreground/45">{children}</p>
  );

  const scaledW = Math.round(A4W * scale);
  const scaledH = Math.round(A4H * scale);

  // ── Sidebar for "My Resumes" mode ──────────────────────────────────────────
  const SidebarContent = () => (
    <>
      <div role="tablist" aria-label="Panel" className="flex shrink-0 gap-1.5 border-b border-border p-1.5">
        {[{ id: "resumes", Icon: Layers, label: "Templates" }, { id: "style", Icon: Palette, label: "Style" }].map(t => (
          <button key={t.id} role="tab" aria-selected={panel === t.id} onClick={() => setPanel(t.id)}
            className={`flex min-h-[34px] flex-1 items-center justify-center gap-1.5 rounded-md border-none px-1.5 py-2 text-[11px] font-bold transition-colors ${
              panel === t.id ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground"
            }`}>
            <t.Icon size={13} strokeWidth={ICON_STROKE} />
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3.5 [scrollbar-width:none]">
        {panel === "resumes" && (
          <div className="flex flex-col gap-1.5">
            <Label>SELECT RESUME</Label>
            {Object.entries(RESUMES).map(([key, r]) => {
              const active = activeResume === key;
              return (
                <motion.button key={key} whileTap={{ scale: 0.97 }} onClick={() => switchResume(key)}
                  aria-pressed={active}
                  className={`box-border flex w-full min-h-[44px] items-center justify-between gap-2 rounded-xl border px-2.5 py-2.5 text-left ${
                    active ? "border-primary/30 bg-primary/10" : "border-border bg-card"
                  }`}>
                  <div className="min-w-0">
                    <p className={`m-0 text-xs font-semibold ${active ? "text-primary" : "text-foreground"}`}>{r.label}</p>
                    <p className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px] text-muted-foreground">{r.title}</p>
                  </div>
                  {active && (
                    <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-primary">
                      <Check size={11} strokeWidth={2.4} className="text-primary-foreground" />
                    </span>
                  )}
                </motion.button>
              );
            })}
            <div className="mt-2 rounded-xl border border-border bg-card p-2.5">
              <p className="m-0 mb-1 font-mono text-[9px] tracking-[0.08em] text-muted-foreground/45">TIP</p>
              <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">Click any text in the preview to edit it inline.</p>
            </div>
          </div>
        )}
        {panel === "style" && (
          <div className="flex flex-col gap-3.5">
            <div>
              <Label>FONT FAMILY</Label>
              <div className="flex flex-col gap-1">
                {FONTS.map(f => (
                  <button key={f.id} onClick={() => setStyle(s => ({ ...s, font: f.id }))}
                    aria-pressed={style.font === f.id}
                    style={{ fontFamily: f.css }}
                    className={`min-h-10 rounded-lg border px-2.5 py-2 text-left text-xs ${
                      style.font === f.id ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                    }`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>FONT SIZE: {style.fontSize}pt</Label>
              <input type="range" min={9} max={13} step={0.5} value={style.fontSize}
                onChange={e => setStyle(s => ({ ...s, fontSize: parseFloat(e.target.value) }))}
                className="w-full accent-primary" />
              <div className="flex justify-between">
                <span className="font-mono text-[9px] text-muted-foreground/45">9pt</span>
                <span className="font-mono text-[9px] text-muted-foreground/45">13pt</span>
              </div>
            </div>
            <div>
              <Label>LINE SPACING: {style.lineHeight}×</Label>
              <input type="range" min={1.1} max={1.8} step={0.05} value={style.lineHeight}
                onChange={e => setStyle(s => ({ ...s, lineHeight: parseFloat(e.target.value) }))}
                className="w-full accent-primary" />
            </div>
            <div>
              <Label>ACCENT COLOR</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {ACCENTS.map(a => (
                  <button key={a.id} onClick={() => setStyle(s => ({ ...s, accent: a.id }))}
                    aria-pressed={style.accent === a.id}
                    className={`flex min-h-[38px] items-center gap-1.5 rounded-lg border px-2 py-2 ${
                      style.accent === a.id ? "border-primary/30 bg-primary/10" : "border-border bg-card"
                    }`}>
                    <div className="size-[13px] shrink-0 rounded-sm" style={{ background: a.hex }} />
                    <span className={`text-[11px] ${style.accent === a.id ? "text-primary" : "text-muted-foreground"}`}>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );

  // ── Outer stage: gives the two modes a shared 3D space so switching between
  // them reads as turning a page in a book, rather than an abrupt content swap.
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-background [perspective:2200px] [perspective-origin:50%_50%]"
      style={{ bottom: "var(--taskbar-height,52px)" }}>

      <style>{`
        @media print { body * { visibility: hidden; } #nova-resume-print, #nova-resume-print * { visibility: visible; } #nova-resume-print { position: fixed; left: 0; top: 0; width: 100%; } }
      `}</style>

      <AnimatePresence mode="wait" custom={flipDir}>
        {mode === "guest" ? (
          // Guest mode is a fully self-contained, full-screen experience —
          // it owns its own header, preview, and close button.
          <motion.div key="guest" custom={flipDir} variants={FLIP_VARIANTS} initial="enter" animate="center" exit="exit"
            className="absolute inset-0 [backface-visibility:hidden] [transform-style:preserve-3d]">
            {/* Two distinct exits, not one forced one: the X still leaves the
                whole studio (onClose → launcher), while onBack flips back to
                "My Resumes" without ever losing the session. Guest mode's
                own draft/profile autosave means either direction is safe. */}
            <ResumeGuestMode onClose={onClose} onBack={() => goToMode("mine")} />
          </motion.div>
        ) : (
          <motion.div key="mine" custom={flipDir} variants={FLIP_VARIANTS} initial="enter" animate="center" exit="exit"
            className="absolute inset-0 flex flex-col overflow-hidden bg-background font-sans [backface-visibility:hidden] [transform-style:preserve-3d]">

            {/* ── Top bar — two clear rows: identity/actions, then a big tappable mode switch ── */}
            <div className="flex shrink-0 flex-col border-b border-border bg-card">

              <div className="flex min-w-0 items-center justify-between gap-2 px-3.5 pt-3 pb-2">
                <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setSidebarOpen(v => !v)}
                    aria-label={sidebarOpen ? "Hide panel" : "Show panel"} title={sidebarOpen ? "Hide panel" : "Show panel"}
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${
                      sidebarOpen ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground"
                    }`}>
                    <PanelLeft size={16} strokeWidth={ICON_STROKE} />
                  </motion.button>
                  <Logo size={20} style={{ minWidth: 0 }} />
                </div>

                {/* Download buttons — big, labelled, unmissable; collapse to icon-only below 430px so they never overlap the title */}
                <div className="flex shrink-0 items-center gap-2">
                  <motion.button whileTap={!downloading ? { scale: 0.94 } : undefined} onClick={handleDownloadDocx} disabled={!!downloading}
                    aria-label="Download as Word document" title="Download as Word (.docx)"
                    className={`flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-xl border border-primary/25 bg-primary/10 px-3.5 py-2.5 max-[430px]:gap-0 max-[430px]:px-2.5 text-[12.5px] font-bold text-primary ${
                      downloading ? "cursor-not-allowed" : "cursor-pointer"
                    } ${downloading && downloading !== "docx" ? "opacity-45" : ""}`}>
                    <Download size={14} strokeWidth={ICON_STROKE} />
                    <span className="max-[430px]:hidden">{downloading === "docx" ? "Preparing…" : "Word"}</span>
                  </motion.button>
                  <motion.button whileTap={!downloading ? { scale: 0.94 } : undefined} onClick={handleDownloadPdf} disabled={!!downloading}
                    aria-label="Download as PDF" title="Download as PDF"
                    className={`flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-xl border border-destructive/25 bg-destructive/10 px-3.5 py-2.5 max-[430px]:gap-0 max-[430px]:px-2.5 text-[12.5px] font-bold text-destructive ${
                      downloading ? "cursor-not-allowed" : "cursor-pointer"
                    } ${downloading && downloading !== "pdf" ? "opacity-45" : ""}`}>
                    <Download size={14} strokeWidth={ICON_STROKE} />
                    <span className="max-[430px]:hidden">{downloading === "pdf" ? "Preparing…" : "PDF"}</span>
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.88 }} onClick={onClose} aria-label="Close Noviq" title="Close"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                    <X size={16} strokeWidth={ICON_STROKE} />
                  </motion.button>
                </div>
              </div>

              {/* Mode switcher — full-width segmented control, sliding highlight, labels always on */}
              <div role="tablist" aria-label="Resume mode" className="mx-3.5 mb-3 flex gap-1 rounded-2xl border border-border bg-card p-1">
                {[{ id: "mine", label: "My Resumes", Icon: FileText }, { id: "guest", label: "Guest Mode · AI", Icon: Sparkle }].map(m => (
                  <button key={m.id} role="tab" aria-selected={mode === m.id} onClick={() => goToMode(m.id)}
                    className={`relative flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border-none px-2.5 py-2.5 text-[13px] font-bold ${
                      mode === m.id ? "text-primary-foreground" : "text-muted-foreground"
                    }`}>
                    {mode === m.id && (
                      <motion.span layoutId="modePill" transition={{ type: "spring", damping: 26, stiffness: 320 }}
                        className="absolute inset-0 z-0 rounded-xl bg-primary" />
                    )}
                    <span className="relative z-10 flex">
                      <m.Icon size={14} strokeWidth={ICON_STROKE} />
                    </span>
                    <span className="relative z-10">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Body ── */}
            <div className="relative flex flex-1 overflow-hidden">
              <AnimatePresence>
                {(!isMobile || sidebarOpen) && (
                  <motion.div
                    initial={isMobile ? { x: -sidebarW } : false}
                    animate={{ x: 0 }} exit={{ x: -sidebarW }}
                    transition={{ type: "spring", damping: 28, stiffness: 300 }}
                    style={{ width: sidebarW }}
                    className={`top-0 bottom-0 left-0 flex shrink-0 flex-col border-r border-border bg-card ${
                      isMobile ? "absolute z-10" : "relative z-[1]"
                    }`}>
                    <SidebarContent />
                  </motion.div>
                )}
              </AnimatePresence>
              {isMobile && sidebarOpen && (
                <div onClick={() => setSidebarOpen(false)}
                  className="absolute inset-0 z-[9] bg-black/50 backdrop-blur-[2px]" />
              )}
              <div ref={canvasRef} className="flex flex-1 flex-col items-center overflow-y-auto bg-[#D0D0D0] px-0 pt-5 pb-10 [scrollbar-width:thin]">
                <div className="mb-2.5 font-mono text-[9px] tracking-[0.08em] text-[#888]">
                  {Math.round(scale * 100)}% · Click any text to edit
                </div>
                <div style={{ width: scaledW, height: scaledH }} className="relative shrink-0">
                  <div style={{ width: A4W, height: A4H, transform: `scale(${scale})` }} className="absolute top-0 left-0 origin-top-left shadow-[0_4px_32px_rgba(0,0,0,0.3)]">
                    <Preview ref={previewRef} resume={resumeData} style={style}
                      onEditContact={onEditContact} onEditText={onEditText}
                      onEditBullet={onEditBullet} onEditJob={onEditJob} onEditDegree={onEditDegree} />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Resume;