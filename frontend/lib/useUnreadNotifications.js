"use client";
/**
 * useUnreadNotifications.js — real data for the app-wide notification bell
 * (Dashboard.js's header). Three independent unread sources exist, not
 * one: the customer side (works for a signed-in User OR a plain guest —
 * job requests can be guest_id-scoped), the artisan side (only when this
 * browser is signed in as an artisan, X-Artisan-Token), and Apply with
 * AI's own finished-while-you-weren't-watching runs (GET
 * /apply/runs/unseen-terminal — submitted/failed/cancelled/expired, not
 * yet shown). A browser can have any combination of these at once, so
 * this merges all three rather than picking one.
 *
 * Returns actual per-item data, not just a count — a bare count can only
 * ever drive one hardcoded click destination; each item here already
 * knows what kind it is (`kind: "message" | "apply_run"`) and enough
 * about itself to open the SPECIFIC screen it's about, not a guess based
 * on whichever source has the bigger number.
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
      const [customerItems, artisanItems, applyRuns] = await Promise.all([
        apiRequest("/api/v1/messages/unread").catch(() => []),
        getArtisanToken()
          ? apiRequest("/api/v1/messages/unread", { headers: { "X-Artisan-Token": getArtisanToken() } }).catch(() => [])
          : Promise.resolve([]),
        apiRequest("/api/v1/apply/runs/unseen-terminal").catch(() => []),
      ]);
      if (!cancelled) {
        setItems([
          ...(customerItems || []).map((it) => ({ ...it, kind: "message" })),
          ...(artisanItems || []).map((it) => ({ ...it, kind: "message" })),
          // One notification per finished run — unread_count is always 1
          // here (a run either finished or it didn't), matching how a
          // message thread's own unread_count contributes to the same
          // total badge on the bell.
          ...(applyRuns || []).map((run) => ({ kind: "apply_run", unread_count: 1, run })),
        ]);
      }
    };
    poll();
    const interval = setInterval(poll, 25000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const count = items.reduce((sum, it) => sum + it.unread_count, 0);
  return { items, count };
}
