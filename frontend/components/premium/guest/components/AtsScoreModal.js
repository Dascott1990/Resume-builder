"use client";
/**
 * AtsScoreModal.js — on-demand ATS-readiness check for whatever resume is
 * currently built (see /resume/ats-check). Not persisted — this is a
 * one-time read, not a saved artifact, matching the app's default of
 * keeping ephemeral things ephemeral.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, Gauge } from "lucide-react";
import { apiRequest } from "../../shared/api";

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

export function AtsScoreModal({ open, onClose, resume, jobDescription }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) { setResult(null); setError(""); return; }
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent showCloseButton className="w-full max-w-[440px] gap-0 overflow-hidden p-0 sm:max-w-[440px]">
        <div className="p-[22px]">
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

          {result && (
            <>
              <div className="mb-4 flex items-center gap-4">
                <div
                  className="flex size-16 shrink-0 items-center justify-center rounded-full border-4 text-xl font-extrabold"
                  style={{ borderColor: scoreColor(result.score), color: scoreColor(result.score) }}
                >
                  {result.score}
                </div>
                <p className="m-0 text-[13px] leading-relaxed text-foreground">{result.summary}</p>
              </div>

              <div className="flex flex-col gap-2">
                {(result.issues || []).map((issue, i) => {
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
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
