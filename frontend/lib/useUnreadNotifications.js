"use client";
/**
 * useUnreadNotifications.js — real data for the app-wide notification bell
 * (Dashboard.js's header): Apply with AI's own finished-while-you-weren't-
 * watching runs (GET /apply/runs/unseen-terminal — submitted/failed/
 * cancelled/expired, not yet shown).
 *
 * Returns actual per-item data, not just a count — a bare count can only
 * ever drive one hardcoded click destination; each item here already
 * knows what kind it is (`kind: "apply_run"`) and enough about itself to
 * open the specific screen it's about.
 */
import { useEffect, useState } from "react";
import { apiRequest } from "@/components/premium/shared/api";

export function useUnreadNotifications() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const applyRuns = await apiRequest("/api/v1/apply/runs/unseen-terminal").catch(() => []);
      if (!cancelled) {
        setItems(
          // One notification per finished run — unread_count is always 1
          // here (a run either finished or it didn't).
          (applyRuns || []).map((run) => ({ kind: "apply_run", unread_count: 1, run }))
        );
      }
    };
    poll();
    const interval = setInterval(poll, 25000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const count = items.reduce((sum, it) => sum + it.unread_count, 0);
  return { items, count };
}
