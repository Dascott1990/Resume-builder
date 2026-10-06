"use client";
/**
 * JobSearchStatsCard.js — the one "Your job search" Applied/Responses/
 * Interviews/Offers strip, shared by every screen in the platform
 * ecosystem that opens on this greeting hook (Dashboard.js, JobsBoard.js,
 * ...) instead of each one hand-copying it. Same real counts, same two
 * visual modes: a borderless, monochrome 4-column grid on mobile (no
 * card cage, no color-coded values — the whole point is one flat
 * typographic grid, metrics float directly on the page canvas), the
 * original glass card with success-tinted interview/offer values on
 * desktop (unchanged, not part of the monochrome mobile pass).
 */
import { ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function JobSearchStatsCard({ applications, loading, onViewAll, isDesktop = true }) {
  const applied = applications.length;
  const responses = applications.filter((a) => a.status !== "applied").length;
  const interviews = applications.filter((a) => a.status === "interview").length;
  const offers = applications.filter((a) => a.status === "offer").length;

  if (!isDesktop) {
    return (
      <div className="mb-7">
        <p className="m-0 mb-3 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground/70 uppercase">Your job search</p>
        <div className="grid grid-cols-4 gap-2">
          {loading ? (
            <>
              <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
            </>
          ) : (
            [
              ["Applied", applied], ["Responses", responses],
              ["Interviews", interviews], ["Offers", offers],
            ].map(([label, value]) => (
              <div key={label}>
                <span className="block text-3xl font-bold tracking-tight text-foreground">{value}</span>
                <span className="mt-1.5 block text-[11px] font-semibold tracking-wide text-muted-foreground/70 uppercase">{label}</span>
              </div>
            ))
          )}
        </div>
        {onViewAll && (
          <button onClick={onViewAll} className="mt-4 flex items-center gap-1 border-none bg-transparent p-0 text-[12.5px] font-semibold text-muted-foreground [-webkit-tap-highlight-color:transparent]">
            View applications <ArrowRight className="size-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="glass-surface mb-5 rounded-2xl p-5">
      <p className="m-0 mb-4 font-mono text-[10px] font-bold tracking-[0.1em] text-muted-foreground/60 uppercase">Your job search</p>
      <div className="mb-4 grid grid-cols-4 gap-2.5">
        {loading ? (
          <>
            <Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" />
          </>
        ) : (
          <>
            <div><span className="block text-[24px] font-bold text-foreground">{applied}</span><span className="text-[11px] text-muted-foreground">Applied</span></div>
            <div><span className="block text-[24px] font-bold text-foreground">{responses}</span><span className="text-[11px] text-muted-foreground">Responses</span></div>
            <div><span className="block text-[24px] font-bold text-success">{interviews}</span><span className="text-[11px] text-muted-foreground">Interviews</span></div>
            <div><span className="block text-[24px] font-bold text-success">{offers}</span><span className="text-[11px] text-muted-foreground">Offers</span></div>
          </>
        )}
      </div>
      {onViewAll && (
        <button onClick={onViewAll} className="flex items-center gap-1 border-none bg-transparent p-0 text-[13px] font-bold text-primary [-webkit-tap-highlight-color:transparent]">
          View applications <ArrowRight className="size-3.5" />
        </button>
      )}
    </div>
  );
}
