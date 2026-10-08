"use client";
/**
 * ForgotPassword.js — reached only from Login.js's "Forgot password?" link.
 * Always shows the same success message whether or not the email has an
 * account (see backend/app/api/auth.py forgot_password) — the UI mirrors
 * that on purpose, so it can't be used to test which emails are registered.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/useAuth";
import { Field, Btn } from "../guest/components/primitives";
import { AuthShell } from "./AuthShell";
import { useLanguage } from "@/lib/i18n";

export default function ForgotPassword({ onClose, onBackToLogin }) {
  const { t } = useLanguage();
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError(t("auth.enterEmail"));
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50">
      <AuthShell onClose={onClose}>
        {sent ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div>
              <p className="m-0 text-[18px] font-bold text-foreground">{t("auth.checkYourEmail")}</p>
              <p className="m-0 mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                {t("auth.resetLinkSentTo", { email: email.trim() })}
              </p>
            </div>
            <Btn variant="gold" small onClick={onBackToLogin}>{t("auth.backToSignIn")}</Btn>
          </div>
        ) : (
          <>
            <p className="m-0 text-[20px] font-bold text-foreground">{t("auth.resetYourPassword")}</p>
            <p className="m-0 mt-1.5 mb-5 text-[13.5px] leading-relaxed text-muted-foreground">
              {t("auth.resetLinkSubtitle")}
            </p>

            <form onSubmit={submit} className="grid gap-1">
              <Field label={t("auth.email")} required type="email" value={email} onChange={setEmail} placeholder={t("auth.emailPlaceholder")} autoComplete="email" />

              {error && (
                <div role="alert" className="mt-1 mb-1 flex gap-2 border-l-2 border-destructive py-0.5 pl-[11px] text-[12.5px] leading-relaxed text-destructive">
                  {error}
                </div>
              )}

              <Btn variant="gold" type="submit" className="mt-2.5" disabled={submitting} loading={submitting}>
                {submitting ? t("auth.sending") : t("auth.sendResetLink")}
              </Btn>
            </form>

            <p className="m-0 mt-5 text-center text-[13px] text-muted-foreground">
              <button onClick={onBackToLogin} className="border-none bg-transparent p-0 font-bold text-primary">
                {t("auth.backToSignIn")}
              </button>
            </p>
          </>
        )}
      </AuthShell>
    </motion.div>
  );
}
