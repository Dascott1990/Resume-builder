"use client";
import { Sparkles, ShieldCheck, FileCheck2, Hammer, LayoutDashboard, Bot, Lock, ClipboardList } from "lucide-react";
import { Reveal, ScrollBlend, SECTION_WRAP, EYEBROW, CARD, SectionGlow } from "./shared";

const FEATURES = [
  { Icon: LayoutDashboard, title: "One dashboard for the whole job search" },
  { Icon: Sparkles, title: "Every resume tailored to the actual posting, not a template" },
  // ShieldCheck, not ShieldOff — this is a privacy win (no account wall),
  // and a slashed shield reads as "unprotected," the opposite point.
  { Icon: ShieldCheck, title: "Anonymous by default. Account optional." },
  { Icon: FileCheck2, title: "Real, editable files. No locked preview, no watermark." },
  // Structural guarantee, not a policy promise — apply.py's agent schema
  // has no submit tool at all, so there's nothing for it to call even if
  // asked to.
  { Icon: Bot, title: "Auto Apply fills real applications. It never submits without you." },
  { Icon: ClipboardList, title: "Scan an existing resume, or track every application you send" },
  { Icon: Hammer, title: "A local artisan network with real profiles, ID and insurance reviewed" },
  { Icon: Lock, title: "Artisan payments held in escrow until you confirm the job is done" },
];

export function WhyNoqeev() {
  return (
    <section id="features" className="relative flex min-h-[100dvh] flex-col justify-center overflow-hidden py-24 sm:py-28" style={{ scrollMarginTop: "72px" }}>
      <SectionGlow color="amber" side="left" />
      <ScrollBlend className={SECTION_WRAP}>
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal className={`${CARD} order-2 flex flex-col lg:order-1`}>
            {FEATURES.map((f, i) => (
              <div key={f.title} className={`flex items-start gap-3.5 py-3 ${i > 0 ? "border-t border-border" : ""}`}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
                  <f.Icon className="size-4 text-primary" />
                </span>
                <span className="pt-1 text-[13.5px] font-semibold text-foreground">{f.title}</span>
              </div>
            ))}
          </Reveal>

          {/* order-1 on mobile so the words sit at the top of the stack,
              same as Hero — the card only goes above the text at lg,
              where it's genuinely sitting beside it, not above it. */}
          <Reveal delay={0.1} className="order-1 lg:order-2">
            <span className={EYEBROW}>Why Noqeev</span>
            <h2 className="m-0 text-[clamp(1.6rem,4vw,2.4rem)] leading-tight font-bold text-foreground">
              Built to get you hired, not to collect your data.
            </h2>
            <p className="m-0 mt-3 max-w-sm text-[14.5px] leading-relaxed text-muted-foreground">
              Every tool on Noqeev works for you first. No dark patterns, no data harvesting, no locked files.
            </p>
          </Reveal>
        </div>
      </ScrollBlend>
    </section>
  );
}
