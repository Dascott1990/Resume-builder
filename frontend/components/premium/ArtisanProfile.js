"use client";
/**
 * ArtisanProfile.js — full-screen "professional profile" view for one
 * artisan: full bio, rating summary + Uber-style rate-this-artisan widget,
 * recent reviews, and a Call/Text/Email connect section.
 *
 * A state swap (like Artisans.js's own tab / page.js's view), not a Dialog —
 * shadcn's DialogContent caps at sm:max-w-sm, too cramped for this much
 * content, and the app already treats "look at one thing full screen" as a
 * state swap at two other levels.
 *
 * Visually speaks the same artisan-brand language as ArtisanDashboard.js/
 * JobDetailDialog.js — mono tracking-wide section labels with icons, a
 * status badge reusing the same available/off language as the artisan's
 * own dashboard, staggered entrance on the hero block.
 *
 * Contact (Request/Call/Text/Email) is a sticky sheet pinned to the
 * bottom of the screen, NOT part of the scrolling content — the whole
 * point of this page is to reach the artisan, so that action shouldn't
 * require scrolling past bio/photos/reviews to find it. It slides up once
 * on mount, the same "always reachable at the bottom" feel as iOS's
 * incoming-call sheet, then just stays put through however much the rest
 * of the page scrolls underneath it.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ChevronLeft, MapPin, Phone, MessageSquare, Mail, RefreshCw, ClipboardList, Star, MessageCircle } from "lucide-react";
import { apiRequest } from "./shared/api";
import { tintFor, initialsOf, formatPhone, avatarPhotoUrl } from "./shared/artisanDisplay";
import { Btn } from "./guest/components/primitives";
import PhotoPortfolio from "./artisan/PhotoPortfolio";
import Emoji3D from "./shared/Emoji3D";
import RequestJobModal from "./artisan/RequestJobModal";
import StarRating from "./shared/StarRating";
import DeleteListingDialog from "./shared/DeleteListingDialog";
import { tapFeedback } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function ArtisanProfile({
  artisan, isMine, editToken, onBack, onEdit, onDelete, myRating, onRated, onRatingUpdate,
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
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

  const tint = tintFor(artisan.name || "?");
  // Requesting needs a real account on the other end (see backend's
  // create_request) — most existing listings are the anonymous "list
  // yourself" kind with no account, for which Call/Text/Email is and
  // stays the only path. is_available is the artisan's own on/off switch.
  const canRequest = !isMine && artisan.has_account && artisan.is_available;

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

      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}
        className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-card/95 p-4 shadow-[0_8px_28px_rgba(0,0,0,0.10)] backdrop-blur-xl supports-backdrop-filter:bg-card/75 dark:shadow-[0_10px_36px_rgba(0,0,0,0.4),0_1px_0_rgba(255,255,255,0.06)_inset]"
      >
        <div className={`flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border ${artisan.has_avatar_photo || artisan.avatar_emoji ? "" : "font-mono text-xl font-bold"} ${tint}`}>
          {artisan.has_avatar_photo ? (
            <img src={avatarPhotoUrl(artisan.id, artisan.avatar_photo_version)} alt="" className="size-full object-cover" />
          ) : artisan.avatar_emoji ? (
            <Emoji3D emoji={artisan.avatar_emoji} size={64} />
          ) : (
            initialsOf(artisan.name)
          )}
        </div>
        <div className="min-w-0 flex-1">
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
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
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

      {artisan.bio && (
        <p className="text-[13.5px] leading-relaxed text-foreground">{artisan.bio}</p>
      )}

      <PhotoPortfolio artisanId={artisan.id} isMine={isMine} editToken={editToken} />

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
              <p className="m-0 text-[12.5px] leading-relaxed text-muted-foreground">No reviews yet — job-verified reviews show up here once work's completed.</p>
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

    </div>

      {/* Same underlying Button primitive Btn itself wraps (asChild renders
          the real <a> so tel:/sms:/mailto: semantics stay correct), sized
          with Btn's own default/small classes — pixel-identical to the
          rest of the app's gold-CTA + quiet-secondary pattern.

          "Request this artisan" is the primary action once they have a
          real account and are available (see canRequest above) — Call
          becomes the secondary/fallback path instead of the only one.
          Without an account (most existing listings, per the code comment
          above) Call/Text/Email are simply the only way to reach out — no
          note needed, since there was never an in-app request path to
          begin with. Only when the artisan HAS an account but toggled
          themselves off does a short note explain the gap (the header
          badge above already says "Not accepting requests," so this stays
          brief rather than repeating it verbatim).

          Pinned outside the scrolling column above (see the file-level
          comment) — a border + blur reads as a distinct sheet sitting on
          top of the content, the same visual cue as an iOS action sheet
          rather than just "the last thing in the list." */}
      <motion.div
        initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 24, stiffness: 300 }}
        className="shrink-0 border-t border-foreground/10 bg-background/95 px-5 pt-3 shadow-[0_-8px_28px_rgba(0,0,0,0.10)] backdrop-blur-xl supports-backdrop-filter:bg-background/80 dark:shadow-[0_-10px_32px_rgba(0,0,0,0.4)]"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
      <div className="grid gap-2.5">
        {canRequest ? (
          <Button className="h-[54px] w-full gap-2 rounded-xl px-[18px] text-[15px] font-bold" onClick={() => setRequestOpen(true)}>
            <ClipboardList className="size-[18px]" /> Request {artisan.name.split(" ")[0]}
          </Button>
        ) : !isMine && artisan.has_account && (
          <p className="m-0 text-center text-[12px] text-muted-foreground">
            Try calling instead — back in a bit, most likely
          </p>
        )}
        <Button
          asChild
          variant={canRequest ? "outline" : "default"}
          className={canRequest ? "h-11 w-full gap-1.5 rounded-[10px] px-4 text-sm font-bold" : "h-[54px] w-full gap-2 rounded-xl px-[18px] text-[15px] font-bold"}
        >
          <a href={`tel:${artisan.phone}`}>
            <Phone className={canRequest ? "size-4" : "size-[18px]"} /> Call {formatPhone(artisan.phone)}
          </a>
        </Button>
        <div className={artisan.email ? "grid grid-cols-2 gap-2.5" : "grid grid-cols-1 gap-2.5"}>
          <Button asChild variant="outline" className="h-11 w-full gap-1.5 rounded-[10px] px-4 text-sm font-bold">
            <a href={`sms:${artisan.phone}`}>
              <MessageSquare className="size-4" /> Text
            </a>
          </Button>
          {artisan.email && (
            <Button asChild variant="outline" className="h-11 w-full gap-1.5 rounded-[10px] px-4 text-sm font-bold">
              <a href={`mailto:${artisan.email}`}>
                <Mail className="size-4" /> Email
              </a>
            </Button>
          )}
        </div>
      </div>
      </motion.div>

      <RequestJobModal open={requestOpen} onClose={() => setRequestOpen(false)} targetArtisan={artisan} />
    </div>
  );
}
