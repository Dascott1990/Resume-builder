"use client";
import { useState, useEffect } from "react";

// ── Connectivity hook — tracks the browser's own online/offline signal ────
// navigator.onLine is a network-interface check, not a "can I reach Noviq's
// servers" check (a captive portal or dead backend still reads "online"),
// but it's exactly right for the one thing this hook exists to catch: the
// device itself has no connection at all, so there's no point even trying
// a request. Real request failures are handled separately by shared/api.js.
export function useOnlineStatus() {
  // Defaults true — genuinely unknown until the client mounts, and true is
  // the fail-safe default (never show "you're offline" on a guess). The
  // real read happens below, once navigator.onLine actually exists.
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // Re-sync to the REAL value the instant this runs on the client — the
    // initial useState above can't be trusted: during SSR there's no real
    // browser to ask, and recent Node versions expose a minimal global
    // `navigator` (for user-agent compatibility) that has no `.onLine` at
    // all, so `navigator.onLine` reads as `undefined` there — falsy, which
    // rendered as "You're offline" on first paint regardless of whether the
    // visitor's connection was ever actually down. Without this line the
    // banner would only ever be corrected by a FUTURE online/offline event
    // firing, never by checking the truth of the current one.
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
