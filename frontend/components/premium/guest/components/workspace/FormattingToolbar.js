"use client";
/**
 * FormattingToolbar.js — the floating pill above the resume canvas. Only
 * two controls, both wired to real state: font family and layout
 * (shared/resumeLayouts/registry.js's LAYOUTS — the exact same 3 layouts
 * Dashboard's Templates card and StyleTab already use). Deliberately does
 * NOT include bold/italic/underline/strike/list buttons — Noqeev's resume
 * data model has no per-run rich text today (a job title is bold because
 * the layout renders it bold, not because a user toggled it), so those
 * buttons would have nothing real to do. Building actual rich text means
 * changing the resume data model and the DOCX/PDF export together, which
 * is real, separate work, not a checkbox on this component.
 */
import { ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { FONTS } from "../../constants";
import { LAYOUTS } from "../../../shared/resumeLayouts/registry";

function ToolbarSelect({ label, children }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-7 items-center gap-1 rounded-full border-none bg-transparent px-2.5 text-[12px] font-semibold text-foreground [-webkit-tap-highlight-color:transparent] hover:bg-muted">
          {label} <ChevronDown className="size-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FormattingToolbar({ docStyle, setDocStyle }) {
  const font = FONTS.find((f) => f.id === docStyle.font) || FONTS[0];
  const layout = LAYOUTS.find((l) => l.id === (docStyle.layout || "classic")) || LAYOUTS[0];

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-border bg-card px-1.5 py-1 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
      <ToolbarSelect label={font.label}>
        {FONTS.map((f) => (
          <DropdownMenuItem key={f.id} style={{ fontFamily: f.css }} onSelect={() => setDocStyle((s) => ({ ...s, font: f.id }))}>
            {f.label}
          </DropdownMenuItem>
        ))}
      </ToolbarSelect>
      <div className="mx-1 h-[18px] w-px shrink-0 bg-border" />
      <ToolbarSelect label={layout.label}>
        {LAYOUTS.map((l) => (
          <DropdownMenuItem key={l.id} onSelect={() => setDocStyle((s) => ({ ...s, layout: l.id }))}>
            {l.label}
          </DropdownMenuItem>
        ))}
      </ToolbarSelect>
    </div>
  );
}
