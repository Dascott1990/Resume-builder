"use client";
/**
 * SkillAlignmentCard.js — the workspace's inline "Skill Alignment" card.
 * Same two real endpoints AtsScoreModal.js already uses (/resume/ats-check,
 * /resume/ats-improve) — not a separate scoring system, just a compact
 * always-visible rendering of the same analysis instead of a modal you
 * have to open. "Ignore" just hides the card for this session (local
 * state only — nothing is dismissed server-side, there's nothing to
 * un-dismiss); "Add skills" is ats-improve + apply, identical to the
 * modal's "Fix these issues" → "Apply to resume" pair collapsed into one
 * click since there's no separate review step here.
 */
import { useEffect, useState } from "react";
import { Loader2, Layers } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "../../../shared/api";

export function SkillAlignmentCard({ resume, jobDescription, onApply }) {
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState(false);
  const [result, setResult] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!resume) return;
    let cancelled = false;
    setLoading(true);
    apiRequest("/api/v1/resume/ats-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume, job_description: jobDescription || "" }),
    })
      .then((data) => { if (!cancelled) setResult(data); })
      .catch(() => { if (!cancelled) setResult(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume?.saved_id]);

  const fix = async () => {
    setFixing(true);
    try {
      const data = await apiRequest("/api/v1/resume/ats-improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, job_description: jobDescription || "" }),
      });
      onApply(data.resume);
      toast.success("Resume updated");
      setResult({ score: data.score, summary: data.summary, issues: data.issues });
    } catch (e) {
      toast.error(e.message || "Couldn't update the resume.");
    } finally {
      setFixing(false);
    }
  };

  if (dismissed || !resume) return null;

  const issueCount = result?.issues?.length || 0;

  return (
    <div className="rounded-[12px] border border-border p-3.5">
      <div className="flex items-start justify-between">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-foreground/[0.07]">
          <Layers className="size-[14px] text-foreground" />
        </div>
        {!loading && result && (
          <span className="text-[11px] font-bold tabular-nums text-muted-foreground">{result.score}/100</span>
        )}
      </div>

      {loading ? (
        <div className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Checking alignment…
        </div>
      ) : result ? (
        <>
          <p className="m-0 mt-2.5 text-[12px] leading-relaxed text-foreground">{result.summary}</p>
          {issueCount > 0 && (
            <div className="mt-3 flex gap-1.5">
              <button
                onClick={() => setDismissed(true)}
                className="h-7 flex-1 rounded-full border border-border text-[11.5px] font-bold text-foreground [-webkit-tap-highlight-color:transparent]"
              >
                Ignore
              </button>
              <button
                onClick={fix}
                disabled={fixing}
                className="flex h-7 flex-1 items-center justify-center gap-1 rounded-full bg-primary text-[11.5px] font-bold text-primary-foreground [-webkit-tap-highlight-color:transparent] disabled:opacity-60"
              >
                {fixing && <Loader2 className="size-3 animate-spin" />} Add skills
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="m-0 mt-2.5 text-[12px] text-muted-foreground">Couldn't check this resume right now.</p>
      )}
    </div>
  );
}
