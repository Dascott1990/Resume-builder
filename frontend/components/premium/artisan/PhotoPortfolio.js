"use client";
/**
 * PhotoPortfolio.js — an artisan's public photo portfolio, shown as
 * ArtisanProfile.js's hero: one large photo up top with a thumbnail strip
 * below it to switch which one's showing, not a small standalone strip
 * anymore. Thumbnails/hero both point straight at the backend's raw-byte
 * route (GET /api/v1/artisans/<id>/photos/<photo>/raw) via a plain <img>,
 * never base64-inlined in the list response — see backend/app/api/
 * artisans.py's get_photo_raw. Upload/delete logic is untouched from the
 * original strip version, just re-laid-out.
 *
 * Takes the full `artisan` object (not just an id) so a listing with zero
 * uploaded photos still has a real hero to show — falls back to the same
 * avatar precedence (photo → emoji → initials) every other screen in this
 * app already uses, instead of leaving a blank gap at the top of the
 * profile.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { tintFor, initialsOf, avatarPhotoUrl } from "../shared/artisanDisplay";
import Emoji3D from "../shared/Emoji3D";
import { apiRequest } from "../shared/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

function rawUrl(artisanId, photoId) {
  return `${API_BASE}/api/v1/artisans/${artisanId}/photos/${photoId}/raw`;
}

export default function PhotoPortfolio({ artisan, isMine, editToken }) {
  const artisanId = artisan.id;
  const [photos, setPhotos] = useState(null); // null = loading
  const [activeIndex, setActiveIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef(null);

  const load = () => {
    apiRequest(`/api/v1/artisans/${artisanId}/photos`)
      .then((data) => { setPhotos(data); setActiveIndex(0); })
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

  const removeActive = async () => {
    const photo = photos?.[activeIndex];
    if (!photo) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/v1/artisans/${artisanId}/photos/${photo.id}`, {
        method: "DELETE",
        headers: { "X-Edit-Token": editToken || "" },
      });
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
    }
  };

  if (photos === null) {
    return <div className="aspect-[4/5] w-full animate-pulse rounded-2xl bg-muted sm:aspect-[16/10]" />;
  }

  const hasPhotos = photos.length > 0;
  const active = hasPhotos ? photos[Math.min(activeIndex, photos.length - 1)] : null;
  const tint = tintFor(artisan.name || "?");

  return (
    <div>
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-foreground/10 shadow-[0_8px_28px_rgba(0,0,0,0.14)] sm:aspect-[16/10] dark:shadow-[0_10px_36px_rgba(0,0,0,0.45)]">
        {active ? (
          <img src={rawUrl(artisanId, active.id)} alt={active.caption || `${artisan.name}'s work`} className="size-full object-cover" />
        ) : artisan.has_avatar_photo ? (
          <img src={avatarPhotoUrl(artisan.id, artisan.avatar_photo_version)} alt="" className="size-full object-cover" />
        ) : (
          <div className={`flex size-full items-center justify-center ${tint}`}>
            {artisan.avatar_emoji ? (
              <Emoji3D emoji={artisan.avatar_emoji} size={96} />
            ) : (
              <span className="font-mono text-6xl font-bold">{initialsOf(artisan.name)}</span>
            )}
          </div>
        )}

        {isMine && active && (
          <button
            type="button"
            onClick={removeActive}
            disabled={deleting}
            aria-label="Delete this photo"
            className="absolute right-3 bottom-3 flex size-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
          >
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </button>
        )}
      </div>

      {(photos.length > 1 || isMine) && (
        <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={`size-16 shrink-0 overflow-hidden rounded-lg border p-0 transition-opacity ${
                i === activeIndex ? "border-primary opacity-100" : "border-border opacity-70 hover:opacity-100"
              }`}
            >
              <img src={rawUrl(artisanId, p.id)} alt={p.caption || `Photo ${i + 1} of ${photos.length}`} className="size-full object-cover" />
            </button>
          ))}
          {isMine && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex size-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-border bg-transparent text-muted-foreground"
            >
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              <span className="text-[9.5px] font-semibold">Add</span>
            </button>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }}
      />
    </div>
  );
}
