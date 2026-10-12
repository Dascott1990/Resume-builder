"use client";
/**
 * KeywordGapCard.js — shows which JD-extracted keywords (resume.keywords,
 * already computed server-side during generate/optimize) actually appear
 * somewhere in the resume's own text vs. which don't. Pure client-side
 * substring match — no new endpoint, since the data this needs is already
 * sitting in the resume object every caller of this card already holds.
 */
import { useMemo } from "react";
import { useLanguage } from "@/lib/i18n";

// AI-generated resume text sometimes uses typographic punctuation (a
// non-breaking hyphen U+2011 in "on‑call", curly quotes, etc.) that the
// plain-ASCII extracted keyword never contains — found live when a real
// generation produced "On‑call" (U+2011) against the keyword "on-call"
// (plain U+002D), which silently failed a naive substring match.
function normalize(s) {
  return String(s || "")
    .replace(/[‐-―−]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase();
}

function flattenResumeText(resume) {
  const parts = [];
  if (resume?.contact) parts.push(...Object.values(resume.contact).filter((v) => typeof v === "string"));
  (resume?.sections || []).forEach((sec) => {
    if (sec.type === "text") parts.push(sec.content || "");
    if (sec.type === "bullets") parts.push(...(sec.items || []));
    if (sec.type === "jobs") {
      (sec.jobs || []).forEach((job) => {
        parts.push(job.role, job.company, job.location, ...(job.bullets || []));
      });
    }
    if (sec.type === "education") {
      (sec.degrees || []).forEach((deg) => {
        parts.push(deg.degree, deg.school, deg.location);
      });
    }
  });
  return parts.filter(Boolean).join(" \n ");
}

export function KeywordGapCard({ resume }) {
  const { t } = useLanguage();
  const keywords = resume?.keywords || [];

  const { matched, missing } = useMemo(() => {
    const text = normalize(flattenResumeText(resume));
    const matched = [];
    const missing = [];
    for (const kw of keywords) {
      const needle = normalize(kw).trim();
      if (!needle) continue;
      (text.includes(needle) ? matched : missing).push(kw);
    }
    return { matched, missing };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume, keywords.join("|")]);

  if (!resume || keywords.length === 0) return null;

  return (
    <div className="rounded-[12px] border border-border p-3.5">
      <div className="flex items-center justify-between">
        <p className="m-0 text-[10.5px] font-bold tracking-[0.08em] text-muted-foreground/60 uppercase">{t("keywordGap.title")}</p>
        <span className="text-[11px] font-bold tabular-nums text-muted-foreground">{matched.length}/{keywords.length}</span>
      </div>

      {missing.length > 0 ? (
        <>
          <p className="m-0 mt-2 text-[12px] leading-relaxed text-foreground">{t("keywordGap.missingIntro")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missing.map((kw) => (
              <span key={kw} className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                {kw}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="m-0 mt-2 text-[12px] text-success">{t("keywordGap.allMatched")}</p>
      )}

      {matched.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {matched.map((kw) => (
            <span key={kw} className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
              {kw}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
