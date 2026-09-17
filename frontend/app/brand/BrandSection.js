"use client";
/**
 * BrandSection.js — the collapsible card shell used by every section on
 * /brand. Same trigger/content shape as the landing page's FAQ accordion
 * (components/premium/landing/FAQ.js) — the one place this pattern was
 * already proven out — just dressed as a full card (IconTile + eyebrow +
 * title) instead of a bare question line, since these sections are each
 * a real chunk of content, not a one-line Q&A.
 */
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { IconTile } from "@/components/premium/shared/IconTile";

export function Section({ icon, eyebrow, title, description, open, onOpenChange, children }) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="min-w-0 w-full rounded-2xl border border-border bg-card">
      <CollapsibleTrigger className="flex w-full items-center gap-3 border-none bg-transparent p-6 text-left sm:p-8 [-webkit-tap-highlight-color:transparent]">
        <IconTile icon={icon} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="m-0 font-mono text-[10.5px] font-bold tracking-[0.14em] text-muted-foreground/60 uppercase">{eyebrow}</p>
          {title && <p className="m-0 mt-1 text-[15px] font-bold text-foreground">{title}</p>}
          {description && <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden px-6 data-[state=open]:pb-6 sm:px-8 sm:data-[state=open]:pb-8">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
