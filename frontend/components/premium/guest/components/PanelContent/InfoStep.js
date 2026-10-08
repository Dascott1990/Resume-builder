"use client";
import { User, X } from "lucide-react";
import { Field, Btn } from "../primitives";
import { useLanguage } from "@/lib/i18n";

// ── Step 1 — Your Info ──────────────────────────────────────────────────────
export function InfoStep({
  info, set, infoFromProfile, useDifferentInfo, dismissInfoFromProfile,
  isPhone, ready1, onNext,
}) {
  const { t } = useLanguage();
  return (
    <>
      {infoFromProfile && (
        <div className="mb-3.5 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2.5">
          <User className="size-[13px] text-primary" />
          <span className="min-w-[160px] flex-1 text-xs text-muted-foreground">
            {t("infoStep.filledFromProfile")}
          </span>
          <button onClick={useDifferentInfo} className="border-none bg-transparent p-0 text-[11.5px] font-bold whitespace-nowrap text-primary">
            {t("infoStep.useDifferentInfo")}
          </button>
          <button onClick={dismissInfoFromProfile} aria-label={t("guestMode.dismiss")} className="border-none bg-transparent p-0.5 text-muted-foreground/60">
            <X className="size-[13px]" />
          </button>
        </div>
      )}
      <div className={`grid gap-x-2 ${isPhone ? "grid-cols-1" : "grid-cols-2"}`}>
        <div className="col-span-full">
          <Field label={t("infoStep.fullName")} required value={info.name} onChange={set("name")} placeholder="Jane Smith" />
        </div>
        <Field label={t("infoStep.targetJobTitle")} required value={info.title} onChange={set("title")} placeholder="Sales Associate" />
        <Field label={t("infoStep.location")} required hint={t("infoStep.locationHint")} hintOnFocus value={info.location} onChange={set("location")} placeholder="Toronto, ON" />
        <Field label={t("auth.email")} value={info.email} onChange={set("email")} placeholder="jane@email.com" />
        <Field label={t("infoStep.phone")} value={info.phone} onChange={set("phone")} placeholder="(416) 555-0100" />
      </div>

      <Field label={t("infoStep.background")} hint={t("infoStep.backgroundHint")} hintOnFocus
        value={info.background} onChange={set("background")} multiline rows={3}
        placeholder="e.g. I worked at Farm Boy for 4 years stocking shelves, helping customers, and training new staff. Bilingual: English and French." />

      <Field label={t("infoStep.pastJobs")} hint={t("infoStep.pastJobsHint")} hintOnFocus
        value={info.experience} onChange={set("experience")} multiline rows={2}
        placeholder={"Grocery Clerk | Farm Boy | 2021–2025\nCashier | Loblaws | 2019–2021"} />

      <Field label={t("infoStep.education")} hint={t("infoStep.educationHint")} hintOnFocus
        value={info.education} onChange={set("education")} multiline rows={2}
        placeholder="Business Admin | Algonquin College | 2023" />

      <Field label={t("infoStep.skills")} hint={t("infoStep.skillsHint")} hintOnFocus
        value={info.skills} onChange={set("skills")} multiline rows={2}
        placeholder="Customer service, bilingual English and French, inventory, MS Office" />

      <Btn icon="ChevronRight" onClick={onNext} disabled={!ready1}>
        {t("common.next")}
      </Btn>
    </>
  );
}
