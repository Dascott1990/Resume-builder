"use client";
/**
 * Signup.js — entirely optional, same as Login.js. If a guest_id-scoped
 * draft already exists on this browser, the backend links it to the new
 * account on signup (see backend/app/api/auth.py) — creating an account
 * never means starting over.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, UserPlus, X } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { Field, Btn } from "../guest/components/primitives";
import { IconTile } from "../shared/IconTile";
import Logo from "../Logo";

export default function Signup({ onClose, onSuccess, onSwitchToLogin }) {
  const { signup, resendVerification } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col overflow-y-auto bg-background font-sans"
    >
      <motion.div
        aria-hidden="true"
        animate={{ opacity: [0.14, 0.26, 0.14] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute top-[-12%] left-1/2 size-[420px] -translate-x-1/2"
        style={{ background: "radial-gradient(circle, color-mix(in oklch, var(--primary) 18%, transparent) 0%, transparent 70%)" }}
      />

      <div className="relative flex shrink-0 items-center justify-between p-5">
        <Logo size={22} />
        {onClose && (
          <button onClick={onClose} aria-label="Close" className="flex size-10 items-center justify-center rounded-full border border-border bg-muted text-foreground">
            <X className="size-[17px]" />
          </button>
        )}
      </div>

      <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 pb-16">
        {sent ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4 text-center">
            <IconTile icon={Mail} size="lg" />
            <div>
              <p className="m-0 font-serif text-[20px] italic text-foreground">Check your email</p>
              <p className="m-0 mt-1.5 max-w-xs text-[13.5px] leading-relaxed text-muted-foreground">
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
          </motion.div>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }}>
              <IconTile icon={UserPlus} size="md" className="mb-4" />
              <p className="m-0 font-serif text-[22px] italic text-foreground">Create an account</p>
              <p className="m-0 mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                Optional — sync your saved resumes and job tracker across devices.
              </p>
            </motion.div>

            <motion.form
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.12 }}
              onSubmit={submit} className="grid gap-1"
            >
              <Field label="EMAIL" required type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
              <Field label="PASSWORD" required type="password" hint="8+ characters" value={password} onChange={setPassword} placeholder="••••••••" />

              {error && (
                <div role="alert" className="mt-1 mb-1 flex gap-2 border-l-2 border-destructive py-0.5 pl-[11px] text-[12.5px] leading-relaxed text-destructive">
                  {error}
                </div>
              )}

              <Btn variant="gold" type="submit" className="mt-2.5" disabled={submitting} loading={submitting}>
                {submitting ? "Creating account…" : "Create account"}
              </Btn>
            </motion.form>

            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45, delay: 0.2 }}
              className="m-0 text-center text-[13px] text-muted-foreground"
            >
              Already have an account?{" "}
              <button onClick={onSwitchToLogin} className="border-none bg-transparent p-0 font-bold text-primary">
                Sign in
              </button>
            </motion.p>
          </>
        )}
      </div>
    </motion.div>
  );
}
