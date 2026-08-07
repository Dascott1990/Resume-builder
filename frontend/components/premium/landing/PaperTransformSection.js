"use client";
import { useRef } from "react";
import { useInView } from "framer-motion";
import { Reveal, SECTION_WRAP, EYEBROW } from "./shared";
import PaperTransformScene3D from "../PaperTransformScene3D";

// ── The "watch it happen" section — right after the Hero, the literal
// next thing you scroll to. The 3D canvas only mounts once this section is
// actually in view (see `inView` below), so the writing animation starts
// fresh from the first stroke the moment someone scrolls to it, instead of
// running on a loop somewhere off-screen and being caught mid-cycle.
export function PaperTransformSection() {
  const containerRef = useRef(null);
  const inView = useInView(containerRef, { once: true, margin: "-15% 0px -15% 0px" });

  return (
    <section ref={containerRef} className="relative overflow-hidden py-24 sm:py-28">
      <div className={SECTION_WRAP}>
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal className="order-2 lg:order-1">
            <span className={EYEBROW}>See it happen</span>
            <h2 className="m-0 text-[clamp(1.6rem,4vw,2.4rem)] leading-tight font-bold text-foreground">
              Rough draft in. Ready to send out.
            </h2>
            <p className="m-0 mt-4 max-w-md text-[14.5px] leading-relaxed text-muted-foreground">
              Whatever you're starting from — scratch notes, an old CV, a resume you
              haven't touched in years — the AI turns it into a clean, structured,
              ATS-ready document in the time it takes to read this sentence.
            </p>
          </Reveal>

          <Reveal delay={0.1} className="order-1 lg:order-2">
            <div
              className="relative aspect-square w-full max-w-[420px] justify-self-center overflow-hidden rounded-[28px] border border-white/[0.1] lg:justify-self-end"
              style={{
                background: "radial-gradient(circle at 50% 42%, color-mix(in oklch, var(--primary) 13%, transparent) 0%, transparent 65%), color-mix(in oklch, var(--card) 55%, transparent)",
                boxShadow: "inset 0 0 70px rgba(0,0,0,0.45), 0 24px 70px rgba(0,0,0,0.4)",
              }}
            >
              {inView && <PaperTransformScene3D style={{ width: "100%", height: "100%" }} />}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
