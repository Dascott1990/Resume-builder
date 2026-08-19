"use client";
import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { ShieldCheck, Zap, FileCheck2 } from "lucide-react";
import { Reveal, SECTION_WRAP, EYEBROW } from "./shared";

const TRUST = [
  { Icon: ShieldCheck, label: "Anonymous by default, account optional" },
  { Icon: Zap, label: "Tailored in under 2 minutes" },
  { Icon: FileCheck2, label: "Real, editable .docx & PDF" },
];

// ── The "watch it happen" section — right after the Hero, the literal
// next thing you scroll to. Deliberately text-only now: it used to carry
// its own boxed 3D showcase, but stacking a second 3D piece directly under
// the Hero's own (now much richer, real-handwriting) scene read as a step
// down in fidelity rather than a reinforcement — a plainer abstract mark
// right after the most polished moment on the page undercut it instead of
// building on it. A clean, centered trust bar carries the same three
// proof points without competing with what the Hero just showed.
export function PaperTransformSection() {
  const containerRef = useRef(null);
  const inView = useInView(containerRef, { once: true, margin: "-15% 0px -15% 0px" });

  return (
    <section ref={containerRef} className="relative overflow-hidden py-20 sm:py-24">
      <div className={SECTION_WRAP}>
        <Reveal className="mx-auto max-w-xl text-center">
          <span className={EYEBROW}>See it happen</span>
          <h2 className="m-0 text-[clamp(1.6rem,4vw,2.4rem)] leading-tight font-bold text-foreground">
            Rough draft in. Ready to send out.
          </h2>
        </Reveal>

        {/* Popped in staggered, one badge at a time, once this section
            scrolls into view — the "magic" beat replacing the old
            paragraph of explaining, show instead of tell. */}
        <ul className="m-0 mt-8 flex list-none flex-wrap items-center justify-center gap-3 p-0">
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
      </div>
    </section>
  );
}
