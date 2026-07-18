"use client";
/**
 * ResumeGuestMode.js — app/components/premium/ResumeGuestMode.js
 *
 * Standalone guest resume builder.
 * - 2-step wizard: info → job description → AI generates
 * - Live editable preview (click any text)
 * - Download as real .docx (editable in Word/Google Docs) via docx npm package
 * - Download as real text PDF via jsPDF (selectable, copyable text — NOT raster)
 * - "Guest Templates" tab: all previously generated resumes, reload & re-download any
 * - Saves to backend: POST /api/v1/resume/generate (Groq)
 *
 * Props: { onClose }
 */

import React, {
  useState, useEffect, useRef, useCallback, useReducer
} from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Constants ──────────────────────────────────────────────────────────────────
// Must match the port run.py actually listens on (5002) and be inside
// ALLOWED_ORIGINS on the backend, or every request will fail before it starts.
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5002";

const ACCENTS = [
  { id: "navy",   hex: "#1F3864", label: "Navy"    },
  { id: "black",  hex: "#1A1A1A", label: "Classic" },
  { id: "teal",   hex: "#0D5C6B", label: "Teal"    },
  { id: "forest", hex: "#1E4D2B", label: "Forest"  },
  { id: "wine",   hex: "#6B1A3A", label: "Wine"    },
  { id: "steel",  hex: "#2C4A6B", label: "Steel"   },
];

const FONTS = [
  { id: "calibri",   label: "Calibri",         css: "Calibri, 'Gill Sans', sans-serif" },
  { id: "times",     label: "Times New Roman",  css: "'Times New Roman', Times, serif" },
  { id: "arial",     label: "Arial",            css: "Arial, Helvetica, sans-serif" },
  { id: "garamond",  label: "Garamond",         css: "Garamond, 'EB Garamond', Georgia, serif" },
  { id: "georgia",   label: "Georgia",          css: "Georgia, 'Times New Roman', serif" },
  { id: "helvetica", label: "Helvetica",        css: "Helvetica, Arial, sans-serif" },
];

const DEFAULT_STYLE = { accent: "navy", fontSize: 11, lineHeight: 1.4, font: "calibri" };

// ── Draft persistence ────────────────────────────────────────────────────────
// Everything below was previously only in React state, so any refresh wiped
// the in-progress build — form fields, the generated resume, cover letter,
// interview tips, apply info, all of it. This mirrors the current draft to
// localStorage (best-effort; a full/blocked storage just means no restore,
// never a crash) and reads it back once on mount.
const DRAFT_KEY = "resumeBuilder:draft:v1";

function loadDraft() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearDraft() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* best-effort */ }
}

// ── Design tokens ──────────────────────────────────────────────────────────────
// One accent (gold, matches the actual resume ink) — everything else is neutral.
// Colour shows up as a rule, a dot, or a weight change, never a tinted bg+border pair.
const C = {
  bg:      "#0C0D10",
  panel:   "#111318",
  surface: "#15171D",
  raised:  "#1B1E26",
  border:  "rgba(255,255,255,0.10)",
  borderHi:"rgba(255,255,255,0.22)",
  text:    "#F5F2EA",
  muted:   "#A6ABB4",
  faint:   "rgba(166,171,180,0.72)",
  gold:    "#C9A24E",
  goldFg:  "#1A1710",
  red:     "#E0796A",
  green:   "#8FBF8A",
  sans:    "'Helvetica Neue',Arial,sans-serif",
  serif:   "'Iowan Old Style','Palatino Linotype',Georgia,serif",
  mono:    "'SF Mono','JetBrains Mono','Courier New',monospace",
};
// App-shell type scale — bigger than a resume's own type scale on purpose:
// this is the interface people tap and read quickly, not the printed page.
const TS = { label: 14, body: 16, meta: 13, title: 19, nav: 12.5 };

// ── Lucide-style icons (named, readable) ────────────────────────────────────
// Each icon is a complete, recognisable SVG path from Lucide icon set
const ICONS = {
  // Navigation & actions
  ChevronLeft:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>,
  ChevronRight: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>,
  X:            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  Check:        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  Plus:         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  Trash2:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>,
  RefreshCw:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>,
  // Files
  FileText:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>,
  FileDown:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3"/></svg>,
  // UI
  Layout:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/><path d="M3 9h18M9 21V9"/></svg>,
  Sparkles:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3z"/></svg>,
  User:         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Clipboard:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>,
  Tag:          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  MapPin:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Eye:          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  AlertCircle:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  Settings2:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7H4M20 12H4M20 17H4"/></svg>,
  Gear:         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Mail:         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
  Globe:        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  ExternalLink: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>,
};

function Icon({ name, size = 16, color = "currentColor" }) {
  return (
    <span style={{ width: size, height: size, display: "inline-flex",
      alignItems: "center", justifyContent: "center", flexShrink: 0,
      color, fontSize: size }}>
      {React.cloneElement(ICONS[name] || ICONS.AlertCircle, {
        width: size, height: size,
      })}
    </span>
  );
}

// ── Responsive viewport hook — tracks real width, updates on resize/rotate ────
function useViewport() {
  const [w, setW] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1280));
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);
  return {
    width: w,
    isPhone:   w < 640,
    isTablet:  w >= 640 && w < 1024,
    isDesktop: w >= 1024,
  };
}

// ── Spinner ────────────────────────────────────────────────────────────────────
function Spinner({ size = 20, color = C.gold }) {
  return (
    <motion.span
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.85, ease: "linear" }}
      style={{ display: "inline-block", width: size, height: size, borderRadius: "50%",
        border: `2.5px solid rgba(255,255,255,0.1)`, borderTopColor: color }} />
  );
}

// ── Button ─────────────────────────────────────────────────────────────────────
// Only one filled button exists ("gold" — the single call-to-action per screen).
// Everything else is an outline or plain text; no colour-tinted boxes.
function Btn({ children, onClick, disabled, variant = "primary", small, icon, loading, className, labelClassName }) {
  const v = {
    primary: { bg: C.text,        border: C.text,          fg: C.bg,   weight: 700 },
    gold:    { bg: C.gold,        border: C.gold,           fg: C.goldFg, weight: 700 },
    ghost:   { bg: C.surface,     border: C.border,         fg: C.text, weight: 600 },
    danger:  { bg: "transparent", border: "rgba(224,121,106,0.35)", fg: C.red, weight: 600 },
    success: { bg: "transparent", border: C.border,         fg: C.green, weight: 600 },
  }[variant];
  return (
    <button
      className={className}
      onClick={disabled ? undefined : onClick}
      disabled={!!disabled}
      aria-disabled={!!disabled}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        gap: 8, padding: small ? "10px 16px" : "14px 18px",
        minHeight: small ? 44 : 54, // real tap targets, not the WCAG floor
        borderRadius: small ? 10 : 12, border: `1.5px solid ${v.border}`,
        background: v.bg, color: v.fg,
        fontSize: small ? 14 : 16, fontWeight: v.weight, fontFamily: C.sans,
        letterSpacing: "0.01em",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1, width: small ? "auto" : "100%",
        transition: "opacity 0.15s, border-color 0.15s, transform 0.08s", boxSizing: "border-box",
      }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = "scale(0.98)"; }}
      onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}>
      {loading ? <Spinner size={small ? 15 : 17} color={v.fg} /> : icon && <Icon name={icon} size={small ? 16 : 18} color={v.fg} />}
      {labelClassName ? <span className={labelClassName}>{children}</span> : children}
    </button>
  );
}

