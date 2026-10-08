"use client";
import { Mail, Globe, AlertCircle, ExternalLink } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/lib/i18n";

// ── Apply banner ─────────────────────────────────────────────────────────────
// Bold, unmissable, one clear instruction — the "how do I actually apply" answer,
// grounded in what the AI found in the job description (never invented).
export function ApplyBanner({ application }) {
  const { t } = useLanguage();
  const method = application?.method || "unclear";
  const value  = application?.value || null;
  const text   = application?.instructions || t("applyBanner.noDirectMethod");

  const cfg = {
    email:   { Icon: Mail,  label: t("applyBanner.applyByEmail"),   cta: value ? t("applyBanner.emailValue", { value }) : null,
               href: value ? `mailto:${value}` : null },
    website: { Icon: Globe, label: t("applyBanner.applyOnTheirSite"), cta: value ? t("applyBanner.openApplicationPage") : null,
               href: value || null },
    unclear: { Icon: AlertCircle, label: t("applyBanner.howToApply"), cta: null, href: null },
  }[method] || { Icon: AlertCircle, label: t("applyBanner.howToApply"), cta: null, href: null };

  return (
    <Alert className="border-primary/40 bg-primary/[0.08] py-3">
      <cfg.Icon className="size-4 text-primary" />
      <div className="col-start-2">
        <AlertTitle className="text-[12.5px] font-extrabold tracking-wide text-primary uppercase">
          {cfg.label}
        </AlertTitle>
        <AlertDescription className="mt-1.5 text-[14.5px] leading-relaxed font-bold text-foreground">
          {text}
        </AlertDescription>
        {cfg.href && (
          <a
            href={cfg.href}
            target={method === "website" ? "_blank" : undefined}
            rel="noreferrer"
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13.5px] font-bold text-primary-foreground no-underline"
          >
            {method === "website" ? <ExternalLink className="size-3.5" /> : <Mail className="size-3.5" />}
            {cfg.cta}
          </a>
        )}
      </div>
    </Alert>
  );
}
