"use client";
/**
 * DidYouApplyModal.js — shown once per generated resume, right after the
 * first successful download. "Yes" collects the one thing we can't
 * reliably pull from the pasted job description ourselves (the company
 * name — titles/descriptions don't reliably say who's hiring) and saves
 * a real row to the Job Tracker, with the pasted job description kept as
 * its notes and this resume linked via resume_id. "No" just dismisses —
 * there's no wrong answer, this is a convenience, not a requirement.
 */
import { useEffect, useState } from "react";
import { Briefcase } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Field, Btn } from "./primitives";
import { useLanguage } from "@/lib/i18n";

export function DidYouApplyModal({ open, onClose, defaultRole, onConfirm }) {
  const { t } = useLanguage();
  const [asking, setAsking] = useState(true);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState(defaultRole || "");
  const [saving, setSaving] = useState(false);

  // defaultRole comes from info.title, which is almost always still empty
  // the moment this component first mounts (it's rendered unconditionally,
  // gated only by `open` — see GuestMode.js) — the useState initializer
  // above only ever sees that first, empty value. Re-seed it for real each
  // time the dialog actually opens, when info.title has had a chance to
  // be filled in.
  useEffect(() => {
    if (open) { setAsking(true); setCompany(""); setRole(defaultRole || ""); }
  }, [open, defaultRole]);

  const reset = () => { setAsking(true); setCompany(""); setRole(defaultRole || ""); setSaving(false); };
  const close = () => { reset(); onClose(); };

  const save = async () => {
    if (!company.trim() || !role.trim()) return;
    setSaving(true);
    try {
      await onConfirm({ company: company.trim(), role: role.trim() });
      close();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-sm">
        {asking ? (
          <>
            <DialogHeader>
              <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Briefcase className="size-5" />
              </div>
              <DialogTitle>{t("didYouApply.question")}</DialogTitle>
              <DialogDescription>
                {t("didYouApply.saveExplain")}
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Btn variant="ghost" className="flex-1" onClick={close}>{t("didYouApply.notYet")}</Btn>
              <Btn variant="gold" className="flex-1" onClick={() => setAsking(false)}>{t("didYouApply.yesApplied")}</Btn>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("didYouApply.addToTracker")}</DialogTitle>
              <DialogDescription>{t("didYouApply.justCompany")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-1">
              <Field label={t("didYouApply.companyLabel")} required value={company} onChange={setCompany} placeholder="Acme Corp" autoFocus />
              <Field label={t("didYouApply.roleLabel")} required value={role} onChange={setRole} placeholder="Software Engineer" />
            </div>
            <Btn variant="gold" onClick={save} disabled={!company.trim() || !role.trim()} loading={saving}>
              {t("didYouApply.saveToTracker")}
            </Btn>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
