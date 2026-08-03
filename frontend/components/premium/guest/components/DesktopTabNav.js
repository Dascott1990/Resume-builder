"use client";
import { Sparkles, Palette, Layout, Settings } from "lucide-react";

const VIEWS = [
  { id: "new",       Icon: Sparkles, label: "Build" },
  { id: "style",     Icon: Palette,  label: "Style" },
  { id: "templates", Icon: Layout,   label: "Saved" },
  { id: "settings",  Icon: Settings, label: "Settings" },
];

// ── Desktop: top segmented nav, bigger and always labeled ──────────────────
export function DesktopTabNav({ tab, onChange }) {
  return (
    <div role="tablist" aria-label="View" className="flex shrink-0 border-b border-border bg-card px-2.5">
      {VIEWS.map(v => {
        const active = tab === v.id;
        return (
          <button key={v.id} role="tab" aria-selected={active} onClick={() => onChange(v.id)}
            className={`flex min-h-[52px] items-center justify-center gap-2 border-none border-b-[3px] bg-transparent px-[18px] text-[14.5px] transition-colors ${
              active ? "border-primary font-bold text-foreground" : "border-transparent font-medium text-muted-foreground/60"
            }`}>
            <v.Icon className={`size-4 ${active ? "text-primary" : "text-muted-foreground/60"}`} />
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
