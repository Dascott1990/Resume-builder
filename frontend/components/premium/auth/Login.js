"use client";
/**
 * Login.js — entirely optional. Nothing else in the app requires this
 * screen to ever be visited; it exists purely for people who want their
 * saved resumes / job tracker / CV scans to follow them across devices.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { X } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { Field, Btn } from "../guest/components/primitives";
import Logo from "../Logo";

export default function Login({ onClose, onSuccess, onSwitchToSignup }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
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
        <div>
          <p className="m-0 font-serif text-[22px] italic text-foreground">Welcome back</p>
          <p className="m-0 mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
            Sign in to sync your saved resumes and job tracker across devices. Everything still works fine without this.
          </p>
        </div>

        <form onSubmit={submit} className="grid gap-1">
          <Field label="EMAIL" required type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
          <Field label="PASSWORD" required type="password" value={password} onChange={setPassword} placeholder="••••••••" />

          {error && (
            <div role="alert" className="mt-1 mb-1 flex gap-2 border-l-2 border-destructive py-0.5 pl-[11px] text-[12.5px] leading-relaxed text-destructive">
              {error}
            </div>
          )}

          <Btn variant="gold" type="submit" className="mt-2.5" disabled={submitting} loading={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Btn>
        </form>

        <p className="m-0 text-center text-[13px] text-muted-foreground">
          New here?{" "}
          <button onClick={onSwitchToSignup} className="border-none bg-transparent p-0 font-bold text-primary">
            Create an account
          </button>
        </p>
      </div>
    </motion.div>
  );
}
