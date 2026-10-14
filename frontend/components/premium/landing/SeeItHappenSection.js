"use client";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { RefreshCw, Zap, FileCheck2 } from "lucide-react";
import { Reveal, ScrollBlend, SECTION_WRAP, EYEBROW, CARD, SectionGlow, IPhoneFrame, IPadFrame } from "./shared";
import { useLanguage } from "@/lib/i18n";
import { useViewport } from "@/lib/useViewport";

const trust = (t) => [
  { Icon: RefreshCw, label: t("landing.trust1") },
  { Icon: Zap, label: t("landing.trust2") },
  { Icon: FileCheck2, label: t("landing.trust3") },
];

export function SeeItHappenSection() {
  const { t } = useLanguage();
  const TRUST = trust(t);
  const containerRef = useRef(null);
  const inView = useInView(containerRef, { once: true, margin: "-15% 0px -15% 0px" });
  // Tablet gets the same real split-screen workspace desktop does in the
  // actual builder (GuestMode.js's own showSplit = isDesktop || isTablet),
  // so it gets the desktop recording too, just inside an iPad-shaped frame
  // instead of desktop's plain bordered box — only a real phone gets the
  // phone recording.
  const { isPhone, isTablet } = useViewport();

  return (
    <section ref={containerRef} className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden py-10 sm:py-24">
      <SectionGlow color="emerald" side="right" />
      {/* The hero-to-this-section handoff — deliberately a long, eased
          falloff (not a short linear one) so the dark hero and this
          section's own light background never read as two panels
          meeting at a seam. A plain 0%-to-100% linear mask over a short
          distance still shows a perceptible "line" around its own
          midpoint, since contrast there is still changing fast per
          pixel; stretching the same fade over roughly double the
          distance and easing through more intermediate stops spreads
          that change thin enough nothing reads as an edge. */}
      <div
        aria-hidden="true"
        className="dark pointer-events-none absolute inset-x-0 top-0 h-56 bg-background sm:h-80"
        style={{
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, rgba(0,0,0,0.92) 15%, rgba(0,0,0,0.65) 38%, rgba(0,0,0,0.32) 62%, rgba(0,0,0,0.08) 85%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, black 0%, rgba(0,0,0,0.92) 15%, rgba(0,0,0,0.65) 38%, rgba(0,0,0,0.32) 62%, rgba(0,0,0,0.08) 85%, transparent 100%)",
        }}
      />
      <ScrollBlend className={SECTION_WRAP}>
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <span className={EYEBROW}>{t("landing.seeItHappenEyebrow")}</span>
            <h2 className="m-0 text-[clamp(1.5rem,4vw,2.4rem)] leading-tight font-bold text-foreground">
              {t("landing.seeItHappenTitle")}
            </h2>
            <p className="m-0 mt-2.5 max-w-sm text-[13.5px] leading-relaxed text-muted-foreground sm:mt-3 sm:text-[14.5px]">
              {t("landing.seeItHappenSubtitle")}
            </p>
            <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0 sm:mt-6 sm:gap-2.5">
              {TRUST.map(({ Icon, label }, i) => (
                <motion.li
                  key={label}
                  initial={{ opacity: 0, x: -12 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ type: "spring", stiffness: 340, damping: 22, delay: 0.15 + i * 0.1 }}
                  className="flex items-center gap-2.5 text-[12.5px] font-semibold text-foreground sm:text-[13px]"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Icon className="size-3.5" />
                  </span>
                  {label}
                </motion.li>
              ))}
            </ul>
          </Reveal>

          {/* Real screen recordings of the actual builder, not a scripted
              animation or a canned "live demo" button, inside real device
              frames (shared.js's IPhoneFrame/IPadFrame — plain CSS, no
              screenshot assets) so this reads as "a real phone/tablet
              running the real app," not an arbitrary bordered box. Sized
              deliberately small on phone (~130px) — this section's own
              text already fills most of a phone viewport, and a visitor
              having to scroll just to see the whole "See it happen" block
              (text + video) in one glance defeats the point of it being
              the very next thing after the hero. muted+playsInline so
              autoplay is allowed on mobile Safari/Chrome without a tap;
              loop since there's no narration or audio track to desync. */}
          {isPhone ? (
            <Reveal delay={0.1} className="flex justify-center">
              <IPhoneFrame className="w-[160px]">
                <video key="mobile" className="block w-full" autoPlay muted loop playsInline poster="/video/landing-demo-mobile-poster.jpg">
                  <source src="/video/landing-demo-mobile.webm" type="video/webm" />
                  <source src="/video/landing-demo-mobile.mp4" type="video/mp4" />
                </video>
              </IPhoneFrame>
            </Reveal>
          ) : isTablet ? (
            <Reveal delay={0.1} className="flex justify-center lg:justify-start">
              <IPadFrame className="w-full max-w-md">
                <video key="tablet" className="block w-full" autoPlay muted loop playsInline poster="/video/landing-demo-desktop-poster.jpg">
                  <source src="/video/landing-demo-desktop.webm" type="video/webm" />
                  <source src="/video/landing-demo-desktop.mp4" type="video/mp4" />
                </video>
              </IPadFrame>
            </Reveal>
          ) : (
            <Reveal delay={0.1} className={`${CARD} flex flex-col items-center justify-center`}>
              <div className="mx-auto w-full max-w-xl overflow-hidden rounded-lg border border-border shadow-[0_12px_28px_-14px_rgba(0,0,0,0.35)]">
                <video key="desktop" className="block w-full" autoPlay muted loop playsInline poster="/video/landing-demo-desktop-poster.jpg">
                  <source src="/video/landing-demo-desktop.webm" type="video/webm" />
                  <source src="/video/landing-demo-desktop.mp4" type="video/mp4" />
                </video>
              </div>
            </Reveal>
          )}
        </div>
      </ScrollBlend>
    </section>
  );
}
