"use client";
/**
 * ArtisanDashboard.js — an artisan's home base once signed in: toggle
 * availability, see requests addressed to them, accept/decline, and
 * manage in-progress/completed jobs. Gated by ArtisanAuth until a token
 * exists (see lib/artisanAuthToken.js).
 *
 * Two card treatments on purpose: the "Requests for you" pool is a triage
 * list — one-tap Accept/Decline right on the card, no dialog in the way.
 * In-progress/completed jobs open JobDetailDialog for anything beyond the
 * summary (contact info, scheduling, and later messages/payment).
 *
 * The availability status card is pinned above the scrolling job list
 * (not inside it) — same fix as ArtisanProfile.js/JobDetailDialog.js's
 * sticky contact sheets: the one fact that decides whether customers can
 * even reach this artisan shouldn't scroll out of view once there are
 * enough job cards to fill the screen.
 */
import { forwardRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Loader2, MapPin, Clock, X, Wrench, RefreshCw, ClipboardList, Hammer,
  CheckCircle2, Inbox, Star, MessageCircle, Banknote,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Btn } from "../guest/components/primitives";
import { truncateBio, tintFor, initialsOf, avatarPhotoUrl } from "../shared/artisanDisplay";
import Emoji3D from "../shared/Emoji3D";
import StarRating from "../shared/StarRating";
import { getArtisanToken, setArtisanToken } from "@/lib/artisanAuthToken";
import ArtisanAuth from "./ArtisanAuth";
import JobDetailDialog from "./JobDetailDialog";
import {
  artisanMe, artisanSetAvailability, artisanPool, artisanAccepted,
  artisanAcceptRequest, artisanDeclineRequest, artisanCompleteRequest,
  artisanProposeTime, artisanConfirmTime,
  artisanGetThread, artisanPostMessage, artisanMarkThreadRead, artisanUnreadCount,
  artisanReviews, artisanConnectOnboard, artisanConnectStatus,
} from "./api";

function timeAgo(iso) {
  if (!iso) return "";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const STATUS_META = {
  accepted: { label: "Accepted", className: "border-[var(--success,#22c55e)]/30 bg-[var(--success,#22c55e)]/10 text-[var(--success,#22c55e)]" },
  completed: { label: "Completed", className: "border-border bg-muted text-muted-foreground" },
};

function SectionLabel({ icon: Icon, children }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60">
      <Icon className="size-3" /> {children}
    </span>
  );
}

function EmptyRow({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-border px-3 py-3">
      <Icon className="size-4 shrink-0 text-muted-foreground/60" />
      <p className="m-0 text-[12.5px] leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

// forwardRef matters here, not cosmetically: this is a direct child of
// AnimatePresence in popLayout mode below, which clones in a ref (via its
// internal PopChild) to measure the element for exit animations. A plain
// function component can't receive that ref — same gotcha documented on
// Btn in guest/components/primitives.js.
const PoolCard = forwardRef(function PoolCard({ j, busy, onAccept, onDecline }, ref) {
  return (
    <motion.div ref={ref} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
      <Card className="gap-0 overflow-hidden border-l-[3px] border-l-primary p-3.5">
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <span className="text-[13.5px] font-bold text-foreground">{j.trade}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground/70">{new Date(j.created_at).toLocaleDateString()}</span>
        </div>
        {j.city && (
          <div className="mb-1 flex items-center gap-1">
            <MapPin className="size-[11px] text-muted-foreground" />
            <span className="text-[12px] text-muted-foreground">{j.city}</span>
          </div>
        )}
        <p className="m-0 mb-2.5 text-[12.5px] leading-relaxed text-foreground">{j.description}</p>
        <div className="flex gap-2">
          <Btn small variant="gold" disabled={busy} loading={busy} onClick={onAccept}>Accept</Btn>
          <Btn small variant="ghost" disabled={busy} onClick={onDecline}>Decline</Btn>
        </div>
      </Card>
    </motion.div>
  );
});

function CompactJobCard({ j, onOpen }) {
  const meta = STATUS_META[j.status];
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.98 }}>
      <Card
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
        className="cursor-pointer gap-0 overflow-hidden p-3.5"
      >
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <span className="text-[13.5px] font-bold text-foreground">{j.trade}</span>
          {meta && (
            <Badge variant="outline" className={`shrink-0 rounded-full text-[10px] font-bold ${meta.className}`}>
              {meta.label}
            </Badge>
          )}
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
    </motion.div>
  );
}

