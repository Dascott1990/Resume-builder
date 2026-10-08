"use client";
/**
 * AiRewriteBar.js — the inline action row under a text field being edited
 * in the Builder sidebar (summary paragraphs, job bullets). Calls the real
 * POST /api/v1/resume/rewrite-block endpoint and replaces the field's own
 * value with what comes back — never a separate preview/confirm step, the
 * same "click to edit, blur to commit" directness every other field in
 * this app already has.
 */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { apiRequest } from "../../../shared/api";
import { useLanguage } from "@/lib/i18n";

const MODES = (t) => [
  { id: "rewrite", label: t("aiRewrite.rewrite") },
  { id: "match_jd", label: t("aiRewrite.matchJobDescription") },
  { id: "clarity", label: t("aiRewrite.improveClarity") },
  { id: "tone", label: t("aiRewrite.changeTone") },
];

export function AiRewriteBar({ text, onResult, jobDescription }) {
  const { t } = useLanguage();
  const [loadingMode, setLoadingMode] = useState(null);

  const run = async (mode) => {
    if (!text?.trim() || loadingMode) return;
    setLoadingMode(mode);
    try {
      const data = await apiRequest("/api/v1/resume/rewrite-block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mode, job_description: jobDescription || "" }),
      });
      onResult(data.text);
    } catch {
      // Best-effort — a failed rewrite just leaves the existing text alone,
      // same as any other transient AI-call failure elsewhere in this app.
    } finally {
      setLoadingMode(null);
    }
  };

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-0.5 gap-y-1 rounded-full border border-border bg-card p-1">
      {MODES(t).map((m) => (
        <button
          key={m.id}
          type="button"
          disabled={!!loadingMode || (m.id === "match_jd" && !jobDescription)}
          onClick={() => run(m.id)}
          className="flex h-6 items-center gap-1 rounded-full border-none bg-transparent px-2 text-[11px] font-semibold text-foreground [-webkit-tap-highlight-color:transparent] hover:bg-muted disabled:opacity-40"
        >
          {loadingMode === m.id && <Loader2 className="size-2.5 animate-spin" />}
          {m.label}
        </button>
      ))}
    </div>
  );
}
