"use client";
import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { ShieldCheck, Zap, FileCheck2 } from "lucide-react";
import { Reveal, ScrollBlend, SECTION_WRAP, EYEBROW } from "./shared";
import { ResumeDocument } from "../shared/ResumeDocument";
import { RESUMES } from "../shared/prebuiltResumes";

const TRUST = [
  { Icon: ShieldCheck, label: "Anonymous by default, account optional" },
  { Icon: Zap, label: "Tailored in under 2 minutes" },
  { Icon: FileCheck2, label: "Real, editable .docx & PDF" },
];

// Same Letter-page pixel size Resume.js's own "My Resumes" mode renders
// at (LETTER_WIDTH_PX/LETTER_HEIGHT_PX there) — this isn't a new size
// invented for the landing page, it's what the real document actually
// measures, just displayed smaller via ResumeDocument's own `scale` prop
// (the same mechanism ResumePageSheet already uses everywhere else for
// on-screen preview sizing).
const PAGE_WIDTH = 816;
const PAGE_HEIGHT = 1056;
const SHOWCASE_STYLE = { font: "calibri", fontSize: 11, lineHeight: 1.4, accent: "navy" };

// Two of the three real layouts (resumeLayouts/registry.js), same content
// (RESUMES.it — the "Bilingual Service Desk Analyst" example already
// shipped in the product's own "My Resumes" mode), rendered through the
// actual ResumeDocument renderer every real resume in the app uses. Never
// a mockup image or hand-drawn screenshot that can drift out of sync with
// what the product actually looks like.
const SHOWCASE_LAYOUTS = [
  { layout: "classic", label: "Classic", description: "Centered header, colored section rules" },
  { layout: "sidebar", label: "Modern Sidebar", description: "Two columns — colored panel for contact & skills" },
];

function ResumeShowcaseCard({ layout, label, description, delay }) {
  // 300px display width reads as a compact "real example," not a full-size
  // document dropped into a landing page — 300 / PAGE_WIDTH is the scale
  // ResumeDocument needs to hit that target regardless of the page's real
  // pixel dimensions.
  const displayWidth = 300;
  const scale = displayWidth / PAGE_WIDTH;
  const displayHeight = PAGE_HEIGHT * scale;

  return (
    <Reveal delay={delay} className="flex flex-col items-center gap-3">
      <div
        className="overflow-hidden rounded-xl border border-border bg-[#f4f4f4] shadow-[0_16px_40px_-16px_rgba(0,0,0,0.35)]"
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
      <div className="text-center">
        <p className="m-0 text-[13px] font-bold text-foreground">{label}</p>
        <p className="m-0 text-[11.5px] text-muted-foreground">{description}</p>
      </div>
    </Reveal>
  );
}

// ── The "watch it happen" section — right after the Hero, the literal
// next thing you scroll to. Used to be deliberately text-only (a second
// abstract 3D piece stacked directly under the Hero's own scene read as a
// step down in fidelity, not a reinforcement) — but a real, flat, typeset
// resume isn't competing with the Hero's 3D showcase the way another 3D
// scene would; it's the one thing missing from this whole page: an actual
// look at what the product produces, not just a promise that it's good.
// The trust bar stays exactly as it was underneath — the showcase answers
// "what does it look like," the badges answer "why trust it."
export function SeeItHappenSection() {
  const containerRef = useRef(null);
  const inView = useInView(containerRef, { once: true, margin: "-15% 0px -15% 0px" });

  return (
    <section ref={containerRef} className="relative flex min-h-[100dvh] flex-col justify-center overflow-hidden py-20 sm:py-24">
      <ScrollBlend className={SECTION_WRAP}>
        <Reveal className="mx-auto max-w-xl text-center">
          <span className={EYEBROW}>See it happen</span>
          <h2 className="m-0 text-[clamp(1.6rem,4vw,2.4rem)] leading-tight font-bold text-foreground">
            Rough draft in. Ready to send out.
          </h2>
        </Reveal>

        <div className="mt-12 flex flex-wrap items-start justify-center gap-8 sm:gap-10">
          {SHOWCASE_LAYOUTS.map((s, i) => (
            <ResumeShowcaseCard key={s.layout} {...s} delay={i * 0.12} />
          ))}
        </div>

        {/* Popped in staggered, one badge at a time, once this section
            scrolls into view — the "magic" beat replacing the old
            paragraph of explaining, show instead of tell. */}
        <ul className="m-0 mt-12 flex list-none flex-wrap items-center justify-center gap-3 p-0">
          {TRUST.map(({ Icon, label }, i) => (
            <motion.li
              key={label}
              initial={{ opacity: 0, scale: 0.4, y: 10 }}
              animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
              transition={{ type: "spring", stiffness: 340, damping: 18, delay: 0.15 + i * 0.13 }}
              className="flex items-center gap-2.5 rounded-full border border-border bg-card px-4 py-2 text-[14px] font-medium text-foreground"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Icon className="size-3.5" />
              </span>
              {label}
            </motion.li>
          ))}
        </ul>
      </ScrollBlend>
    </section>
  );
}
