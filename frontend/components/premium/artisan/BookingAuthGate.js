"use client";
/**
 * BookingAuthGate.js — the "sign in to book" prompt for RequestJobModal.js.
 * Deliberately NOT a reuse of SignupNudgeModal.js: that modal doesn't sign
 * anyone in after signup (it just sends a verification email and stops),
 * which is fine for its original "don't lose my resume" use case but wrong
 * here — a first-time visitor would create an account and then be stuck,
 * unable to actually post the job they came to post, until they go check
 * their inbox. This leads with sign-in (existing verified users post
 * immediately, no delay) and offers signup as the secondary path, which
 * still ends in "check your email" but at least doesn't pretend otherwise.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { LogIn, Mail } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { Field, Btn } from "../guest/components/primitives";

export default function BookingAuthGate({ open, onClose, onSuccess }) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signupSent, setSignupSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || password.length < 8) {
      setError("Enter your email and an 8+ character password.");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
        onSuccess();
      } else {
        await signup(email.trim(), password);
        setSignupSent(true);
      }
    } catch (err) {
      if (err.code === "EMAIL_NOT_VERIFIED") {
        setError("This account's email isn't verified yet — check your inbox for the link.");
      } else {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        {signupSent ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Mail className="size-5" />
            </div>
            <p className="m-0 font-serif text-lg italic text-foreground">Check your email</p>
            <p className="m-0 text-[13.5px] leading-relaxed text-muted-foreground">
              We sent a verification link to <strong className="text-foreground">{email.trim()}</strong>. Click it, then come back and sign in to post your request.
            </p>
            <Btn variant="gold" onClick={onClose} className="mt-1">Got it</Btn>
          </div>
        ) : (
          <>
            <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary">
              <LogIn className="size-5" />
            </div>
            <p className="m-0 font-serif text-lg italic text-foreground">
              {mode === "login" ? "Sign in to post this request" : "Create an account to post this request"}
            </p>
            <p className="m-0 mb-1 text-[13.5px] leading-relaxed text-muted-foreground">
              An account is how artisans reach back out and how you track this job's status.
            </p>
            <form onSubmit={submit} className="grid gap-0">
              <Field label="Email" required type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
              <Field label="Password" required type="password" value={password} onChange={setPassword} placeholder={mode === "signup" ? "8+ characters" : "••••••••"} />
              {error && (
                <div role="alert" className="mb-3 border-l-2 border-destructive py-0.5 pl-[11px] text-[12.5px] leading-relaxed text-destructive">
                  {error}
                </div>
              )}
              <Btn variant="gold" type="submit" disabled={submitting} loading={submitting}>
                {submitting ? "Please wait…" : mode === "login" ? "Sign in & post" : "Create account"}
              </Btn>
            </form>
            <p className="m-0 mt-2 text-center text-[13px] text-muted-foreground">
              {mode === "login" ? (
                <>New here?{" "}
                  <button onClick={() => { setMode("signup"); setError(""); }} className="border-none bg-transparent p-0 font-bold text-primary">
                    Create an account
                  </button>
                </>
              ) : (
                <>Already have an account?{" "}
                  <button onClick={() => { setMode("login"); setError(""); }} className="border-none bg-transparent p-0 font-bold text-primary">
                    Sign in
                  </button>
                </>
              )}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
