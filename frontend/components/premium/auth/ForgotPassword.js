"use client";
/**
 * ForgotPassword.js — reached only from Login.js's "Forgot password?" link.
 * Always shows the same success message whether or not the email has an
 * account (see backend/app/api/auth.py forgot_password) — the UI mirrors
 * that on purpose, so it can't be used to test which emails are registered.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, KeyRound, X } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { Field, Btn } from "../guest/components/primitives";
import { IconTile } from "../shared/IconTile";
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
      <motion.div
        aria-hidden="true"
        animate={{ opacity: [0.14, 0.26, 0.14] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute top-[-12%] left-1/2 size-[420px] -translate-x-1/2"
        style={{ background: "radial-gradient(circle, color-mix(in oklch, var(--primary) 18%, transparent) 0%, transparent 70%)" }}
      />

      <div
        className="relative flex shrink-0 items-center justify-between px-5 pb-5"
        style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
      >
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
                If <strong className="text-foreground">{email.trim()}</strong> has an account, a reset link is on its way.
              </p>
            </div>
            <Btn variant="gold" small onClick={onBackToLogin}>Back to sign in</Btn>
          </motion.div>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }}>
              <IconTile icon={KeyRound} size="md" className="mb-4" />
              <p className="m-0 font-serif text-[22px] italic text-foreground">Reset your password</p>
              <p className="m-0 mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                Enter the email on your account and we'll send a link to choose a new password.
              </p>
            </motion.div>

            <motion.form
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.12 }}
              onSubmit={submit} className="grid gap-1"
            >
              <Field label="EMAIL" required type="email" value={email} onChange={setEmail} placeholder="you@example.com" />

              {error && (
                <div role="alert" className="mt-1 mb-1 flex gap-2 border-l-2 border-destructive py-0.5 pl-[11px] text-[12.5px] leading-relaxed text-destructive">
                  {error}
                </div>
              )}

              <Btn variant="gold" type="submit" className="mt-2.5" disabled={submitting} loading={submitting}>
                {submitting ? "Sending…" : "Send reset link"}
              </Btn>
            </motion.form>

            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45, delay: 0.2 }}
              className="m-0 text-center text-[13px] text-muted-foreground"
            >
              <button onClick={onBackToLogin} className="border-none bg-transparent p-0 font-bold text-primary">
                Back to sign in
              </button>
            </motion.p>
          </>
        )}
      </div>
    </motion.div>
  );
}
