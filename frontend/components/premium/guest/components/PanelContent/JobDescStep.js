"use client";
import { useState } from "react";
import { ChevronLeft, Bookmark } from "lucide-react";
import { Field, Btn } from "../primitives";
import { BookmarkletModal } from "../BookmarkletModal";

// ── Step 2 — Job Posting ─────────────────────────────────────────────────────
export function JobDescStep({
  jobDesc, setJobDesc, isPhone, ready2, generating, optimizing, onBack, onGenerate, onOptimize,
}) {
  const [bookmarkletOpen, setBookmarkletOpen] = useState(false);
  return (
    <>
      <button onClick={onBack} aria-label="Back to your information"
        className="flex min-h-8 items-center gap-1.5 border-none bg-transparent py-1.5 pb-3 text-[13px] text-muted-foreground">
        <ChevronLeft className="size-3.5" /> Back
      </button>

      <Field
        label="JOB DESCRIPTION" required
        hint={
          <span className="flex items-center gap-2.5">
            {`${jobDesc.length} chars${jobDesc.length >= 80 ? " ✓" : ""}`}
            <button
              onClick={() => setBookmarkletOpen(true)}
              className="flex items-center gap-1 border-none bg-transparent p-0 font-bold text-primary [-webkit-tap-highlight-color:transparent]"
            >
              <Bookmark className="size-3" /> Skip the paste
            </button>
          </span>
        }
        value={jobDesc} onChange={setJobDesc} multiline rows={isPhone ? 10 : 18} mono
        placeholder={"Paste the full job posting here — from any job board.\n\nMore text = better keyword matching."} />

      <BookmarkletModal open={bookmarkletOpen} onClose={() => setBookmarkletOpen(false)} />

      <Btn icon="Sparkles" onClick={onGenerate} disabled={!ready2 || generating || optimizing} loading={generating}>
        {generating ? "Generating…" : "Generate Resume"}
      </Btn>

      <div className="mt-2.5">
        <Btn variant="gold" icon="Sparkles" onClick={onOptimize}
          disabled={!ready2 || generating || optimizing} loading={optimizing}>
          {optimizing ? "Optimizing…" : "Optimize for This Job"}
        </Btn>
        <p className="mt-1.5 mb-0 ml-0.5 text-[11px] leading-relaxed text-muted-foreground/60">
          Also writes a cover letter and interview tips.
        </p>
      </div>
    </>
  );
}
