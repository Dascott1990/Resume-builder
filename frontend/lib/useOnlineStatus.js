"use client";
import { useState, useEffect } from "react";

// ── Connectivity hook — tracks the browser's own online/offline signal ────
// navigator.onLine is a network-interface check, not a "can I reach Noviq's
// servers" check (a captive portal or dead backend still reads "online"),
// but it's exactly right for the one thing this hook exists to catch: the
// device itself has no connection at all, so there's no point even trying
// a request. Real request failures are handled separately by shared/api.js.
export function useOnlineStatus() {
  const [online, setOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    // The 'online'/'offline' events aren't fully reliable on their own —
    // confirmed during offline-caching testing that a page reload served
    // by the service worker's cache can come back up without the browser
    // ever dispatching 'online', leaving the banner stuck. Re-checking
    // navigator.onLine (a plain property read, not a request) whenever the
    // tab regains focus/visibility, plus a light periodic poll, catches
    // anything the event itself missed without depending on it alone.
    const recheck = () => setOnline(navigator.onLine);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    const poll = setInterval(recheck, 15000);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
      clearInterval(poll);
    };
  }, []);

  return online;
}
