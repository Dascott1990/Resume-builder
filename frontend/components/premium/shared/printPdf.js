// ── PDF: text-based via browser print (preserves selectable text) ─────────────
// We inject a dedicated print stylesheet and isolate the preview element.
// Result: clean text PDF — every word is selectable and copyable.
//
// Shared by both editors ("My Resumes" and Guest Mode AI) — previewEl is now
// the multi-page container from usePaginatedBlocks (a flex column of one or
// more ResumePageSheet instances), not a single page div, so on top of the
// existing ancestor-chain isolation this also has to undo each sheet's own
// on-screen scale-down transform and force one physical page per sheet.
export function printPdf(previewEl) {
  if (!previewEl) return;
  const PRINT_ID    = "__resume_pdf_print__";
  const HIDE_CLASS  = "__resume_print_hide__";
  const RESET_ATTR  = "data-print-reset";

  // previewEl (the resume) is nested several levels deep inside the scaled,
  // scrollable preview canvas — NOT a direct child of <body>. Walk the real
  // ancestor chain from previewEl up to <body> so we hide the correct
  // siblings at each level, instead of hiding every child of body (which
  // would hide the resume's own ancestors too, and print a blank page).
  const chain = [];
  for (let node = previewEl; node && node !== document.body; node = node.parentElement) {
    chain.push(node);
  }
  chain.push(document.body);

  const resetEls = [];
  for (let i = chain.length - 1; i > 0; i--) {
    const ancestor = chain[i];
    const keep     = chain[i - 1];
    Array.from(ancestor.children).forEach((sib) => {
      if (sib !== keep) sib.classList.add(HIDE_CLASS);
    });
    // The on-screen preview scales this element down and clips/scrolls it
    // (transform, fixed width/height, overflow) to fit the panel — none of
    // that should apply when printing the full-size page.
    if (ancestor !== document.body) {
      ancestor.setAttribute(RESET_ATTR, "1");
      resetEls.push(ancestor);
    }
  }
  previewEl.id = PRINT_ID;

  const style = document.createElement("style");
  style.id    = "__resume_print_style__";
  style.textContent = `
    @media print {
      body { margin: 0 !important; padding: 0 !important; background: white !important; }
      .${HIDE_CLASS} { display: none !important; }
      [${RESET_ATTR}] {
        display: block !important; position: static !important; transform: none !important;
        width: auto !important; height: auto !important; max-height: none !important;
        overflow: visible !important; padding: 0 !important; box-shadow: none !important;
      }
      #${PRINT_ID} { display: block !important; position: static !important;
                 transform: none !important; box-shadow: none !important;
                 border-radius: 0 !important; width: 100% !important; }
      /* Each page's own sizing wrapper (ResumePageSheet's outer div, scaled
         down for on-screen display via width/height in px) — let it size to
         its real content instead of the shrunk on-screen box. */
      #${PRINT_ID} > div { width: auto !important; height: auto !important; overflow: visible !important; }
      /* The actual page — ResumePageSheet's inner .resume-page-sheet div —
         carries the on-screen scale-down transform and absolute positioning;
         both need to go so it prints at true physical size in normal flow.
         One physical printed page per sheet, with no trailing blank page
         after the last one. */
      #${PRINT_ID} .resume-page-sheet {
        position: static !important; transform: none !important;
        box-shadow: none !important; break-after: page;
      }
      #${PRINT_ID} > div:last-child .resume-page-sheet { break-after: auto !important; }
    }
  `;
  document.head.appendChild(style);
  window.print();

  setTimeout(() => {
    document.querySelectorAll(`.${HIDE_CLASS}`).forEach((el) => el.classList.remove(HIDE_CLASS));
    resetEls.forEach((el) => el.removeAttribute(RESET_ATTR));
    previewEl.removeAttribute("id");
    const s = document.getElementById("__resume_print_style__");
    if (s) document.head.removeChild(s);
  }, 1500);
}

// ── Cover letter PDF — same print-to-PDF trick, but the cover letter has no
// on-screen preview element, so we build one purely for printing: a plain
// letter page appended to <body>, everything else hidden, then removed.
export function printCoverLetterPdf(coverLetter, contact) {
  if (!coverLetter) return;
  const PRINT_ID   = "__cover_letter_pdf_print__";
  const HIDE_CLASS = "__cl_print_hide__";

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  const toHide = Array.from(document.body.children);
  toHide.forEach((el) => el.classList.add(HIDE_CLASS));

  const page = document.createElement("div");
  page.id = PRINT_ID;
  page.style.cssText = [
    "width:8.5in", "min-height:11in", "margin:0 auto", "padding:1in",
    "background:#fff", "color:#1a1a1a",
    "font-family:Georgia,'Times New Roman',serif", "font-size:12pt",
    "line-height:1.6", "white-space:pre-wrap", "box-sizing:border-box",
  ].join(";");

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const headerBits = [contact?.name, contact?.email, contact?.phone, contact?.location].filter(Boolean).join("  |  ");

  page.innerHTML = `
    ${contact?.name ? `<div style="font-weight:bold;margin-bottom:4px;">${esc(contact.name)}</div>` : ""}
    ${headerBits ? `<div style="font-size:10.5pt;color:#555;margin-bottom:26px;">${esc(headerBits)}</div>` : ""}
    <div style="margin-bottom:26px;">${esc(today)}</div>
    <div>${esc(coverLetter)}</div>
  `;
  document.body.appendChild(page);

  const style = document.createElement("style");
  style.id = "__cover_letter_print_style__";
  style.textContent = `
    @media print {
      body { margin: 0 !important; padding: 0 !important; background: white !important; }
      .${HIDE_CLASS} { display: none !important; }
      #${PRINT_ID} { display: block !important; }
    }
  `;
  document.head.appendChild(style);
  window.print();

  setTimeout(() => {
    toHide.forEach((el) => el.classList.remove(HIDE_CLASS));
    if (page.parentNode) document.body.removeChild(page);
    const s = document.getElementById("__cover_letter_print_style__");
    if (s) document.head.removeChild(s);
  }, 1500);
}
