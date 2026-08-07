"use client";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Reveal, SECTION_WRAP } from "./shared";

export function FinalCTA({ onOpen, onOpenDashboard }) {
  return (
    <section className="relative overflow-hidden py-24 sm:py-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 size-[600px] -translate-x-1/2 -translate-y-1/2 opacity-40"
        style={{ background: "radial-gradient(circle, color-mix(in oklch, var(--primary) 14%, transparent) 0%, transparent 70%)" }}
      />
      <div className={`${SECTION_WRAP} relative`}>
        <Reveal className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
          <h2 className="m-0 text-[clamp(1.8rem,5vw,2.75rem)] leading-[1.1] font-bold text-foreground">
            Your next chance starts with one resume.
          </h2>
          <p className="m-0 max-w-md text-[14.5px] leading-relaxed text-muted-foreground">
            No account to make, nothing to delete later. Just open your
            dashboard and see what two minutes gets you.
          </p>
          <motion.button
            onClick={onOpenDashboard}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", damping: 22, stiffness: 400 }}
            className="flex min-h-[54px] items-center gap-2 rounded-2xl border-none bg-primary px-8 text-[15.5px] font-bold text-primary-foreground [-webkit-tap-highlight-color:transparent] [touch-action:manipulation]"
          >
            Dashboard
            <ArrowRight className="size-4" />
          </motion.button>
          <button
            onClick={onOpen}
            className="border-none bg-transparent p-0 text-[13px] font-semibold text-muted-foreground [-webkit-tap-highlight-color:transparent]"
          >
            Resume Studio →
          </button>
        </Reveal>
      </div>
    </section>
  );
}
