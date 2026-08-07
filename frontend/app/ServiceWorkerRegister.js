"use client";
import { useEffect } from "react";

// Registers after the page has finished loading, not on mount — so it
// never competes with the initial page's own network requests (AI calls,
// saved-resume fetches) for bandwidth/priority during first paint.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
