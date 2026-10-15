"use client";
/**
 * DidYouApplyModal.js — shown once per generated resume, right after the
 * first successful download. The company name is resolved in the
 * background well before this ever opens (see GuestMode.js's
 * detectedCompany) — a real Jobs Board listing supplies it with
 * certainty, and a bare pasted description gets it AI-extracted while
 * someone's still building. "Yes" saves that instantly, no typing. Only
 * when detection genuinely has nothing (detectedCompany is null) does
 * this fall back to asking for the one field we can't get any other way.
 * Role never gets asked — it's already known (info.title). "No" just
 * dismisses — there's no wrong answer, this is a convenience, not a
 * requirement.
 */
import { useEffect, useState } from "react";
import { Briefcase } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Field, Btn } from "./primitives";
import { useLanguage } from "@/lib/i18n";

export function DidYouApplyModal({ open, onClose, defaultRole, detectedCompany, onConfirm }) {
  const { t } = useLanguage();
  const [asking, setAsking] = useState(true);
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setAsking(true); setCompany(""); }
  }, [open]);

  const reset = () => { setAsking(true); setCompany(""); setSaving(false); };
  const close = () => { reset(); onClose(); };

  const confirmApplied = async () => {
    // detectedCompany already resolved (Jobs Board listing, or the
    // AI guess that finished while this person kept building) — nothing
    // left to ask, save right now.
    if (detectedCompany) {
      setSaving(true);
      try {
        await onConfirm({ company: detectedCompany, role: defaultRole || "" });
        close();
      } finally {
        setSaving(false);
      }
      return;
    }
    // No real signal to go on (or detection just hasn't finished yet) —
    // the one-field fallback, not a dead end.
    setAsking(false);
  };

  const saveFallback = async () => {
    if (!company.trim()) return;
    setSaving(true);
    try {
      await onConfirm({ company: company.trim(), role: defaultRole || "" });
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
              <Btn variant="gold" className="flex-1" onClick={confirmApplied} loading={saving}>{t("didYouApply.yesApplied")}</Btn>
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
            </div>
            <Btn variant="gold" onClick={saveFallback} disabled={!company.trim()} loading={saving}>
              {t("didYouApply.saveToTracker")}
            </Btn>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
