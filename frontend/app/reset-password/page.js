"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { Field, Btn } from "@/components/premium/guest/components/primitives";
import { AuthShell } from "@/components/premium/auth/AuthShell";
import { useLanguage } from "@/lib/i18n";

const ENTERED_KEY = "noqeev_entered_app";

function ResetPasswordContent() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const { resetPassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  // Set only when resetPassword() itself fails (an expired/already-used
  // token) — distinct from a plain validation error (weak password,
  // mismatch) above, since retyping the password can never fix this one:
  // the form stays open either way, but this case needs a real way out.
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setTokenInvalid(false);
    if (password.length < 8) {
      setError(t("resetPassword.passwordMinLength"));
      return;
    }
    if (password !== confirm) {
      setError(t("resetPassword.passwordsDontMatch"));
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(token, password);
      try { localStorage.setItem(ENTERED_KEY, "1"); } catch {}
      router.replace("/");
    } catch (e) {
      setError(e.message);
      setTokenInvalid(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <AuthShell>
        <div className="flex flex-col items-center gap-4 text-center">
          <div>
            <p className="m-0 text-[18px] font-bold text-foreground">{t("common.linkDidntWork")}</p>
            <p className="m-0 mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
              {t("resetPassword.missingTokenExplain")}
            </p>
          </div>
          <Btn variant="gold" small onClick={() => router.replace("/")}>{t("common.goToSignIn")}</Btn>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <p className="m-0 text-[20px] font-bold text-foreground">{t("resetPassword.chooseNewPassword")}</p>
      <p className="m-0 mt-1.5 mb-5 text-[13.5px] leading-relaxed text-muted-foreground">
        {t("resetPassword.signedInRightAfter")}
      </p>

      <form onSubmit={submit} className="grid gap-1">
        <Field label={t("resetPassword.newPasswordLabel")} required type="password" hint={t("auth.passwordHint")} value={password} onChange={setPassword} placeholder="••••••••" autoComplete="new-password" />
        <Field label={t("resetPassword.confirmPasswordLabel")} required type="password" value={confirm} onChange={setConfirm} placeholder="••••••••" autoComplete="new-password" />

        {error && (
          <div role="alert" className="mt-1 mb-1 flex flex-col gap-2 border-l-2 border-destructive py-0.5 pl-[11px] text-[12.5px] leading-relaxed text-destructive">
            <span>{error}</span>
            {tokenInvalid && (
              <span className="text-foreground">
                {t("resetPassword.linkExpiredPrefix")}{" "}
                <button
                  type="button"
                  onClick={() => router.replace("/")}
                  className="border-none bg-transparent p-0 font-bold text-primary underline"
                >
                  {t("resetPassword.signInRequestNew")}
                </button>.
              </span>
            )}
          </div>
        )}

        <Btn variant="gold" type="submit" className="mt-2.5" disabled={submitting} loading={submitting}>
          {submitting ? t("resetPassword.updating") : t("resetPassword.updatePassword")}
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
