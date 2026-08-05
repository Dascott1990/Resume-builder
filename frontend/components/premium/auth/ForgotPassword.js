"use client";
/**
 * ForgotPassword.js — reached only from Login.js's "Forgot password?" link.
 * Always shows the same success message whether or not the email has an
 * account (see backend/app/api/auth.py forgot_password) — the UI mirrors
 * that on purpose, so it can't be used to test which emails are registered.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, X } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { Field, Btn } from "../guest/components/primitives";
import Logo from "../Logo";

export default function ForgotPassword({ onClose, onBackToLogin }) {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Enter your email.");
      return;
    }
    setSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col overflow-y-auto bg-background font-sans"
    >
      <div className="flex shrink-0 items-center justify-between p-5">
        <Logo size={22} />
        {onClose && (
          <button onClick={onClose} aria-label="Close" className="flex size-10 items-center justify-center rounded-full border border-border bg-muted text-foreground">
            <X className="size-[17px]" />
          </button>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 pb-16">
        {sent ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-14 items-center justify-center rounded-full border border-primary/25 bg-primary/10">
              <Mail className="size-6 text-primary" />
            </div>
            <div>
              <p className="m-0 font-serif text-[20px] italic text-foreground">Check your email</p>
              <p className="m-0 mt-1.5 max-w-xs text-[13.5px] leading-relaxed text-muted-foreground">
                If <strong className="text-foreground">{email.trim()}</strong> has an account, a reset link is on its way.
              </p>
            </div>
            <Btn variant="gold" small onClick={onBackToLogin}>Back to sign in</Btn>
          </motion.div>
        ) : (
          <>
            <div>
              <p className="m-0 font-serif text-[22px] italic text-foreground">Reset your password</p>
              <p className="m-0 mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                Enter the email on your account and we'll send a link to choose a new password.
              </p>
            </div>

            <form onSubmit={submit} className="grid gap-1">
              <Field label="EMAIL" required type="email" value={email} onChange={setEmail} placeholder="you@example.com" />

              {error && (
                <div role="alert" className="mt-1 mb-1 flex gap-2 border-l-2 border-destructive py-0.5 pl-[11px] text-[12.5px] leading-relaxed text-destructive">
                  {error}
                </div>
              )}

              <Btn variant="gold" type="submit" className="mt-2.5" disabled={submitting} loading={submitting}>
                {submitting ? "Sending…" : "Send reset link"}
              </Btn>
            </form>

            <p className="m-0 text-center text-[13px] text-muted-foreground">
              <button onClick={onBackToLogin} className="border-none bg-transparent p-0 font-bold text-primary">
                Back to sign in
              </button>
            </p>
          </>
        )}
      </div>
    </motion.div>
  );
}
