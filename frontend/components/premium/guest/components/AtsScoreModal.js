"use client";
/**
 * AtsScoreModal.js — on-demand ATS-readiness check for whatever resume is
 * currently built (see /resume/ats-check), plus a "Fix these issues" action
 * (see /resume/ats-improve) that rewrites the resume to address exactly what
 * was flagged and re-scores it — the check alone was a diagnosis with no
 * treatment; this is the treatment.
 *
 * The rewrite only ever uses information already in the resume — same
 * employers, dates, schools, skills, just better organized/phrased/aligned
 * with the job description's keywords (see ats_improve's system prompt on
 * the backend). Anything the job genuinely wants that the resume has no real
 * basis for shows up in `unresolved` as a suggestion for the person to go
 * get — never written into the resume as if it already happened.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, Gauge, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "../../shared/api";
import { Btn } from "./primitives";

const SEVERITY_META = {
  high: { label: "Fix this", className: "border-destructive/30 bg-destructive/10 text-destructive" },
  medium: { label: "Worth fixing", className: "border-primary/30 bg-primary/10 text-primary" },
  low: { label: "Minor", className: "border-border bg-muted text-muted-foreground" },
};

function scoreColor(score) {
  if (score >= 80) return "var(--success, #22c55e)";
  if (score >= 50) return "var(--primary)";
  return "var(--destructive)";
}

export function AtsScoreModal({ open, onClose, resume, jobDescription, onApply }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  // The "Fix these issues" action — a separate request/result pair from the
  // read-only check above, so a failed fix attempt never wipes out the score
  // the person already saw.
  const [fixing, setFixing] = useState(false);
  const [fixError, setFixError] = useState("");
  const [fixResult, setFixResult] = useState(null);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (!open) { setResult(null); setError(""); setFixing(false); setFixError(""); setFixResult(null); setApplied(false); return; }
    if (!resume) return;
    setLoading(true);
    setError("");
    apiRequest("/api/v1/resume/ats-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume, job_description: jobDescription || "" }),
    })
      .then(setResult)
      .catch((e) => setError(e.message || "Could not check this resume. Try again."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleFix = () => {
    setFixing(true);
    setFixError("");
    apiRequest("/api/v1/resume/ats-improve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume, job_description: jobDescription || "" }),
    })
      .then((data) => { setFixResult(data); setApplied(false); })
      .catch((e) => setFixError(e.message || "Could not fix this resume. Try again."))
      .finally(() => setFixing(false));
  };

  const handleApply = () => {
    if (!fixResult || !onApply) return;
    onApply(fixResult.resume);
    setApplied(true);
    toast.success("Resume updated");
  };

  // fixResult supersedes the original check once it exists — it's a fresher
  // read of the exact same resume (post-rewrite), not a separate thing.
  const shown = fixResult || result;
  const startScore = result?.score;
  const canFix = shown && (shown.issues?.length || 0) > 0 && !applied;
  const showApplyButton = Boolean(fixResult && !applied && onApply);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent showCloseButton className="flex max-h-[85dvh] w-full max-w-[440px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[440px]">
        <div className="min-h-0 overflow-y-auto overscroll-contain p-[22px] [-webkit-overflow-scrolling:touch]">
          <p className="m-0 mb-4 flex items-center gap-2 font-serif text-xl italic text-foreground">
            <Gauge className="size-[17px] text-primary" /> ATS score
          </p>

          {loading && (
            <div className="flex flex-col items-center gap-2.5 py-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <p className="m-0 text-[12.5px] text-muted-foreground">Checking how this resume actually parses…</p>
            </div>
          )}

          {error && (
            <div role="alert" className="border-l-2 border-destructive py-0.5 pl-[11px] text-[12.5px] leading-relaxed text-destructive">
              {error}
            </div>
          )}

          {shown && (
            <>
              <div className="mb-4 flex items-center gap-4">
                <div
                  className="flex size-16 shrink-0 items-center justify-center rounded-full border-4 text-xl font-extrabold"
                  style={{ borderColor: scoreColor(shown.score), color: scoreColor(shown.score) }}
                >
                  {shown.score}
                </div>
                <p className="m-0 text-[13px] leading-relaxed text-foreground">
                  {fixResult && typeof startScore === "number" && startScore !== shown.score ? (
                    <span className="mb-1 flex items-center gap-1.5 text-[11.5px] font-bold text-[var(--success,#22c55e)]">
                      {startScore} <ArrowRight className="size-3" /> {shown.score}
                    </span>
                  ) : null}
                  {shown.summary}
                </p>
              </div>

              {(shown.issues?.length || 0) > 0 && (
                <div className="mb-4 flex flex-col gap-2">
                  {shown.issues.map((issue, i) => {
                    const meta = SEVERITY_META[issue.severity] || SEVERITY_META.low;
                    return (
                      <div key={i} className="rounded-xl border border-border bg-card p-3">
                        <span className={`mb-1.5 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.className}`}>
                          {meta.label}
                        </span>
                        <p className="m-0 text-[12.5px] leading-relaxed text-foreground">{issue.message}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {fixResult && (fixResult.unresolved?.length || 0) > 0 && (
                <div className="mb-4">
                  <p className="m-0 mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Can't fix from what's here — worth doing for real
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {fixResult.unresolved.map((note, i) => (
                      <p key={i} className="m-0 rounded-lg border border-dashed border-border px-2.5 py-2 text-[12.5px] leading-relaxed text-muted-foreground">
                        {note}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {fixError && (
                <div role="alert" className="mb-3 border-l-2 border-destructive py-0.5 pl-[11px] text-[12.5px] leading-relaxed text-destructive">
                  {fixError}
                </div>
              )}

              {applied ? (
                <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--success,#22c55e)]">
                  <CheckCircle2 className="size-4" /> Applied to your resume
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {canFix && (
                    <Btn small variant="gold" icon={fixing ? undefined : "Sparkles"} loading={fixing} onClick={handleFix} disabled={fixing}>
                      {fixing ? "Rewriting…" : fixResult ? "Fix remaining issues" : "Fix these issues"}
                    </Btn>
                  )}
                  {showApplyButton && (
                    <Btn small variant={canFix ? "ghost" : "gold"} icon={canFix ? undefined : "Check"} onClick={handleApply}>
                      Apply to resume
                    </Btn>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
