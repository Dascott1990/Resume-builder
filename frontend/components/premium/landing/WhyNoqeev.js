"use client";
import { Sparkles, RefreshCw, FileCheck2, LayoutDashboard, Bot, ClipboardList } from "lucide-react";
import { Reveal, ScrollBlend, SECTION_WRAP, EYEBROW, CARD, SectionGlow } from "./shared";
import { useLanguage } from "@/lib/i18n";

// The headline value prop of the onboarding redesign — set up a profile
// once, every resume after that reuses it automatically (feature3 below).
// feature5 is a structural guarantee, not a policy promise — apply.py's
// agent schema has no submit tool at all, so there's nothing for it to
// call even if asked to.
const features = (t) => [
  { Icon: LayoutDashboard, title: t("landing.feature1") },
  { Icon: Sparkles, title: t("landing.feature2") },
  { Icon: RefreshCw, title: t("landing.feature3") },
  { Icon: FileCheck2, title: t("landing.feature4") },
  { Icon: Bot, title: t("landing.feature5") },
  { Icon: ClipboardList, title: t("landing.feature6") },
];

export function WhyNoqeev() {
  const { t } = useLanguage();
  const FEATURES = features(t);
  return (
    <section id="features" className="relative flex min-h-[100svh] flex-col justify-center py-24 sm:py-28" style={{ scrollMarginTop: "72px" }}>
      {/* No overflow-hidden on this section (every sibling section still
          has it) — this glow's own radial falloff was still well short of
          fully transparent right at this section's own top edge, so with
          the clip in place, SeeItHappenSection above had none of this
          glow at all and WhyNoqeev started with a visible amount of it
          right at the shared boundary — a hard line where "no glow" met
          "glow," not a blend. Letting it bleed upward into the section
          above instead (same soft radial gradient, same color, nothing
          changed about it) is what actually makes the transition
          disappear. */}
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
            <span className={EYEBROW}>{t("landing.whyNoqeevEyebrow")}</span>
            <h2 className="m-0 text-[clamp(1.6rem,4vw,2.4rem)] leading-tight font-bold text-foreground">
              {t("landing.whyNoqeevTitle")}
            </h2>
            <p className="m-0 mt-3 max-w-sm text-[14.5px] leading-relaxed text-muted-foreground">
              {t("landing.whyNoqeevSubtitle")}
            </p>
          </Reveal>
        </div>
      </ScrollBlend>
    </section>
  );
}
