"use client";
/**
 * PhotoPortfolio.js — an artisan's public photo strip of past work, shown
 * on ArtisanProfile.js. Thumbnails point straight at the backend's raw-byte
 * route (GET /api/v1/artisans/<id>/photos/<photo>/raw) via a plain <img>,
 * never base64-inlined in the list response — see backend/app/api/
 * artisans.py's get_photo_raw.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, X, Loader2, Images } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { apiRequest } from "../shared/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

function rawUrl(artisanId, photoId) {
  return `${API_BASE}/api/v1/artisans/${artisanId}/photos/${photoId}/raw`;
}

export default function PhotoPortfolio({ artisanId, isMine, editToken }) {
  const [photos, setPhotos] = useState(null); // null = loading
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState(null); // a photo object, or null
  const fileInputRef = useRef(null);

  const load = () => {
    apiRequest(`/api/v1/artisans/${artisanId}/photos`)
      .then(setPhotos)
      .catch(() => setPhotos([]));
  };
  useEffect(load, [artisanId]);

  const upload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be 5MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await apiRequest(`/api/v1/artisans/${artisanId}/photos`, {
        method: "POST",
        headers: { "X-Edit-Token": editToken || "" },
        body: formData,
      });
      toast.success("Photo added");
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const remove = async (photoId) => {
    try {
      await apiRequest(`/api/v1/artisans/${artisanId}/photos/${photoId}`, {
        method: "DELETE",
        headers: { "X-Edit-Token": editToken || "" },
      });
      setViewing(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (photos === null) return null; // no loading skeleton — this is a secondary section, not core content
  if (photos.length === 0 && !isMine) return null;

  return (
    <div>
      <p className="m-0 mb-2 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60">
        <Images className="size-3" /> PHOTOS OF PAST WORK
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {photos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setViewing(p)}
            className="size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-card p-0"
          >
            <img src={rawUrl(artisanId, p.id)} alt={p.caption || ""} className="size-full object-cover" />
          </button>
        ))}
        {isMine && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex size-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-transparent text-muted-foreground"
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            <span className="text-[10px] font-semibold">Add</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }}
        />
      </div>

      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent showCloseButton className="w-full max-w-[520px] gap-0 overflow-hidden p-0 sm:max-w-[520px]">
          {viewing && (
            <div>
              <img src={rawUrl(artisanId, viewing.id)} alt={viewing.caption || ""} className="max-h-[70vh] w-full object-contain" />
              <div className="flex items-center justify-between gap-2 p-3.5">
                <p className="m-0 text-[13px] text-muted-foreground">{viewing.caption || "No caption"}</p>
                {isMine && (
                  <button
                    type="button"
                    onClick={() => remove(viewing.id)}
                    className="flex shrink-0 items-center gap-1 border-none bg-transparent p-0 text-[12.5px] font-bold text-destructive"
                  >
                    <X className="size-3.5" /> Delete
                  </button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
