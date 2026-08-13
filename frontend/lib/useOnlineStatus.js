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
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
