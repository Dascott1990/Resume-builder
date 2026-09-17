"use client";
/**
 * AiSuggestPanel.js — the mood-picker → AI-draft panel, extracted out of
 * PostComposer.js so the story-assembly tool can reuse the EXACT same
 * /api/v1/brand/suggest-post pipeline for per-clip captions instead of a
 * separate caption-specific endpoint (see StoryComposer.js, which maps
 * onSuggestion's {eyebrow, headline, subtext} onto the selected clip's
 * caption layer instead of a whole post's layers) — zero backend change.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Btn } from "@/components/premium/guest/components/primitives";
import { apiRequest } from "@/components/premium/shared/api";

export const MOODS = ["Motivational", "Practical", "Celebratory", "Urgent", "Playful"];

export function timeOfDay(hour) {
  if (hour < 5) return "late night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

export function AiSuggestPanel({ onSuggestion }) {
  const [mood, setMood] = useState("Motivational");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState(null);

  useEffect(() => {
    const now = new Date();
    setContext({
      time_of_day: timeOfDay(now.getHours()),
      day_of_week: now.toLocaleDateString(undefined, { weekday: "long" }),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }, []);

  const suggest = async () => {
    setLoading(true);
    try {
      const data = await apiRequest("/api/v1/brand/suggest-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood: mood.toLowerCase(), ...context }),
      });
      onSuggestion(data);
    } catch (e) {
      toast.error(e.message || "Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
      <div className="mb-2.5 flex items-center gap-1.5">
        <Sparkles className="size-3.5 text-primary" />
        <span className="font-mono text-[10.5px] font-bold tracking-[0.1em] text-primary uppercase">AI draft</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {MOODS.map((m) => (
          <button key={m} type="button" onClick={() => setMood(m)} aria-pressed={mood === m}
            className={`rounded-full border px-3 py-1 text-[11.5px] font-semibold ${mood === m ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
            {m}
          </button>
        ))}
      </div>
      <Btn small variant="gold" onClick={suggest} disabled={loading || !context} loading={loading}>
        {loading ? "…" : "Suggest"}
      </Btn>
    </div>
  );
}
