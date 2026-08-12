"use client";
/**
 * ReviewForm.js — star + comment input, shared by anywhere a rating gets
 * submitted. Currently used by the job-gated "Leave a review" flow in
 * MyRequestsPane.js; ArtisanProfile.js's own free-floating rate-this-
 * artisan widget predates this and isn't refactored onto it — same
 * star/comment UI, kept as its own inline copy there rather than risking a
 * regression in already-working code for a purely cosmetic dedup.
 */
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Btn } from "../guest/components/primitives";
import StarRating from "./StarRating";

export default function ReviewForm({ onSubmit, submitting }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");

  return (
    <div>
      <StarRating value={stars} onChange={setStars} />
      <Textarea
        className="mt-2.5 min-h-[60px] resize-y rounded-[10px] text-sm"
        placeholder="Optional — how did it go?"
        maxLength={280}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="mt-1 text-right text-[10.5px] text-muted-foreground/60">{comment.length}/280</div>
      <Btn
        variant="gold"
        className="mt-2.5"
        disabled={stars === 0 || submitting}
        loading={submitting}
        onClick={() => onSubmit({ stars, comment: comment.trim() || undefined })}
      >
        {submitting ? "Submitting…" : "Submit review"}
      </Btn>
    </div>
  );
}
