"use client";
/**
 * LayerPanel.js — the font/size/spacing/align/bounce controls for a
 * selected layer, plus a header row combining its label with order/
 * duplicate/delete actions. Extracted out of PostComposer.js so the
 * story-assembly tool can reuse it verbatim for per-clip caption editing
 * (captions are just text layers, same shape PostComposer already
 * edits) — see frontend/app/brand/story/StoryComposer.js.
 *
 * onDuplicate/onFront/onBack are optional: PostComposer's multi-layer
 * canvas passes real handlers, but a caption is always exactly one
 * layer, where "send to back," "bring to front," and "duplicate" have
 * no meaning — Story passes none of the three, and the row collapses to
 * just the label and Delete instead of rendering buttons that do
 * nothing when pressed.
 */
import { Textarea } from "@/components/ui/textarea";
import {
  Trash2, SendToBack, BringToFront, Copy, AlignLeft, AlignCenter, AlignRight, Waves, Square, Captions,
} from "lucide-react";
import { FONT_OPTIONS, FONT_STACKS, FONT_DEFAULT_WEIGHTS } from "./postTemplates";

// Fixed, on-brand swatches rather than a free RGB picker — matches the
// rest of the app's "one deliberate accent, no arbitrary colour boxes"
// convention (see Btn's own "gold" comment in primitives.js). White/black
// cover the two classic caption looks (light text on dark video, dark
// text on light video); Ink/Muted/Accent are the existing theme tokens.
const COLOR_OPTIONS = [
  { id: "ink", swatch: "#f5f0e6", label: "Ink" },
  { id: "white", swatch: "#ffffff", label: "White" },
  { id: "black", swatch: "#0a0a0a", label: "Black" },
  { id: "muted", swatch: "#a89b7e", label: "Muted" },
];

