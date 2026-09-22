import Link from "next/link";
import Logo from "@/components/premium/Logo";

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/cookies", label: "Cookie Policy" },
  { href: "/refund-policy", label: "Refund Policy" },
];

export function LegalPageLayout({ title, updated, children, activeHref }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center [-webkit-tap-highlight-color:transparent]">
            <Logo size={22} />
          </Link>
          <Link href="/" className="text-[13px] font-semibold text-muted-foreground hover:text-foreground">
            Back to Noqeev
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <p className="m-0 font-mono text-[11px] font-bold tracking-[0.18em] text-primary-text uppercase">Legal</p>
        <h1 className="m-0 mt-2 text-[clamp(1.6rem,4vw,2.1rem)] font-bold text-foreground">{title}</h1>
        <p className="m-0 mt-2 text-[13px] text-muted-foreground">Last updated {updated}</p>

        {/* max-w-[68ch] keeps line length readable regardless of the
            column's own max-w-3xl — a legal document is read top to
            bottom, not scanned, so comfortable line length matters more
            here than filling the available width. */}
        <article className="mt-8 max-w-[68ch] text-[14.5px] leading-relaxed text-foreground [&_h2]:m-0 [&_h2]:mt-8 [&_h2]:mb-2.5 [&_h2]:text-[16.5px] [&_h2]:font-bold [&_h2]:text-foreground [&_h3]:m-0 [&_h3]:mt-5 [&_h3]:mb-1.5 [&_h3]:text-[14.5px] [&_h3]:font-bold [&_h3]:text-foreground [&_p]:m-0 [&_p]:mt-2.5 [&_p]:text-muted-foreground [&_ul]:m-0 [&_ul]:mt-2.5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1 [&_li]:text-muted-foreground [&_strong]:text-foreground [&_a]:text-primary-text [&_a]:underline [&_a]:underline-offset-2">
          {children}
        </article>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-5 gap-y-2 px-6 py-8 text-[12.5px] text-muted-foreground">
          {LEGAL_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={l.href === activeHref ? "font-bold text-foreground" : "hover:text-foreground"}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
