"use client";
import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { ShieldCheck, Zap, FileCheck2 } from "lucide-react";
import { Reveal, SECTION_WRAP, EYEBROW } from "./shared";
import PaperTransformScene3D from "../PaperTransformScene3D";

const TRUST = [
  { Icon: ShieldCheck, label: "Anonymous by default, account optional" },
  { Icon: Zap, label: "Tailored in under 2 minutes" },
  { Icon: FileCheck2, label: "Real, editable .docx & PDF" },
];

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

            {/* Popped in staggered, one badge at a time, once this section
                scrolls into view — the "magic" beat replacing the old
                paragraph of explaining, show instead of tell. */}
            <ul className="m-0 mt-5 flex list-none flex-col gap-2.5 p-0">
              {TRUST.map(({ Icon, label }, i) => (
                <motion.li
                  key={label}
                  initial={{ opacity: 0, scale: 0.4, y: 10 }}
                  animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
                  transition={{ type: "spring", stiffness: 340, damping: 18, delay: 0.15 + i * 0.13 }}
                  className="flex items-center gap-2.5 text-[14.5px] font-medium text-foreground"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Icon className="size-3.5" />
                  </span>
                  {label}
                </motion.li>
              ))}
            </ul>
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
