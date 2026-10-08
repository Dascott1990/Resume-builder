"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Reveal, ScrollBlend, SECTION_WRAP, EYEBROW, CARD, SectionGlow } from "./shared";
import { useLanguage } from "@/lib/i18n";

const faqs = (t) => [
  { q: t("landing.faq1Q"), a: t("landing.faq1A") },
  { q: t("landing.faq2Q"), a: t("landing.faq2A") },
  { q: t("landing.faq3Q"), a: t("landing.faq3A") },
  { q: t("landing.faq4Q"), a: t("landing.faq4A") },
  { q: t("landing.faq5Q"), a: t("landing.faq5A") },
];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b border-border py-4 last:border-b-0 last:pb-0">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 border-none bg-transparent p-0 text-left [-webkit-tap-highlight-color:transparent]">
        <span className="text-[14.5px] font-bold text-foreground">{q}</span>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden text-[13.5px] leading-relaxed text-muted-foreground data-[state=open]:pt-3">
        {a}
      </CollapsibleContent>
    </Collapsible>
  );
}

// No overflow-hidden on this section's own className below — same fix as
// WhyNoqeev.js: lets this glow bleed upward into the section above
// instead of getting hard-clipped at this section's own top edge, which
// is what was reading as a visible line at the boundary.
export function FAQ() {
  const { t } = useLanguage();
  const FAQS = faqs(t);
  return (
    <section id="faq" className="relative flex min-h-[100svh] flex-col justify-center py-24 sm:py-28" style={{ scrollMarginTop: "72px" }}>
      <SectionGlow color="emerald" side="right" />
      <ScrollBlend className={SECTION_WRAP}>
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <span className={EYEBROW}>{t("landing.faqEyebrow")}</span>
            <h2 className="m-0 text-[clamp(1.6rem,4vw,2.4rem)] leading-tight font-bold text-foreground">
              {t("landing.faqTitle")}
            </h2>
          </Reveal>

          <Reveal delay={0.1} className={CARD}>
            {FAQS.map((f) => <FAQItem key={f.q} {...f} />)}
          </Reveal>
        </div>
      </ScrollBlend>
    </section>
  );
}
