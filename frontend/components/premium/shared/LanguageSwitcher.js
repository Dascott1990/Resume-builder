"use client";
/**
 * LanguageSwitcher.js — the manual override on top of lib/i18n.js's own
 * auto-detection (saved choice > visitor's country > browser language >
 * English). Flag-only trigger, not flag+label — stays compact enough for
 * the Navbar's already-tight mobile header without needing its own
 * breakpoint-specific hiding rule.
 */
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { LANGUAGES, useLanguage } from "@/lib/i18n";

export function LanguageSwitcher({ className }) {
  const { lang, setLang } = useLanguage();
  const current = LANGUAGES.find((l) => l.id === lang) || LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Choose language"
          className={`flex size-10 items-center justify-center rounded-full border border-border bg-card text-base [-webkit-tap-highlight-color:transparent] ${className || ""}`}
        >
          {current.flag}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGES.map((l) => (
          <DropdownMenuItem key={l.id} onSelect={() => setLang(l.id)}>
            <span className="mr-2">{l.flag}</span>
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
