"use client";
import { Check } from "lucide-react";
import { FONTS, ACCENTS } from "../../constants";
import { LAYOUTS } from "../../../shared/resumeLayouts/registry";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Btn } from "../primitives";

export function StyleTab({ docStyle, setDocStyle, isDesktop, onPreview }) {
  return (
    <div className="p-4">
      {/* Layout */}
      <p className="m-0 mb-1.5 text-xs text-muted-foreground">Layout</p>
      <div className="mb-[18px] flex flex-col gap-1.5">
        {LAYOUTS.map(l => (
          <button key={l.id} onClick={() => setDocStyle(s => ({ ...s, layout: l.id }))}
            aria-pressed={(docStyle.layout || "classic") === l.id}
            className={`min-h-[52px] rounded-md border px-3 py-2 text-left ${
              (docStyle.layout || "classic") === l.id ? "border-primary/30 bg-primary/10" : "border-border bg-card"
            }`}>
            <p className={`m-0 text-sm ${(docStyle.layout || "classic") === l.id ? "font-bold text-foreground" : "font-normal text-muted-foreground"}`}>{l.label}</p>
            <p className="m-0 mt-0.5 text-[11px] text-muted-foreground/70">{l.description}</p>
          </button>
        ))}
      </div>

      {/* Font family */}
      <p className="m-0 mb-1.5 text-xs text-muted-foreground">Font family</p>
      <ToggleGroup
        type="single"
        orientation="vertical"
        spacing={0}
        value={docStyle.font}
        onValueChange={(v) => v && setDocStyle(s => ({ ...s, font: v }))}
        className="mb-[18px] w-full overflow-hidden rounded-md border border-border"
      >
        {FONTS.map(f => (
          <ToggleGroupItem
            key={f.id}
            value={f.id}
            style={{ fontFamily: f.css }}
            className="h-auto w-full justify-between rounded-none px-3 py-2.5 text-sm font-normal data-[state=on]:bg-primary/10 data-[state=on]:font-bold data-[state=on]:text-foreground"
          >
            {f.label}
            {docStyle.font === f.id && <Check className="size-[13px] text-primary" />}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {/* Font size */}
      <p className="m-0 mb-1.5 text-xs text-muted-foreground">
        Font size <span className="text-muted-foreground/60">· {docStyle.fontSize}pt</span>
      </p>
      <input type="range" min={9} max={13} step={0.5} value={docStyle.fontSize}
        onChange={e => setDocStyle(s => ({ ...s, fontSize: parseFloat(e.target.value) }))}
        className="mb-[18px] w-full accent-primary" />

      {/* Line spacing */}
      <p className="m-0 mb-1.5 text-xs text-muted-foreground">
        Line spacing <span className="text-muted-foreground/60">· {docStyle.lineHeight}×</span>
      </p>
      <input type="range" min={1.1} max={1.8} step={0.05} value={docStyle.lineHeight}
        onChange={e => setDocStyle(s => ({ ...s, lineHeight: parseFloat(e.target.value) }))}
        className="mb-[18px] w-full accent-primary" />

      {/* Accent color */}
      <p className="m-0 mb-2.5 text-xs text-muted-foreground">Accent color</p>
      <div className="mb-4 flex flex-wrap gap-3.5">
        {ACCENTS.map(a => (
          <button key={a.id} onClick={() => setDocStyle(s => ({ ...s, accent: a.id }))}
            aria-label={a.label} title={a.label}
            className="flex flex-col items-center gap-1.5 border-none bg-transparent p-0"
          >
            <div
              className="size-[18px] shrink-0 rounded-full"
              style={{
                background: a.hex,
                boxShadow: docStyle.accent === a.id ? "0 0 0 2px var(--background), 0 0 0 3px var(--foreground)" : "none",
              }}
            />
            <span className={`text-[10.5px] ${docStyle.accent === a.id ? "text-foreground" : "text-muted-foreground/60"}`}>{a.label}</span>
          </button>
        ))}
      </div>

      {!isDesktop && (
        <Btn variant="primary" icon="Eye" onClick={onPreview} small>
          Preview changes
        </Btn>
      )}
    </div>
  );
}
