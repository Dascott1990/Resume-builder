"use client";
/**
 * useAuth.js — entirely optional session layer on top of the anonymous
 * guest_id system. Nothing in the app requires being signed in; this only
 * exists so someone who wants their saved resumes / job tracker / CV scans
 * to follow them across devices can opt into that.
 */
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/components/premium/shared/api";
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
    } catch {
      // Token missing/expired/invalid — same as never having signed in.
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  // Does NOT sign the user in — the account exists but is unverified until
  // they click the link that just landed in their inbox. Returns the
  // backend's "check your email" message for the UI to show.
  const signup = async (email, password) => {
    const data = await apiRequest("/api/v1/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
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

  const changePassword = (currentPassword, newPassword) =>
    apiRequest("/api/v1/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });

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
    return data.user;
  };

  return {
    user, loading, login, signup, logout, refreshUser,
    verifyEmail, resendVerification, forgotPassword, resetPassword,
    updateProfile, changePassword,
  };
}
