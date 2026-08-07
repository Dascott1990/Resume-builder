"use client";
/**
 * useInstallPrompt.js — wraps the PWA install flow so a "Download" button
 * can show up only when installing is actually a real, available action,
 * and disappear the instant it isn't (already installed, or mid-session
 * right after the user accepts the native prompt) — never a dead button
 * sitting there once there's nothing left for it to do.
 *
 * Chrome/Edge/Android fire `beforeinstallprompt`, which this captures and
 * replays later via `promptInstall()`. iOS Safari has no such event at
 * all — there is no programmatic install trigger — so `isIOS` is exposed
 * separately for the caller to show manual "Share → Add to Home Screen"
 * instructions instead of a native prompt.
 */
import { useCallback, useEffect, useState } from "react";

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  // Rather than the button just vanishing with zero feedback the instant
  // installed flips true, it briefly shows a disabled "Installed" state —
  // proof the click/install actually landed — then hides itself for good.
  const [showInstalledBadge, setShowInstalledBadge] = useState(false);

  useEffect(() => {
    // Standalone display-mode (Android/desktop) or navigator.standalone
    // (iOS's own, non-standard flag) both mean "already running as the
    // installed app, not a browser tab" — the button has nothing to do.
    const alreadyStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    if (alreadyStandalone) {
      setInstalled(true);
      setShowInstalledBadge(true);
      return;
    }

    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream);

    const onBeforeInstall = (e) => {
      e.preventDefault(); // stop Chrome's own mini-infobar; we drive the prompt ourselves
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setShowInstalledBadge(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!showInstalledBadge) return;
    const timer = setTimeout(() => setShowInstalledBadge(false), 5000);
    return () => clearTimeout(timer);
  }, [showInstalledBadge]);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
      setShowInstalledBadge(true);
    }
    setDeferredPrompt(null); // one-shot — a used/dismissed prompt can't be replayed
  }, [deferredPrompt]);

  // Shown for Chrome/Edge/Android (a real prompt to trigger) and for iOS
  // (no real prompt, but instructions are still worth showing) — hidden
  // everywhere else, including once already installed (past the brief
  // "Installed" confirmation window above).
  const canShow = !installed && (!!deferredPrompt || isIOS);

  return { canShow, isIOS, installed, showInstalledBadge, promptInstall };
}
