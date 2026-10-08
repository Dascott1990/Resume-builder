"use client";
/**
 * ChangePasswordForm.js — the change-password form used by the account
 * card in Settings.js.
 */
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Field, Btn } from "../guest/components/primitives";
import { useLanguage } from "@/lib/i18n";

export default function ChangePasswordForm({ onSubmit }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 border-none bg-transparent p-0 text-[12.5px] font-bold text-primary">
        <KeyRound className="size-3.5" /> {t("changePassword.changePassword")}
      </button>
    );
  }

  const submit = async () => {
    if (next.length < 8) { toast.error(t("changePassword.minLength")); return; }
    if (next !== confirm) { toast.error(t("changePassword.noMatch")); return; }
    setSubmitting(true);
    try {
      await onSubmit(current, next);
      toast.success(t("changePassword.updated"));
      setOpen(false); setCurrent(""); setNext(""); setConfirm("");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-2.5 rounded-lg border border-border p-3">
      <Field label={t("changePassword.currentPassword")} type="password" value={current} onChange={setCurrent} placeholder="••••••••" autoComplete="current-password" />
      <Field label={t("changePassword.newPassword")} type="password" value={next} onChange={setNext} placeholder={t("changePassword.atLeast8")} autoComplete="new-password" />
      <Field label={t("changePassword.confirmNewPassword")} type="password" value={confirm} onChange={setConfirm} placeholder={t("changePassword.retypeNewPassword")} autoComplete="new-password" />
      <div className="flex gap-2">
        <Btn small variant="gold" disabled={submitting} loading={submitting} onClick={submit}>{t("changePassword.updatePassword")}</Btn>
        <Btn small variant="ghost" disabled={submitting} onClick={() => setOpen(false)}>{t("common.cancel")}</Btn>
      </div>
    </div>
  );
}
