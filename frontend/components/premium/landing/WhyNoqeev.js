"use client";
import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Sparkles, ShieldCheck, FileCheck2, Hammer, LayoutDashboard, Bot, Lock, ClipboardList } from "lucide-react";
import { Reveal, ScrollBlend, SECTION_WRAP, EYEBROW } from "./shared";

const FEATURES = [
  { Icon: LayoutDashboard, title: "One dashboard for the whole job search" },
  { Icon: Sparkles, title: "Every resume tailored to the actual posting, not a template" },
  // ShieldCheck, not ShieldOff — this is a privacy WIN (no account wall),
  // and a slashed shield reads as "unprotected," the opposite point.
  // Matches SeeItHappenSection.js's identical claim, same icon.
  { Icon: ShieldCheck, title: "Anonymous by default. Account optional." },
  { Icon: FileCheck2, title: "Real, editable files — no locked preview, no watermark" },
  // Structural guarantee, not a policy promise — apply.py's agent schema
  // has no submit tool at all, so there's nothing for it to call even if
  // asked to. Worth stating plainly, not just implying "AI" is careful.
  { Icon: Bot, title: "Auto Apply fills real applications — it never submits without you" },
  { Icon: ClipboardList, title: "Scan an existing resume, or track every application you send" },
  { Icon: Hammer, title: "A local artisan network — real profiles, ID and insurance reviewed" },
  { Icon: Lock, title: "Artisan payments held in escrow until you confirm the job is done" },
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
    <section id="features" className="relative flex min-h-[100dvh] flex-col justify-center py-24 sm:py-28" style={{ scrollMarginTop: "72px" }}>
      <ScrollBlend className={SECTION_WRAP}>
        <Reveal className="mx-auto max-w-xl text-center">
          <span className={EYEBROW}>Why Noqeev</span>
          <h2 className="m-0 text-[clamp(1.6rem,4vw,2.4rem)] leading-tight font-bold text-foreground">
            Built to get you hired, not to collect your data.
          </h2>
        </Reveal>

        {/* 2-column grid — an ODD count would otherwise leave the last card
            alone in a mostly-empty row on every width from sm up (this is
            what iPad landing/dashboard were both actually hitting), so an
            odd-length FEATURES spans that last card across both columns
            and self-centers it instead, reading as a deliberate closing
            card rather than a leftover. Even-length FEATURES (as of this
            writing) fills every row already, so this is a no-op today. */}
        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {FEATURES.map((f, i) => {
            const isDanglingLast = FEATURES.length % 2 === 1 && i === FEATURES.length - 1;
            return (
            <TiltCard
              key={f.title}
              delay={i * 0.08}
              className={isDanglingLast ? "sm:col-span-2" : ""}
            >
              <div className={isDanglingLast ? "sm:mx-auto sm:max-w-md" : ""}>
                <div className="flex size-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
                  <f.Icon className="size-5 text-primary" />
                </div>
                <h3 className="m-0 mt-4 text-[16.5px] font-bold text-foreground">{f.title}</h3>
              </div>
            </TiltCard>
            );
          })}
        </div>
      </ScrollBlend>
    </section>
  );
}