function LayerHeaderRow({ label, onDuplicate, onFront, onBack, onDelete }) {
  const hasOrderControls = onDuplicate || onFront || onBack;
  return (
    <div className="mb-3 flex items-center justify-between">
      <span className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">{label}</span>
      {/* size-11 (44px), not the tighter size-7 this row used to use —
          the app's minimum reliable touch target (Apple HIG/Material
          Design both call for ~44-48px) rather than a size that's fine
          with a mouse cursor but easy to mis-tap on a phone. gap-2, not
          gap-1, so four adjacent 44px targets stay easy to tell apart. */}
      <div className="flex items-center gap-2">
        {hasOrderControls && (
          <>
            {onBack && <button type="button" onClick={onBack} title="Send to back" className="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><SendToBack className="size-4" /></button>}
            {onFront && <button type="button" onClick={onFront} title="Bring to front" className="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><BringToFront className="size-4" /></button>}
            {onDuplicate && <button type="button" onClick={onDuplicate} title="Duplicate" className="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><Copy className="size-4" /></button>}
          </>
        )}
        <button type="button" onClick={onDelete} title="Delete" aria-label="Delete" className="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
      </div>
    </div>
  );
}

export function LayerPanel({ layer, onChange, onDelete, onDuplicate, onFront, onBack, accent, showKaraoke }) {
  if (!layer) return null;
  const set = (patch) => onChange({ ...layer, ...patch });

  if (layer.type === "sticker") {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <LayerHeaderRow label="Sticker" onDuplicate={onDuplicate} onFront={onFront} onBack={onBack} onDelete={onDelete} />
        <label className="mb-1.5 block text-[11.5px] font-bold text-foreground">Size</label>
        <input type="range" min="0.05" max="0.35" step="0.01" value={layer.sizeFrac} onChange={(e) => set({ sizeFrac: Number(e.target.value) })} className="w-full accent-primary" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <LayerHeaderRow label="Text" onDuplicate={onDuplicate} onFront={onFront} onBack={onBack} onDelete={onDelete} />
      <Textarea value={layer.text} onChange={(e) => set({ text: e.target.value })} rows={2} className="mb-3 resize-none rounded-[10px] text-[13px]" />

      <label className="mb-1.5 block text-[11px] font-bold text-foreground">Font</label>
      {/* Each pill set in its own actual typeface, not a generic label —
          picking a font is exploring what it looks like, not reading a
          name off a list. */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FONT_OPTIONS.map((f) => (
          <button
            key={f.id} type="button"
            onClick={() => set({ font: f.id, weight: FONT_DEFAULT_WEIGHTS[f.id] || 700 })}
            aria-pressed={layer.font === f.id}
            style={{ fontFamily: FONT_STACKS[f.id] }}
            className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${layer.font === f.id ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[11px] font-bold text-foreground">Size</label>
          <input type="range" min="0.015" max="0.2" step="0.005" value={layer.sizeFrac} onChange={(e) => set({ sizeFrac: Number(e.target.value) })} className="w-full accent-primary" />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-bold text-foreground">Spacing</label>
          <input type="range" min="0" max="0.012" step="0.0005" value={layer.spacingFrac} onChange={(e) => set({ spacingFrac: Number(e.target.value) })} className="w-full accent-primary" />
        </div>
      </div>

      <label className="mb-1.5 block text-[11px] font-bold text-foreground">Color</label>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {[...COLOR_OPTIONS, ...(accent ? [{ id: "accent", swatch: accent.primary, label: "Accent" }] : [])].map((c) => (
          <button key={c.id} type="button" onClick={() => set({ color: c.id, gradientFill: false })} aria-pressed={layer.color === c.id && !layer.gradientFill}
            title={c.label}
            className={`flex size-9 items-center justify-center rounded-full border-2 ${layer.color === c.id && !layer.gradientFill ? "border-primary" : "border-transparent"}`}>
            <span className="size-6 rounded-full border border-black/10" style={{ backgroundColor: c.swatch }} />
          </button>
        ))}
      </div>

      {layer.highlight && (
        <div className="mb-3">
          <label className="mb-1.5 block text-[11px] font-bold text-foreground">Highlight color</label>
          <div className="flex flex-wrap items-center gap-2">
            {[...COLOR_OPTIONS, ...(accent ? [{ id: "accent", swatch: accent.primary, label: "Accent" }] : [])].map((c) => (
              <button key={c.id} type="button" onClick={() => set({ highlightColor: c.id })} aria-pressed={(layer.highlightColor || "black") === c.id}
                title={c.label}
                className={`flex size-9 items-center justify-center rounded-full border-2 ${(layer.highlightColor || "black") === c.id ? "border-primary" : "border-transparent"}`}>
                <span className="size-6 rounded-full border border-black/10" style={{ backgroundColor: c.swatch }} />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          {[["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]].map(([id, Icon]) => (
            <button key={id} type="button" onClick={() => set({ align: id })} aria-pressed={layer.align === id}
              className={`flex size-11 items-center justify-center rounded-lg border ${layer.align === id ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
              <Icon className="size-3.5" />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {/* Solid chip behind the text — the classic IG Story / WhatsApp
              status caption look, so captions stay legible over any video
              frame regardless of colour underneath. */}
          <button type="button" onClick={() => set({ highlight: !layer.highlight })} aria-pressed={layer.highlight}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${layer.highlight ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
            <Square className="size-3.5" /> Highlight
          </button>
          <button type="button" onClick={() => set({ bounce: !layer.bounce })} aria-pressed={layer.bounce}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${layer.bounce ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
            <Waves className="size-3.5" /> Bounce
          </button>
          {/* Only where there's a clip duration to time words against —
              Create's layers have no time axis, so this only shows up
              from Story's caption editor (see StoryComposer.js). */}
          {showKaraoke && (
            <button type="button" onClick={() => set({ karaoke: !layer.karaoke })} aria-pressed={layer.karaoke}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${layer.karaoke ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
              <Captions className="size-3.5" /> Karaoke
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
