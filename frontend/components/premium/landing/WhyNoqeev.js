"use client";
import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Sparkles, ShieldOff, FileCheck2, Hammer, LayoutDashboard } from "lucide-react";
import { Reveal, SECTION_WRAP, EYEBROW } from "./shared";

const FEATURES = [
  { Icon: LayoutDashboard, title: "One dashboard for the whole job search" },
  { Icon: Sparkles, title: "AI that reads the job, not just your title" },
  { Icon: ShieldOff, title: "Anonymous by default. Account optional." },
  { Icon: FileCheck2, title: "Real files, not a locked preview" },
  { Icon: Hammer, title: "A real trade directory too" },
];

// Subtle pointer-tracked tilt on desktop only (a mouse is required for the
// illusion to read correctly) — a light, GPU-cheap rotateX/rotateY spring,
// not a full parallax scene, so it stays smooth on modest hardware.
function TiltCard({ children, delay, className }) {
  const ref = useRef(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(my, [0, 1], [7, -7]), { damping: 20, stiffness: 220 });
  const rotateY = useSpring(useTransform(mx, [0, 1], [-7, 7]), { damping: 20, stiffness: 220 });

  const onMouseMove = (e) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };
  const onMouseLeave = () => { mx.set(0.5); my.set(0.5); };

  return (
    <Reveal delay={delay} className={`[perspective:1000px] ${className || ""}`}>
      <motion.div
        ref={ref}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="h-full rounded-2xl border border-border bg-card p-6"
      >
        {children}
      </motion.div>
    </Reveal>
  );
}

export function WhyNoqeev() {
  return (
    <section id="features" className="relative py-24 sm:py-28" style={{ scrollMarginTop: "72px" }}>
      <div className={SECTION_WRAP}>
        <Reveal className="mx-auto max-w-xl text-center">
          <span className={EYEBROW}>Why Noqeev</span>
          <h2 className="m-0 text-[clamp(1.6rem,4vw,2.4rem)] leading-tight font-bold text-foreground">
            Built to get you hired, not to collect your data.
          </h2>
        </Reveal>

        {/* 5 cards in a 2-column grid — an odd count would otherwise leave
            the last card alone in a mostly-empty row on every width from
            sm up (this is what iPad landing/dashboard were both actually
            hitting). The last card spans both columns and self-centers
            instead, reading as a deliberate closing card, not a leftover. */}
        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {FEATURES.map((f, i) => (
            <TiltCard
              key={f.title}
              delay={i * 0.08}
              className={i === FEATURES.length - 1 ? "sm:col-span-2" : ""}
            >
              <div className={i === FEATURES.length - 1 ? "sm:mx-auto sm:max-w-md" : ""}>
                <div className="flex size-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
                  <f.Icon className="size-5 text-primary" />
                </div>
                <h3 className="m-0 mt-4 text-[16.5px] font-bold text-foreground">{f.title}</h3>
              </div>
            </TiltCard>
          ))}
        </div>
      </div>
    </section>
  );
}
