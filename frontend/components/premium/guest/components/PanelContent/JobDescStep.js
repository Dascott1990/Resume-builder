"use client";
import { ChevronLeft } from "lucide-react";
import { Field, Btn } from "../primitives";

// ── Step 2 — Job Posting ─────────────────────────────────────────────────────
export function JobDescStep({
  jobDesc, setJobDesc, isPhone, ready2, generating, optimizing, onBack, onGenerate, onOptimize,
}) {
  return (
    <>
      <button onClick={onBack} aria-label="Back to your information"
        className="flex min-h-8 items-center gap-1.5 border-none bg-transparent py-1.5 pb-3 text-[13px] text-muted-foreground">
        <ChevronLeft className="size-3.5" /> Back
      </button>

      <Field
        label="JOB DESCRIPTION" required
        hint={`${jobDesc.length} chars${jobDesc.length >= 80 ? " ✓" : ""}`}
        value={jobDesc} onChange={setJobDesc} multiline rows={isPhone ? 10 : 18} mono
        placeholder={"Paste the full job posting here — from any job board.\n\nMore text = better keyword matching."} />

      <Btn icon="Sparkles" onClick={onGenerate} disabled={!ready2 || generating || optimizing} loading={generating}>
        {generating ? "Generating…" : "Generate Resume"}
      </Btn>

      <div className="mt-2.5">
        <Btn variant="gold" icon="Sparkles" onClick={onOptimize}
          disabled={!ready2 || generating || optimizing} loading={optimizing}>
          {optimizing ? "Optimizing…" : "Optimize for This Job"}
        </Btn>
        <p className="mt-1.5 mb-0 ml-0.5 text-[11px] leading-relaxed text-muted-foreground/60">
          Also writes a cover letter + interview talking points, and downloads
          the Word doc automatically.
        </p>
      </div>
    </>
  );
}
