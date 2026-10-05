"use client";
/**
 * Login.js — entirely optional. Nothing else in the app requires this
 * screen to ever be visited; it exists purely for people who want their
 * saved resumes / job tracker / CV scans to follow them across devices.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/lib/useAuth";
import { Field, Btn, TextLink } from "../guest/components/primitives";
import { AuthShell } from "./AuthShell";
import ForgotPassword from "./ForgotPassword";

export default function Login({ onClose, onSuccess, onSwitchToSignup }) {
  const { login, resendVerification } = useAuth();
  const [screen, setScreen] = useState("login"); // "login" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [unverified, setUnverified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setUnverified(false);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      toast.success(`Welcome back, ${user.email}`);
      onSuccess?.();
    } catch (e) {
      if (e.code === "EMAIL_NOT_VERIFIED") {
        setUnverified(true);
      } else {
        setError(e.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      await resendVerification(email.trim());
      toast.success("Verification email sent — check your inbox.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setResending(false);
    }
  };

  if (screen === "forgot") {
    return <ForgotPassword onClose={onClose} onBackToLogin={() => setScreen("login")} />;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50">
      <AuthShell onClose={onClose}>
        <p className="m-0 text-[20px] font-bold text-foreground">Welcome back</p>
        <p className="m-0 mt-1.5 mb-5 text-[13.5px] leading-relaxed text-muted-foreground">
          Sync your saved resumes and job tracker across devices.
        </p>

        <form onSubmit={submit} className="grid gap-1">
          <Field label="EMAIL" required type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
          <div>
            <Field label="PASSWORD" required type="password" value={password} onChange={setPassword} placeholder="••••••••" autoComplete="current-password" />
            <div className="-mt-3 mb-3.5 flex justify-end">
              <TextLink small onClick={() => setScreen("forgot")}>Forgot password?</TextLink>
            </div>
          </div>

          {error && (
            <div role="alert" className="mt-1 mb-1 flex gap-2 border-l-2 border-destructive py-0.5 pl-[11px] text-[12.5px] leading-relaxed text-destructive">
              {error}
            </div>
          )}

          {unverified && (
            <div role="alert" className="mt-1 mb-1 flex flex-col gap-2 rounded-[10px] border border-primary/25 bg-primary/10 p-3.5">
              <p className="m-0 text-[12.5px] leading-relaxed text-foreground">
                This account's email hasn't been verified yet. Check your inbox for the link, or we can send a new one.
              </p>
              <Btn small variant="primary" onClick={resend} disabled={resending} loading={resending}>
                {resending ? "Sending…" : "Resend email"}
              </Btn>
            </div>
          )}

          <Btn variant="gold" type="submit" className="mt-2.5" disabled={submitting} loading={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Btn>
        </form>

        <p className="m-0 mt-5 text-center text-[13px] text-muted-foreground">
          New here?{" "}
          <button onClick={onSwitchToSignup} className="border-none bg-transparent p-0 font-bold text-primary">
            Create an account
          </button>
        </p>
      </AuthShell>
    </motion.div>
  );
}
