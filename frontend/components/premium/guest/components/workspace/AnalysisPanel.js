"use client";
/**
 * AnalysisPanel.js — the workspace's right panel: Skill Alignment, then
 * Text and Colors, both reading/writing the exact same docStyle StyleTab.js
 * already owns (font size, line height, accent) — just restyled into this
 * panel's denser layout instead of StyleTab's vertical list. Font FAMILY
 * and layout live in the floating toolbar above the canvas instead of
 * repeating here — one home per control, not two places that could drift
 * or just read as clutter.
 *
 * No "Alignment" (text-align grid) or "Size" (W/H px) sections from the
 * reference — intentionally. Noqeev's resume is a flowed document, not a
 * free-form canvas: there's no per-element bounding box to report a width/
 * height for, and the layouts already control their own internal alignment
 * structurally (Classic's centered header vs. Sidebar's two columns aren't
 * a per-paragraph user choice). Building number inputs that don't actually
 * move or resize anything would be exactly the "fake button" the redesign
 * brief says not to leave in.
 */
import { ACCENTS } from "../../constants";
import { SkillAlignmentCard } from "./SkillAlignmentCard";

export function AnalysisPanel({ resume, jobDescription, onApplyAts, docStyle, setDocStyle }) {
  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-3.5">
      <SkillAlignmentCard resume={resume} jobDescription={jobDescription} onApply={onApplyAts} />

      <div>
        <p className="m-0 mb-2.5 text-[10.5px] font-bold tracking-[0.08em] text-muted-foreground/60 uppercase">Text</p>
        <div className="flex flex-col gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Size</span><span className="tabular-nums">{docStyle.fontSize}pt</span>
            </div>
            <input type="range" min={9} max={13} step={0.5} value={docStyle.fontSize}
              onChange={(e) => setDocStyle((s) => ({ ...s, fontSize: parseFloat(e.target.value) }))}
              className="w-full accent-primary" />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Line height</span><span className="tabular-nums">{docStyle.lineHeight}×</span>
            </div>
            <input type="range" min={1.1} max={1.8} step={0.05} value={docStyle.lineHeight}
              onChange={(e) => setDocStyle((s) => ({ ...s, lineHeight: parseFloat(e.target.value) }))}
              className="w-full accent-primary" />
          </div>
        </div>
      </div>

      <div>
        <p className="m-0 mb-2.5 text-[10.5px] font-bold tracking-[0.08em] text-muted-foreground/60 uppercase">Colors</p>
        <div className="flex flex-wrap gap-3">
          {ACCENTS.map((a) => (
            <button key={a.id} onClick={() => setDocStyle((s) => ({ ...s, accent: a.id }))}
              aria-label={a.label} title={a.label}
              className="flex flex-col items-center gap-1.5 border-none bg-transparent p-0 [-webkit-tap-highlight-color:transparent]">
              <span className="block size-[18px] shrink-0 rounded-full" style={{
                background: a.hex,
                boxShadow: docStyle.accent === a.id ? "0 0 0 2px var(--background), 0 0 0 3px var(--foreground)" : "none",
              }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
