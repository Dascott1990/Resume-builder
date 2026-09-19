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

    // A browser that registered an OLDER sw.js before some past fix (see
    // this file's own history — a stale offline.html served instead of
    // the real page was exactly this class of bug once already) doesn't
    // self-replace it just because the file on the server changed. The
    // browser only CHECKS for a new version on navigation, and even once
    // it finds one, the new worker stays in the background — the OLD one
    // keeps controlling the CURRENT page load regardless. That's a
    // plausible root cause for "loads broken, only a hard refresh (which
    // bypasses the active worker for that one load) fixes it": whatever
    // the old worker does differently is still running.
    //
    // hadControllerBefore gates this to a genuine UPDATE (an already-
    // active worker got replaced by a newer one), not first-ever
    // activation — sw.js's own clients.claim() means a first-time visitor
    // also fires "controllerchange" once, and reloading THEM mid-visit
    // for no reason would be the exact kind of silent surprise this
    // codebase's own registration timing (after window.load, so it never
    // competes with the page's first real work) was written to avoid.
    const hadControllerBefore = !!navigator.serviceWorker.controller;
    let reloadedForUpdate = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadedForUpdate || !hadControllerBefore) return;
      reloadedForUpdate = true;
      window.location.reload();
    });

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