export default function ArtisanDashboard({ onClose }) {
  const [signedIn, setSignedIn] = useState(null); // null = checking
  const [artisan, setArtisan] = useState(null);
  const [pool, setPool] = useState(null);
  const [accepted, setAccepted] = useState(null);
  const [togglingAvail, setTogglingAvail] = useState(false);
  const [actingId, setActingId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [openId, setOpenId] = useState(null); // job id whose detail dialog is open, or null
  const [unread, setUnread] = useState(0);
  const [reviews, setReviews] = useState(null);
  const [payoutStatus, setPayoutStatus] = useState(null); // { payouts_enabled, onboarding_started } | null while loading
  const [connectingPayouts, setConnectingPayouts] = useState(false);

  const loadAll = async () => {
    try {
      const [me, poolData, acceptedData] = await Promise.all([artisanMe(), artisanPool(), artisanAccepted()]);
      setArtisan(me);
      setPool(poolData);
      setAccepted(acceptedData);
      setSignedIn(true);
    } catch {
      setArtisanToken(null);
      setSignedIn(false);
    }
  };

  useEffect(() => {
    if (getArtisanToken()) loadAll();
    else setSignedIn(false);
  }, []);

  // The artisan's own public reputation — the same rating/reviews a
  // customer sees on ArtisanProfile.js, surfaced here too so they don't
  // have to go find their own public listing to see it. Fetch-once is
  // fine (a new review only ever follows a job the artisan just marked
  // complete, not something that changes mid-session on its own).
  useEffect(() => {
    if (!artisan?.id) return;
    artisanReviews(artisan.id).then(setReviews).catch(() => setReviews([]));
  }, [artisan?.id]);

  // Payout readiness (see backend/app/api/payments.py) — fetch-once on
  // sign-in is enough for the same reason reviews are: nothing changes
  // this mid-session except the artisan themselves leaving for Stripe's
  // onboarding flow and coming back, which remounts this screen anyway.
  useEffect(() => {
    if (!signedIn) return;
    artisanConnectStatus().then(setPayoutStatus).catch(() => setPayoutStatus({ payouts_enabled: false, onboarding_started: false }));
  }, [signedIn]);

  const startPayoutOnboarding = async () => {
    setConnectingPayouts(true);
    try {
      const { url } = await artisanConnectOnboard();
      window.location.href = url;
    } catch (e) {
      toast.error(e.message);
      setConnectingPayouts(false);
    }
  };

  // Unread badge on the header — a slower, separate poll from the message
  // thread's own 4s cadence (see MessageThread.js): this only needs to
  // feel current, not live, while no specific thread is open.
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    const poll = () => artisanUnreadCount().then((d) => !cancelled && setUnread(d.count)).catch(() => {});
    poll();
    const interval = setInterval(poll, 25000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [signedIn]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const [poolData, acceptedData] = await Promise.all([artisanPool(), artisanAccepted()]);
      setPool(poolData);
      setAccepted(acceptedData);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const toggleAvailability = async (checked) => {
    setTogglingAvail(true);
    try {
      const updated = await artisanSetAvailability(checked);
      setArtisan(updated);
      // Availability no longer gates visibility into requests already sent
      // (see backend's pool()) — only whether NEW ones can be created — so
      // toggling off does NOT clear the pool here anymore, just refreshes.
      await refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setTogglingAvail(false);
    }
  };

  const accept = async (id) => {
    setActingId(id);
    try {
      await artisanAcceptRequest(id);
      toast.success("Job accepted");
      await refresh();
    } catch (e) {
      toast.error(e.message);
      await refresh();
    } finally {
      setActingId(null);
    }
  };

  const decline = async (id) => {
    setActingId(id);
    try {
      await artisanDeclineRequest(id);
      toast.success("Request declined");
      await refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActingId(null);
    }
  };

  const proposeTime = async (scheduledAt) => {
    setActingId(openId);
    try {
      await artisanProposeTime(openId, scheduledAt);
      await refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActingId(null);
    }
  };

  const confirmTime = async () => {
    setActingId(openId);
    try {
      await artisanConfirmTime(openId);
      toast.success("Time confirmed");
      await refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActingId(null);
    }
  };

  const complete = async () => {
    setActingId(openId);
    try {
      const updated = await artisanCompleteRequest(openId);
      if (updated.warning) toast.warning(updated.warning);
      else toast.success("Marked complete");
      await refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActingId(null);
    }
  };

  const signOut = () => {
    setArtisanToken(null);
    setSignedIn(false);
    setArtisan(null);
  };

  const header = (
    <div
      className="relative flex shrink-0 items-center justify-between overflow-hidden px-5 pb-3.5"
      style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
    >
      <motion.div
        aria-hidden="true"
        animate={{ opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute top-[-60%] left-[-10%] size-[280px]"
        style={{ background: "radial-gradient(circle, color-mix(in oklch, var(--primary) 16%, transparent) 0%, transparent 70%)" }}
      />
      <div className="relative flex items-center gap-2">
        <Wrench className="size-4 text-primary" />
        <p className="m-0 font-serif text-[17px] italic text-foreground">Artisan dashboard</p>
        {unread > 0 && (
          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10.5px] font-bold text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </div>
      {onClose && (
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose} className="relative">
          <X className="size-5" />
        </Button>
      )}
    </div>
  );

  if (signedIn === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2.5 bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!signedIn) {
    return <ArtisanAuth onClose={onClose} onSuccess={loadAll} />;
  }

  const inProgress = (accepted || []).filter((j) => j.status === "accepted");
  const history = (accepted || []).filter((j) => j.status === "completed");
  const openJob = [...inProgress, ...history].find((j) => j.id === openId) || null;
  const tint = tintFor(artisan?.name || "?");

  return (
    <div
      className="flex h-full flex-col overflow-hidden bg-background text-foreground"
    >
      {header}

      {/* Availability is the single most important fact on this screen —
          it decides whether any customer can reach this artisan at all —
          so it gets real visual weight: a glowing ring around the avatar
          when live (an actual pulsing sonar-style ring, not just a border
          tint), an ambient glow breathing behind the whole card, and the
          avatar itself desaturated when off. Pinned outside the scrolling
          list below (see the file-level comment) so it never scrolls out
          of view. */}
      <div className="shrink-0 px-5 pb-3.5">
        <Card
          className="relative flex flex-row items-center justify-between gap-3 overflow-hidden p-3.5 transition-colors"
          style={artisan?.is_available ? {
            borderColor: "color-mix(in oklch, var(--success, #22c55e) 35%, var(--border))",
            background: "color-mix(in oklch, var(--success, #22c55e) 6%, var(--card))",
          } : undefined}
        >
          {/* Ambient glow, not just a border tint — purely decorative
              (aria-hidden, no pointer events), absent entirely when off
              so a quiet status doesn't compete for attention. */}
          {artisan?.is_available && (
            <motion.div
              aria-hidden="true"
              animate={{ opacity: [0.5, 0.85, 0.5] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="pointer-events-none absolute -top-10 -left-6 size-32 rounded-full blur-3xl"
              style={{ background: "var(--success, #22c55e)" }}
            />
          )}

          <div className="relative flex min-w-0 items-center gap-3">
            <div className="relative shrink-0">
              {/* The sonar-style pulse this card's own comment always
                  promised but never actually built — a ring expanding
                  outward and fading, the classic "this is live right now"
                  micro-interaction. */}
              {artisan?.is_available && (
                <motion.div
                  aria-hidden="true"
                  initial={{ scale: 1, opacity: 0.55 }}
                  animate={{ scale: 1.7, opacity: 0 }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                  className="absolute inset-0 rounded-full"
                  style={{ background: "var(--success, #22c55e)" }}
                />
              )}
              <div
                className={`relative flex size-11 items-center justify-center overflow-hidden rounded-full border transition-all duration-500 ${artisan?.has_avatar_photo || artisan?.avatar_emoji ? "" : "font-mono text-sm font-bold"} ${tint} ${!artisan?.is_available ? "opacity-50 grayscale" : ""}`}
                style={artisan?.is_available ? {
                  boxShadow: "0 0 0 3px color-mix(in oklch, var(--success,#22c55e) 25%, transparent), 0 0 18px color-mix(in oklch, var(--success,#22c55e) 40%, transparent)",
                } : undefined}
              >
                {artisan?.has_avatar_photo ? (
                  <img src={avatarPhotoUrl(artisan.id, artisan.avatar_photo_version)} alt="" className="size-full object-cover" />
                ) : artisan?.avatar_emoji ? (
                  <Emoji3D emoji={artisan.avatar_emoji} size={44} />
                ) : (
                  initialsOf(artisan?.name || "?")
                )}
              </div>
            </div>
            <div className="min-w-0">
              <p className="m-0 truncate text-[13.5px] font-bold text-foreground">{artisan?.name}</p>
              <p className="m-0 text-[12px] text-muted-foreground">{artisan?.trade} · {artisan?.city || "No city set"}</p>
            </div>
          </div>
          <div className="relative flex shrink-0 items-center gap-2.5">
            <span className={`flex items-center gap-1.5 font-mono text-[10.5px] font-bold tracking-[0.1em] ${artisan?.is_available ? "text-[var(--success,#22c55e)]" : "text-muted-foreground/60"}`}>
              {artisan?.is_available && (
                <motion.span
                  animate={{ opacity: [1, 0.35, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  className="size-[7px] shrink-0 rounded-full bg-[var(--success,#22c55e)]"
                />
              )}
              {artisan?.is_available ? "LIVE" : "OFF"}
            </span>
            <Switch checked={!!artisan?.is_available} disabled={togglingAvail} onCheckedChange={toggleAvailability} />
          </div>
        </Card>

        {/* Where escrow actually lands — a job's payment can't be
            released to this artisan (see JobDetailDialog.js's "Release
            payment" action) until Stripe confirms this account can
            receive a Transfer. Visible here even once ready, not hidden
            after setup, so it's always clear payouts are live. */}
        {payoutStatus && !payoutStatus.payouts_enabled ? (
          <Card className="mt-2.5 flex flex-row items-center justify-between gap-3 p-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
                <Banknote className="size-[18px] text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="m-0 text-[13.5px] font-bold text-foreground">
                  {payoutStatus.onboarding_started ? "Finish payout setup" : "Set up payouts"}
                </p>
                <p className="m-0 text-[12px] text-muted-foreground">
                  Required before you can be paid for a completed job.
                </p>
              </div>
            </div>
            <Btn small variant="gold" disabled={connectingPayouts} loading={connectingPayouts} onClick={startPayoutOnboarding}>
              {payoutStatus.onboarding_started ? "Finish" : "Set up"}
            </Btn>
          </Card>
        ) : payoutStatus?.payouts_enabled ? (
          <Card className="mt-2.5 flex flex-row items-center gap-3 p-3.5" style={{
            borderColor: "color-mix(in oklch, var(--success, #22c55e) 35%, var(--border))",
            background: "color-mix(in oklch, var(--success, #22c55e) 6%, var(--card))",
          }}>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--success,#22c55e)]/15">
              <CheckCircle2 className="size-[16px] text-[var(--success,#22c55e)]" />
            </div>
            <p className="m-0 text-[13px] font-bold text-foreground">Payouts ready — escrowed jobs can be released to you.</p>
          </Card>
        ) : null}
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5"
        style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-center justify-between">
          <SectionLabel icon={ClipboardList}>REQUESTS FOR YOU ({pool?.length ?? 0})</SectionLabel>
          <button type="button" onClick={refresh} className="flex items-center gap-1 border-none bg-transparent p-0 text-[11.5px] font-semibold text-muted-foreground">
            <RefreshCw className={`size-3 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
        <div className="grid gap-2.5">
          {!artisan?.is_available && (
            <EmptyRow icon={Wrench}>
              You're off — customers can't send you new requests right now, but anything already sent still shows here.
            </EmptyRow>
          )}
          {pool?.length === 0 && (
            <EmptyRow icon={Inbox}>Nothing waiting on you right now.</EmptyRow>
          )}
          <AnimatePresence mode="popLayout">
            {(pool || []).map((j) => (
              <PoolCard key={j.id} j={j} busy={actingId === j.id}
                onAccept={() => accept(j.id)} onDecline={() => decline(j.id)} />
            ))}
          </AnimatePresence>
        </div>

        {inProgress.length > 0 && (
          <>
            <SectionLabel icon={Hammer}>IN PROGRESS</SectionLabel>
            <div className="grid gap-2.5">
              {inProgress.map((j) => <CompactJobCard key={j.id} j={j} onOpen={() => setOpenId(j.id)} />)}
            </div>
          </>
        )}

        {history.length > 0 && (
          <>
            <SectionLabel icon={CheckCircle2}>COMPLETED</SectionLabel>
            <div className="grid gap-2.5 pb-2">
              {history.map((j) => <CompactJobCard key={j.id} j={j} onOpen={() => setOpenId(j.id)} />)}
            </div>
          </>
        )}

        {/* The same rating/reviews a customer sees on ArtisanProfile.js —
            surfaced here too so the artisan doesn't have to go find their
            own public listing to see how recent jobs went. */}
        <SectionLabel icon={Star}>YOUR REPUTATION</SectionLabel>
        <Card className="grid gap-3 p-3.5">
          <div className="flex items-center gap-2.5">
            {artisan?.rating_count > 0 ? (
              <>
                <span className="text-xl font-bold text-foreground">{artisan.rating_avg.toFixed(1)}</span>
                <StarRating readOnly value={artisan.rating_avg} size="size-3.5" />
                <span className="text-[12px] text-muted-foreground">
                  ({artisan.rating_count} rating{artisan.rating_count === 1 ? "" : "s"})
                </span>
              </>
            ) : (
              <span className="text-[12.5px] text-muted-foreground">No ratings yet</span>
            )}
          </div>
          {reviews?.length > 0 && (
            <div className="grid gap-2.5 border-t border-border pt-3">
              {reviews.map((r) => (
                <div key={r.id}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <StarRating readOnly value={r.stars} size="size-3" />
                      {r.verified && (
                        <Badge variant="outline" className="rounded-full border-[var(--success,#22c55e)]/30 bg-[var(--success,#22c55e)]/10 text-[9px] font-bold text-[var(--success,#22c55e)]">
                          Verified job
                        </Badge>
                      )}
                    </div>
                    <span className="shrink-0 text-[10.5px] text-muted-foreground/70">{timeAgo(r.created_at)}</span>
                  </div>
                  {r.comment && <p className="m-0 mt-1 text-[12px] leading-relaxed text-foreground">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
          {reviews !== null && reviews.length === 0 && (
            <div className="flex items-center gap-2 border-t border-border pt-3">
              <MessageCircle className="size-3.5 shrink-0 text-muted-foreground/60" />
              <p className="m-0 text-[12px] leading-relaxed text-muted-foreground">No reviews yet — they'll show up here once a completed job gets rated.</p>
            </div>
          )}
        </Card>

        <button type="button" onClick={signOut} className="justify-self-center border-none bg-transparent p-2 text-[12.5px] font-semibold text-muted-foreground">
          Sign out
        </button>
      </div>

      <JobDetailDialog
        open={!!openJob}
        onClose={() => setOpenId(null)}
        job={openJob}
        viewerIsArtisan
        busy={actingId === openId}
        onProposeTime={proposeTime}
        onConfirmTime={confirmTime}
        onComplete={complete}
        onFetchMessages={artisanGetThread}
        onSendMessage={artisanPostMessage}
        onMarkMessagesRead={artisanMarkThreadRead}
      />
    </div>
  );
}
