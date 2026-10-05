"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { Field, Btn } from "@/components/premium/guest/components/primitives";
import { AuthShell } from "@/components/premium/auth/AuthShell";

const ENTERED_KEY = "noqeev_entered_app";

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
      <AuthShell>
        <div className="flex flex-col items-center gap-4 text-center">
          <div>
            <p className="m-0 text-[18px] font-bold text-foreground">Link didn't work</p>
            <p className="m-0 mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
              This reset link is missing its token.
            </p>
          </div>
          <Btn variant="gold" small onClick={() => router.replace("/")}>Back to Noqeev</Btn>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <p className="m-0 text-[20px] font-bold text-foreground">Choose a new password</p>
      <p className="m-0 mt-1.5 mb-5 text-[13.5px] leading-relaxed text-muted-foreground">
        You'll be signed in right after.
      </p>

      <form onSubmit={submit} className="grid gap-1">
        <Field label="NEW PASSWORD" required type="password" hint="8+ characters" value={password} onChange={setPassword} placeholder="••••••••" autoComplete="new-password" />
        <Field label="CONFIRM PASSWORD" required type="password" value={confirm} onChange={setConfirm} placeholder="••••••••" autoComplete="new-password" />

        {error && (
          <div role="alert" className="mt-1 mb-1 flex gap-2 border-l-2 border-destructive py-0.5 pl-[11px] text-[12.5px] leading-relaxed text-destructive">
            {error}
          </div>
        )}

        <Btn variant="gold" type="submit" className="mt-2.5" disabled={submitting} loading={submitting}>
          {submitting ? "Updating…" : "Update password"}
        </Btn>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
