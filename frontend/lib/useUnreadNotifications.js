"use client";
/**
 * useUnreadNotifications.js — real data for the app-wide notification bell
 * (Dashboard.js's header). Two independent unread sources exist, not one:
 * the customer side (works for a signed-in User OR a plain guest — job
 * requests can be guest_id-scoped) and the artisan side (only when this
 * browser is signed in as an artisan, X-Artisan-Token). A browser can be
 * both at once, so this merges both lists rather than picking one.
 *
 * Returns actual per-thread items (backend: GET /messages/unread), not
 * just a count — a bare count can only ever drive one hardcoded click
 * destination; each item here already knows its own viewer_role, so a
 * click can open the SPECIFIC screen that item is about instead of
 * guessing from whichever side has the bigger number.
 *
 * Same 25s poll cadence as Artisans.js/ArtisanDashboard.js's own
 * unread-badge effects — this only needs to feel current, not live.
 */
import { useEffect, useState } from "react";
import { apiRequest } from "@/components/premium/shared/api";
import { getArtisanToken } from "./artisanAuthToken";

export function useUnreadNotifications() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const [customerItems, artisanItems] = await Promise.all([
        apiRequest("/api/v1/messages/unread").catch(() => []),
        getArtisanToken()
          ? apiRequest("/api/v1/messages/unread", { headers: { "X-Artisan-Token": getArtisanToken() } }).catch(() => [])
          : Promise.resolve([]),
      ]);
      if (!cancelled) setItems([...(customerItems || []), ...(artisanItems || [])]);
    };
    poll();
    const interval = setInterval(poll, 25000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const count = items.reduce((sum, it) => sum + it.unread_count, 0);
  return { items, count };
}
