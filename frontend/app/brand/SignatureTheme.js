"use client";
/**
 * SignatureTheme.js — "this month's signature style": an AI-proposed
 * accent + name for whatever's currently on the calendar, constrained to
 * the app's own real accent palette (see lib/accentColor.js) rather than
 * inventing a one-off hex nothing else in the product would ever use.
 * Once locked in, it's what PostComposer.js uses as its default accent
 * for the rest of the month — see deriveAccent() in postTemplates.js for
 * how a single hex becomes the full bright/primary/deep gradient every
 * template draws with.
 *
 * Lifted up to page.js (onLockIn), not owned here — PostComposer.js is a
 * sibling, not a child, and needs to reflect a newly-locked theme the
 * instant it's chosen, not after a reload.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Check, RotateCcw } from "lucide-react";
import { Btn } from "@/components/premium/guest/components/primitives";
import { apiRequest } from "@/components/premium/shared/api";
import { ACCENT_COLORS } from "@/lib/accentColor";
import { deriveAccent } from "./postTemplates";
import { loadSignatureTheme, saveSignatureTheme } from "./assetKit";

export function SignatureTheme({ onLockIn }) {
  const [stored, setStored] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const existing = loadSignatureTheme();
    setStored(existing);
    if (existing) onLockIn(deriveAccent(colorFor(existing.accentId).primary));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const colorFor = (id) => ACCENT_COLORS.find((c) => c.id === id) || ACCENT_COLORS[0];

  const generate = async () => {
    setLoading(true);
    try {
      const monthName = new Date().toLocaleDateString(undefined, { month: "long" });
      const data = await apiRequest("/api/v1/brand/suggest-theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month_name: monthName }),
      });
      setProposal(data);
    } catch (e) {
      toast.error(e.message || "Could not generate a theme right now.");
    } finally {
      setLoading(false);
    }
  };

  const lockIn = () => {
    if (!proposal) return;
    saveSignatureTheme(proposal);
    setStored({ ...proposal, monthKey: undefined });
    setProposal(null);
    onLockIn(deriveAccent(colorFor(proposal.accentId).primary));
    toast.success(`"${proposal.themeName}" is this month's signature.`);
  };

  const active = stored || proposal;
  const activeColor = active ? colorFor(active.accentId) : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="mb-1 flex items-center gap-1.5">
        <Sparkles className="size-3.5 text-primary" />
        <p className="m-0 font-mono text-[10.5px] font-bold tracking-[0.14em] text-muted-foreground/60 uppercase">
          This month's signature
        </p>
      </div>
      <p className="m-0 mt-2 mb-5 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
        One accent, picked from the app's own palette, for every post this month — so a week's
        worth of posts reads as one campaign instead of whatever color happened to be default that day.
      </p>

      {active ? (
        <div className="flex items-start gap-4 rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
          <span className="size-10 shrink-0 rounded-full border border-border" style={{ background: activeColor.primary }} />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[14px] font-bold text-foreground">{active.themeName}</p>
            <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{active.rationale}</p>
            {stored && !proposal && (
              <p className="m-0 mt-2 flex items-center gap-1 text-[11px] font-bold text-primary">
                <Check className="size-3" /> Locked in for {new Date().toLocaleDateString(undefined, { month: "long" })}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-1.5">
            {proposal && (
              <Btn small variant="gold" onClick={lockIn}>Lock it in</Btn>
            )}
            <Btn small variant="ghost" onClick={generate} disabled={loading} loading={loading}>
              <RotateCcw className="size-3.5" /> {stored && !proposal ? "Regenerate" : "Try again"}
            </Btn>
          </div>
        </div>
      ) : (
        <Btn variant="gold" onClick={generate} disabled={loading} loading={loading}>
          <Sparkles className="size-4" /> {loading ? "Thinking…" : "Generate this month's theme"}
        </Btn>
      )}
    </div>
  );
}
