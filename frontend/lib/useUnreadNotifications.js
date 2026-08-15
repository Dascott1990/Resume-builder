"use client";
/**
 * useUnreadNotifications.js — the combined badge count for the app-wide
 * notification bell (Dashboard.js's header). Two independent unread
 * sources exist, not one: the customer side (works for a signed-in User
 * OR a plain guest — job requests can be guest_id-scoped, see
 * Artisans.js's own getUnreadCount() call) and the artisan side (only
 * when this browser is signed in as an artisan, X-Artisan-Token). A
 * browser can be both at once, so this sums them rather than picking one.
 *
 * Same 25s poll cadence as Artisans.js/ArtisanDashboard.js's own
 * unread-badge effects — this only needs to feel current, not live.
 */
import { useEffect, useState } from "react";
import { apiRequest } from "@/components/premium/shared/api";
import { getArtisanToken } from "./artisanAuthToken";

export function useUnreadNotifications() {
  const [customerCount, setCustomerCount] = useState(0);
  const [artisanCount, setArtisanCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      apiRequest("/api/v1/messages/unread-count")
        .then((d) => !cancelled && setCustomerCount(d.count))
        .catch(() => {});
      if (getArtisanToken()) {
        apiRequest("/api/v1/messages/unread-count", { headers: { "X-Artisan-Token": getArtisanToken() } })
          .then((d) => !cancelled && setArtisanCount(d.count))
          .catch(() => {});
      } else {
        setArtisanCount(0);
      }
    };
    poll();
    const interval = setInterval(poll, 25000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return { count: customerCount + artisanCount, customerCount, artisanCount };
}
