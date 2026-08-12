"use client";
/**
 * SchedulingRow.js — the propose/confirm-a-time UI, shared between
 * ArtisanDashboard.js's RequestCard and MyRequestsPane.js so the customer
 * and artisan sides render identically off the same JobRequest shape.
 * `viewerIsArtisan` is the only thing that differs per caller — everything
 * else (who proposed, whether it's confirmed) comes straight off `job`.
 */
import { useState } from "react";
import { CalendarClock, Check } from "lucide-react";
import { Btn } from "../guest/components/primitives";

function formatScheduled(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default function SchedulingRow({ job, viewerIsArtisan, onProposeTime, onConfirmTime, busy }) {
  const [draftTime, setDraftTime] = useState("");

  if (job.status !== "accepted" && job.status !== "completed") return null;
  if (job.status === "completed" && !job.scheduled_at) return null;

  const iProposedIt = (job.scheduled_proposed_by === "artisan") === viewerIsArtisan;
  const canPropose = job.status === "accepted" && (!job.scheduled_at || !job.scheduled_confirmed);

  if (job.scheduled_confirmed) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-[var(--success,#22c55e)]/30 bg-[var(--success,#22c55e)]/10 px-2.5 py-2 text-[12.5px] font-semibold text-[var(--success,#22c55e)]">
        <Check className="size-3.5 shrink-0" /> Scheduled for {formatScheduled(job.scheduled_at)}
      </div>
    );
  }

  if (job.scheduled_at && !job.scheduled_confirmed) {
    return (
      <div className="rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-2">
        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-primary">
          <CalendarClock className="size-3.5 shrink-0" />
          {iProposedIt ? `You proposed ${formatScheduled(job.scheduled_at)}` : `Proposed: ${formatScheduled(job.scheduled_at)}`}
        </div>
        {iProposedIt ? (
          <p className="m-0 mt-1 text-[11.5px] text-muted-foreground">Waiting for confirmation</p>
        ) : (
          <Btn small variant="gold" className="mt-1.5" disabled={busy} loading={busy} onClick={onConfirmTime}>
            Confirm this time
          </Btn>
        )}
      </div>
    );
  }

  if (!canPropose) return null;

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="datetime-local"
        value={draftTime}
        onChange={(e) => setDraftTime(e.target.value)}
        className="h-9 flex-1 rounded-[8px] border border-input bg-transparent px-2 text-[12.5px] text-foreground"
      />
      <Btn small variant="primary" disabled={!draftTime || busy} loading={busy} onClick={() => onProposeTime(draftTime)}>
        Propose
      </Btn>
    </div>
  );
}