// ── Input / Textarea ───────────────────────────────────────────────────────────
function Field({ label, required, hint, value, onChange, placeholder, multiline, rows = 3, mono }) {
  const [focused, setFocused] = useState(false);
  const base = {
    width: "100%", background: C.surface,
    border: `1.5px solid ${focused ? C.gold : C.border}`,
    borderRadius: 10, padding: "13px 13px",
    minHeight: 52, // real tap target
    color: C.text, fontSize: 16, // 16px prevents mobile-Safari zoom-on-focus too
    fontFamily: mono ? C.mono : C.sans,
    boxSizing: "border-box", outline: "none",
    transition: "border-color 0.12s", lineHeight: 1.5,
  };
  const events = {
    value,
    onChange: e => onChange(e.target.value),
    onFocus: () => setFocused(true),
    onBlur:  () => setFocused(false),
    placeholder,
    "aria-label": label,
  };
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text, fontFamily: C.sans, letterSpacing: "0.02em" }}>
          {label}{required && <span style={{ color: C.gold }}> *</span>}
        </span>
        {hint && <span style={{ fontSize: 12, color: C.faint, fontFamily: C.sans }}>{hint}</span>}
      </div>
      {multiline
        ? <textarea {...events} rows={rows} style={{ ...base, resize: "vertical" }} />
        : <input    {...events} type="text" style={base} />
      }
    </div>
  );
}

// ── Progress steps ─────────────────────────────────────────────────────────────
function Steps({ current }) {
  const steps = ["Your Info", "Job Posting"];
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: C.sans }}>
          {steps[current - 1]}
        </span>
        <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Step {current} of {steps.length}</span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {steps.map((s, i) => (
          <div key={s} style={{ flex: 1, height: 5, borderRadius: 3,
            background: i < current ? C.gold : C.border }} />
        ))}
      </div>
    </div>
  );
}

// ── Keyword list — plain words, no pill chrome ──────────────────────────────────
function KwPill({ word }) {
  return (
    <span style={{ fontSize: 12.5, color: C.text, whiteSpace: "nowrap" }}>{word}</span>
  );
}

// ── Apply banner ─────────────────────────────────────────────────────────────
// Bold, unmissable, one clear instruction — the "how do I actually apply" answer,
// grounded in what the AI found in the job description (never invented).
function ApplyBanner({ application }) {
  const method = application?.method || "unclear";
  const value  = application?.value || null;
  const text   = application?.instructions
    || "This posting doesn't list a direct email or link — apply through the site or platform where you found it.";

  const cfg = {
    email:   { icon: "Mail",  label: "Apply by email",   cta: value ? `Email ${value}` : null,
               href: value ? `mailto:${value}` : null },
    website: { icon: "Globe", label: "Apply on their site", cta: value ? "Open application page" : null,
               href: value || null },
    unclear: { icon: "AlertCircle", label: "How to apply", cta: null, href: null },
  }[method] || { icon: "AlertCircle", label: "How to apply", cta: null, href: null };

  return (
    <div style={{
      border: `1.5px solid ${C.gold}`, borderRadius: 10, padding: "14px 16px",
      background: "rgba(201,162,78,0.08)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Icon name={cfg.icon} size={16} color={C.gold} />
        <span style={{ fontFamily: C.sans, fontWeight: 800, fontSize: 12.5,
          letterSpacing: "0.04em", textTransform: "uppercase", color: C.gold }}>
          {cfg.label}
        </span>
      </div>
      <p style={{ fontFamily: C.sans, fontWeight: 700, fontSize: 14.5, lineHeight: 1.5,
        color: C.text, margin: "0 0 10px" }}>
        {text}
      </p>
      {cfg.href && (
        <a href={cfg.href} target={method === "website" ? "_blank" : undefined} rel="noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 7, textDecoration: "none",
            background: C.gold, color: C.goldFg, fontFamily: C.sans, fontWeight: 700,
            fontSize: 13.5, padding: "9px 14px", borderRadius: 8,
          }}>
          <Icon name={method === "website" ? "ExternalLink" : "Mail"} size={14} color={C.goldFg} />
          {cfg.cta}
        </a>
      )}
    </div>
  );
}

