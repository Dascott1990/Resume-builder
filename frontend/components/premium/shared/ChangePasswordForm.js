"use client";
/**
 * ChangePasswordForm.js — the change-password form used by the account
 * card in Settings.js.
 */
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Field, Btn } from "../guest/components/primitives";

export default function ChangePasswordForm({ onSubmit }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 border-none bg-transparent p-0 text-[12.5px] font-bold text-primary">
        <KeyRound className="size-3.5" /> Change password
      </button>
    );
  }

  const submit = async () => {
    if (next.length < 8) { toast.error("New password must be at least 8 characters"); return; }
    if (next !== confirm) { toast.error("New passwords don't match"); return; }
    setSubmitting(true);
    try {
      await onSubmit(current, next);
      toast.success("Password updated");
      setOpen(false); setCurrent(""); setNext(""); setConfirm("");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-2.5 rounded-lg border border-border p-3">
      <Field label="Current password" type="password" value={current} onChange={setCurrent} placeholder="••••••••" autoComplete="current-password" />
      <Field label="New password" type="password" value={next} onChange={setNext} placeholder="At least 8 characters" autoComplete="new-password" />
      <Field label="Confirm new password" type="password" value={confirm} onChange={setConfirm} placeholder="Retype new password" autoComplete="new-password" />
      <div className="flex gap-2">
        <Btn small variant="gold" disabled={submitting} loading={submitting} onClick={submit}>Update password</Btn>
        <Btn small variant="ghost" disabled={submitting} onClick={() => setOpen(false)}>Cancel</Btn>
      </div>
    </div>
  );
}
