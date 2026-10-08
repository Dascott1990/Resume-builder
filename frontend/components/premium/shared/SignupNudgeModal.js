"use client";
/**
 * SignupNudgeModal.js — the soft signup prompt itself (see lib/
 * useSignupNudge.js for when it fires). A real inline signup form, not a
 * link to the full-screen Signup.js — dismissing or completing it should
 * never cost someone their place in the resume they were building.
 */
import { useState } from "react";
import { Sparkles, Mail } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/i18n";

export function SignupNudgeModal({ open, onDismiss }) {
  const { t } = useLanguage();
  const { signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || password.length < 8) {
      setError(t("signupNudge.enterEmailPassword"));
      return;
    }
    setSubmitting(true);
    try {
      // Does NOT sign in yet — same as the full Signup screen, the account
      // exists but stays unverified until the emailed link is clicked.
      await signup(email.trim(), password);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onDismiss()}>
      <DialogContent className="sm:max-w-sm">
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Mail className="size-5" />
            </div>
            <DialogTitle>{t("auth.checkYourEmail")}</DialogTitle>
            <p className="m-0 text-[13.5px] leading-relaxed text-muted-foreground">
              {t("signupNudge.verificationSentTo", { email: email.trim() })}
            </p>
            <Button onClick={onDismiss} className="mt-1 w-full">{t("signupNudge.gotIt")}</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Sparkles className="size-5" />
              </div>
              <DialogTitle>{t("signupNudge.dontLoseThis")}</DialogTitle>
              <DialogDescription>
                {t("signupNudge.explain")}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="nudge-email">{t("signupNudge.email")}</Label>
                <Input id="nudge-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nudge-password">{t("signupNudge.password")}</Label>
                <Input id="nudge-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder={t("auth.passwordHint")} />
              </div>
              {error && <p className="m-0 text-[13px] text-destructive">{error}</p>}
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? t("auth.creatingAccount") : t("signupNudge.createFreeAccount")}
              </Button>
              <button type="button" onClick={onDismiss} className="w-full cursor-pointer border-none bg-transparent p-0 py-1 text-center text-[13px] font-semibold text-muted-foreground">
                {t("signupNudge.maybeLater")}
              </button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
