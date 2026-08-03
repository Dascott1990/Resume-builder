"use client";
import { useState, useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";

// ── Cover letter: click-to-edit, read as real paragraphs ───────────────────────
// Same interaction as the resume itself — click the text, it becomes editable,
// blur commits. The point of the read view isn't just "not editable yet", it's
// legibility: real paragraph breaks and a letter-like serif/line-height instead
// of one dense pre-wrap blob, so the whole letter reads at a glance instead of
// needing to be scrolled and parsed line by line.
export function CoverLetterView({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const taRef = useRef(null);

  useEffect(() => { setVal(value); }, [value]);

  const autoGrow = (el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } };
  useEffect(() => { if (editing) { taRef.current?.focus(); autoGrow(taRef.current); } }, [editing]);

  const commit = () => { onChange(val); setEditing(false); };

  if (editing) {
    return (
      <Textarea
        ref={taRef}
        value={val}
        onChange={e => { setVal(e.target.value); autoGrow(e.target); }}
        onBlur={commit}
        className="min-h-[160px] resize-none overflow-hidden rounded-lg border-primary bg-primary/5 p-3.5 font-serif text-[14.5px] leading-[1.75] text-foreground"
      />
    );
  }

  const paragraphs = (val || "").split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);

  return (
    <div
      onClick={() => setEditing(true)}
      title="Click to edit"
      className="cursor-text touch-manipulation rounded-lg border border-dashed border-border p-3.5 transition-colors hover:border-primary/45 [-webkit-tap-highlight-color:transparent]"
    >
      {paragraphs.length ? paragraphs.map((p, i) => (
        <p key={i} className={`font-serif text-[14.5px] leading-[1.75] text-foreground ${i === paragraphs.length - 1 ? "m-0" : "mb-3.5"}`}>
          {p}
        </p>
      )) : (
        <p className="m-0 font-serif text-[14.5px] leading-[1.75] text-muted-foreground italic">
          Click to write your cover letter…
        </p>
      )}
    </div>
  );
}
