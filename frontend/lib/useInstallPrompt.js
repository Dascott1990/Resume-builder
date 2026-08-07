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
 *
 * "Installed" is persisted to localStorage, not just held in React state.
 * The tab that triggered the install is never itself running in standalone
 * mode (only the freshly launched app window is), so on the very next
 * reload of THIS tab neither the standalone check nor a live
 * beforeinstallprompt/appinstalled event has anything to go on — some
 * browsers also just refire beforeinstallprompt on a later visit even
 * though the app is already installed (manifest/scope quirks, browser
 * bugs). Without the localStorage flag, both of those silently bring the
 * Download button back and let someone re-trigger the install prompt on an
 * app they already installed.
 */
import { useCallback, useEffect, useState } from "react";

const INSTALLED_KEY = "noviq_pwa_installed";

function readInstalledFlag() {
  try {
    return localStorage.getItem(INSTALLED_KEY) === "1";
  } catch {
    return false;
  }
}
function writeInstalledFlag() {
  try {
    localStorage.setItem(INSTALLED_KEY, "1");
  } catch {}
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  // Rather than the button just vanishing with zero feedback the instant
  // installed flips true, it briefly shows a disabled "Installed" state —
  // proof the click/install actually landed — then hides itself for good.
  const [showInstalledBadge, setShowInstalledBadge] = useState(false);
  // Guards against a second click firing a second install prompt while the
  // first one is still awaiting the user's choice.
  const [isPrompting, setIsPrompting] = useState(false);

  const markInstalled = useCallback((withBadge) => {
    setInstalled(true);
    setDeferredPrompt(null);
    if (withBadge) setShowInstalledBadge(true);
    writeInstalledFlag();
  }, []);

  useEffect(() => {
    // Standalone display-mode (Android/desktop) or navigator.standalone
    // (iOS's own, non-standard flag) both mean "already running as the
    // installed app, not a browser tab" — the button has nothing to do.
    const alreadyStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    if (alreadyStandalone || readInstalledFlag()) {
      setInstalled(true);
      writeInstalledFlag();
      return; // no badge here — this isn't the moment install happened, just a later, ordinary visit
    }

    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream);

    const onBeforeInstall = (e) => {
      e.preventDefault(); // stop Chrome's own mini-infobar; we drive the prompt ourselves
      setDeferredPrompt(e);
    };
    const onInstalled = () => markInstalled(true);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [markInstalled]);

  useEffect(() => {
    if (!showInstalledBadge) return;
    const timer = setTimeout(() => setShowInstalledBadge(false), 5000);
    return () => clearTimeout(timer);
  }, [showInstalledBadge]);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt || isPrompting) return; // nothing to prompt, or a prompt is already in flight
    setIsPrompting(true);
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        markInstalled(true);
      } else {
        setDeferredPrompt(null); // one-shot — a dismissed prompt can't be replayed; a later beforeinstallprompt (if the browser ever refires it) offers another chance
      }
    } finally {
      setIsPrompting(false);
    }
  }, [deferredPrompt, isPrompting, markInstalled]);

  // Shown for Chrome/Edge/Android (a real prompt to trigger) and for iOS
  // (no real prompt, but instructions are still worth showing) — hidden
  // everywhere else, including once already installed (past the brief
  // "Installed" confirmation window above).
  const canShow = !installed && (!!deferredPrompt || isIOS);

  return { canShow, isIOS, installed, showInstalledBadge, isPrompting, promptInstall };
}
