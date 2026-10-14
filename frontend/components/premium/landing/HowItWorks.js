"use client";
import { UserRound, ClipboardPaste, Download } from "lucide-react";
import { Reveal, ScrollBlend, SECTION_WRAP, EYEBROW, SectionGlow, IPhoneFrame } from "./shared";
import { useLanguage } from "@/lib/i18n";

const steps = (t) => [
  { Icon: UserRound, step: "01", title: t("landing.step1") },
  { Icon: ClipboardPaste, step: "02", title: t("landing.step2") },
  { Icon: Download, step: "03", title: t("landing.step3") },
];

// Real screen recordings (same raw footage as SeeItHappenSection.js, sped
// up ~3.5-4x) inside plain-CSS device frames — no screenshot assets, just
// borders/radii shaped like the real hardware. Fast on purpose: this is
// the "glance and get it" section, not the detailed one — the full-speed,
// full-resume walkthrough already lives one scroll up.
function MacBookFrame() {
  return (
    <div className="w-full max-w-[460px]">
      <div className="rounded-t-[10px] border-[5px] border-b-0 border-[#1d1d1f] bg-[#1d1d1f] p-[2px] shadow-[0_30px_70px_-24px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-center bg-[#1d1d1f] py-[3px]">
          <span className="size-[3px] rounded-full bg-[#49494b]" />
        </div>
        <div className="overflow-hidden rounded-[2px] bg-black">
          <video className="block w-full" autoPlay muted loop playsInline poster="/video/howitworks-macbook-poster.jpg">
            <source src="/video/howitworks-macbook.webm" type="video/webm" />
            <source src="/video/howitworks-macbook.mp4" type="video/mp4" />
          </video>
        </div>
      </div>
      <div className="h-[9px] rounded-b-[8px] bg-gradient-to-b from-[#e2e2e2] to-[#c7c7c7]" />
      <div className="mx-auto h-[3px] w-[26%] rounded-b-[5px] bg-[#c7c7c7]" />
    </div>
  );
}


// No overflow-hidden on this section's own className below — same fix as
// WhyNoqeev.js: this glow's radial falloff isn't fully transparent yet at
// this section's own top edge, so clipping it there left a visible hard
// line at the boundary instead of a blend. Letting it bleed upward into
// the section above (same color/gradient, nothing changed about it) is
// what removes the line.
export function HowItWorks() {
  const { t } = useLanguage();
  const STEPS = steps(t);
  return (
    <section id="how-it-works" className="relative flex min-h-[100svh] flex-col justify-center py-24 sm:py-28" style={{ scrollMarginTop: "72px" }}>
      <SectionGlow color="emerald" side="right" />
      <ScrollBlend className={SECTION_WRAP}>
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <span className={EYEBROW}>{t("landing.howItWorksEyebrow")}</span>
            <h2 className="m-0 mb-8 text-[clamp(1.6rem,4vw,2.4rem)] leading-tight font-bold text-foreground">
              {t("landing.howItWorksTitle")}
            </h2>
            <div className="flex flex-col">
              {STEPS.map((s, i) => (
                <div key={s.step} className={`flex items-center gap-4 py-3.5 ${i > 0 ? "border-t border-border" : ""}`}>
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-background text-primary">
                    <s.Icon className="size-5" />
                  </div>
                  <div>
                    <span className="block font-mono text-[10.5px] font-bold tracking-[0.18em] text-primary-text">{t("landing.step", { n: s.step })}</span>
                    <h3 className="m-0 mt-0.5 text-[15px] font-bold text-foreground">{s.title}</h3>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.1} className="relative flex items-end justify-center gap-0 lg:justify-start">
            <MacBookFrame />
            <div className="absolute right-[2%] -bottom-6 w-[128px] sm:right-[6%] sm:w-[148px]">
              <IPhoneFrame>
                <video className="block w-full" autoPlay muted loop playsInline poster="/video/howitworks-iphone-poster.jpg">
                  <source src="/video/howitworks-iphone.webm" type="video/webm" />
                  <source src="/video/howitworks-iphone.mp4" type="video/mp4" />
                </video>
              </IPhoneFrame>
            </div>
          </Reveal>
        </div>
      </ScrollBlend>
    </section>
  );
}
