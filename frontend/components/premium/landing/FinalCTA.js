"use client";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import { Reveal, ScrollBlend, SECTION_WRAP, CARD, SectionGlow } from "./shared";
import { LogoMark } from "../Logo";
import { useLanguage } from "@/lib/i18n";

// The closing moment of the page, so the brand mark gets its own small
// reveal instead of just sitting there static — the mark scales/fades in,
// a single light sweep crosses it (same "scanning" language the app's own
// ScreenLoading uses while something real is loading, borrowed here as a
// one-shot flourish rather than an infinite loop), then the wordmark
// slides in after it settles. Plays once (`once: true`), the same rule
// every other scroll-reveal on this page already follows — a premium
// closing beat settles, it doesn't replay every time someone scrolls past.
function AnimatedLockup({ size = 80 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  return (
    <div ref={ref} className="flex items-center gap-4">
      <div className="relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
        >
          <LogoMark size={size} />
        </motion.div>
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2"
          style={{ background: "linear-gradient(90deg, transparent, color-mix(in oklch, var(--primary) 60%, transparent), transparent)" }}
          initial={{ x: "0%", opacity: 0 }}
          animate={inView ? { x: ["0%", "260%"], opacity: [0, 1, 1, 0] } : {}}
          transition={{ duration: 1, delay: 0.35, ease: "easeInOut" }}
        />
      </div>
      <motion.span
        initial={{ opacity: 0, x: -22 }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
        style={{
          fontFamily: "var(--font-wordmark)",
          fontSize: Math.round(size * 0.52),
          fontWeight: 800,
          letterSpacing: "0.02em",
          color: "var(--foreground)",
          lineHeight: 1,
        }}
      >
        NOQEEV
      </motion.span>
    </div>
  );
}

// No overflow-hidden on this section's own className below — same fix as
// WhyNoqeev.js: lets this glow bleed upward into FAQ above instead of
// getting hard-clipped at this section's own top edge, which is what was
// reading as a visible line at the boundary.
export function FinalCTA({ onOpenSignup }) {
  const { t } = useLanguage();
  return (
    <section className="relative flex min-h-[100svh] flex-col justify-center py-24 sm:py-28">
      <SectionGlow color="amber" side="left" />
      <ScrollBlend className={`${SECTION_WRAP} relative`}>
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal className={`${CARD} order-2 flex items-center justify-center lg:order-1`}>
            <AnimatedLockup size={80} />
          </Reveal>

          {/* order-1 on mobile so the words sit at the top of the stack,
              same as Hero — the card only goes above the text at lg. */}
          <Reveal delay={0.1} className="order-1 flex flex-col items-start gap-6 lg:order-2">
            <h2 className="m-0 text-[clamp(1.8rem,5vw,2.5rem)] leading-[1.1] font-bold text-foreground">
              {t("finalCta.headline")}
            </h2>
            {/* Same real claim Hero's own trust row makes, reinforced right
                at the final conversion moment — reuses the existing
                freeAccountNote string (today only shown once, buried in
                the Footer) instead of a new key. */}
            <p className="m-0 -mt-3 text-[13px] font-semibold text-muted-foreground">
              {t("landing.freeAccountNote")}
            </p>
            <motion.button
              onClick={onOpenSignup}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", damping: 22, stiffness: 400 }}
              className="flex min-h-[54px] items-center gap-2 rounded-2xl border-none bg-primary px-8 text-[15.5px] font-bold text-primary-foreground [-webkit-tap-highlight-color:transparent] [touch-action:manipulation]"
            >
              {t("finalCta.createResume")}
              <ArrowRight className="size-4" />
            </motion.button>
          </Reveal>
        </div>
      </ScrollBlend>
    </section>
  );
}
