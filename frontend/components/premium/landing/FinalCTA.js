"use client";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Reveal, ScrollBlend, SECTION_WRAP, CARD, SectionGlow } from "./shared";
import { LogoMark } from "../Logo";

// No overflow-hidden on this section's own className below — same fix as
// WhyNoqeev.js: lets this glow bleed upward into FAQ above instead of
// getting hard-clipped at this section's own top edge, which is what was
// reading as a visible line at the boundary.
export function FinalCTA({ onOpenSignup }) {
  return (
    <section className="relative flex min-h-[100svh] flex-col justify-center py-24 sm:py-28">
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
              Set up your profile once. Get a tailored resume for every job after that.
            </h2>
            <motion.button
              onClick={onOpenSignup}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", damping: 22, stiffness: 400 }}
              className="flex min-h-[54px] items-center gap-2 rounded-2xl border-none bg-primary px-8 text-[15.5px] font-bold text-primary-foreground [-webkit-tap-highlight-color:transparent] [touch-action:manipulation]"
            >
              Create Resume
              <ArrowRight className="size-4" />
            </motion.button>
          </Reveal>
        </div>
      </ScrollBlend>
    </section>
  );
}
