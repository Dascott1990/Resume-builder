"use client";
/**
 * JobDetailDialog.js — everything past a job's compact summary: full
 * description, contact info, scheduling, messages, and (customer side)
 * leaving a review once complete. Built as the shared home for this so
 * Phase 3's messages and Phase 4's payment status have somewhere to slot
 * in later without redesigning the cards again — both MyRequestsPane.js
 * (customer) and ArtisanDashboard.js (artisan) open this for anything
 * beyond a compact card; the artisan's "Requests for you" pool is the one
 * exception, which stays one-tap Accept/Decline with no dialog (that's a
 * triage list, not something worth an extra tap to act on).
 *
 * Visually this is the same "artisan brand" language as ArtisanDashboard/
 * ArtisanAuth — IconTile trade icon, mono tracking-wide section labels
 * with icons, a status-tinted top accent — just condensed into a dialog.
 *
 * Contact (Call/Email) and the primary status action (Mark complete /
 * Cancel request) live in a sticky footer pinned below the scrolling
 * content — same fix as ArtisanProfile.js's bottom contact sheet: reaching
 * the other party or taking the one action that matters shouldn't require
 * scrolling past a long message thread to find it.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  MapPin, Clock, CheckCircle2, Hammer, Phone, Mail, CalendarClock,
  MessageCircle, Star, X, Ban, FileText,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Btn } from "../guest/components/primitives";
import { IconTile } from "../shared/IconTile";
import { formatPhone } from "../shared/artisanDisplay";
import SchedulingRow from "./SchedulingRow";
import ReviewForm from "../shared/ReviewForm";
import MessageThread from "../messages/MessageThread";

const STATUS_META = {
  requested: { label: "Waiting for a response", icon: Clock, className: "border-primary/30 bg-primary/10 text-primary", accent: "var(--primary)" },
  accepted: { label: "Accepted", icon: CheckCircle2, className: "border-[var(--success,#22c55e)]/30 bg-[var(--success,#22c55e)]/10 text-[var(--success,#22c55e)]", accent: "var(--success, #22c55e)" },
  completed: { label: "Completed", icon: CheckCircle2, className: "border-border bg-muted text-muted-foreground", accent: "var(--muted-foreground)" },
  declined: { label: "Declined", icon: Ban, className: "border-destructive/30 bg-destructive/10 text-destructive", accent: "var(--destructive)" },
  cancelled: { label: "Cancelled", icon: X, className: "border-border bg-muted text-muted-foreground/60", accent: "var(--muted-foreground)" },
};

function Section({ icon: Icon, children }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60">
      <Icon className="size-3" /> {children}
    </div>
  );
}

export default function JobDetailDialog({
  open, onClose, job, viewerIsArtisan, busy,
  onProposeTime, onConfirmTime, onComplete, onCancel,
  reviewed, onSubmitReview, reviewSubmitting,
  onFetchMessages, onSendMessage, onMarkMessagesRead,
}) {
  const [reviewOpen, setReviewOpen] = useState(false);

  // Closes the review form once the parent's refetch confirms it actually
  // landed — not on the submit call's own promise resolving, since the
  // parent's submit handler swallows its own errors (toasts, doesn't
  // re-throw), so a resolved promise there doesn't mean success.
  useEffect(() => { if (reviewed) setReviewOpen(false); }, [reviewed]);

  if (!job) return null;
  const meta = STATUS_META[job.status] || STATUS_META.requested;
  // Mirrors SchedulingRow's own early-return conditions exactly — a
  // completed job that was never scheduled renders nothing there, so the
  // section label above it must not render either (an empty "SCHEDULE"
  // heading with nothing under it reads as a bug, not a state).
  const showScheduling = job.status === "accepted" || (job.status === "completed" && !!job.scheduled_at);
  const showContact = job.status === "accepted" || job.status === "completed";
  const hasAction =
    (viewerIsArtisan && job.status === "accepted") ||
    (!viewerIsArtisan && (job.status === "requested" || job.status === "accepted"));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent showCloseButton className="flex max-h-[85dvh] w-full max-w-[440px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[440px]">
        <div aria-hidden="true" className="h-[3px] w-full shrink-0" style={{ background: meta.accent }} />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 [-webkit-overflow-scrolling:touch]">
          <div className="mb-3.5 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <IconTile icon={Hammer} size="sm" />
              <div>
                <p className="m-0 font-serif text-[17px] italic leading-tight text-foreground">{job.trade}</p>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground/70">
                  {job.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="size-[10px]" /> {job.city}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="size-[10px]" /> {new Date(job.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
            <Badge variant="outline" className={`mr-6 shrink-0 gap-1 rounded-full text-[10px] font-bold ${meta.className}`}>
              <meta.icon className="size-3" /> {meta.label}
            </Badge>
          </div>

          <Section icon={FileText}>JOB DETAILS</Section>
          <p className="m-0 mb-3.5 rounded-lg border border-border bg-muted/40 p-3 text-[13px] leading-relaxed text-foreground">
            {job.description}
          </p>

          {showScheduling && (
            <div className="mb-3.5">
              <Section icon={CalendarClock}>SCHEDULE</Section>
              <SchedulingRow job={job} viewerIsArtisan={viewerIsArtisan} busy={busy}
                onProposeTime={onProposeTime} onConfirmTime={onConfirmTime} />
            </div>
          )}

          {showContact && onFetchMessages && (
            <div className="mb-3.5">
              <Section icon={MessageCircle}>MESSAGES</Section>
              <MessageThread
                jobId={job.id}
                viewerIsArtisan={viewerIsArtisan}
                onFetch={onFetchMessages}
                onSend={onSendMessage}
                onMarkRead={onMarkMessagesRead}
              />
            </div>
          )}

          {/* Reviewing is customer-only — viewerIsArtisan sees a read-only
              "Reviewed" note instead of ever seeing the form. */}
          {job.status === "completed" && !viewerIsArtisan && (
            <div className="mb-1">
              <Section icon={Star}>REVIEW</Section>
              {reviewed ? (
                <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground">
                  <CheckCircle2 className="size-3.5" /> Reviewed
                </div>
              ) : reviewOpen ? (
                <ReviewForm submitting={reviewSubmitting} onSubmit={onSubmitReview} />
              ) : (
                <Btn small variant="gold" onClick={() => setReviewOpen(true)}>Leave a review</Btn>
              )}
            </div>
          )}

        </div>

        {/* Sticky footer — see the file-level comment. Only rendered when
            there's something to pin; a declined/cancelled job (no contact,
            no action) just ends with the scrolling content above. */}
        {(showContact || hasAction) && (
          <motion.div
            initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", damping: 24, stiffness: 300 }}
            className="shrink-0 border-t border-border bg-background/95 p-3.5 backdrop-blur-xl supports-backdrop-filter:bg-background/80"
          >
            {showContact && (
              <>
                <p className="m-0 mb-1.5 truncate text-[11px] font-semibold text-muted-foreground">{job.contact_name}</p>
                <div className={`${job.contact_email ? "grid grid-cols-2" : "grid grid-cols-1"} gap-2 ${hasAction ? "mb-2.5" : ""}`}>
                  <Button asChild variant="outline" className="h-10 gap-1.5 rounded-[10px] text-[12.5px] font-bold">
                    <a href={`tel:${job.contact_phone}`}>
                      <Phone className="size-3.5" /> {formatPhone(job.contact_phone)}
                    </a>
                  </Button>
                  {job.contact_email && (
                    <Button asChild variant="outline" className="h-10 gap-1.5 rounded-[10px] text-[12.5px] font-bold">
                      <a href={`mailto:${job.contact_email}`}>
                        <Mail className="size-3.5" /> Email
                      </a>
                    </Button>
                  )}
                </div>
              </>
            )}
            {hasAction && (
              <div className="flex gap-2">
                {viewerIsArtisan && job.status === "accepted" && (
                  <Btn small variant="primary" icon="Check" disabled={busy} loading={busy} onClick={onComplete} className="flex-1">
                    Mark complete
                  </Btn>
                )}
                {!viewerIsArtisan && (job.status === "requested" || job.status === "accepted") && (
                  <Btn small variant="ghost" disabled={busy} loading={busy} onClick={onCancel} className="flex-1">
                    Cancel request
                  </Btn>
                )}
              </div>
            )}
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
}
