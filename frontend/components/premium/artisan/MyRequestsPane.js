"use client";
/**
 * MyRequestsPane.js — a customer's own posted job requests and their
 * status (requested -> accepted -> completed/declined, or cancelled).
 * Lives inside Artisans.js's "Hire an artisan" persona, "My requests" tab.
 * Cards stay compact; anything beyond the summary (contact info,
 * scheduling, leaving a review) lives in JobDetailDialog.
 *
 * The "MY REQUESTS (n)" header + refresh control is pinned above the
 * scrolling card list (not inside it) — same fix as ArtisanDashboard.js's
 * pinned availability card: it shouldn't scroll out of view once there
 * are enough past requests to fill the screen. Uses the same
 * "shrink-0 header + min-h-0 flex-1 overflow-y-auto list" shape rather
 * than CSS position:sticky, because this pane renders inside two
 * different scroll contexts (mobile: an ancestor scrolls; desktop: this
 * pane owns its own scroll inside a fixed-height clipped column — see
 * Artisans.js) and the flex approach is the one that works in both
 * without depending on which ancestor actually scrolls.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, MapPin, Clock, RefreshCw, ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "../shared/api";
import { truncateBio } from "../shared/artisanDisplay";
import JobDetailDialog from "./JobDetailDialog";
import { getThread, postMessage, markThreadRead } from "../messages/api";

const STATUS_META = {
  requested: { label: "Waiting for a response", className: "border-primary/30 bg-primary/10 text-primary" },
  accepted: { label: "Accepted", className: "border-[var(--success,#22c55e)]/30 bg-[var(--success,#22c55e)]/10 text-[var(--success,#22c55e)]" },
  completed: { label: "Completed", className: "border-border bg-muted text-muted-foreground" },
  declined: { label: "Declined", className: "border-destructive/30 bg-destructive/10 text-destructive" },
  cancelled: { label: "Cancelled", className: "border-border bg-muted text-muted-foreground/60" },
};

export default function MyRequestsPane() {
  const [items, setItems] = useState(null); // null = loading
  const [openId, setOpenId] = useState(null); // job id whose detail dialog is open, or null
  const [busy, setBusy] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const [releaseBusy, setReleaseBusy] = useState(false);

  const load = () => {
    setRefreshing(true);
    apiRequest("/api/v1/requests/mine")
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setRefreshing(false));
  };
  useEffect(() => { load(); }, []);

  const openJob = items?.find((j) => j.id === openId) || null;

  const cancel = async () => {
    setBusy(true);
    try {
      await apiRequest(`/api/v1/requests/${openId}/cancel`, { method: "POST" });
      toast.success("Request cancelled");
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const proposeTime = async (scheduledAt) => {
    setBusy(true);
    try {
      await apiRequest(`/api/v1/requests/${openId}/propose-time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduled_at: scheduledAt }),
      });
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmTime = async () => {
    setBusy(true);
    try {
      await apiRequest(`/api/v1/requests/${openId}/confirm-time`, { method: "POST" });
      toast.success("Time confirmed");
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Redirects the whole tab to Stripe's own hosted Checkout page — not an
  // in-app form, card details never touch this app at all (see
  // backend's create_request/pay). Coming back is handled by the same
  // "restore whatever screen was last open" mechanism the rest of the
  // app already uses (app/page.js's view persistence) rather than a
  // dedicated return page this app has no real route for.
  const pay = async () => {
    setPayBusy(true);
    try {
      const { checkout_url } = await apiRequest(`/api/v1/requests/${openId}/pay`, { method: "POST" });
      window.location.href = checkout_url;
    } catch (e) {
      toast.error(e.message);
      setPayBusy(false);
    }
  };

  const releasePayment = async () => {
    setReleaseBusy(true);
    try {
      await apiRequest(`/api/v1/requests/${openId}/release-payment`, { method: "POST" });
      toast.success("Payment released to the artisan");
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setReleaseBusy(false);
    }
  };

  const submitReview = async ({ stars, comment }) => {
    setReviewSubmitting(true);
    try {
      await apiRequest(`/api/v1/requests/${openId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stars, comment }),
      });
      toast.success("Thanks for the review!");
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="flex shrink-0 items-center justify-between">
        <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60">
          <ClipboardList className="size-3" /> MY REQUESTS ({items?.length ?? 0})
        </span>
        <button type="button" onClick={load} className="flex items-center gap-1 border-none bg-transparent p-0 text-[11.5px] font-semibold text-muted-foreground">
          <RefreshCw className={`size-3 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* On mobile this div is the ACTUAL scrollport (see the file-level
          comment above), not the page-level ancestor — nested min-h-0/
          flex-1 bounds it before it can ever overflow into that ancestor,
          so Artisans.js's own BottomNav clearance never applies here. This
          was the same bug the user reported elsewhere in the app: the
          floating BottomNav hiding the last card(s) in a list with barely
          any bottom padding of its own. Generous on purpose, same
          reasoning MobileNav.js's own comment gives — a little extra
          blank space at the end of a scroll is harmless, a covered card
          isn't. Harmless on desktop too (just a bit of unused space at
          the bottom of the 380px column; there's no floating nav there
          to clear). */}
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ paddingBottom: "calc(100px + env(safe-area-inset-bottom, 0px))" }}>
        {items === null ? (
          <div className="flex flex-col items-center gap-2.5 py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="grid justify-items-center gap-2 px-1 py-10 text-center">
            <p className="m-0 text-sm font-bold text-foreground">No requests yet</p>
            <p className="m-0 max-w-[240px] text-[12.5px] leading-relaxed text-muted-foreground">
              Open an artisan's profile and tap "Request" to reach out.
            </p>
          </div>
        ) : (
          <div className="grid gap-2.5 pb-1">
            {items.map((j) => {
              const meta = STATUS_META[j.status] || STATUS_META.requested;
              return (
                <Card
                  key={j.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenId(j.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(j.id); } }}
                  className="cursor-pointer gap-0 overflow-hidden p-3.5"
                >
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <span className="text-[13.5px] font-bold text-foreground">{j.trade}</span>
                    <Badge variant="outline" className={`shrink-0 rounded-full text-[10px] font-bold ${meta.className}`}>
                      {meta.label}
                    </Badge>
                  </div>
                  {j.city && (
                    <div className="mb-1 flex items-center gap-1">
                      <MapPin className="size-[11px] text-muted-foreground" />
                      <span className="text-[12px] text-muted-foreground">{j.city}</span>
                    </div>
                  )}
                  <p className="m-0 mb-1.5 text-[12.5px] leading-relaxed text-foreground">{truncateBio(j.description)}</p>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                    <Clock className="size-[11px]" />
                    {new Date(j.created_at).toLocaleDateString()}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <JobDetailDialog
        open={!!openJob}
        onClose={() => setOpenId(null)}
        job={openJob}
        viewerIsArtisan={false}
        busy={busy}
        onProposeTime={proposeTime}
        onConfirmTime={confirmTime}
        onCancel={cancel}
        onPay={pay}
        payBusy={payBusy}
        onReleasePayment={releasePayment}
        releaseBusy={releaseBusy}
        reviewed={openJob?.reviewed}
        onSubmitReview={submitReview}
        reviewSubmitting={reviewSubmitting}
        onFetchMessages={getThread}
        onSendMessage={postMessage}
        onMarkMessagesRead={markThreadRead}
      />
    </div>
  );
}
