"use client";
import Link from "next/link";
import Logo from "../Logo";

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/cookies", label: "Cookie Policy" },
  { href: "/refund-policy", label: "Refund Policy" },
];

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#faq", label: "FAQ" },
  { href: "#artisans", label: "Find an Artisan" },
];

export function Footer({ onOpen, onOpenDashboard }) {
  return (
    // Extra bottom clearance on narrow screens only — the floating 3D
    // intensity control sits fixed bottom-right and would otherwise overlap
    // the last line of copyright text once it wraps to two lines.
    <footer className="border-t border-border pt-12 pb-24 sm:pb-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 sm:px-8 lg:px-12">
        <div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-2.5">
            <Logo size={22} />
          </div>

          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="text-[13px] font-semibold text-muted-foreground hover:text-foreground">
                {l.label}
              </a>
            ))}
            {/* Same quiet secondary link FinalCTA.js already offers next to
                its own Dashboard button — the footer had the prop wired in
                from LandingPage.js but never actually rendered it. */}
            {onOpen && (
              <button
                onClick={onOpen}
                className="border-none bg-transparent p-0 text-[13px] font-semibold text-muted-foreground [-webkit-tap-highlight-color:transparent] hover:text-foreground"
              >
                Resume Studio
              </button>
            )}
            <button
              onClick={onOpenDashboard}
              className="rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-[13px] font-bold text-primary-text [-webkit-tap-highlight-color:transparent]"
            >
              Dashboard
            </button>
          </nav>
        </div>

        <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-6">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-[12px] font-semibold text-muted-foreground hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col-reverse items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="text-[11.5px] leading-relaxed text-muted-foreground/80">
            <p className="m-0">© {new Date().getFullYear()} Noqeev Technology · 305 Rideau St, Ottawa, ON, Canada</p>
            <p className="m-0">
              <a href="mailto:support@noqeev.com" className="hover:text-foreground">support@noqeev.com</a>
            </p>
          </div>
          <p className="m-0 text-[11.5px] text-muted-foreground/80">
            Anonymous by design.
          </p>
        </div>
      </div>
    </footer>
  );
}
