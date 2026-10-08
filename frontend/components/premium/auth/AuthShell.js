"use client";
/**
 * AuthShell.js — the one chrome every auth-adjacent screen (Login, Signup,
 * ForgotPassword, verify-email, reset-password) renders through. Previously
 * each screen hand-duplicated its own header + background + a per-screen
 * decorative IconTile (LogIn/UserPlus/KeyRound/Mail/CheckCircle2/XCircle)
 * floating above its own heading — five near-identical copies free to drift,
 * same class of problem as blockBuilders.js's/wrap_email_html's own
 * file-level comments on this. Redesigned per explicit request: just the
 * brand lockup at the top (Logo already renders icon + "NOQEEV" by default,
 * nothing extra needed there) and the actual form content sitting inside a
 * real card — not floating straight on the page background — so every auth
 * screen reads as one consistent, minimal container instead of a bespoke
 * hero each time.
 */
import { useEffect } from "react";
import { X } from "lucide-react";
import Logo from "../Logo";
import { useLanguage } from "@/lib/i18n";

export function AuthShell({ onClose, children }) {
  const { t } = useLanguage();
  // Only Login/Signup/ForgotPassword pass onClose — they're the real
  // dismissible overlay case (rendered absolute/inset-0 over existing
  // page content, see Login.js). verify-email/reset-password mount this
  // same shell as their own standalone route with nothing behind it, so
  // dialog semantics/Escape would be wrong there — there's no "outside"
  // to return focus/visibility to.
  useEffect(() => {
    if (!onClose) return;
    const onKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="relative flex min-h-[100dvh] w-full flex-col overflow-y-auto bg-background font-sans"
      role={onClose ? "dialog" : undefined}
      aria-modal={onClose ? "true" : undefined}
    >
      {/* A static (not pulsing) wash — brand warmth without the busyness an
          infinite animation adds to what's meant to read as minimal. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[-14%] left-1/2 size-[440px] -translate-x-1/2 opacity-[0.14]"
        style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }}
      />

      <div
        className="relative flex shrink-0 items-center justify-between px-5 pb-4"
        style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}
      >
        <Logo size={24} />
        {onClose && (
          <button
            onClick={onClose} aria-label={t("common.close")}
            className="flex size-9 items-center justify-center rounded-full border border-border bg-muted text-foreground [-webkit-tap-highlight-color:transparent]"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-8">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-7">
          {children}
        </div>
      </div>
    </div>
  );
}
