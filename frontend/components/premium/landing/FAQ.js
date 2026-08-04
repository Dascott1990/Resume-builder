"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Reveal, SECTION_WRAP, EYEBROW } from "./shared";

const FAQS = [
  {
    q: "Is Noviq really free?",
    a: "Yes. Building, editing, and downloading a resume costs nothing — no credit card, no trial period, no subscription to cancel later.",
  },
  {
    q: "Do I need to create an account?",
    a: "No — it's entirely optional. By default your in-progress draft is kept in your own browser, and anything you save is tied to a random, anonymous id generated on your device, never your name or email. Signing in just lets that same data follow you to another device — nothing about the core builder changes either way.",
  },
  {
    q: "How does the AI actually tailor my resume?",
    a: "You paste the job posting and tell us about your background. The AI matches your experience to that posting's real keywords and phrasing — the kind of tailoring an experienced resume writer would do by hand, done in under a minute.",
  },
  {
    q: "What files do I get, and can I edit them?",
    a: "A real, editable .docx that opens in Word or Google Docs, and a clean PDF with selectable text — never a locked preview or a watermark. You can also click any line in the on-screen preview to edit it before downloading.",
  },
  {
    q: "Is the Artisan directory anonymous too?",
    a: "Same rules apply: no account to browse or to list yourself. Just a name, a trade, and a way to reach you — nothing more is collected.",
  },
];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b border-border py-4">
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
    <section id="faq" className="relative py-24 sm:py-28" style={{ scrollMarginTop: "72px" }}>
      <div className={SECTION_WRAP}>
        <Reveal className="mx-auto max-w-xl text-center">
          <span className={EYEBROW}>Questions</span>
          <h2 className="m-0 text-[clamp(1.6rem,4vw,2.4rem)] leading-tight font-bold text-foreground">
            How Noviq actually works.
          </h2>
        </Reveal>

        <Reveal delay={0.1} className="mx-auto mt-12 max-w-2xl">
          {FAQS.map((f) => <FAQItem key={f.q} {...f} />)}
        </Reveal>
      </div>
    </section>
  );
}
