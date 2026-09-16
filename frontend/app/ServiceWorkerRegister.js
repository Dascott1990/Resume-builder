"use client";
import { useEffect } from "react";

// Registers after the page has finished loading, not on mount — so it
// never competes with the initial page's own network requests (AI calls,
// saved-resume fetches) for bandwidth/priority during first paint.
//
// Production only. `next dev` restarts/recompiles constantly, and each
// restart is a real window where a navigation fetch genuinely fails —
// exactly the case sw.js's fetch handler exists to catch, so a dev server
// bouncing while the SW is active gets "helpfully" papered over with the
// cached offline.html instead of the developer just seeing the dev
// server come back. That's not a hypothetical: it's exactly how a stale
// offline.html (with copy from before a since-fixed rename) kept getting
// served during this app's own local development, looking indistinguishable
// from the app actually being broken. In dev, this actively unregisters
// any service worker + clears the offline cache instead, so a machine
// that picked one up before this fix shipped gets cleaned up automatically
// on its next load rather than staying stuck.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
      if ("caches" in window) {
        caches.keys().then((keys) => {
          keys.filter((k) => k.startsWith("noqeev-offline")).forEach((k) => caches.delete(k));
        });
      }
      return;
    }

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
