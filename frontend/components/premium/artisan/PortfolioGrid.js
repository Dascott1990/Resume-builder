"use client";
/**
 * PortfolioGrid.js — the work portfolio as it belongs on a management
 * screen: a compact, uniform grid of thumbnails you can scan and tap to
 * manage, not a full-bleed hero. PhotoPortfolio.js's big single-photo
 * hero is right for ArtisanProfile.js (the public page's whole job is
 * showing off one photo at a time); dropped into ArtisanListingManager.js
 * underneath a normal-sized form it read as an oversized, out-of-place
 * block — the opposite of the restrained, consistent weight the rest of
 * that screen already has. Same data underneath either way
 * (usePortfolioPhotos.js), just shaped for "manage many" instead of
 * "showcase one."
 */
import { useRef, useState } from "react";
import { Plus, Loader2, Images, X, Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { usePortfolioPhotos, rawUrl } from "./usePortfolioPhotos";

export default function PortfolioGrid({ artisanId, editToken }) {
  const { photos, uploading, upload, remove } = usePortfolioPhotos(artisanId, editToken);
  const [viewing, setViewing] = useState(null); // a photo object, or null
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef(null);

  const deleteViewing = async () => {
    if (!viewing) return;
    setDeleting(true);
    try {
      await remove(viewing.id);
      setViewing(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <p className="m-0 mb-2 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60">
        <Images className="size-3" /> PORTFOLIO PHOTOS
      </p>

      {photos !== null && photos.length === 0 && (
        <p className="m-0 mb-2.5 text-[12.5px] text-muted-foreground">
          Add a few photos of your work — listings with photos get more requests.
        </p>
      )}

      <div className="grid grid-cols-4 gap-2">
        {photos === null ? (
          <>
            <div className="aspect-square animate-pulse rounded-lg bg-muted" />
            <div className="aspect-square animate-pulse rounded-lg bg-muted" />
            <div className="aspect-square animate-pulse rounded-lg bg-muted" />
          </>
        ) : (
          photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setViewing(p)}
              className="aspect-square overflow-hidden rounded-lg border border-border p-0"
            >
              <img src={rawUrl(artisanId, p.id)} alt={p.caption || `Photo ${i + 1} of ${photos.length}`} className="size-full object-cover" />
            </button>
          ))
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-transparent text-muted-foreground disabled:opacity-50"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          <span className="text-[10px] font-semibold">Add</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }}
      />

      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent showCloseButton className="w-full max-w-[420px] gap-0 overflow-hidden p-0 sm:max-w-[420px]">
          {viewing && (
            <div>
              <img src={rawUrl(artisanId, viewing.id)} alt={viewing.caption || "Portfolio photo"} className="max-h-[60vh] w-full object-contain" />
              <div className="flex items-center justify-between gap-2 p-3.5">
                <p className="m-0 text-[13px] text-muted-foreground">{viewing.caption || "No caption"}</p>
                <button
                  type="button"
                  onClick={deleteViewing}
                  disabled={deleting}
                  className="flex shrink-0 items-center gap-1 border-none bg-transparent p-0 text-[12.5px] font-bold text-destructive disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  Delete
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
