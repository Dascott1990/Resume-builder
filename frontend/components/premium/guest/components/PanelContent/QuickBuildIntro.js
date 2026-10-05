"use client";
import { useState } from "react";
import { Zap, Mail, Check } from "lucide-react";
import { Field, Btn } from "../primitives";

// ── Quick Build's own compact step 1 ─────────────────────────────────────
// Only shown when quickMode is on (Dashboard's Quick Build chip AND a
// saved profile already exists — see GuestMode.js's hasUsableProfile gate).
// Everything the full InfoStep asks for — target title, location,
// background, past jobs, education, skills — is already sitting in the
// saved profile and carried through untouched; this screen only asks for
// the two things that genuinely can't come from either the profile or the
// job posting: the name on THIS resume and a phone number to reach them
// at. Title/location get silently overridden by whatever the AI finds in
// the pasted posting anyway (see resume.py's TITLE/LOCATION extraction
// rules) — asking again here would just be friction with no payoff.
export function QuickBuildIntro({ info, set, accountEmail, isPhone, onNext }) {
  const [emailChoice, setEmailChoice] = useState(() => (
    !info.email || info.email === accountEmail ? "account" : "custom"
  ));

  const chooseAccount = () => {
    setEmailChoice("account");
    if (accountEmail) set("email")(accountEmail);
  };
  const chooseCustom = () => setEmailChoice("custom");

  const ready = info.name.trim() && info.phone.trim() && (emailChoice === "custom" ? info.email.trim() : true);

  return (
    <>
      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-primary/25 bg-primary/10 px-3.5 py-3">
        <Zap className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="m-0 text-[12.5px] leading-relaxed text-foreground">
          Quick Build reuses your saved background, experience, education and skills from your last resume — paste the job posting next and the title/location come straight from it.
        </p>
      </div>

      <Field label="FULL NAME" required value={info.name} onChange={set("name")} placeholder="Jane Smith" />
      <Field label="PHONE" required value={info.phone} onChange={set("phone")} placeholder="(416) 555-0100" />

      <div className="mb-3.5">
        <label className="mb-1.5 block text-[13.5px] font-bold tracking-wide text-foreground">EMAIL</label>
        <div className={`grid gap-2 ${isPhone ? "grid-cols-1" : "grid-cols-2"}`}>
          <button
            type="button"
            onClick={chooseAccount}
            disabled={!accountEmail}
            className={`flex items-center gap-2 rounded-[10px] border px-3 py-3 text-left [-webkit-tap-highlight-color:transparent] disabled:opacity-40 ${
              emailChoice === "account" ? "border-primary/50 bg-primary/5" : "border-border bg-card"
            }`}
          >
            <Mail className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-bold text-foreground">Use my account email</span>
              <span className="block truncate text-[11px] text-muted-foreground">{accountEmail || "No account email"}</span>
            </span>
            {emailChoice === "account" && <Check className="size-3.5 shrink-0 text-primary" />}
          </button>
          <button
            type="button"
            onClick={chooseCustom}
            className={`flex items-center gap-2 rounded-[10px] border px-3 py-3 text-left [-webkit-tap-highlight-color:transparent] ${
              emailChoice === "custom" ? "border-primary/50 bg-primary/5" : "border-border bg-card"
            }`}
          >
            <Mail className="size-4 shrink-0 text-muted-foreground" />
            <span className="block text-[12.5px] font-bold text-foreground">Use a different email</span>
            {emailChoice === "custom" && <Check className="ml-auto size-3.5 shrink-0 text-primary" />}
          </button>
        </div>
        {emailChoice === "custom" && (
          <div className="mt-2.5">
            <Field label="" value={info.email} onChange={set("email")} placeholder="jane@email.com" />
          </div>
        )}
      </div>

      <Btn icon="ChevronRight" onClick={onNext} disabled={!ready}>
        Next
      </Btn>
    </>
  );
}
