"use client";
import { useEffect } from "react";

const PING_INTERVAL_MS = 5 * 60 * 1000; // Render's free tier spins down after 15 min idle — 5 min stays comfortably under that with far less traffic than pinging every few seconds.

// Silent background ping, not a page reload — nothing visible changes, no
// lost scroll position or in-progress form input. Just enough traffic to
// keep the Render backend from spinning down while the tab is open.
export function KeepAlive() {
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL;
    if (!base) return;

    const ping = () => {
      if (document.visibilityState !== "visible") return; // no point waking the backend for a backgrounded tab
      fetch(`${base}/api/v1/health`, { cache: "no-store" }).catch(() => {});
    };

    const id = setInterval(ping, PING_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return null;
}
