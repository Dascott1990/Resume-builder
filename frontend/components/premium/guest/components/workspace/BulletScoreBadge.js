"use client";
/**
 * BulletScoreBadge.js — instant, local heuristic feedback per bullet line:
 * starts with a strong action verb, contains a quantifier, healthy word
 * count. These are the same rule-based signals real "bullet grading" tools
 * use (a verb dictionary + a regex + a word count), not an AI judgment —
 * deliberately not routed through a new AI call, so it updates on every
 * keystroke with no round-trip.
 */
import { useMemo } from "react";
import { useLanguage } from "@/lib/i18n";

const STRONG_VERBS = new Set([
  "led", "built", "launched", "drove", "increased", "reduced", "improved",
  "designed", "implemented", "managed", "created", "delivered", "achieved",
  "optimized", "negotiated", "scaled", "automated", "spearheaded",
  "architected", "streamlined", "mentored", "owned", "shipped", "grew",
  "cut", "saved", "generated", "established", "coordinated", "executed",
  "resolved", "transformed", "accelerated", "consolidated", "restructured",
  "pioneered", "authored", "directed", "analyzed", "developed", "trained",
  "launched", "secured", "forecasted", "modernized", "standardized",
]);

function scoreBullet(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const words = trimmed.split(/\s+/);
  const firstWord = (words[0] || "").toLowerCase().replace(/[^a-z]/g, "");
  return {
    hasStrongVerb: STRONG_VERBS.has(firstWord),
    hasNumber: /\d|%|\$/.test(trimmed),
    lengthOk: words.length >= 6 && words.length <= 24,
  };
}

export function BulletScoreBadge({ text }) {
  const { t } = useLanguage();
  const score = useMemo(() => scoreBullet(text), [text]);
  if (!score) return null;

  const checks = [
    { ok: score.hasStrongVerb, label: t("bulletScore.verb") },
    { ok: score.hasNumber, label: t("bulletScore.quantified") },
    { ok: score.lengthOk, label: t("bulletScore.length") },
  ];
  const firstFailing = checks.find((c) => !c.ok);

  return (
    <div className="flex items-center gap-1.5 px-0.5">
      {checks.map((c) => (
        <span key={c.label} title={c.label} aria-label={c.label}
          className={`size-1.5 shrink-0 rounded-full ${c.ok ? "bg-success" : "bg-muted-foreground/30"}`} />
      ))}
      {firstFailing && <span className="truncate text-[10.5px] text-muted-foreground">{firstFailing.label}</span>}
    </div>
  );
}
