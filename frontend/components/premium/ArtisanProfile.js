"use client";
/**
 * ArtisanProfile.js — full-screen "professional profile" view for one
 * artisan: a portfolio-forward hero, rating summary, bio, rate-this-
 * artisan widget, recent reviews, and a Message/Request contact sheet.
 *
 * A state swap (like Artisans.js's own tab / page.js's view), not a Dialog —
 * shadcn's DialogContent caps at sm:max-w-sm, too cramped for this much
 * content, and the app already treats "look at one thing full screen" as a
 * state swap at two other levels.
 *
 * Contact (Message/Request) is a sticky sheet pinned to the bottom of the
 * screen, NOT part of the scrolling content — the whole point of this page
 * is to reach the artisan, so that action shouldn't require scrolling past
 * photos/bio/reviews to find it. Call/Text/Email — real tel:/sms:/mailto:
 * links, unchanged from before — live in the scrolling column instead of
 * the sheet now; the sheet itself stays to exactly two actions on purpose.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ChevronLeft, MapPin, Phone, MessageSquare, Mail, RefreshCw, ClipboardList, Star, MessageCircle, Heart, Share2 } from "lucide-react";
import { apiRequest } from "./shared/api";
import { formatPhone } from "./shared/artisanDisplay";
import { Btn } from "./guest/components/primitives";
import PhotoPortfolio from "./artisan/PhotoPortfolio";
import RequestJobModal from "./artisan/RequestJobModal";
import StarRating from "./shared/StarRating";
import DeleteListingDialog from "./shared/DeleteListingDialog";
import { tapFeedback } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

const BIO_TRUNCATE_LEN = 220;

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

function Section({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60">
      <Icon className="size-3" /> {children}
    </div>
  );
}

// Truncate-then-expand for the bio, same shape as the reference's product
// description — full text always exists in the DOM/state, just visually
// clipped until "Read more" is tapped, so nothing is ever actually hidden
// from a screen reader or search.
function ExpandableBio({ text }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const needsTruncation = text.length > BIO_TRUNCATE_LEN;
  const shown = expanded || !needsTruncation ? text : text.slice(0, BIO_TRUNCATE_LEN).trimEnd() + "…";
  return (
    <p className="text-[13.5px] leading-relaxed text-foreground">
      {shown}
      {needsTruncation && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-1.5 border-none bg-transparent p-0 text-[13px] font-bold text-primary"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </p>
  );
}

export default function ArtisanProfile({
  artisan, isMine, editToken, onBack, onEdit, onDelete, myRating, onRated, onRatingUpdate,
  isFavorite, onToggleFavorite, onMessage,
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [messageChecking, setMessageChecking] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadReviews = () => {
    setReviewsLoading(true);
    setReviewsError(null);
    apiRequest(`/api/v1/artisans/${artisan.id}/reviews`)
      .then(setReviews)
      .catch((e) => setReviewsError(e.message))
      .finally(() => setReviewsLoading(false));
  };
  useEffect(loadReviews, [artisan.id]);

  // Requesting needs a real account on the other end (see backend's
  // create_request) — most existing listings are the anonymous "list
  // yourself" kind with no account, for which Call/Text/Email is and
  // stays the only path. is_available is the artisan's own on/off switch.
  const canRequest = !isMine && artisan.has_account && artisan.is_available;

  // "Message" has no standalone backend of its own — real in-app messaging
  // only exists once a request is accepted (job-scoped threads, see
  // messages.py). So this checks for an already-accepted request with
  // THIS artisan first and, if one exists, hands off to the real thread
  // (via onMessage, which Artisans.js wires to its own "My requests" tab —
  // the one place that thread actually renders); otherwise it's the same
  // honest fallback as the Request button: submitting a request IS the
  // real first step toward a conversation in this product today.
  const handleMessage = async () => {
    if (!isMine && onMessage) {
      setMessageChecking(true);
      try {
        const mine = await apiRequest("/api/v1/requests/mine");
        const accepted = (mine || []).find((r) => r.artisan_id === artisan.id && r.status === "accepted");
        if (accepted) { onMessage(); return; }
      } catch { /* fall through to request/call fallback below */ }
      finally { setMessageChecking(false); }
    }
    if (canRequest) setRequestOpen(true);
    else toast.error("Send a request first — you'll be able to message once it's accepted.");
  };

  const share = async () => {
    const text = `${artisan.name} — ${artisan.trade}${artisan.city ? ` in ${artisan.city}` : ""} on Noqeev`;
    if (navigator.share) {
      try { await navigator.share({ title: artisan.name, text }); } catch { /* cancelled — not an error */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Couldn't share — try copying manually.");
    }
  };

  const submitRating = async () => {
    setSubmitting(true);
    try {
      const data = await apiRequest(`/api/v1/artisans/${artisan.id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stars, comment: comment.trim() || undefined }),
      });
      onRated(artisan.id, stars);
      onRatingUpdate({ rating_avg: data.rating_avg, rating_count: data.rating_count });
      setReviews((r) => [data, ...r]);
      tapFeedback();
      toast.success("Thanks for rating!");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
    <div
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-5"
      style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
    >
      <div className="flex shrink-0 items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 border-none bg-transparent p-0 text-[13px] font-semibold text-muted-foreground"
        >
          <ChevronLeft className="size-4" /> Back
        </button>
        {isMine && (
          <div className="flex shrink-0 gap-1.5">
            <Btn small icon="Pencil" onClick={() => onEdit(artisan)}>Edit</Btn>
            <DeleteListingDialog
              name={artisan.name}
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              onConfirm={() => onDelete(artisan.id)}
              trigger={<Btn small variant="danger" icon="Trash2">Delete</Btn>}
            />
          </div>
        )}
      </div>

      {/* Hero: the artisan's own portfolio, not a small circular avatar —
          heart/share float over its top-right corner, same corner
          positions a product-detail hero uses them in. */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }} className="relative">
        <PhotoPortfolio artisan={artisan} isMine={isMine} editToken={editToken} />
        {!isMine && (
          <div className="absolute top-3 right-3 flex gap-2">
            <button
              type="button"
              onClick={share}
              aria-label="Share"
              className="flex size-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
            >
              <Share2 className="size-4" />
            </button>
            {onToggleFavorite && (
              <button
                type="button"
                onClick={() => onToggleFavorite(artisan.id)}
                aria-label={isFavorite ? "Remove from favorites" : "Save to favorites"}
                aria-pressed={!!isFavorite}
                className="flex size-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
              >
                <Heart className={`size-4 ${isFavorite ? "fill-white" : ""}`} />
              </button>
            )}
          </div>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <div className="text-xl font-bold text-foreground">{artisan.name}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-bold text-primary">{artisan.trade}</span>
          {artisan.years_experience != null && (
            <Badge variant="outline" className="rounded border-dashed font-mono text-[10.5px] text-muted-foreground">
              {artisan.years_experience}+ YRS
            </Badge>
          )}
          {/* The same available/off language as the artisan's own
              dashboard status card (ArtisanDashboard.js) — a customer
              gets the same signal the artisan sees about themselves,
              instead of only discovering it once the Request button
              does or doesn't appear. */}
          {!isMine && artisan.has_account && (
            <Badge
              variant="outline"
              className={`gap-1 rounded-full text-[10px] font-bold ${
                artisan.is_available
                  ? "border-[var(--success,#22c55e)]/30 bg-[var(--success,#22c55e)]/10 text-[var(--success,#22c55e)]"
                  : "border-border bg-muted text-muted-foreground"
              }`}
            >
              <span className={`size-[5px] rounded-full ${artisan.is_available ? "bg-[var(--success,#22c55e)]" : "bg-muted-foreground/50"}`} />
              {artisan.is_available ? "Available now" : "Not accepting requests"}
            </Badge>
          )}
        </div>
        {artisan.city && (
          <div className="mt-1 flex items-center gap-1">
            <MapPin className="size-3 text-muted-foreground" />
            <span className="text-[12.5px] text-muted-foreground">{artisan.city}</span>
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}
        className="flex items-center gap-2.5 rounded-2xl border border-foreground/10 bg-card/95 px-4 py-3.5 shadow-[0_8px_28px_rgba(0,0,0,0.10)] backdrop-blur-xl supports-backdrop-filter:bg-card/75 dark:shadow-[0_10px_36px_rgba(0,0,0,0.4),0_1px_0_rgba(255,255,255,0.06)_inset]"
      >
        {artisan.rating_count > 0 ? (
          <>
            <span className="text-2xl font-bold text-foreground">{artisan.rating_avg.toFixed(1)}</span>
            <StarRating readOnly value={artisan.rating_avg} size="size-4" />
            <span className="text-[12.5px] text-muted-foreground">
              ({artisan.rating_count} rating{artisan.rating_count === 1 ? "" : "s"})
            </span>
          </>
        ) : (
          <span className="text-[13px] text-muted-foreground">No ratings yet — be the first</span>
        )}
      </motion.div>

      <ExpandableBio text={artisan.bio} />

      {!isMine && (
        <div className="rounded-2xl border border-foreground/10 bg-card/95 p-3.5 shadow-[0_8px_28px_rgba(0,0,0,0.10)] backdrop-blur-xl supports-backdrop-filter:bg-card/75 dark:shadow-[0_10px_36px_rgba(0,0,0,0.4),0_1px_0_rgba(255,255,255,0.06)_inset]">
          {myRating != null ? (
            <div className="flex items-center gap-2">
              <StarRating readOnly value={myRating} size="size-4" />
              <span className="text-[13px] font-semibold text-muted-foreground">
                You rated this artisan {myRating} star{myRating === 1 ? "" : "s"}
              </span>
            </div>
          ) : (
            <>
              <p className="m-0 mb-2 font-serif text-base italic text-foreground">Rate this artisan</p>
              <StarRating value={stars} onChange={setStars} />
              <Textarea
                className="mt-2.5 min-h-[60px] resize-y rounded-[10px] text-sm"
                placeholder="Optional — how did it go?"
                maxLength={280}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="mt-1 text-right text-[10.5px] text-muted-foreground/60">
                {comment.length}/280
              </div>
              <Btn
                variant="gold"
                className="mt-2.5"
                disabled={stars === 0 || submitting}
                loading={submitting}
                onClick={submitRating}
              >
                {submitting ? "Submitting…" : "Submit rating"}
              </Btn>
            </>
          )}
        </div>
      )}

      {reviewsLoading && (
        <div className="grid gap-2.5">
          <Section icon={Star}>RECENT REVIEWS</Section>
          <div className="rounded-lg border border-border p-2.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="mt-2 h-3 w-full" />
          </div>
        </div>
      )}

      {!reviewsLoading && reviewsError && (
        <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <span>Couldn't load reviews.</span>
          <button
            type="button"
            onClick={loadReviews}
            className="flex items-center gap-1 border-none bg-transparent p-0 font-bold text-primary"
          >
            <RefreshCw className="size-3" /> Try again
          </button>
        </div>
      )}

      {!reviewsLoading && !reviewsError && (
        <div className="grid gap-2.5">
          <Section icon={Star}>RECENT REVIEWS</Section>
          {reviews.length === 0 ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-border px-3 py-3">
              <MessageCircle className="size-4 shrink-0 text-muted-foreground/60" />
              <p className="m-0 text-[12.5px] leading-relaxed text-muted-foreground">No reviews yet</p>
            </div>
          ) : reviews.map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <StarRating readOnly value={r.stars} size="size-3.5" />
                  {r.verified && (
                    <Badge variant="outline" className="rounded-full border-[var(--success,#22c55e)]/30 bg-[var(--success,#22c55e)]/10 text-[9.5px] font-bold text-[var(--success,#22c55e)]">
                      Verified job
                    </Badge>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground/70">{timeAgo(r.created_at)}</span>
              </div>
              {r.comment && (
                <p className="m-0 mt-1.5 text-[12.5px] leading-relaxed text-foreground">{r.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Call/Text/Email — real tel:/sms:/mailto: links, unchanged from
          before, just moved out of the sticky sheet below (which now
          stays to exactly Message + Request) and into the scrolling
          column as the "other ways to reach them" fallback. */}
      {!isMine && (
        <div className="grid gap-2">
          <Section icon={Phone}>OTHER WAYS TO REACH {artisan.name.split(" ")[0].toUpperCase()}</Section>
          <div className={artisan.email ? "grid grid-cols-3 gap-2" : "grid grid-cols-2 gap-2"}>
            <Button asChild variant="outline" className="h-11 w-full gap-1.5 rounded-[10px] px-2 text-[12.5px] font-bold">
              <a href={`tel:${artisan.phone}`}>
                <Phone className="size-3.5" /> {formatPhone(artisan.phone)}
              </a>
            </Button>
            <Button asChild variant="outline" className="h-11 w-full gap-1.5 rounded-[10px] px-2 text-[12.5px] font-bold">
              <a href={`sms:${artisan.phone}`}>
                <MessageSquare className="size-3.5" /> Text
              </a>
            </Button>
            {artisan.email && (
              <Button asChild variant="outline" className="h-11 w-full gap-1.5 rounded-[10px] px-2 text-[12.5px] font-bold">
                <a href={`mailto:${artisan.email}`}>
                  <Mail className="size-3.5" /> Email
                </a>
              </Button>
            )}
          </div>
        </div>
      )}

    </div>

      {/* The sticky contact sheet — exactly two actions now, Message and
          Request, the one deliberate deviation from a literal product-
          page footer (no size/quantity/cart concept applies here). Pinned
          outside the scrolling column above so reaching the artisan never
          requires scrolling past photos/bio/reviews to find it. */}
      {!isMine && (
        <motion.div
          initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 24, stiffness: 300 }}
          className="shrink-0 border-t border-foreground/10 bg-background/95 px-5 pt-3 shadow-[0_-8px_28px_rgba(0,0,0,0.10)] backdrop-blur-xl supports-backdrop-filter:bg-background/80 dark:shadow-[0_-10px_32px_rgba(0,0,0,0.4)]"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <div className="grid grid-cols-2 gap-2.5">
            <Button
              variant="outline"
              className="h-[54px] w-full gap-2 rounded-xl px-3 text-[14px] font-bold"
              onClick={handleMessage}
              disabled={messageChecking}
            >
              <MessageCircle className="size-[18px]" /> Message
            </Button>
            <Button
              className="h-[54px] w-full gap-2 rounded-xl px-3 text-[14px] font-bold"
              onClick={() => setRequestOpen(true)}
              disabled={!canRequest}
            >
              <ClipboardList className="size-[18px]" /> Request {artisan.trade}
            </Button>
          </div>
          {!canRequest && artisan.has_account && (
            <p className="m-0 pt-2 text-center text-[12px] text-muted-foreground">
              Not accepting requests right now — try calling instead
            </p>
          )}
        </motion.div>
      )}

      <RequestJobModal open={requestOpen} onClose={() => setRequestOpen(false)} targetArtisan={artisan} />
    </div>
  );
}
