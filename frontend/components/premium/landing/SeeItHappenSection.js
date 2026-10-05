"use client";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { RefreshCw, Zap, FileCheck2 } from "lucide-react";
import { Reveal, ScrollBlend, SECTION_WRAP, EYEBROW, CARD, SectionGlow } from "./shared";
import { ResumeDocument } from "../shared/ResumeDocument";
import { RESUMES } from "../shared/prebuiltResumes";

const TRUST = [
  { Icon: RefreshCw, label: "Save your profile once, reuse it every time" },
  { Icon: Zap, label: "Tailored in under 2 minutes" },
  { Icon: FileCheck2, label: "Real, editable .docx and PDF" },
];

// Same Letter-page pixel size Resume.js's own "My Resumes" mode renders
// at (LETTER_WIDTH_PX/LETTER_HEIGHT_PX there) — this isn't a new size
// invented for the landing page, it's what the real document actually
// measures, just displayed smaller via ResumeDocument's own `scale` prop.
const PAGE_WIDTH = 816;
const PAGE_HEIGHT = 1056;
const SHOWCASE_STYLE = { font: "calibri", fontSize: 11, lineHeight: 1.4, accent: "navy" };

// Two of the three real layouts (resumeLayouts/registry.js), same content
// (RESUMES.it), rendered through the actual ResumeDocument renderer every
// real resume in the app uses — never a mockup image.
const SHOWCASE_LAYOUTS = [
  { layout: "classic", label: "Classic" },
  { layout: "sidebar", label: "Sidebar" },
];

function ResumeMini({ layout, label }) {
  const displayWidth = 148;
  const scale = displayWidth / PAGE_WIDTH;
  const displayHeight = PAGE_HEIGHT * scale;
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="overflow-hidden rounded-lg border border-border bg-[#f4f4f4] shadow-[0_12px_28px_-14px_rgba(0,0,0,0.35)]"
        style={{ width: displayWidth, height: displayHeight }}
      >
        <ResumeDocument
          resume={RESUMES.it}
          style={{ ...SHOWCASE_STYLE, layout }}
          scale={scale}
          pageWidth={PAGE_WIDTH}
          pageHeight={PAGE_HEIGHT}
          shadowClassName=""
        />
      </div>
      <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
    </div>
  );
}

// ── The "watch it happen" section — right after the Hero. Words on the
// left name what it does; the card on the right shows it, two real
// layouts rendered through the same component every actual resume in the
// product uses, never a mockup.
export function SeeItHappenSection() {
  const containerRef = useRef(null);
  const inView = useInView(containerRef, { once: true, margin: "-15% 0px -15% 0px" });

  return (
    <section ref={containerRef} className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden py-20 sm:py-24">
      <SectionGlow color="emerald" side="right" />
      <ScrollBlend className={SECTION_WRAP}>
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <span className={EYEBROW}>See it happen</span>
            <h2 className="m-0 text-[clamp(1.6rem,4vw,2.4rem)] leading-tight font-bold text-foreground">
              Rough draft in. Ready to send out.
            </h2>
            <p className="m-0 mt-3 max-w-sm text-[14.5px] leading-relaxed text-muted-foreground">
              A real, typeset resume, not a preview. Pick a layout and it's ready in minutes.
            </p>
            <ul className="m-0 mt-6 flex list-none flex-col gap-2.5 p-0">
              {TRUST.map(({ Icon, label }, i) => (
                <motion.li
                  key={label}
                  initial={{ opacity: 0, x: -12 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ type: "spring", stiffness: 340, damping: 22, delay: 0.15 + i * 0.1 }}
                  className="flex items-center gap-2.5 text-[13px] font-semibold text-foreground"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Icon className="size-3.5" />
                  </span>
                  {label}
                </motion.li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.1} className={`${CARD} flex items-center justify-center gap-6`}>
            {SHOWCASE_LAYOUTS.map((s) => (
              <ResumeMini key={s.layout} {...s} />
            ))}
          </Reveal>
        </div>
      </ScrollBlend>
    </section>
  );
}
