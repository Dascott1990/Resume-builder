"use client";
import Logo from "../Logo";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#faq", label: "FAQ" },
  { href: "#artisans", label: "Find an Artisan" },
];

export function Footer({ onOpen }) {
  return (
    // Extra bottom clearance on narrow screens only — the floating 3D
    // intensity control sits fixed bottom-right and would otherwise overlap
    // the last line of copyright text once it wraps to two lines.
    <footer className="border-t border-border pt-12 pb-24 sm:pb-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 sm:px-8 lg:px-12">
        <div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-2.5">
            <Logo size={22} />
            <p className="m-0 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
              Every career deserves a second chance. No account, no login,
              no trace — just a resume that gets you in the door.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="text-[13px] font-semibold text-muted-foreground hover:text-foreground">
                {l.label}
              </a>
            ))}
            <button
              onClick={onOpen}
              className="rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-[13px] font-bold text-primary [-webkit-tap-highlight-color:transparent]"
            >
              Open Resume Studio
            </button>
          </nav>
        </div>

        <div className="flex flex-col-reverse items-start justify-between gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="m-0 text-[11.5px] text-muted-foreground/60">
            © {new Date().getFullYear()} Noviq. Built for people rebuilding their careers.
          </p>
          <p className="m-0 text-[11.5px] text-muted-foreground/60">
            Anonymous by design.
          </p>
        </div>
      </div>
    </footer>
  );
}
