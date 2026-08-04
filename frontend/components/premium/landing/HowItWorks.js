"use client";
import { UserRound, ClipboardPaste, Download } from "lucide-react";
import { Reveal, SECTION_WRAP, EYEBROW } from "./shared";

const STEPS = [
  { Icon: UserRound, step: "01", title: "Tell us who you are", body: "Name, background, past roles — just what a resume needs, nothing more." },
  { Icon: ClipboardPaste, step: "02", title: "Paste the job posting", body: "Any job board, any format. The AI reads it and finds what actually matters." },
  { Icon: Download, step: "03", title: "Download and apply", body: "A tailored resume, cover letter, and apply-ready package — real files, instantly." },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24 sm:py-28" style={{ scrollMarginTop: "72px" }}>
      <div className={SECTION_WRAP}>
        <Reveal className="mx-auto max-w-xl text-center">
          <span className={EYEBROW}>How it works</span>
          <h2 className="m-0 text-[clamp(1.6rem,4vw,2.4rem)] leading-tight font-bold text-foreground">
            Three steps. Under two minutes.
          </h2>
        </Reveal>

        <div className="relative mt-16 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-6">
          {/* Connecting line — desktop only, sits behind the numbered icons */}
          <div
            aria-hidden="true"
            className="absolute top-6 right-[16%] left-[16%] hidden h-px sm:block"
            style={{ background: "linear-gradient(90deg, transparent, var(--border) 15%, var(--border) 85%, transparent)" }}
          />
          {STEPS.map((s, i) => (
            <Reveal key={s.step} delay={i * 0.12} className="relative flex flex-col items-center text-center">
              <div className="relative z-10 flex size-12 items-center justify-center rounded-full border border-primary/30 bg-background text-primary shadow-[0_0_0_6px_var(--background)]">
                <s.Icon className="size-5" />
              </div>
              <span className="mt-4 font-mono text-[11px] font-bold tracking-[0.18em] text-primary/70">STEP {s.step}</span>
              <h3 className="m-0 mt-1.5 text-[16px] font-bold text-foreground">{s.title}</h3>
              <p className="m-0 mt-2 max-w-[240px] text-[13.5px] leading-relaxed text-muted-foreground">{s.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
