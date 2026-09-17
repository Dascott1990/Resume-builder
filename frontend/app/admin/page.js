"use client";
/**
 * app/admin/page.js — the admin panel's front door.
 *
 * A real URL route (not a screen inside the main app/page.js shell) on
 * purpose: it needs its own gate (checked before anything else renders),
 * shouldn't be reachable from the regular nav, and has nothing to do with
 * the guest_id-scoped app the rest of the site is built around.
 *
 * "Not signed in" and "signed in but not an admin" both come back from the
 * backend as the exact same 403 (see app/utils/auth.require_admin —
 * revealing which one it is would just tell an attacker their token is
 * real but under-privileged), so both are handled by the same "denied"
 * screen with a way to try a different account, rather than being told
 * apart client-side.
 */
import { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { apiRequest } from "@/components/premium/shared/api";
import { getToken, setToken } from "@/lib/authToken";
import { useAuth } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/premium/Logo";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

// Separate from the normal email/password form on purpose: it posts to
// /api/v1/auth/break-glass-login, which (see backend app/utils/auth.py)
// never reads the users table — the one sign-in path meant to still work
// when Postgres itself is what's broken. Tucked behind a toggle instead of
// shown by default so it stays "the thing you reach for during an
// incident," not a second login form someone reaches for out of habit.
function BreakGlassLogin({ onSignedIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await apiRequest("/api/v1/auth/break-glass-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      setToken(data.token);
      onSignedIn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-5 space-y-4 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/[0.04] p-5">
      <p className="m-0 flex items-center gap-1.5 text-[12px] font-semibold text-amber-600 dark:text-amber-400">
        <KeyRound className="size-3.5" /> Emergency access
      </p>
      <p className="m-0 text-[12px] leading-relaxed text-muted-foreground">
        Uses the break-glass credential instead of an account — works even if the database is down.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="bg-username">Username</Label>
        <Input id="bg-username" required value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bg-password">Password</Label>
        <Input id="bg-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
      </div>
      {error && <p className="m-0 text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} variant="outline" className="w-full border-amber-500/40">
        {busy ? <Loader2 className="size-4 animate-spin" /> : "Sign in with emergency access"}
      </Button>
    </form>
  );
}

function AdminLogin({ onSignedIn }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showBreakGlass, setShowBreakGlass] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      onSignedIn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <form onSubmit={submit} className="space-y-5 rounded-2xl border border-border bg-card p-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <Logo size={28} />
            <h1 className="m-0 text-lg font-bold text-foreground">Admin sign in</h1>
            <p className="m-0 text-[13px] text-muted-foreground">Sign in with an account that has admin access.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-email">Email</Label>
            <Input id="admin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-password">Password</Label>
            <Input id="admin-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          {error && <p className="m-0 text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
          </Button>
        </form>

        {showBreakGlass ? (
          <BreakGlassLogin onSignedIn={onSignedIn} />
        ) : (
          <button
            type="button"
            onClick={() => setShowBreakGlass(true)}
            className="mx-auto mt-4 block text-[12px] font-medium text-muted-foreground/70 hover:text-muted-foreground"
          >
            Can't sign in? Emergency access →
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [status, setStatus] = useState("checking"); // checking | needs-login | denied | ok
  const [adminUser, setAdminUser] = useState(null);

  const checkAdmin = useCallback(async () => {
    if (!getToken()) {
      setStatus("needs-login");
      return;
    }
    setStatus("checking");
    try {
      const data = await apiRequest("/api/v1/admin/me");
      setAdminUser(data);
      setStatus("ok");
    } catch {
      setStatus("denied");
    }
  }, []);

  useEffect(() => { checkAdmin(); }, [checkAdmin]);

  const tryDifferentAccount = () => {
    setToken(null);
    setStatus("needs-login");
  };

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "needs-login") {
    return <AdminLogin onSignedIn={checkAdmin} />;
  }

  if (status === "denied") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <ShieldAlert className="size-8 text-destructive" />
        <p className="m-0 max-w-sm text-sm text-muted-foreground">
          Either you're not signed in, or this account doesn't have admin access.
        </p>
        <Button variant="outline" onClick={tryDifferentAccount}>Try a different account</Button>
      </div>
    );
  }

  return <AdminDashboard adminUser={adminUser} onSignOut={tryDifferentAccount} />;
}
