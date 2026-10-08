"use client";
/**
 * WelcomeNamePrompt.js — asked once, right after a first real login/signup,
 * purely so the generated resume itself can say a real name instead of
 * nothing: every resume layout needs SOMETHING in the name slot, and up to
 * now a fresh account had no name at all until someone happened to visit
 * Profile and type one in.
 *
 * "First time" is read directly off the account, not a separate flag:
 * `user.name` falsy IS the signal. An account that already has a name
 * (set via Profile, carried over from an older account, whatever) never
 * sees this again — there's nothing to ask it for.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Btn } from "../guest/components/primitives";
import { useLanguage } from "@/lib/i18n";

// Dismissing ("Skip for now") shouldn't nag again every single page load
// within the same visit, but SHOULD come back on a later visit if the
// account still has no name — sessionStorage (not localStorage) gives
// exactly that: silent for the rest of this tab's session, asked again
// next time if still unanswered.
const SKIPPED_KEY = "noqeev_name_prompt_skipped";

export function WelcomeNamePrompt({ user, updateProfile }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || user.name) { setOpen(false); return; }
    try {
      if (sessionStorage.getItem(SKIPPED_KEY)) return;
    } catch { /* best-effort */ }
    setOpen(true);
  }, [user]);

  const skip = () => {
    try { sessionStorage.setItem(SKIPPED_KEY, "1"); } catch { /* best-effort */ }
    setOpen(false);
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await updateProfile({ name: trimmed });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && skip()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("welcomeName.whatShouldWeCallYou")}</DialogTitle>
        </DialogHeader>
        <p className="m-0 -mt-2 text-[13px] text-muted-foreground">
          {t("welcomeName.explain")}
        </p>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("personalProfile.yourName")}
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") save(); }}
        />
        <DialogFooter>
          <Btn small variant="ghost" onClick={skip}>{t("welcomeName.skipForNow")}</Btn>
          <Btn small variant="gold" onClick={save} loading={saving} disabled={!name.trim()}>{t("common.save")}</Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
