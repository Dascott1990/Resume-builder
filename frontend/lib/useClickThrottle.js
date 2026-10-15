"use client";
/**
 * useClickThrottle.js — a time-based cooldown for buttons whose action
 * resolves too fast for a plain "disable while pending" guard to help
 * (copy-to-clipboard, anything synchronous or near-instant). Confirmed
 * live: JobTracker.js's "Copy link" button fired a fresh success toast on
 * every single click with zero guard — 20 rapid clicks meant 20 stacked
 * toasts, since each one resolves before the next click even lands, so
 * an in-flight/`loading` state never gets the chance to block anything.
 *
 * Returns a single `canFire()` check — call it first thing inside the
 * handler and bail if it returns false. Not a hook that wraps the
 * handler itself (no `useCallback`-style API) on purpose: the call sites
 * this exists for are a mix of sync and async functions, loop bodies,
 * and bodies that need to run some logic (e.g. closing a menu) even on a
 * throttled click — a single boolean gate composes into all of those
 * without forcing a particular handler shape.
 */
import { useRef } from "react";

export function useClickThrottle(ms = 1200) {
  const lastRef = useRef(0);
  return () => {
    const now = Date.now();
    if (now - lastRef.current < ms) return false;
    lastRef.current = now;
    return true;
  };
}
