"use client";
/**
 * EmailHrModal.js — the reviewable draft behind PackagePreviewModal's
 * "Email HR" button. Never sends anything itself: "Send" just builds a
 * mailto: link and hands off to the user's own email app, so the message
 * genuinely comes from their real address (not noreply@noqeev.com) and
 * nothing goes out until they've actually looked at it and hit send
 * again in their own client — same "never submit without a human in the
 * loop" posture Apply-with-AI already uses elsewhere in this app.
 *
 * `to` pre-fills from GuestMode.js's hrEmail/hrEmailConfidence (found
 * directly in the posting, or an AI guess against a REAL known company
 * domain — never a fully invented address) but is always a plain,
 * editable field: a wrong or missing guess is just an empty box to fill
 * in by hand, not a dead end.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Field, Btn } from "./primitives";
import { useLanguage } from "@/lib/i18n";

export function EmailHrModal({ open, onClose, hrEmail, hrEmailConfidence, coverLetter, info }) {
  const { t } = useLanguage();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // Re-seeded every time the modal actually opens (not a useState
  // initializer) — hrEmail/coverLetter are very likely still empty the
  // first time this component ever mounts (rendered unconditionally,
  // gated only by `open`, same pattern DidYouApplyModal.js already uses).
  useEffect(() => {
    if (!open) return;
    setTo(hrEmail || "");
    setSubject(t("emailHr.subjectTemplate", { role: info?.title || "", name: info?.name || "" }));
    setBody(coverLetter || "");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = () => {
    if (!to.trim()) return;
    const mailto = `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("emailHr.title")}</DialogTitle>
          <DialogDescription>{t("emailHr.attachReminder")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-0.5">
          <Field label={t("emailHr.toLabel")} required value={to} onChange={setTo} placeholder="hr@company.com" autoComplete="off" />
          <p className="m-0 -mt-2.5 mb-3 text-[11.5px] text-muted-foreground">
            {!hrEmail
              ? t("emailHr.noEmailFound")
              : hrEmailConfidence === "found_in_posting"
                ? t("emailHr.foundInPosting")
                : t("emailHr.aiGuessedVerify")}
          </p>
          <Field label={t("emailHr.subjectLabel")} value={subject} onChange={setSubject} />
          <Field label={t("emailHr.bodyLabel")} value={body} onChange={setBody} multiline rows={8} />
        </div>
        <Btn variant="gold" onClick={send} disabled={!to.trim()}>{t("emailHr.sendButton")}</Btn>
        <p className="m-0 mt-2 text-center text-[11px] text-muted-foreground/70">{t("emailHr.ifBlankCopyManually")}</p>
      </DialogContent>
    </Dialog>
  );
}
