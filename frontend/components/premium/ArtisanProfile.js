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
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, MapPin, Phone, MessageSquare, Mail, RefreshCw } from "lucide-react";
import { apiRequest } from "./shared/api";
import { tintFor, initialsOf, formatPhone } from "./shared/artisanDisplay";
import { Btn } from "./guest/components/primitives";
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

export default function ArtisanProfile({
  artisan, isMine, onBack, onEdit, onDelete, myRating, onRated, onRatingUpdate,
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
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
    <div
      className="flex h-full flex-col gap-4 overflow-y-auto bg-background px-5 pb-5 text-foreground"
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

      <div className="flex items-center gap-3">
        <div className={`flex size-16 shrink-0 items-center justify-center rounded-full border font-mono text-xl font-bold ${tint}`}>
          {initialsOf(artisan.name)}
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
          </div>
          {artisan.city && (
            <div className="mt-1 flex items-center gap-1">
              <MapPin className="size-3 text-muted-foreground" />
              <span className="text-[12.5px] text-muted-foreground">{artisan.city}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 border-y border-border py-3.5">
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
      </div>

      {artisan.bio && (
        <p className="text-[13.5px] leading-relaxed text-foreground">{artisan.bio}</p>
      )}

      {!isMine && (
        <div className="rounded-xl border border-border p-3.5">
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
          <p className="m-0 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60">RECENT REVIEWS</p>
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

      {!reviewsLoading && !reviewsError && reviews.length > 0 && (
        <div className="grid gap-2.5">
          <p className="m-0 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60">RECENT REVIEWS</p>
          {reviews.map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-2.5">
              <div className="flex items-center justify-between gap-2">
                <StarRating readOnly value={r.stars} size="size-3.5" />
                <span className="text-[11px] text-muted-foreground/70">{timeAgo(r.created_at)}</span>
              </div>
              {r.comment && (
                <p className="m-0 mt-1.5 text-[12.5px] leading-relaxed text-foreground">{r.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Same underlying Button primitive Btn itself wraps (asChild renders
          the real <a> so tel:/sms:/mailto: semantics stay correct), sized
          with Btn's own default/small classes — pixel-identical to the
          rest of the app's gold-CTA + quiet-secondary pattern. */}
      <div className="mt-auto grid gap-2.5 pt-2">
        <Button asChild className="h-[54px] w-full gap-2 rounded-xl px-[18px] text-[15px] font-bold">
          <a href={`tel:${artisan.phone}`}>
            <Phone className="size-[18px]" /> Call {formatPhone(artisan.phone)}
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
    </div>
  );
}
