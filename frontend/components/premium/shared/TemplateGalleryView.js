"use client";
/**
 * TemplateGalleryView.js — "see it before you pick it": a full-screen grid
 * of every structure in templateLibrary.js for one country, each rendered
 * as a real, small ResumeDocument (the exact same renderer the editor
 * itself uses) rather than a screenshot or a mockup — so what's shown here
 * can never drift out of sync with what you actually get after picking it.
 *
 * Opened from Resume.js's Templates panel ("Browse all") as an alternative
 * to the compact text list there — that list is faster once you already
 * know roughly what you want; this is for comparing options visually
 * before you've decided.
 */
import { useMemo } from "react";
import { X } from "lucide-react";
import { ResumeDocument } from "./ResumeDocument";
import { getVariantsForCountry, buildResumeFromTemplate } from "./templateLibrary";

const PAGE_W = 816; // US Letter @ 96dpi — same constants Resume.js's own editor uses
const PAGE_H = 1056;
const THUMB_SCALE = 0.24;

function TemplateThumb({ country, variant, style, active, onClick }) {
  const resume = useMemo(() => buildResumeFromTemplate(country, variant.id), [country, variant.id]);
  return (
    <button
      type="button" onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-xl border p-2.5 text-center transition-colors ${
        active ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:border-primary/20"
      }`}
    >
      <div className="pointer-events-none overflow-hidden rounded-[4px]" style={{ width: PAGE_W * THUMB_SCALE, height: PAGE_H * THUMB_SCALE }}>
        <ResumeDocument
          resume={resume} style={style} scale={THUMB_SCALE}
          pageWidth={PAGE_W} pageHeight={PAGE_H}
          shadowClassName="shadow-[0_2px_10px_rgba(0,0,0,0.18)]"
        />
      </div>
      <div className="min-w-0">
        <p className={`m-0 text-[11.5px] font-semibold ${active ? "text-primary" : "text-foreground"}`}>{variant.label}</p>
        <p className="m-0 mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">{variant.persona}</p>
      </div>
    </button>
  );
}

export function TemplateGalleryView({ open, country, onCountryChange, activeId, style, onSelect, onClose }) {
  if (!open) return null;
  const grouped = getVariantsForCountry(country).reduce((groups, v) => {
    (groups[v.group] ||= []).push(v);
    return groups;
  }, {});

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-8">
        <div>
          <p className="m-0 text-[15px] font-bold text-foreground">Browse templates</p>
          <p className="m-0 text-[11.5px] text-muted-foreground">Every real layout for this country, at a glance — tap one to open it</p>
        </div>
        <div className="flex items-center gap-2">
          {[{ code: "CA", name: "Canada" }, { code: "US", name: "United States" }].map((c) => (
            <button key={c.code} type="button" onClick={() => onCountryChange(c.code)}
              aria-pressed={country === c.code}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                country === c.code ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
              }`}>
              {c.name}
            </button>
          ))}
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-full border border-border bg-card">
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-8">
        {Object.entries(grouped).map(([groupLabel, variants]) => (
          <div key={groupLabel} className="mb-6">
            <p className="m-0 mb-2.5 font-mono text-[10.5px] font-bold tracking-[0.1em] text-muted-foreground/60 uppercase">{groupLabel}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {variants.map((v) => (
                <TemplateThumb
                  key={v.id} country={country} variant={v} style={style}
                  active={activeId === v.id}
                  onClick={() => onSelect(v.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
