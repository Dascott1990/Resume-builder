"use client";
/**
 * useAuth.js — session layer on top of the anonymous guest_id system.
 * guest_id itself still exists (every backend model is scoped by it, and
 * it's what signup/login migrate a browser's anonymous data INTO an
 * account from), but app/page.js now gates every real screen behind an
 * actual account — see resolveLandingView() there. Saved resumes / job
 * tracker / CV scans following you across devices is the reason this
 * exists at all.
 */
import { useCallback, useEffect, useState } from "react";
import { apiRequest, onUnauthorized } from "@/components/premium/shared/api";
import { getToken, setToken } from "./authToken";
import { rotateGuestId } from "./guestId";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await apiRequest("/api/v1/auth/me");
      setUser(data);
    } catch (err) {
      // Only a genuine 401 means THIS token is actually invalid/expired —
      // every other failure (a transient 503 from the DB being briefly
      // unreachable, confirmed live during a real Neon quota hiccup; a
      // network blip; anything else) says nothing about whether the
      // token itself is still good. Clearing it on any of those used to
      // silently sign a real, still-valid session out — on a device
      // whose only copy of that session is this token, logged out by an
      // outage that had nothing to do with them, with no way back in
      // except typing their password again once the outage passes.
      // 401 still goes through the normal onUnauthorized path below.
      if (err.status === 401) {
        setToken(null);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  // Any request anywhere in the app coming back 401 means THIS session's
  // token is no longer valid — clear it and drop `user` back to null so
  // every screen gated on "am I signed in" (see app/page.js's own
  // auth-gated view resolution) reacts the same way it would to a real
  // sign-out, instead of silently rendering stale "signed in" UI while
  // every request underneath it keeps failing.
  useEffect(() => onUnauthorized(() => {
    setToken(null);
    setUser(null);
  }), []);

  // Does NOT sign the user in — the account exists but is unverified until
  // they click the link that just landed in their inbox. Returns the
  // backend's "check your email" message for the UI to show.
  //
  // Still rotates the local guest id, same as login/logout below: the
  // backend migrates this browser's anonymous data into the new account
  // as part of THIS call (see api/auth.py's signup()), even though no
  // session exists yet — so by the time this returns, that data is gone
  // from the old guest_id's scope. Leaving the browser still pointed at
  // that now-empty id would be harmless on its own, but rotating here
  // keeps the rule simple and exception-free: any call that can cause a
  // migration also leaves this browser with a fresh, unclaimed id
  // afterward, the same guarantee logout already gives the next person.
  const signup = async (email, password) => {
    const data = await apiRequest("/api/v1/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    rotateGuestId();
    return data;
  };

  const login = async (email, password) => {
    const data = await apiRequest("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    setUser(data.user);
    // The backend just migrated whatever this browser's OLD guest id owned
    // into the account above (see api/auth.py's login()) — on a personal
    // device that's exactly the point (your anonymous work follows you
    // in). On a shared/family/library computer, it's also the moment a
    // stranger's earlier anonymous session (never explicitly signed in,
    // so it never hit the logout-time rotation below) can get silently
    // swept into whoever logs in next. Rotating here can't undo a
    // migration that already happened, but it stops the SAME stale id
    // from being available to claim again — closing the gap for
    // whoever uses this browser after this session, not just after an
    // explicit sign-out.
    rotateGuestId();
    return data.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    // A fresh guest identity the instant someone signs out — otherwise the
    // next person on this browser (a shared/family device) keeps sending
    // the outgoing account's old guest id and can end up seeing whatever
    // of theirs is still reachable by it. See lib/guestId.js.
    rotateGuestId();
  };

  // Verifying signs the user in directly (the click itself proves inbox
  // control — no reason to make them type a password again right after).
  const verifyEmail = async (token) => {
    const data = await apiRequest("/api/v1/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setToken(data.token);
    setUser(data.user);
    // Same reasoning as login() above — this browser is now tied to a
    // real account, so it shouldn't keep carrying whatever guest id it
    // had before.
    rotateGuestId();
    return data.user;
  };

  // Doesn't need a fresh token — the JWT isn't derived from profile
  // fields, only user.id — but does need the local user state to reflect
  // the edit immediately (Settings.js reads straight off this hook).
  const updateProfile = async (fields) => {
    const data = await apiRequest("/api/v1/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    setUser(data);
    return data;
  };

  const changePassword = async (currentPassword, newPassword) => {
    const data = await apiRequest("/api/v1/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    // Changing a password now invalidates every token issued before it
    // (see backend/app/utils/auth.py's _issued_before_password_change) —
    // this session's own existing token is one of them, so without
    // storing the freshly-issued one here, the very next request would
    // log this session out too.
    setToken(data.token);
    return data;
  };

  // Terms & Conditions already promises this is possible "at any time" —
  // this is what actually makes that true for a signed-in customer,
  // rather than only via emailing support. Same shape as logout(): clears
  // the token and rotates this browser to a fresh guest identity, since
  // the account (and the guest_id's own migrated data, now the deleted
  // account's) is gone either way.
  const deleteAccount = async () => {
    await apiRequest("/api/v1/auth/me", { method: "DELETE" });
    setToken(null);
    setUser(null);
    rotateGuestId();
  };

  const resendVerification = (email) =>
    apiRequest("/api/v1/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

  const forgotPassword = (email) =>
    apiRequest("/api/v1/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

  // Choosing a new password from the emailed link already proves control
  // of both the account and the inbox — signs in directly, same as
  // verifyEmail, rather than making them retype the password they just set.
  const resetPassword = async (token, password) => {
    const data = await apiRequest("/api/v1/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setToken(data.token);
    setUser(data.user);
    // Same reasoning as login()/verifyEmail() above.
    rotateGuestId();
    return data.user;
  };

  return {
    user, loading, login, signup, logout, refreshUser,
    verifyEmail, resendVerification, forgotPassword, resetPassword,
    updateProfile, changePassword, deleteAccount,
  };
}
