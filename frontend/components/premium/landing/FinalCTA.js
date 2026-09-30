"use client";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Reveal, ScrollBlend, SECTION_WRAP, CARD, SectionGlow } from "./shared";
import { LogoMark } from "../Logo";

export function FinalCTA({ onOpen, onOpenDashboard }) {
  return (
    <section className="relative flex min-h-[100dvh] flex-col justify-center overflow-hidden py-24 sm:py-28">
      <SectionGlow color="amber" side="left" />
      <ScrollBlend className={`${SECTION_WRAP} relative`}>
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal className={`${CARD} order-2 flex items-center justify-center lg:order-1`}>
            <LogoMark size={88} />
          </Reveal>

          {/* order-1 on mobile so the words sit at the top of the stack,
              same as Hero — the card only goes above the text at lg. */}
          <Reveal delay={0.1} className="order-1 flex flex-col items-start gap-6 lg:order-2">
            <h2 className="m-0 text-[clamp(1.8rem,5vw,2.5rem)] leading-[1.1] font-bold text-foreground">
              Build a tailored resume. No account required to start.
            </h2>
            <motion.button
              onClick={onOpenDashboard}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", damping: 22, stiffness: 400 }}
              className="flex min-h-[54px] items-center gap-2 rounded-2xl border-none bg-primary px-8 text-[15.5px] font-bold text-primary-foreground [-webkit-tap-highlight-color:transparent] [touch-action:manipulation]"
            >
              Get started
              <ArrowRight className="size-4" />
            </motion.button>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <button
                onClick={onOpen}
                className="border-none bg-transparent p-0 text-[13px] font-semibold text-muted-foreground [-webkit-tap-highlight-color:transparent] hover:text-foreground"
              >
                Resume Studio →
              </button>
            </div>
          </Reveal>
        </div>
      </ScrollBlend>
    </section>
  );
}
