"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Reveal, ScrollBlend, SECTION_WRAP, EYEBROW, CARD, SectionGlow } from "./shared";

const FAQS = [
  { q: "Is Noqeev really free?", a: "Yes. No credit card, no trial, no subscription." },
  { q: "Do I need to create an account?", a: "No. Your draft lives in your browser. Signing in just syncs it across devices." },
  { q: "How does resume tailoring actually work?", a: "Paste the job posting and it matches your background to the posting's own keywords." },
  { q: "What files do I get, and can I edit them?", a: "An editable .docx and a clean PDF. No watermark, no locked preview." },
  { q: "Does Auto Apply submit applications for me?", a: "No. It fills out the real application form and shows you exactly what it entered. Nothing is ever sent without you reviewing and confirming it first." },
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

export function FAQ() {
  return (
    <section id="faq" className="relative flex min-h-[100dvh] flex-col justify-center overflow-hidden py-24 sm:py-28" style={{ scrollMarginTop: "72px" }}>
      <SectionGlow color="emerald" side="right" />
      <ScrollBlend className={SECTION_WRAP}>
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <span className={EYEBROW}>Questions</span>
            <h2 className="m-0 text-[clamp(1.6rem,4vw,2.4rem)] leading-tight font-bold text-foreground">
              How Noqeev actually works.
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
