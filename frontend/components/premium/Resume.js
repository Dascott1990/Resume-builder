"use client";
/**
 * Resume.js — Noqeev Studio + Guest Mode
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
import { toast } from "sonner";
import { Layers, Palette, Check, PanelLeft, FileText, Sparkle, Download, X } from "lucide-react";
import ResumeGuestMode from "./guest";
import { printPdf } from "./shared/printPdf";
import { ResumeDocument } from "./shared/ResumeDocument";
import { LAYOUTS } from "./shared/resumeLayouts/registry";
import { FONTS, ACCENTS } from "./guest/constants";
import { downloadDocx } from "./guest/export/docx";
import Logo from "./Logo";
import Flag3D from "./flag/Flag3D";
import { useCountryDetect } from "@/lib/useCountryDetect";
import { COUNTRY_NAMES } from "@/lib/countryTemplates";
import { loadMyResumeDraft, saveMyResumeDraft } from "./myResumeDraft";
import { getVariantsForCountry, buildResumeFromTemplate } from "./shared/templateLibrary";

// This file's icons were drawn at a slightly thinner default stroke (1.6 vs
// lucide's default of 2) — preserved here so nothing on screen shifts.
const ICON_STROKE = 1.6;

// ── The four pre-built resumes — moved to shared/prebuiltResumes.js so the
// landing page's real-example showcase can reuse this same data without
// pulling this whole file's dependency tree into the marketing bundle.
// A real import, not just a re-export — this file uses RESUMES directly
// below (a bare `export { X } from "..."` re-export does NOT bind a local
// `X`, it only forwards the name to whoever imports it from THIS file, so
// every use of RESUMES below was throwing "RESUMES is not defined" and
// crashing the whole editor the instant it mounted). Re-exported too,
// since nothing outside this file currently needs it that way, but it did
// before (SeeItHappenSection.js now imports it straight from
// shared/prebuiltResumes.js instead) — keeping it costs nothing.
import { RESUMES } from "./shared/prebuiltResumes";
export { RESUMES };

const REGION_GROUPS = [
  { label: "CANADA · CURRENT FORMAT", keys: ["it", "grocery", "admin", "popeye"] },
  { label: "INTERNATIONAL FORMATS", keys: ["usa", "uk", "germany", "france", "africa"] },
];

const MODE_TABS = [
  { id: "mine", label: "My Resumes", Icon: FileText },
  { id: "guest", label: "Guest Mode · AI", Icon: Sparkle },
];

// PDF export now goes through the same shared printPdf() Guest Mode AI
// uses (components/premium/shared/printPdf.js) — this used to be its own
// primitive here, tagging the preview element for a static print-only
// `visibility` rule elsewhere in this component's JSX. That rule never
// reset the preview's own on-screen scale-down transform/fixed size/
// overflow-hidden, so a printed page came out scaled and clipped to
// whatever the on-screen preview happened to be, not true page size. The
// shared version walks the real ancestor chain and resets all of that
// before printing, plus now also handles multiple page-sheets correctly
// (one physical page per sheet) now that this preview can paginate.
function downloadPdf(previewRef) {
  printPdf(previewRef.current);
}

// ── Live preview ─────────────────────────────────────────────────────────────
const LETTER_WIDTH_PX = 816;
const LETTER_HEIGHT_PX = 1056;
const PREVIEW_PAD_Y_MM = 22;
const PREVIEW_PAD_X_MM = 20;

// A thin wrapper around the shared renderer now (see shared/ResumeDocument.js
// and shared/resumeLayouts/ for why: this and Guest Mode's own LivePreview.js
// used to each hand-build the exact same layout independently, which is
// exactly the kind of triple-maintenance that's caused repeat bugs this
// session). Letter-sized pages and this component's own page-sheet chrome
// (heavier shadow, sharp corners) are the two things that intentionally stay
// different from Guest Mode's A4 pages — passed in, not hardcoded upstream.
const Preview = React.forwardRef(({ resume, style, scale = 1, onEdit }, ref) => (
  <ResumeDocument
    ref={ref} resume={resume} style={style} onEdit={onEdit} scale={scale}
    pageWidth={LETTER_WIDTH_PX} pageHeight={LETTER_HEIGHT_PX}
    paddingXMm={PREVIEW_PAD_X_MM} paddingYMm={PREVIEW_PAD_Y_MM}
    shadowClassName="shadow-[0_8px_40px_rgba(0,0,0,0.18)]"
    className="rounded-[2px]"
  />
));
Preview.displayName = "Preview";

// ── Window width hook ──────────────────────────────────────────────────────────
function useWindowWidth() {
  // Lazy-initialized from the real width, not a hardcoded 1024 — this
  // component is ssr:false-loaded so window is always present by the
  // time it renders. A hardcoded desktop-sized default made isMobile
  // false for the whole first render on an actual mobile device (fixed
  // only once this hook's own effect ran, one tick after mount), which
  // in turn made Resume.js's sidebar render unconditionally for that
  // first frame regardless of sidebarOpen's own value.
  const [w, setW] = useState(() => (typeof window === "undefined" ? 1024 : window.innerWidth));
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
const Resume = ({ onClose, pendingImport, pendingJobDesc, pendingLoadResumeId, pendingViewAllResumes }) => {
  // Read once, synchronously, before first render — same pattern as
  // GuestMode.js's own draftAtMount — so the initial useState value is
  // already correct instead of flashing the default template for one
  // frame before an effect corrects it.
  const draftAtMount = useRef(loadMyResumeDraft()).current;

  // "mine" = pre-built resumes, "guest" = AI wizard — a CV scan result (or
  // a job description handed off by the "tailor for this job" bookmarklet)
  // lives in the wizard, so land there directly instead of on the
  // pre-built list someone would just have to click past. Same for
  // pendingViewAllResumes ("View all" on Dashboard's Recent resumes) — the
  // actual saved-resumes list lives inside Guest Mode (its own "templates"
  // tab, see GuestMode.js), never inside "mine" (which despite the name is
  // the 4 pre-built templates, not anything the user saved). Falls back to
  // the restored draft's own mode only when none of those apply.
  const [mode,         setMode]         = useState(() => (pendingImport || pendingJobDesc || pendingLoadResumeId || pendingViewAllResumes) ? "guest" : (draftAtMount?.mode || "mine"));
  const [flipDir,      setFlipDir]      = useState(1); // 1 = flipping forward (mine→guest), -1 = flipping back
  const [activeResume, setActiveResume] = useState(() => draftAtMount?.activeResume || "it");
  // Which country's structure library the Templates panel browses — separate
  // from the legacy auto-detected RESUMES[key] below, since this picks a
  // whole COUNTRY (to browse its ~20 formats), not one specific resume.
  const [pickerCountry, setPickerCountry] = useState(() => draftAtMount?.pickerCountry || "CA");
  const [resumeData,   setResumeData]   = useState(() => draftAtMount?.resumeData || JSON.parse(JSON.stringify(RESUMES["it"])));
  const [style,        setStyle]        = useState(() => draftAtMount?.style || { font: "calibri", fontSize: 11, lineHeight: 1.4, accent: "navy", layout: "classic" });
  const [panel,        setPanel]        = useState("style");
  const [downloading,  setDownloading]  = useState(null);
  // Lazy-initialized from the real viewport width (this component is
  // ssr:false-loaded — window is always present by the time it renders) —
  // NOT a plain `true` default. useWindowWidth() below only settles its
  // first real reading inside an effect, one render after mount, so a
  // `true` default here made the style sidebar cover the resume preview
  // on mobile for that first frame, and stay that way until whichever
  // resolved first: the resize effect, or the async country-detect
  // effect's own switchResume() call closing it as a side effect.
  const [sidebarOpen,  setSidebarOpen]  = useState(() => typeof window === "undefined" ? true : window.innerWidth >= 700);
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
    // A single post-paint measurement can land before the browser has
    // fully settled layout on a real (slower) mobile device — e.g. a
    // webfont swapping in after this effect's first run. When that
    // happens the canvas gets measured wrong once and then never
    // rechecked, since nothing else in this effect's dependencies
    // changes on its own — the resume renders unscaled (looks "zoomed
    // in") until something unrelated, like toggling the sidebar, just
    // happens to re-run this effect. These two catch that without
    // needing that manual nudge.
    const raf = requestAnimationFrame(() => requestAnimationFrame(compute));
    document.fonts?.ready?.then(compute).catch(() => {});
    const ro = window.ResizeObserver ? new ResizeObserver(compute) : null;
    if (ro && canvasRef.current) ro.observe(canvasRef.current);
    window.addEventListener("resize", compute);
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); window.removeEventListener("resize", compute); };
  }, [sidebarOpen, isMobile]);

  // Mirrors GuestMode.js's own debounced draft save exactly — 300ms so
  // rapid-fire typing doesn't hit localStorage on every keystroke, just
  // once things settle.
  const draftSaveTimer = useRef(null);
  useEffect(() => {
    clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      saveMyResumeDraft({ mode, activeResume, resumeData, style, pickerCountry });
    }, 300);
    return () => clearTimeout(draftSaveTimer.current);
  }, [mode, activeResume, resumeData, style, pickerCountry]);

  const switchResume = (key) => {
    setActiveResume(key);
    setResumeData(JSON.parse(JSON.stringify(RESUMES[key])));
    if (isMobile) setSidebarOpen(false);
  };

  // Same idea as switchResume, but for the country-specific structure
  // library (templateLibrary.js) instead of the 9 legacy static resumes —
  // built on demand rather than looked up, since there are 20 of these per
  // country rather than a small fixed set.
  const switchToVariant = (variantId) => {
    const built = buildResumeFromTemplate(pickerCountry, variantId);
    if (!built) return;
    setActiveResume(variantId);
    setResumeData(built);
    if (isMobile) setSidebarOpen(false);
  };

  // Auto-picks the resume format that matches where the visitor actually
  // is — once, ever, per browser. After that first visit their own choice
  // wins; this only ever sets the *starting point*, never overrides a
  // format someone's already sitting on.
  const { countryCode, templateKey: detectedTemplateKey, resolved: countryResolved } = useCountryDetect();
  useEffect(() => {
    if (!countryResolved || !detectedTemplateKey || !countryCode) return;
    let alreadyShown = false;
    try { alreadyShown = localStorage.getItem("noqeev_auto_template_shown") === "1"; } catch { /* best-effort */ }
    if (alreadyShown) return;
    switchResume(detectedTemplateKey);
    try { localStorage.setItem("noqeev_auto_template_shown", "1"); } catch { /* best-effort */ }
    const countryName = COUNTRY_NAMES[countryCode] || "your region";
    toast(`Looks like you're in ${countryName} — this is the resume format you'll be seeing.`, {
      description: "Browse Templates any time for Canada, USA, UK, Germany, France, or Nigeria & Ghana instead.",
      duration: 6000,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryResolved, detectedTemplateKey, countryCode]);

  // Drives the book-flip page-turn transition — direction depends on which way we're navigating
  const goToMode = (next) => {
    if (next === mode) return;
    setFlipDir(next === "guest" ? 1 : -1);
    setMode(next);
  };

  // One unified onEdit(kind, ...args, value), same interface Guest Mode's
  // own onEditHandler (guest/guestReducer.js) already used — replaces the
  // five separate handlers this used to carry, which is what let
  // Preview/LivePreview.js's rendering logic unify into shared/
  // ResumeDocument.js in the first place (see that file's own comment).
  const onEdit = useCallback((kind, ...args) => {
    const val = args[args.length - 1];
    setResumeData((r) => {
      const s = JSON.parse(JSON.stringify(r));
      switch (kind) {
        case "contact": { const [key] = args; s.contact[key] = val; break; }
        case "section-text": { const [si] = args; s.sections[si].content = val; break; }
        case "bullet": { const [si, ii] = args; s.sections[si].items[ii] = val; break; }
        case "job-role": { const [si, ji] = args; s.sections[si].jobs[ji].role = val; break; }
        case "job-company": { const [si, ji] = args; s.sections[si].jobs[ji].company = val; break; }
        case "job-location": { const [si, ji] = args; s.sections[si].jobs[ji].location = val; break; }
        case "job-period": { const [si, ji] = args; s.sections[si].jobs[ji].period = val; break; }
        case "job-bullet": { const [si, ji, bi] = args; s.sections[si].jobs[ji].bullets[bi] = val; break; }
        case "deg-degree": { const [si, di] = args; s.sections[si].degrees[di].degree = val; break; }
        case "deg-school": { const [si, di] = args; s.sections[si].degrees[di].school = val; break; }
        case "deg-location": { const [si, di] = args; s.sections[si].degrees[di].location = val; break; }
        case "deg-period": { const [si, di] = args; s.sections[si].degrees[di].period = val; break; }
        default: break;
      }
      return s;
    });
  }, []);

  const handleDownloadDocx = async () => {
    setDownloading("docx");
    try { await downloadDocx(resumeData, style, `${resumeData.contact.name.replace(/\s+/g, "_")}_Resume.docx`); } finally { setDownloading(null); }
  };
  const handleDownloadPdf = () => {
    setDownloading("pdf");
    setTimeout(() => { downloadPdf(previewRef); setDownloading(null); }, 100);
  };

  const Label = ({ children }) => (
    <p className="m-0 mb-1.5 font-mono text-[9px] tracking-[0.1em] text-muted-foreground/45">{children}</p>
  );

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
            {/* Not just a badge — an actual little flag going up its pole.
                Purely informational (switching template is still a manual
                click below), but a fun way to say "here's why we picked
                this one for you" instead of a dry settings line. */}
            {countryCode && (
              <div className="mb-1 flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
                <div className="size-14 shrink-0">
                  <Flag3D countryCode={countryCode} style={{ width: "100%", height: "100%" }} />
                </div>
                <div className="min-w-0">
                  <p className="m-0 font-mono text-[9px] tracking-[0.08em] text-muted-foreground/45">DETECTED LOCATION</p>
                  <p className="m-0 text-xs font-semibold text-foreground">{COUNTRY_NAMES[countryCode] || countryCode}</p>
                </div>
              </div>
            )}
            {/* Country + structure picker (templateLibrary.js) — plain-
                language persona questions ("I'm just starting out," "I'm
                switching careers"), never format jargon, so picking the
                right one doesn't require already knowing what a
                "reverse-chronological" resume is. */}
            <div>
              <Label>BROWSE FORMATS FOR</Label>
              <div className="mb-2 flex gap-1.5">
                {[{ code: "CA", name: "Canada" }, { code: "US", name: "United States" }].map((c) => (
                  <button key={c.code} type="button" onClick={() => setPickerCountry(c.code)}
                    aria-pressed={pickerCountry === c.code}
                    className={`flex-1 rounded-lg border px-2.5 py-2 text-center text-xs font-semibold ${
                      pickerCountry === c.code ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                    }`}>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
            {Object.entries(
              getVariantsForCountry(pickerCountry).reduce((groups, v) => {
                (groups[v.group] ||= []).push(v);
                return groups;
              }, {})
            ).map(([groupLabel, variants]) => (
              <div key={groupLabel} className="mb-1 flex flex-col gap-1.5">
                <Label>{groupLabel.toUpperCase()}</Label>
                {variants.map((v) => {
                  const active = activeResume === v.id;
                  return (
                    <motion.button key={v.id} whileTap={{ scale: 0.97 }} onClick={() => switchToVariant(v.id)}
                      aria-pressed={active}
                      className={`box-border flex w-full min-h-[44px] items-center justify-between gap-2 rounded-xl border px-2.5 py-2.5 text-left ${
                        active ? "border-primary/30 bg-primary/10" : "border-border bg-card"
                      }`}>
                      <div className="min-w-0">
                        <p className={`m-0 text-xs font-semibold ${active ? "text-primary" : "text-foreground"}`}>{v.label}</p>
                        <p className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[10.5px] text-muted-foreground">{v.persona}</p>
                      </div>
                      {active && (
                        <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-primary">
                          <Check size={11} strokeWidth={2.4} className="text-primary-foreground" />
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            ))}
            {/* Grouped, not a flat list — the whole point of adding the
                international formats was to make each one's convention
                (or lack of one — no DOB/photo in the US/UK, named referees
                in Nigeria & Ghana, tabular Persönliche Daten in Germany)
                obvious at a glance, not something you find out only after
                clicking in. */}
            <Label>OTHER FORMATS</Label>
            {REGION_GROUPS.map((group) => (
              <div key={group.label} className="mb-1 flex flex-col gap-1.5">
                <Label>{group.label}</Label>
                {group.keys.map((key) => {
                  const r = RESUMES[key];
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
              </div>
            ))}
            <div className="mt-1 rounded-xl border border-border bg-card p-2.5">
              <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">Click text to edit</p>
            </div>
          </div>
        )}
        {panel === "style" && (
          <div className="flex flex-col gap-3.5">
            <div>
              <Label>LAYOUT</Label>
              <div className="flex flex-col gap-1.5">
                {LAYOUTS.map(l => (
                  <button key={l.id} onClick={() => setStyle(s => ({ ...s, layout: l.id }))}
                    aria-pressed={(style.layout || "classic") === l.id}
                    className={`min-h-[52px] rounded-lg border px-2.5 py-2 text-left ${
                      (style.layout || "classic") === l.id ? "border-primary/30 bg-primary/10" : "border-border bg-card"
                    }`}>
                    <p className={`m-0 text-xs font-bold ${(style.layout || "classic") === l.id ? "text-primary" : "text-foreground"}`}>{l.label}</p>
                    <p className="m-0 mt-0.5 text-[10.5px] text-muted-foreground">{l.description}</p>
                  </button>
                ))}
              </div>
            </div>
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
            <ResumeGuestMode onClose={onClose} onBack={() => goToMode("mine")} pendingImport={pendingImport} pendingJobDesc={pendingJobDesc} pendingLoadResumeId={pendingLoadResumeId} pendingViewAllResumes={pendingViewAllResumes} />
          </motion.div>
        ) : (
          <motion.div key="mine" custom={flipDir} variants={FLIP_VARIANTS} initial="enter" animate="center" exit="exit"
            className="absolute inset-0 flex flex-col overflow-hidden bg-background font-sans [backface-visibility:hidden] [transform-style:preserve-3d]">

            {/* ── Top bar — two clear rows: identity/actions, then a big tappable mode switch ── */}
            <div className="flex shrink-0 flex-col border-b border-border bg-card">

              <div
                className="flex min-w-0 items-center justify-between gap-2 px-3.5 pb-2"
                style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
              >
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
                    className={`flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-xl border border-border bg-muted px-3.5 py-2.5 max-[430px]:gap-0 max-[430px]:px-2.5 text-[12.5px] font-bold text-foreground ${
                      downloading ? "cursor-not-allowed" : "cursor-pointer"
                    } ${downloading && downloading !== "pdf" ? "opacity-45" : ""}`}>
                    <Download size={14} strokeWidth={ICON_STROKE} />
                    <span className="max-[430px]:hidden">{downloading === "pdf" ? "Preparing…" : "PDF"}</span>
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.88 }} onClick={onClose} aria-label="Close Noqeev" title="Close"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                    <X size={16} strokeWidth={ICON_STROKE} />
                  </motion.button>
                </div>
              </div>

              {/* Mode switcher — full-width segmented control, sliding highlight, labels always on.
                  The pill's position is driven by plain index-based `left`/`width`, not
                  `layoutId` — this switcher lives inside the "mine" tree that the 3D flip
                  AnimatePresence above unmounts on every mode change, and a `layoutId`
                  element torn out of framer-motion's shared projection tree mid-registration
                  stalls its global animation loop for the whole page (every motion value,
                  including the flip's own opacity/rotateY, freezes mid-transition — a blank
                  screen that never recovers). Index-driven left/width has no cross-component
                  state to leave dangling. */}
              <div role="tablist" aria-label="Resume mode" className="relative mx-3.5 mb-3 flex gap-1 rounded-2xl border border-border bg-card p-1">
                <motion.span
                  animate={{ left: `${(MODE_TABS.findIndex(m => m.id === mode) * 100) / MODE_TABS.length}%` }}
                  transition={{ type: "spring", damping: 26, stiffness: 320 }}
                  style={{ width: `${100 / MODE_TABS.length}%` }}
                  className="absolute top-1 bottom-1 z-0 rounded-xl bg-primary"
                />
                {MODE_TABS.map(m => (
                  <button key={m.id} role="tab" aria-selected={mode === m.id} onClick={() => goToMode(m.id)}
                    className={`relative flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border-none px-2.5 py-2.5 text-[13px] font-bold ${
                      mode === m.id ? "text-primary-foreground" : "text-muted-foreground"
                    }`}>
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
                {/* Preview now owns its own page sizing/scaling and can
                    render more than one sheet — see its own comment for
                    why that responsibility moved in from out here. */}
                <Preview ref={previewRef} resume={resumeData} style={style} scale={scale} onEdit={onEdit} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Resume;