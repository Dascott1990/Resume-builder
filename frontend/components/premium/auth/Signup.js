"use client";
/**
 * Signup.js — entirely optional, same as Login.js. If a guest_id-scoped
 * draft already exists on this browser, the backend links it to the new
 * account on signup (see backend/app/api/auth.py) — creating an account
 * never means starting over.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/useAuth";
import { Field, Btn } from "../guest/components/primitives";
import { TermsConsent } from "@/components/shared/TermsConsent";
import { AuthShell } from "./AuthShell";

export default function Signup({ onClose, onSuccess, onSwitchToLogin }) {
  const { signup, resendVerification } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [resending, setResending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (!agreed) {
      setError("Please agree to the Terms & Conditions and Privacy Policy.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      // Does NOT sign the user in — the account exists but stays
      // unverified until the emailed link is clicked (see useAuth.signup).
      await signup(email.trim(), password);
      setSent(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      await resendVerification(email.trim());
    } finally {
      setResending(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50">
      <AuthShell onClose={onClose}>
        {sent ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div>
              <p className="m-0 text-[18px] font-bold text-foreground">Check your email</p>
              <p className="m-0 mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                We sent a verification link to <strong className="text-foreground">{email.trim()}</strong>. Click it to finish setting up your account.
              </p>
            </div>
            <button
              onClick={resend}
              disabled={resending}
              className="border-none bg-transparent p-0 text-[13px] font-bold text-primary disabled:opacity-50"
            >
              {resending ? "Sending…" : "Didn't get it? Resend"}
            </button>
            <button onClick={onSwitchToLogin} className="border-none bg-transparent p-0 text-[13px] font-semibold text-muted-foreground">
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <p className="m-0 text-[20px] font-bold text-foreground">Create an account</p>
            <p className="m-0 mt-1.5 mb-5 text-[13.5px] leading-relaxed text-muted-foreground">
              Save your resumes, applications, and profile once — reuse them for every future resume.
            </p>

            <form onSubmit={submit} className="grid gap-1">
              <Field label="EMAIL" required type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
              <Field label="PASSWORD" required type="password" hint="8+ characters" value={password} onChange={setPassword} placeholder="••••••••" autoComplete="new-password" />

              <TermsConsent checked={agreed} onChange={setAgreed} id="signup-terms-consent" />

              {error && (
                <div role="alert" className="mt-1 mb-1 flex gap-2 border-l-2 border-destructive py-0.5 pl-[11px] text-[12.5px] leading-relaxed text-destructive">
                  {error}
                </div>
              )}

              <Btn variant="gold" type="submit" className="mt-2.5" disabled={submitting || !agreed} loading={submitting}>
                {submitting ? "Creating account…" : "Create account"}
              </Btn>
            </form>

            <p className="m-0 mt-5 text-center text-[13px] text-muted-foreground">
              Already have an account?{" "}
              <button onClick={onSwitchToLogin} className="border-none bg-transparent p-0 font-bold text-primary">
                Sign in
              </button>
            </p>
          </>
        )}
      </AuthShell>
    </motion.div>
  );
}
