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

  const signup = async (email, password) => {
    const data = await apiRequest("/api/v1/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    setUser(data.user);
    return data.user;
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
  };

  return { user, loading, login, signup, logout, refreshUser };
}
