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

export function Section({ icon, eyebrow, title, open, onOpenChange, children }) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="glass-surface min-w-0 w-full rounded-2xl">
      <CollapsibleTrigger className="flex w-full items-center gap-3 border-none bg-transparent p-5 text-left [-webkit-tap-highlight-color:transparent]">
        <IconTile icon={icon} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="m-0 font-mono text-[10.5px] font-bold tracking-[0.14em] text-muted-foreground/60 uppercase">{eyebrow}</p>
          {title && <p className="m-0 mt-1 text-[15px] font-bold text-foreground">{title}</p>}
        </div>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden px-5 data-[state=open]:pb-5">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
