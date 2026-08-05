"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { XCircle } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { Field, Btn } from "@/components/premium/guest/components/primitives";
import Logo from "@/components/premium/Logo";

const ENTERED_KEY = "noviq_entered_app";

function ResetPasswordContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const { resetPassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(token, password);
      try { localStorage.setItem(ENTERED_KEY, "1"); } catch {}
      router.replace("/");
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="flex h-[100dvh] w-full flex-col items-center justify-center gap-6 bg-background px-6 text-center font-sans">
        <Logo size={26} />
        <XCircle className="size-12 text-destructive" />
        <div>
          <p className="m-0 font-serif text-[20px] italic text-foreground">Link didn't work</p>
          <p className="m-0 mt-1.5 max-w-xs text-[13.5px] leading-relaxed text-muted-foreground">
            This reset link is missing its token.
          </p>
        </div>
        <Btn variant="gold" small onClick={() => router.replace("/")}>Back to Noviq</Btn>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="flex h-[100dvh] w-full flex-col overflow-y-auto bg-background font-sans"
    >
      <div className="flex shrink-0 items-center p-5">
        <Logo size={22} />
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 pb-16">
        <div>
          <p className="m-0 font-serif text-[22px] italic text-foreground">Choose a new password</p>
          <p className="m-0 mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
            You'll be signed in right after.
          </p>
        </div>

        <form onSubmit={submit} className="grid gap-1">
          <Field label="NEW PASSWORD" required type="password" hint="8+ characters" value={password} onChange={setPassword} placeholder="••••••••" />
          <Field label="CONFIRM PASSWORD" required type="password" value={confirm} onChange={setConfirm} placeholder="••••••••" />

          {error && (
            <div role="alert" className="mt-1 mb-1 flex gap-2 border-l-2 border-destructive py-0.5 pl-[11px] text-[12.5px] leading-relaxed text-destructive">
              {error}
            </div>
          )}

          <Btn variant="gold" type="submit" className="mt-2.5" disabled={submitting} loading={submitting}>
            {submitting ? "Updating…" : "Update password"}
          </Btn>
        </form>
      </div>
    </motion.div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
