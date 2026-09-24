"use client";
/**
 * usePortfolioPhotos.js — the data layer behind an artisan's portfolio
 * photos (fetch/upload/delete against GET|POST /artisans/<id>/photos and
 * DELETE .../photos/<id>), shared by every screen that touches them so
 * none of them re-implement the network calls: PhotoPortfolio.js (the
 * public profile's hero) and PortfolioGrid.js (the management screen's
 * compact grid) render this same data two different ways for two
 * genuinely different jobs — showing off the work vs. managing it — but
 * neither should own its own copy of how uploading/deleting actually work.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiRequest } from "../shared/api";
import { getArtisanToken } from "@/lib/artisanAuthToken";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export function rawUrl(artisanId, photoId) {
  return `${API_BASE}/api/v1/artisans/${artisanId}/photos/${photoId}/raw`;
}

// A real signed-up artisan has no edit_token to hand this at all (see
// backend/app/api/artisans.py's _authorize_edit — deliberately never
// exposed in Artisan.to_dict()); their own session authorizes them
// instead. Sending both unconditionally means every caller works
// unmodified whichever door actually applies.
function editHeaders(editToken) {
  return { "X-Edit-Token": editToken || "", "X-Artisan-Token": getArtisanToken() || "" };
}

export function usePortfolioPhotos(artisanId, editToken) {
  const [photos, setPhotos] = useState(null); // null = loading
  const [uploading, setUploading] = useState(false);

  const load = () => {
    if (!artisanId) return;
    apiRequest(`/api/v1/artisans/${artisanId}/photos`)
      .then(setPhotos)
      .catch(() => setPhotos([]));
  };
  // ArtisanListingManager.js calls this before its own artisanMe() fetch
  // resolves (artisanId is undefined for that first render) — skip the
  // request rather than hitting .../artisans/undefined/photos.
  useEffect(load, [artisanId]);

  const upload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Only image files are allowed."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Photo must be 5MB or smaller."); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await apiRequest(`/api/v1/artisans/${artisanId}/photos`, {
        method: "POST",
        headers: editHeaders(editToken),
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
        headers: editHeaders(editToken),
      });
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  // Swaps a photo with its neighbor — sort_order already exists on
  // ArtisanPhoto and PATCH /photos/<id> already accepts it (see
  // backend/app/api/artisans.py's update_photo); nothing in the UI ever
  // called it until now. Optimistic (reorders `photos` locally first) so
  // arranging feels instant instead of waiting on two round trips.
  const move = async (photoId, direction) => {
    if (!photos) return;
    const i = photos.findIndex((p) => p.id === photoId);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= photos.length) return;
    const reordered = [...photos];
    [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
    setPhotos(reordered);
    try {
      await Promise.all([
        apiRequest(`/api/v1/artisans/${artisanId}/photos/${reordered[i].id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...editHeaders(editToken) },
          body: JSON.stringify({ sort_order: i }),
        }),
        apiRequest(`/api/v1/artisans/${artisanId}/photos/${reordered[j].id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...editHeaders(editToken) },
          body: JSON.stringify({ sort_order: j }),
        }),
      ]);
    } catch (e) {
      toast.error(e.message);
      load(); // reconcile with the server's real order on failure
    }
  };

  return { photos, uploading, upload, remove, move };
}
