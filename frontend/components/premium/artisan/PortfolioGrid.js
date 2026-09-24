"use client";
/**
 * PortfolioGrid.js — the work portfolio, arrangeable: a compact grid of
 * thumbnails in display order, tap to view/delete, small ‹ › controls to
 * reorder. sort_order already existed on the backend (PATCH /photos/<id>)
 * with nothing in the UI ever calling it — this is that, finally wired
 * up. The first photo (sort_order 0) is what PhotoPortfolio.js's public
 * hero shows by default, so it's labeled "Cover" here — a real fact
 * about the existing data, not a separate field invented for this.
 *
 * Takes photos/upload/remove/move as props rather than calling
 * usePortfolioPhotos itself — ArtisanListingManager.js owns that one
 * fetch so it can factor photo count into the profile-completion
 * checklist without a second, redundant hook instance.
 */
import { useRef, useState } from "react";
import { Plus, Loader2, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { rawUrl } from "./usePortfolioPhotos";

export default function PortfolioGrid({ artisanId, photos, uploading, upload, remove, move }) {
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
      <p className="m-0 mb-2 text-[13px] font-semibold text-foreground">Photos</p>

      {photos !== null && photos.length === 0 && (
        <p className="m-0 mb-2.5 text-[13px] text-muted-foreground">Add a few photos of your work.</p>
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
            <div key={p.id} className="relative">
              <button
                type="button"
                onClick={() => setViewing(p)}
                className="aspect-square w-full overflow-hidden rounded-lg border border-border p-0"
              >
                <img src={rawUrl(artisanId, p.id)} alt={p.caption || `Photo ${i + 1} of ${photos.length}`} className="size-full object-cover" />
              </button>
              {i === 0 && (
                <span className="pointer-events-none absolute top-1 left-1 rounded bg-black/55 px-1 py-0.5 text-[8.5px] font-semibold text-white">
                  Cover
                </span>
              )}
              {photos.length > 1 && (
                <div className="absolute inset-x-0 -bottom-1 flex justify-center gap-0.5">
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => move(p.id, -1)}
                      aria-label="Move earlier"
                      className="flex size-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground"
                    >
                      <ChevronLeft className="size-3" />
                    </button>
                  )}
                  {i < photos.length - 1 && (
                    <button
                      type="button"
                      onClick={() => move(p.id, 1)}
                      aria-label="Move later"
                      className="flex size-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground"
                    >
                      <ChevronRight className="size-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted-foreground disabled:opacity-50"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
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
              <div className="flex items-center justify-end p-3">
                <button
                  type="button"
                  onClick={deleteViewing}
                  disabled={deleting}
                  className="flex items-center gap-1 border-none bg-transparent p-0 text-[13px] font-medium text-destructive disabled:opacity-50"
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
