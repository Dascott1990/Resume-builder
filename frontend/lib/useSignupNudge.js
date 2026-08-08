"use client";
/**
 * useSignupNudge.js — a soft, one-time nudge toward creating an account,
 * never a hard wall. After a couple of real resume actions (generate/
 * optimize/scan), an anonymous visitor sees one dismissible prompt to sign
 * up; dismissing it (or signing up) means it never shows again, and
 * anonymous use keeps working exactly as before either way. Signed-in
 * visitors never see it at all — there's nothing to nudge them toward.
 */
import { useCallback, useState } from "react";
import { getToken } from "./authToken";

const COUNT_KEY = "noviq_resume_action_count";
const SEEN_KEY = "noviq_signup_nudge_seen";
const THRESHOLD = 2;

export function useSignupNudge() {
  const [show, setShow] = useState(false);

  const recordAction = useCallback(() => {
    if (getToken()) return; // already signed in — nothing to nudge toward
    try {
      if (localStorage.getItem(SEEN_KEY) === "1") return; // already shown once, never nag again
      const count = parseInt(localStorage.getItem(COUNT_KEY) || "0", 10) + 1;
      localStorage.setItem(COUNT_KEY, String(count));
      if (count >= THRESHOLD) setShow(true);
    } catch {}
  }, []);

  const dismiss = useCallback(() => {
    setShow(false);
    try { localStorage.setItem(SEEN_KEY, "1"); } catch {}
  }, []);

  return { show, recordAction, dismiss };
}