// ── Package preview modal ─────────────────────────────────────────────────────
// Opens automatically right after Optimize finishes — the whole application
// package (resume summary, apply instructions, cover letter, interview tips)
// is reviewed here BEFORE anything downloads. One button downloads everything.
function PackagePreviewModal({
  open, onClose, genResult, application, coverLetter, interviewTips,
  onCopyCoverLetter, copied, onDownloadAll, downloading,
}) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" style={{
      position: "fixed", inset: 0, zIndex: 200, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16,
      background: "rgba(0,0,0,0.6)",
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 560, maxHeight: "88vh", overflowY: "auto",
        background: C.panel, border: `1px solid ${C.borderHi}`, borderRadius: 14,
        padding: 22, boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
          <p style={{ fontFamily: C.serif, fontStyle: "italic", fontSize: 20, color: C.text, margin: 0,
            display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="Check" size={17} color={C.green} /> Your application package is ready
          </p>
          <button onClick={onClose} aria-label="Close preview" style={{
            background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 4 }}>
            <Icon name="X" size={18} />
          </button>
        </div>
        <p style={{ fontFamily: C.sans, fontSize: 12.5, color: C.muted, margin: "0 0 16px" }}>
          Review everything below, then download it all with one click.
          {genResult?.job_location && ` · ${genResult.job_location}`}
        </p>

        <div style={{ marginBottom: 16 }}>
          <ApplyBanner application={application} />
        </div>

        {coverLetter && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <p style={{ fontFamily: C.sans, fontSize: 11.5, color: C.muted, margin: 0 }}>Cover letter</p>
              <Btn variant="ghost" icon={copied ? "Check" : "Clipboard"} onClick={onCopyCoverLetter} small>
                {copied ? "Copied" : "Copy"}
              </Btn>
            </div>
            <div style={{ fontFamily: C.sans, fontSize: 12.5, color: C.text, lineHeight: 1.6,
              whiteSpace: "pre-wrap", maxHeight: 220, overflowY: "auto",
              padding: 12, border: `1px solid ${C.border}`, borderRadius: 8 }}>
              {coverLetter}
            </div>
          </div>
        )}

        {interviewTips.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontFamily: C.sans, fontSize: 11.5, color: C.muted, margin: "0 0 6px" }}>
              Interview talking points
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {interviewTips.map((tip, i) => (
                <div key={i} style={{ display: "flex", gap: 8, fontFamily: C.sans, fontSize: 12.5,
                  color: C.text, lineHeight: 1.5 }}>
                  <span style={{ color: C.gold, flexShrink: 0 }}>{i + 1}.</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="gold" icon="FileDown" onClick={onDownloadAll}
            disabled={!!downloading} loading={downloading === "docx"}>
            Download resume + cover letter
          </Btn>
          <Btn variant="ghost" onClick={onClose} small>Keep editing</Btn>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOCX GENERATION — produces a real editable Word document
// Uses raw Office Open XML — no library needed, validated structure
// ═══════════════════════════════════════════════════════════════════════════════
function buildDocx(resume, docStyle) {
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

// ── Pure-JS ZIP (store method, no compression — DOCX doesn't need it) ─────────
async function zipDocx(xml) {
  const enc = new TextEncoder();
  const u32 = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; };
  const u16 = (n) => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; };

  function crc32(bytes) {
    if (!crc32._t) {
      crc32._t = Array.from({ length: 256 }, (_, i) => {
        let c = i;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        return c >>> 0;
      });
    }
    let c = 0xFFFFFFFF;
    for (const b of bytes) c = (crc32._t[(c ^ b) & 0xFF] ^ (c >>> 8)) >>> 0;
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  const files = [
    ["[Content_Types].xml",          xml.contentTypes],
    ["_rels/.rels",                   xml.pkgRels],
    ["word/document.xml",            xml.doc],
    ["word/styles.xml",              xml.styles],
    ["word/numbering.xml",           xml.num],
    ["word/settings.xml",            xml.settings],
    ["word/_rels/document.xml.rels", xml.docRels],
    ["docProps/core.xml",            xml.core],
    ["docProps/app.xml",             xml.app],
  ];

  const entries = [];
  let offset = 0;
  const parts = [];

  for (const [name, text] of files) {
    const nameB = enc.encode(name);
    const data  = enc.encode(text);
    const crc   = crc32(data);
    const local = new Uint8Array(30 + nameB.length);
    const dv    = new DataView(local.buffer);
    dv.setUint32(0,  0x04034B50, false); // signature
    dv.setUint16(4,  20, true);          // version needed
    dv.setUint16(6,  0,  true);          // flags
    dv.setUint16(8,  0,  true);          // method: store
    dv.setUint16(10, 0,  true);          // mod time
    dv.setUint16(12, 0,  true);          // mod date
    dv.setUint32(14, crc,         true); // CRC
    dv.setUint32(18, data.length, true); // compressed size
    dv.setUint32(22, data.length, true); // uncompressed size
    dv.setUint16(26, nameB.length,true); // filename length
    dv.setUint16(28, 0, true);           // extra field length
    local.set(nameB, 30);
    parts.push(local, data);
    entries.push({ nameB, crc, size: data.length, offset });
    offset += local.length + data.length;
  }

  const centralParts = entries.map(e => {
    const c = new Uint8Array(46 + e.nameB.length);
    const dv = new DataView(c.buffer);
    dv.setUint32(0,  0x02014B50, false);
    dv.setUint16(4,  20, true);
    dv.setUint16(6,  20, true);
    dv.setUint16(8,  0,  true);
    dv.setUint16(10, 0,  true);
    dv.setUint16(12, 0,  true);
    dv.setUint16(14, 0,  true);
    dv.setUint32(16, e.crc,         true);
    dv.setUint32(20, e.size,        true);
    dv.setUint32(24, e.size,        true);
    dv.setUint16(28, e.nameB.length,true);
    dv.setUint16(30, 0, true);
    dv.setUint16(32, 0, true);
    dv.setUint16(34, 0, true);
    dv.setUint16(36, 0, true);
    dv.setUint32(40, 0, true);
    dv.setUint32(42, e.offset, true);
    c.set(e.nameB, 46);
    return c;
  });

  const centralSize   = centralParts.reduce((s, c) => s + c.length, 0);
  const eocd          = new Uint8Array(22);
  const eocdDv        = new DataView(eocd.buffer);
  eocdDv.setUint32(0, 0x06054B50, false);
  eocdDv.setUint16(4, 0, true);
  eocdDv.setUint16(6, 0, true);
  eocdDv.setUint16(8,  entries.length, true);
  eocdDv.setUint16(10, entries.length, true);
  eocdDv.setUint32(12, centralSize,    true);
  eocdDv.setUint32(16, offset,         true);
  eocdDv.setUint16(20, 0, true);

  const all   = [...parts, ...centralParts, eocd];
  const total = all.reduce((s, p) => s + p.length, 0);
  const buf   = new Uint8Array(total);
  let   pos   = 0;
  for (const p of all) { buf.set(p, pos); pos += p.length; }
  return buf;
}

async function downloadDocx(resume, docStyle, filename) {
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

// ── PDF: text-based via browser print (preserves selectable text) ─────────────
// We inject a dedicated print stylesheet and isolate the preview element.
// Result: clean text PDF — every word is selectable and copyable.
function printPdf(previewEl) {
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

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE PREVIEW — fully editable inline
// ═══════════════════════════════════════════════════════════════════════════════
function EditableSpan({ value, onChange, style: extraStyle, multiline, bold, italic }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(value);
  const ref = useRef(null);

  useEffect(() => { setVal(value); }, [value]);
  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);

  const commit = () => { onChange(val); setEditing(false); };
  const shared = {
    fontFamily: "inherit", fontSize: "inherit", lineHeight: "inherit",
    fontWeight: bold ? "bold" : "inherit", fontStyle: italic ? "italic" : "inherit",
    color: "inherit", border: "2px solid #3B82F6", borderRadius: 3,
    background: "rgba(59,130,246,0.06)", outline: "none",
    padding: "0 2px", width: "100%", boxSizing: "border-box", ...extraStyle,
  };

  if (editing) {
    return multiline
      ? <textarea ref={ref} value={val} rows={Math.max(2, val.split("\n").length)}
          onChange={e => setVal(e.target.value)} onBlur={commit}
          style={{ ...shared, resize: "vertical", display: "block" }} />
      : <input ref={ref} value={val} type="text"
          onChange={e => setVal(e.target.value)}
          onBlur={commit} onKeyDown={e => e.key === "Enter" && commit()}
          style={shared} />;
  }
  return (
    <span onClick={() => setEditing(true)} title="Click to edit"
      style={{ cursor: "text", borderBottom: "1.5px dashed transparent",
        transition: "border-color 0.12s", ...extraStyle,
        fontWeight: bold ? "bold" : undefined, fontStyle: italic ? "italic" : undefined }}
      onMouseEnter={e => { e.currentTarget.style.borderBottomColor = "#3B82F680"; }}
      onMouseLeave={e => { e.currentTarget.style.borderBottomColor = "transparent"; }}>
      {val || <span style={{ color: "#aaa" }}>Click to edit</span>}
    </span>
  );
}

// ── Skeleton — shown in the exact shape of the page while a saved resume loads ──
function ResumeSkeleton() {
  const Bar = ({ w = "100%", h = 9, mb = 8 }) => (
    <div style={{ width: w, height: h, marginBottom: mb, borderRadius: 2,
      background: "linear-gradient(90deg, #ECECEC 25%, #F6F6F6 37%, #ECECEC 63%)",
      backgroundSize: "400% 100%", animation: "resumeSkeletonShimmer 1.4s ease infinite" }} />
  );
  return (
    <div style={{ background: "white", padding: "20mm 18mm", width: "210mm", minHeight: "297mm", boxSizing: "border-box" }}>
      <style>{`@keyframes resumeSkeletonShimmer{0%{background-position:100% 0}100%{background-position:0 0}}`}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
        <Bar w="46%" h={16} mb={8} />
        <Bar w="30%" h={10} mb={8} />
        <Bar w="60%" h={9} mb={0} />
      </div>
      {[0, 1, 2].map(section => (
        <div key={section} style={{ marginBottom: 18 }}>
          <Bar w="24%" h={11} mb={10} />
          <Bar w="100%" />
          <Bar w="94%" />
          <Bar w="88%" mb={0} />
        </div>
      ))}
    </div>
  );
}

const LivePreview = React.forwardRef(function LivePreview(
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
          <EditableSpan value={contact.location || ""} onChange={v => onEdit("contact", "location", v)} />
          {(contact.phone || contact.email) && " · "}
          <EditableSpan value={contact.phone || ""} onChange={v => onEdit("contact", "phone", v)} />
          {contact.phone && contact.email && " · "}
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

// ═══════════════════════════════════════════════════════════════════════════════
// RESUME STATE REDUCER
// ═══════════════════════════════════════════════════════════════════════════════
function resumeReducer(state, action) {
  const clone = () => JSON.parse(JSON.stringify(state));
  switch (action.type) {
    case "SET":    return action.resume;
    case "CONTACT": { const s = clone(); s.contact[action.key] = action.val; return s; }
    case "SEC_TEXT": { const s = clone(); s.sections[action.si].content = action.val; return s; }
    case "BULLET":   { const s = clone(); s.sections[action.si].items[action.ii] = action.val; return s; }
    case "JOB_ROLE":     { const s = clone(); s.sections[action.si].jobs[action.ji].role     = action.val; return s; }
    case "JOB_COMPANY":  { const s = clone(); s.sections[action.si].jobs[action.ji].company  = action.val; return s; }
    case "JOB_LOCATION": { const s = clone(); s.sections[action.si].jobs[action.ji].location = action.val; return s; }
    case "JOB_PERIOD":   { const s = clone(); s.sections[action.si].jobs[action.ji].period   = action.val; return s; }
    case "JOB_BULLET":   { const s = clone(); s.sections[action.si].jobs[action.ji].bullets[action.bi] = action.val; return s; }
    case "DEG_DEGREE":   { const s = clone(); s.sections[action.si].degrees[action.di].degree   = action.val; return s; }
    case "DEG_SCHOOL":   { const s = clone(); s.sections[action.si].degrees[action.di].school   = action.val; return s; }
    case "DEG_LOCATION": { const s = clone(); s.sections[action.si].degrees[action.di].location = action.val; return s; }
    case "DEG_PERIOD":   { const s = clone(); s.sections[action.si].degrees[action.di].period   = action.val; return s; }
    default: return state;
  }
}

function onEditHandler(dispatch) {
  return (type, ...args) => {
    const map = {
      "contact":      (key, val)            => ({ type: "CONTACT",      key, val }),
      "section-text": (si, val)             => ({ type: "SEC_TEXT",     si, val }),
      "bullet":       (si, ii, val)         => ({ type: "BULLET",       si, ii, val }),
      "job-role":     (si, ji, val)         => ({ type: "JOB_ROLE",     si, ji, val }),
      "job-company":  (si, ji, val)         => ({ type: "JOB_COMPANY",  si, ji, val }),
      "job-location": (si, ji, val)         => ({ type: "JOB_LOCATION", si, ji, val }),
      "job-period":   (si, ji, val)         => ({ type: "JOB_PERIOD",   si, ji, val }),
      "job-bullet":   (si, ji, bi, val)     => ({ type: "JOB_BULLET",   si, ji, bi, val }),
      "deg-degree":   (si, di, val)         => ({ type: "DEG_DEGREE",   si, di, val }),
      "deg-school":   (si, di, val)         => ({ type: "DEG_SCHOOL",   si, di, val }),
      "deg-location": (si, di, val)         => ({ type: "DEG_LOCATION", si, di, val }),
      "deg-period":   (si, di, val)         => ({ type: "DEG_PERIOD",   si, di, val }),
    };
    const action = map[type]?.(...args);
    if (action) dispatch(action);
  };
}

// ── API helpers ────────────────────────────────────────────────────────────────
// Single shared request fn — every endpoint speaks the same {success, data, error}
// envelope (see backend/app/utils/response.py), so one helper covers all of them.
// Network failures (backend down, CORS block, wrong port) are relabeled with a
// clear message instead of surfacing a raw "Failed to fetch".
async function apiRequest(path, options) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, options);
  } catch (networkErr) {
    throw new Error(
      `Could not reach the server at ${BASE}. Is the backend running and is NEXT_PUBLIC_API_URL set correctly?`
    );
  }

  // 204 No Content etc — nothing to parse
  if (res.status === 204) return null;

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Server returned an unreadable response (HTTP ${res.status}).`);
  }

  if (!res.ok) {
    // Backend error envelope uses "error", success envelope uses "message" —
    // check both so real backend error text always reaches the user.
    throw new Error(json.error || json.message || `Error ${res.status}`);
  }
  return json.data ?? json;
}

const apiGenerate  = (userInfo, jobDesc) => apiRequest("/api/v1/resume/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ user_info: userInfo, job_description: jobDesc }),
});

const apiOptimize  = (userInfo, jobDesc) => apiRequest("/api/v1/resume/optimize", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ user_info: userInfo, job_description: jobDesc }),
});

const apiListSaved = () => apiRequest("/api/v1/resume/saved").catch(() => []);
const apiGetSaved  = (id) => apiRequest(`/api/v1/resume/${id}`);
const apiDelete    = (id) => apiRequest(`/api/v1/resume/${id}`, { method: "DELETE" }).catch(() => null);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT — fully responsive: phone / tablet / desktop
// ═══════════════════════════════════════════════════════════════════════════════
const EMPTY_INFO = {
  name: "", title: "", location: "", email: "", phone: "",
  background: "", experience: "", education: "", skills: "",
};

export default function ResumeGuestMode({ onClose }) {
  console.log('✅ RESUME GUEST MODE v2.0.0 - LOADED');
  const { isPhone, isTablet, isDesktop } = useViewport();
  const showSidebarAndPreview = isDesktop; // side-by-side only on desktop

  // Mobile/tablet: which screen is showing — "panel" (form/list) or "preview"
  const [mobileView, setMobileView] = useState("panel");

  // One localStorage read on mount, reused below to seed every persisted field.
  const [draftAtMount] = useState(loadDraft);

  const [tab,        setTab]        = useState(() => draftAtMount?.tab || "new");   // "new" | "templates"
  const [step,       setStep]       = useState(() => draftAtMount?.step || 1);       // 1 | 2 | 3
  const [info,       setInfo]       = useState(() => draftAtMount?.info || EMPTY_INFO);
  const [jobDesc,    setJobDesc]    = useState(() => draftAtMount?.jobDesc || "");
  const [generating, setGenerating] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [error,      setError]      = useState("");
  const [genResult,  setGenResult]  = useState(() => draftAtMount?.genResult || null);
  const [coverLetter,  setCoverLetter]  = useState(() => draftAtMount?.coverLetter || "");
  const [interviewTips, setInterviewTips] = useState(() => draftAtMount?.interviewTips || []);
  const [application, setApplication] = useState(() => draftAtMount?.application || null); // { method, value, instructions }
  const [packageOpen, setPackageOpen] = useState(false); // never restore an open modal on refresh
  const [copied, setCopied] = useState(false);
  const [resume,     dispatch]      = useReducer(resumeReducer, draftAtMount?.resume || null);
  const onEdit = useCallback(onEditHandler(dispatch), [dispatch]);
  const [docStyle,   setDocStyle]   = useState(() => draftAtMount?.docStyle || DEFAULT_STYLE);
  // Restored on mount only if there's actually something worth telling the user about.
  const [draftRestored, setDraftRestored] = useState(() => !!(draftAtMount?.resume || draftAtMount?.jobDesc));
  const [saved,      setSaved]      = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [loadingResumeId, setLoadingResumeId] = useState(null); // id currently being fetched, drives skeleton
  const [downloading, setDownloading]   = useState(null);
  // On phone/tablet the resume preview isn't mounted while the form panel is
  // showing — this flags "print as soon as the preview screen mounts".
  const [pendingPrint, setPendingPrint] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [scale,       setScale]         = useState(1);

  const canvasRef  = useRef(null);
  const previewRef = useRef(null);

  // Scale preview to fit available width
  useEffect(() => {
    const compute = () => {
      if (!canvasRef.current) return;
      const pad = isPhone ? 16 : 40;
      const available = canvasRef.current.clientWidth - pad;
      setScale(Math.min(1, Math.max(0.25, available / 794)));
    };
    compute();
    const ro = window.ResizeObserver ? new ResizeObserver(compute) : null;
    if (ro && canvasRef.current) ro.observe(canvasRef.current);
    window.addEventListener("resize", compute);
    return () => { ro?.disconnect(); window.removeEventListener("resize", compute); };
  }, [isPhone, mobileView]);

  useEffect(() => {
    if (tab !== "templates" && tab !== "settings") return;
    setLoadingSaved(true);
    apiListSaved().then(setSaved).finally(() => setLoadingSaved(false));
  }, [tab]);

  // Auto-switch to preview screen on phone once resume is ready
  useEffect(() => {
    if (!isDesktop && resume && step === 3) setMobileView("preview");
  }, [resume, step, isDesktop]);

  // Mirror the in-progress build to localStorage (debounced) so a refresh
  // restores it instead of wiping it. Best-effort only — a write failure
  // (storage full/blocked) is swallowed rather than surfaced as an app error.
  const draftSaveTimer = useRef(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify({
          tab, step, info, jobDesc, genResult, coverLetter, interviewTips,
          application, resume, docStyle,
        }));
      } catch { /* best-effort */ }
    }, 300);
    return () => clearTimeout(draftSaveTimer.current);
  }, [tab, step, info, jobDesc, genResult, coverLetter, interviewTips, application, resume, docStyle]);

  const set = (k) => (v) => setInfo(p => ({ ...p, [k]: v }));
  const ready1 = info.name.trim() && info.title.trim() && info.location.trim();
  const ready2 = jobDesc.trim().length >= 80;

  const generate = async () => {
    setGenerating(true);
    setError("");
    try {
      const data = await apiGenerate(info, jobDesc);
      const resumeObj = {
        contact:  data.contact  || {},
        sections: data.sections || [],
        keywords: data.keywords || [],
        saved_id: data.saved_id || null,
      };
      dispatch({ type: "SET", resume: resumeObj });
      setGenResult({ keywords: data.keywords || [], saved_id: data.saved_id, job_location: data.job_location });
      setStep(3);
    } catch (e) {
      setError(e.message || "Generation failed. Try again.");
    } finally {
      setGenerating(false);
    }
  };

  const optimize = async () => {
    setOptimizing(true);
    setError("");

    // Generate the resume/cover-letter/tips/apply-info via the API. Any failure
    // here is a real optimization failure — nothing was produced, so we bail out.
    let data;
    try {
      data = await apiOptimize(info, jobDesc);
    } catch (e) {
      setError(e.message || "Optimization failed. Try again.");
      setOptimizing(false);
      return;
    }

    const resumeObj = {
      contact:  data.contact  || {},
      sections: data.sections || [],
      keywords: data.keywords || [],
      saved_id: data.saved_id || null,
    };
    dispatch({ type: "SET", resume: resumeObj });
    setGenResult({ keywords: data.keywords || [], saved_id: data.saved_id, job_location: data.job_location });
    setCoverLetter(data.cover_letter || "");
    setInterviewTips(data.interview_tips || []);
    setApplication(data.application || null);
    setStep(3);
    setOptimizing(false);

    // One click, one result: the whole package — resume, cover letter, apply
    // instructions, interview tips — opens for review immediately. Nothing
    // downloads yet; the Download button inside the modal is the only thing
    // that writes a file, so the person always sees what they're getting first.
    setPackageOpen(true);
  };

  const downloadCoverLetter = () => {
    if (!coverLetter) return;
    const name = (resume?.contact?.name || info.name || "Resume").replace(/\s+/g, "_");
    const blob = new Blob([coverLetter], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `${name}_Cover_Letter.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  // One click: cover letter text straight to the clipboard, ready to paste into
  // an email or an ATS "cover letter" text box.
  const copyCoverLetter = async () => {
    if (!coverLetter) return;
    try {
      await navigator.clipboard.writeText(coverLetter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be blocked (permissions, non-HTTPS) — fall back to a file
      // download so the person still gets the cover letter in one click either way.
      downloadCoverLetter();
    }
  };

  // The single download action inside the package-preview modal: resume .docx
  // and cover letter .txt both save in one click, after the person has reviewed
  // everything on screen.
  const downloadPackage = async () => {
    if (!resume) return;
    setDownloading("docx");
    try {
      const name = (resume.contact?.name || info.name || "Resume").replace(/\s+/g, "_");
      await downloadDocx(resume, docStyle, `${name}_Resume.docx`);
      if (coverLetter) downloadCoverLetter();
    } catch (e) {
      setError("Download failed: " + e.message);
    } finally {
      setDownloading(null);
    }
  };

  const loadSaved = async (id) => {
    setLoadingResumeId(id);
    setError("");
    if (!isDesktop) setMobileView("preview");
    try {
      const data = await apiGetSaved(id);
      dispatch({ type: "SET", resume: { contact: data.contact || {}, sections: data.sections || [], keywords: data.keywords || [], saved_id: id } });
      setGenResult({ keywords: data.keywords || [], saved_id: id, job_location: data.job_location });
      // Saved records only ever store the resume itself — clear any cover
      // letter / apply-info left over from a previous Optimize in this session.
      setCoverLetter(""); setInterviewTips([]); setApplication(null); setPackageOpen(false);
      setTab("new"); setStep(3);
    } catch (e) {
      setError("Could not load: " + e.message);
    } finally {
      setLoadingResumeId(null);
    }
  };

  const handleDocx = async () => {
    if (!resume) return;
    setDownloading("docx");
    try {
      const name = resume.contact?.name?.replace(/\s+/g, "_") || "Resume";
      await downloadDocx(resume, docStyle, `${name}_Resume.docx`);
    } catch (e) {
      setError("Download failed: " + e.message);
    } finally {
      setDownloading(null);
    }
  };

  // Fires once the preview screen has actually mounted after handlePdf
  // switched to it — printing immediately would still see the old (form) DOM.
  useEffect(() => {
    if (!pendingPrint || (!isDesktop && mobileView !== "preview")) return;
    const raf = requestAnimationFrame(() => {
      if (previewRef.current) {
        printPdf(previewRef.current);
      } else {
        setError("Nothing to export yet — generate a resume first.");
      }
      setPendingPrint(false);
      setTimeout(() => setDownloading(null), 1500);
    });
    return () => cancelAnimationFrame(raf);
  }, [pendingPrint, mobileView, isDesktop]);

  const handlePdf = () => {
    if (!resume) { setError("Nothing to export yet — generate a resume first."); return; }
    setDownloading("pdf");
    // On phone/tablet the preview isn't rendered while the form panel is
    // showing, so previewRef.current would be null here — switch screens
    // and let the effect above print once it's actually mounted.
    if (!isDesktop && mobileView !== "preview") {
      setPendingPrint(true);
      setMobileView("preview");
      return;
    }
    if (!previewRef.current) {
      setDownloading(null);
      setError("Nothing to export yet — generate a resume first.");
      return;
    }
    printPdf(previewRef.current);
    setTimeout(() => setDownloading(null), 1500);
  };

  const resetWizard = () => {
    setStep(1); setInfo(EMPTY_INFO); setJobDesc("");
    setError(""); setGenResult(null);
    setCoverLetter(""); setInterviewTips([]);
    setApplication(null); setPackageOpen(false);
    dispatch({ type: "SET", resume: null }); // was never cleared before — stale resume could linger
    if (!isDesktop) setMobileView("panel");
    clearDraft();
  };

  const A4w = 794;
  const A4h = 1123;
  const scaledW = Math.round(A4w * scale);
  const scaledH = Math.round(A4h * scale);

  // ── Reusable preview canvas (used in both desktop pane and mobile screen) ──
  const PreviewCanvas = () => (
    <div ref={canvasRef} style={{ flex: 1, overflowY: "auto", background: "#C8C8C8",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: isPhone ? "14px 0 24px" : "24px 0 48px", scrollbarWidth: "thin" }}>
      <p style={{ fontFamily: C.mono, fontSize: 9, color: "#666", margin: "0 0 10px",
        letterSpacing: "0.08em", userSelect: "none", textAlign: "center", padding: "0 12px" }}>
        {loadingResumeId ? "Loading…" : `${Math.round(scale * 100)}% · ${resume ? "Tap any text to edit" : "Generate to see your resume"}`}
      </p>
      <div style={{ width: scaledW, height: scaledH, flexShrink: 0, position: "relative" }}>
        <div style={{ width: A4w, height: A4h, position: "absolute", top: 0, left: 0,
          transform: `scale(${scale})`, transformOrigin: "top left",
          boxShadow: "0 6px 40px rgba(0,0,0,0.35)" }}>
          {loadingResumeId
            ? <ResumeSkeleton />
            : <LivePreview ref={previewRef} resume={resume} docStyle={docStyle} onEdit={onEdit} />}
        </div>
      </div>
    </div>
  );

  // ── Reusable sidebar/panel content (form, templates list, or results) ──────
  const PanelContent = () => (
    <>
      {/* BUILD */}
      {tab === "new" && (
        <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
          {draftRestored && (
            <div style={{ margin: "12px 16px 0", padding: "9px 12px", borderRadius: 8,
              border: `1px solid ${C.border}`, background: C.raised,
              display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="RefreshCw" size={13} color={C.gold} />
              <span style={{ flex: 1, fontFamily: C.sans, fontSize: 12, color: C.muted }}>
                Restored your in-progress draft from before the refresh.
              </span>
              <button onClick={() => setDraftRestored(false)} aria-label="Dismiss"
                style={{ background: "none", border: "none", cursor: "pointer", color: C.faint, padding: 2 }}>
                <Icon name="X" size={13} />
              </button>
            </div>
          )}
          {step === 3 && genResult && (
            <div style={{ padding: "16px 16px 18px" }}>
              <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
                <p style={{ color: C.text, fontFamily: C.serif, fontStyle: "italic", fontSize: 18, margin: "0 0 4px",
                  display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name="Check" size={15} color={C.green} /> Resume ready
                </p>
                <p style={{ color: C.muted, fontSize: 12.5, margin: 0 }}>
                  {isPhone ? "Open Preview to edit" : "Click any text to edit"}
                  {genResult.job_location && ` · ${genResult.job_location}`}
                </p>
              </div>

              {genResult.keywords?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontFamily: C.sans, fontSize: 11.5, color: C.muted, margin: "0 0 6px" }}>
                    Keywords matched
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 0" }}>
                    {genResult.keywords.map((k, i) => (
                      <React.Fragment key={k}>
                        {i > 0 && <span style={{ color: C.faint, margin: "0 7px" }}>·</span>}
                        <KwPill word={k} />
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {application && (
                <div style={{ marginBottom: 16 }}>
                  <ApplyBanner application={application} />
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {!isDesktop && (
                  <Btn variant="primary" icon="Eye" onClick={() => setMobileView("preview")} small>
                    Open Preview
                  </Btn>
                )}
                {coverLetter ? (
                  <>
                    <Btn variant="gold" icon="FileDown" onClick={downloadPackage}
                      disabled={!!downloading} loading={downloading === "docx"} small>
                      Download resume + cover letter
                    </Btn>
                    <Btn variant="ghost" icon="Eye" onClick={() => setPackageOpen(true)} small>
                      Review package
                    </Btn>
                  </>
                ) : (
                  <Btn variant="gold" icon="FileDown" onClick={handleDocx}
                    disabled={!!downloading} loading={downloading === "docx"} small>
                    Download Word
                  </Btn>
                )}
                <Btn variant="ghost" icon="FileDown" onClick={handlePdf}
                  disabled={!!downloading} loading={downloading === "pdf"} small>
                  Download PDF
                </Btn>
                <Btn variant="ghost" icon="RefreshCw" onClick={resetWizard} small>
                  Build another
                </Btn>
              </div>

              {coverLetter && (
                <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <p style={{ fontFamily: C.sans, fontSize: 11.5, color: C.muted, margin: 0 }}>
                      Cover letter
                    </p>
                    <Btn variant="ghost" icon={copied ? "Check" : "Clipboard"} onClick={copyCoverLetter} small>
                      {copied ? "Copied" : "Copy"}
                    </Btn>
                  </div>
                  <div style={{ fontFamily: C.sans, fontSize: 12, color: C.text, lineHeight: 1.6,
                    whiteSpace: "pre-wrap", maxHeight: 220, overflowY: "auto",
                    padding: 10, border: `1px solid ${C.border}`, borderRadius: 6 }}>
                    {coverLetter}
                  </div>
                </div>
              )}

              {interviewTips.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ fontFamily: C.sans, fontSize: 11.5, color: C.muted, margin: "0 0 6px" }}>
                    Interview talking points
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {interviewTips.map((tip, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, fontFamily: C.sans, fontSize: 12,
                        color: C.text, lineHeight: 1.5 }}>
                        <span style={{ color: C.gold, flexShrink: 0 }}>{i + 1}.</span>
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step < 3 && (
            <div style={{ padding: "16px 16px 18px" }}>
              <Steps current={step} />

              {error && (
                <div role="alert" style={{ display: "flex", gap: 8, padding: "2px 0 2px 11px",
                  borderLeft: `2px solid ${C.red}`,
                  color: C.red, fontSize: 12.5, marginBottom: 14, lineHeight: 1.5 }}>
                  {error}
                </div>
              )}

              {step === 1 && (
                <>
                  <div style={{ display: "grid",
                    gridTemplateColumns: isPhone ? "1fr" : "1fr 1fr", gap: "0 8px" }}>
                    <div style={{ gridColumn: "1/-1" }}>
                      <Field label="FULL NAME" required value={info.name} onChange={set("name")} placeholder="Jane Smith" />
                    </div>
                    <Field label="TARGET JOB TITLE" required value={info.title} onChange={set("title")} placeholder="Sales Associate" />
                    <Field label="LOCATION" required hint="City, Province" value={info.location} onChange={set("location")} placeholder="Toronto, ON" />
                    <Field label="EMAIL" value={info.email} onChange={set("email")} placeholder="jane@email.com" />
                    <Field label="PHONE" value={info.phone} onChange={set("phone")} placeholder="(416) 555-0100" />
                  </div>

                  <Field label="BACKGROUND" hint="your own words"
                    value={info.background} onChange={set("background")} multiline rows={3}
                    placeholder="e.g. I worked at Farm Boy for 4 years stocking shelves, helping customers, and training new staff. Bilingual EN/FR." />

                  <Field label="PAST JOBS" hint="Role | Company | Years"
                    value={info.experience} onChange={set("experience")} multiline rows={2}
                    placeholder={"Grocery Clerk | Farm Boy | 2021–2025\nCashier | Loblaws | 2019–2021"} />

                  <Field label="EDUCATION" hint="Degree | School | Year"
                    value={info.education} onChange={set("education")} multiline rows={2}
                    placeholder="Business Admin | Algonquin College | 2023" />

                  <Field label="SKILLS" hint="comma separated"
                    value={info.skills} onChange={set("skills")} multiline rows={2}
                    placeholder="Customer service, bilingual EN/FR, inventory, MS Office" />

                  <Btn icon="ChevronRight" onClick={() => { setError(""); setStep(2); }} disabled={!ready1}>
                    Next — Job Posting
                  </Btn>
                </>
              )}

              {step === 2 && (
                <>
                  <button onClick={() => setStep(1)} aria-label="Back to your information"
                    style={{ display: "flex", alignItems: "center", gap: 5, background: "none",
                      border: "none", cursor: "pointer", color: C.muted, fontSize: 13,
                      padding: "6px 0 12px", minHeight: 32, fontFamily: C.sans }}>
                    <Icon name="ChevronLeft" size={14} color={C.muted} /> Back
                  </button>

                  <Field
                    label="JOB DESCRIPTION" required
                    hint={`${jobDesc.length} chars${jobDesc.length >= 80 ? " ✓" : ""}`}
                    value={jobDesc} onChange={setJobDesc} multiline rows={isPhone ? 10 : 18} mono
                    placeholder={"Paste the full job posting here — from any job board.\n\nMore text = better keyword matching."} />

                  <Btn icon="Sparkles" onClick={generate} disabled={!ready2 || generating || optimizing} loading={generating}>
                    {generating ? "Generating…" : "Generate Resume"}
                  </Btn>

                  <div style={{ marginTop: 10 }}>
                    <Btn variant="gold" icon="Sparkles" onClick={optimize}
                      disabled={!ready2 || generating || optimizing} loading={optimizing}>
                      {optimizing ? "Optimizing…" : "✨ Optimize for This Job"}
                    </Btn>
                    <p style={{ fontFamily: C.sans, fontSize: 11, color: C.faint, margin: "6px 2px 0", lineHeight: 1.5 }}>
                      Also writes a cover letter + interview talking points, and downloads
                      the Word doc automatically.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* STYLE */}
      {tab === "style" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 16, scrollbarWidth: "none" }}>
          <p style={{ fontFamily: C.mono, fontSize: 10, color: C.faint,
            letterSpacing: "0.07em", margin: "0 0 14px" }}>RESUME STYLE</p>

          {/* Font family */}
          <p style={{ fontFamily: C.sans, fontSize: 12, color: C.muted, margin: "0 0 7px" }}>Font family</p>
          <div style={{ display: "flex", flexDirection: "column", marginBottom: 18, border: `1px solid ${C.border}`, borderRadius: 5, overflow: "hidden" }}>
            {FONTS.map((f, i) => (
              <button key={f.id} onClick={() => setDocStyle(s => ({ ...s, font: f.id }))}
                style={{ padding: "10px 12px", textAlign: "left", cursor: "pointer",
                  background: "transparent", border: "none",
                  borderTop: i === 0 ? "none" : `1px solid ${C.border}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  color: docStyle.font === f.id ? C.text : C.muted,
                  fontWeight: docStyle.font === f.id ? 700 : 400,
                  fontSize: 14, fontFamily: f.css }}>
                {f.label}
                {docStyle.font === f.id && <Icon name="Check" size={13} color={C.gold} />}
              </button>
            ))}
          </div>

          {/* Font size */}
          <p style={{ fontFamily: C.sans, fontSize: 12, color: C.muted, margin: "0 0 7px" }}>
            Font size <span style={{ color: C.faint }}>· {docStyle.fontSize}pt</span>
          </p>
          <input type="range" min={9} max={13} step={0.5} value={docStyle.fontSize}
            onChange={e => setDocStyle(s => ({ ...s, fontSize: parseFloat(e.target.value) }))}
            style={{ width: "100%", accentColor: C.gold, marginBottom: 18 }} />

          {/* Line spacing */}
          <p style={{ fontFamily: C.sans, fontSize: 12, color: C.muted, margin: "0 0 7px" }}>
            Line spacing <span style={{ color: C.faint }}>· {docStyle.lineHeight}×</span>
          </p>
          <input type="range" min={1.1} max={1.8} step={0.05} value={docStyle.lineHeight}
            onChange={e => setDocStyle(s => ({ ...s, lineHeight: parseFloat(e.target.value) }))}
            style={{ width: "100%", accentColor: C.gold, marginBottom: 18 }} />

          {/* Accent color */}
          <p style={{ fontFamily: C.sans, fontSize: 12, color: C.muted, margin: "0 0 9px" }}>Accent color</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 16 }}>
            {ACCENTS.map(a => (
              <button key={a.id} onClick={() => setDocStyle(s => ({ ...s, accent: a.id }))}
                aria-label={a.label} title={a.label}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                  background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: a.hex, flexShrink: 0,
                  boxShadow: docStyle.accent === a.id ? `0 0 0 2px ${C.bg}, 0 0 0 3px ${C.text}` : "none" }} />
                <span style={{ color: docStyle.accent === a.id ? C.text : C.faint, fontSize: 10.5 }}>{a.label}</span>
              </button>
            ))}
          </div>

          {!isDesktop && (
            <Btn variant="primary" icon="Eye" onClick={() => setMobileView("preview")} small>
              Preview changes
            </Btn>
          )}
        </div>
      )}

      {/* TEMPLATES */}
      {tab === "templates" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 14, scrollbarWidth: "none" }}>
          {loadingSaved ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
              <Spinner size={28} />
            </div>
          ) : saved.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 16px" }}>
              <Icon name="FileText" size={32} color={C.border} />
              <p style={{ color: C.muted, fontSize: 14, margin: "12px 0 4px" }}>No saved resumes yet</p>
              <p style={{ color: C.faint, fontSize: 12, margin: "0 0 16px" }}>Generate one — it saves automatically</p>
              <Btn small variant="ghost" icon="Plus" onClick={() => setTab("new")}>Build one now</Btn>
            </div>
          ) : (
            <>
              <p style={{ fontFamily: C.mono, fontSize: 10, color: C.faint, letterSpacing: "0.1em", margin: "0 0 12px" }}>
                {saved.length} SAVED RESUME{saved.length !== 1 ? "S" : ""}
              </p>
              {saved.map(r => (
                <div key={r.id} style={{ background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 12, padding: "13px 14px", marginBottom: 9 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ color: C.text, fontSize: 14, fontWeight: 600, margin: "0 0 2px",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name || "Unnamed"}</p>
                      <p style={{ color: C.muted, fontSize: 12, margin: "0 0 8px",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.role || ""}</p>
                      {r.keywords?.length > 0 && (
                        <p style={{ fontSize: 11.5, color: C.muted, margin: "0 0 6px" }}>
                          {r.keywords.slice(0, 3).join(" · ")}
                        </p>
                      )}
                      <p style={{ fontFamily: C.mono, fontSize: 10, color: C.faint, margin: 0 }}>
                        {r.generated_at ? new Date(r.generated_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : ""}
                      </p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                      <Btn small icon="Eye" loading={loadingResumeId === r.id} disabled={!!loadingResumeId} onClick={() => loadSaved(r.id)}>Load</Btn>
                      <Btn small variant="danger" icon="Trash2" onClick={async () => { await apiDelete(r.id); setSaved(s => s.filter(x => x.id !== r.id)); }}>
                        <span className="sr-only">Delete</span>
                      </Btn>
                    </div>
                  </div>
                </div>
              ))}
              <Btn variant="ghost" icon="Plus" onClick={() => setTab("new")}>New resume</Btn>
            </>
          )}
        </div>
      )}

      {/* SETTINGS */}
      {tab === "settings" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 16, scrollbarWidth: "none" }}>
          <p style={{ fontFamily: C.serif, fontStyle: "italic", fontSize: 17, color: C.text, margin: "0 0 16px" }}>
            Settings
          </p>

          <div style={{ paddingBottom: 16, marginBottom: 16, borderBottom: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 13, color: C.text, margin: "0 0 3px", fontWeight: 600 }}>Style defaults</p>
            <p style={{ fontSize: 12, color: C.muted, margin: "0 0 10px", lineHeight: 1.5 }}>
              Reset font, size, spacing and accent back to Calibri, 11pt, navy.
            </p>
            <Btn small variant="ghost" icon="RefreshCw" onClick={() => setDocStyle(DEFAULT_STYLE)}>
              Reset style
            </Btn>
          </div>

          <div style={{ paddingBottom: 16, marginBottom: 16, borderBottom: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 13, color: C.text, margin: "0 0 3px", fontWeight: 600 }}>Saved resumes</p>
            <p style={{ fontSize: 12, color: C.muted, margin: "0 0 10px", lineHeight: 1.5 }}>
              {saved.length > 0
                ? `${saved.length} resume${saved.length !== 1 ? "s" : ""} stored on the server.`
                : "Nothing saved yet."}
            </p>
            {!confirmClear ? (
              <Btn small variant="danger" icon="Trash2" disabled={saved.length === 0}
                onClick={() => setConfirmClear(true)}>
                Clear all saved resumes
              </Btn>
            ) : (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 12.5, color: C.red }}>Delete all {saved.length}? This can't be undone.</span>
                <Btn small variant="danger" onClick={async () => {
                  await Promise.all(saved.map(r => apiDelete(r.id)));
                  setSaved([]); setConfirmClear(false);
                }}>Yes, delete</Btn>
                <Btn small variant="ghost" onClick={() => setConfirmClear(false)}>Cancel</Btn>
              </div>
            )}
          </div>

          <p style={{ fontSize: 11.5, color: C.faint, margin: 0 }}>
            Resume Builder · Guest Mode<br />
            Generation runs on your own Groq-backed API — nothing is stored beyond what you see in "Saved."
          </p>
        </div>
      )}
    </>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "absolute", inset: 0,
        zIndex: 50, background: C.bg, display: "flex", flexDirection: "column",
        fontFamily: C.sans, overflow: "hidden" }}>

      <style>{`
        @media print{body *{visibility:hidden!important}#__resume_pdf_print__,#__resume_pdf_print__ *{visibility:visible!important}#__resume_pdf_print__{position:fixed!important;left:0!important;top:0!important;width:100%!important;transform:none!important;box-shadow:none!important}}
        .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
        @media (max-width: 380px) {
          .rgm-dl-label { display: none; }
          .rgm-dl-btn { padding: 10px !important; gap: 0 !important; }
        }
      `}</style>

      {/* ── Top bar — title, close, and the two actions that matter most ── */}
      <header style={{ flexShrink: 0, height: 64, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 14px", background: C.panel,
        borderBottom: `1px solid ${C.border}`, gap: 10 }}>

        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, flex: "1 1 auto", overflow: "hidden" }}>
          <button onClick={onClose} aria-label="Close resume builder"
            style={{ width: 40, height: 40, borderRadius: "50%", background: C.raised,
              border: `1px solid ${C.border}`, display: "flex", alignItems: "center",
              justifyContent: "center", cursor: "pointer", color: C.text, flexShrink: 0 }}>
            <Icon name="X" size={17} color={C.text} />
          </button>
          <span style={{ fontSize: TS.title, fontWeight: 700, color: C.text,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>Resume Builder</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Btn small icon="FileDown" loading={downloading === "docx"} className="rgm-dl-btn" labelClassName="rgm-dl-label"
            onClick={handleDocx} disabled={!resume || !!downloading} variant="gold">
            Word
          </Btn>
          <Btn small icon="FileDown" loading={downloading === "pdf"} className="rgm-dl-btn" labelClassName="rgm-dl-label"
            onClick={handlePdf} disabled={!resume || !!downloading} variant="ghost">
            PDF
          </Btn>
        </div>
      </header>

      {/* ── Desktop: top segmented nav, bigger and always labeled ── */}
      {isDesktop && (
        <div role="tablist" aria-label="View" style={{ display: "flex", flexShrink: 0,
          background: C.panel, borderBottom: `1px solid ${C.border}`, padding: "0 10px" }}>
          {[
            { id: "new",       icon: "Sparkles",  label: "Build" },
            { id: "style",     icon: "Settings2", label: "Style" },
            { id: "templates", icon: "Layout",   label: "Saved" },
            { id: "settings",  icon: "Gear",      label: "Settings" },
          ].map(v => {
            const active = tab === v.id;
            return (
              <button key={v.id} role="tab" aria-selected={active} onClick={() => setTab(v.id)}
                style={{ minHeight: 52, padding: "0 18px", display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 8, border: "none", cursor: "pointer",
                  background: "transparent", borderBottom: `3px solid ${active ? C.gold : "transparent"}`,
                  color: active ? C.text : C.faint,
                  fontSize: 14.5, fontWeight: active ? 700 : 500, fontFamily: C.sans, transition: "color 0.12s, border-color 0.12s" }}>
                <Icon name={v.icon} size={16} color={active ? C.gold : C.faint} />
                {v.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Desktop: sidebar + preview side by side */}
        {isDesktop && (
          <>
            <div style={{ width: 380, flexShrink: 0, display: "flex", flexDirection: "column",
              background: C.panel, borderRight: `1px solid ${C.border}` }}>
              {PanelContent()}
            </div>
            {PreviewCanvas()}
          </>
        )}

        {/* Phone/tablet: one screen at a time, toggled by the bottom bar */}
        {!isDesktop && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {mobileView === "panel" ? PanelContent() : PreviewCanvas()}
          </div>
        )}
      </div>

      {/* ── Mobile/tablet: frosted-glass bottom tab bar — native-app style ── */}
      {!isDesktop && (
        <nav role="tablist" aria-label="View" style={{
          flexShrink: 0, position: "relative", display: "flex",
          background: `${C.panel}E3`, backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderTop: `1px solid ${C.border}`,
          boxShadow: "0 -14px 34px rgba(0,0,0,0.32)",
          paddingTop: 7, paddingBottom: "calc(7px + env(safe-area-inset-bottom, 0px))" }}>
          {[
            { id: "new",       icon: "Sparkles",  label: "Build" },
            { id: "style",     icon: "Settings2", label: "Style" },
            { id: "preview",   icon: "Eye",       label: "Preview" },
            { id: "templates", icon: "Layout",    label: "Saved" },
            { id: "settings",  icon: "Gear",      label: "Settings" },
          ].map(v => {
            const active = v.id === "preview" ? mobileView === "preview" : (mobileView === "panel" && tab === v.id);
            const onTap = () => {
              if (v.id === "preview") { setMobileView("preview"); return; }
              setTab(v.id);
              setMobileView("panel");
            };
            return (
              <motion.button key={v.id} role="tab" aria-selected={active} onClick={onTap}
                whileTap={{ scale: 0.9 }}
                style={{ flex: 1, position: "relative", minHeight: 54, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 3, border: "none", cursor: "pointer",
                  background: "transparent", padding: 0, WebkitTapHighlightColor: "transparent" }}>
                {active && (
                  <motion.span layoutId="navActivePill" transition={{ type: "spring", damping: 26, stiffness: 320 }}
                    style={{ position: "absolute", top: 1, left: "16%", right: "16%", bottom: 1,
                      borderRadius: 14, background: "rgba(201,162,78,0.12)", border: "1px solid rgba(201,162,78,0.22)" }} />
                )}
                <motion.span animate={{ scale: active ? 1.1 : 1, y: active ? -1 : 0 }}
                  transition={{ type: "spring", damping: 18, stiffness: 380 }}
                  style={{ position: "relative", display: "flex" }}>
                  <Icon name={v.icon} size={21} color={active ? C.gold : C.faint} />
                </motion.span>
                <span style={{ position: "relative", fontSize: TS.nav, fontWeight: active ? 700 : 500,
                  fontFamily: C.sans, color: active ? C.gold : C.faint, letterSpacing: "0.01em" }}>{v.label}</span>
              </motion.button>
            );
          })}
        </nav>
      )}

      <PackagePreviewModal
        open={packageOpen}
        onClose={() => setPackageOpen(false)}
        genResult={genResult}
        application={application}
        coverLetter={coverLetter}
        interviewTips={interviewTips}
        onCopyCoverLetter={copyCoverLetter}
        copied={copied}
        onDownloadAll={downloadPackage}
        downloading={downloading}
      />
    </motion.div>
  );
}