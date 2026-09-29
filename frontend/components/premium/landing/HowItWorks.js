"use client";
import { UserRound, ClipboardPaste, Download } from "lucide-react";
import { Reveal, ScrollBlend, SECTION_WRAP, EYEBROW, CARD } from "./shared";

const STEPS = [
  { Icon: UserRound, step: "01", title: "Tell us who you are" },
  { Icon: ClipboardPaste, step: "02", title: "Paste the job posting" },
  { Icon: Download, step: "03", title: "Download and apply" },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative flex min-h-[100dvh] flex-col justify-center py-24 sm:py-28" style={{ scrollMarginTop: "72px" }}>
      <ScrollBlend className={SECTION_WRAP}>
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <span className={EYEBROW}>The resume builder</span>
            <h2 className="m-0 text-[clamp(1.6rem,4vw,2.4rem)] leading-tight font-bold text-foreground">
              Three steps. Under two minutes.
            </h2>
          </Reveal>

          <Reveal delay={0.1} className={`${CARD} flex flex-col`}>
            {STEPS.map((s, i) => (
              <div key={s.step} className={`flex items-center gap-4 py-3.5 ${i > 0 ? "border-t border-border" : ""}`}>
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-background text-primary">
                  <s.Icon className="size-5" />
                </div>
                <div>
                  {/* text-primary-text at full opacity, not text-primary/70
                      — real text needs 4.5:1 against the light background. */}
                  <span className="block font-mono text-[10.5px] font-bold tracking-[0.18em] text-primary-text">STEP {s.step}</span>
                  <h3 className="m-0 mt-0.5 text-[15px] font-bold text-foreground">{s.title}</h3>
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </ScrollBlend>
    </section>
  );
}
