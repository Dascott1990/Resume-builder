"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LayoutDashboard } from "lucide-react";
import Logo from "../Logo";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#faq", label: "FAQ" },
  { href: "#artisans", label: "Find an Artisan" },
];

export function Navbar({ onOpenDashboard }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -72, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-50"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div
        className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-5 transition-[background-color,border-color,backdrop-filter] duration-300 sm:px-8 lg:px-12"
        style={{
          background: scrolled ? "color-mix(in oklch, var(--background) 72%, transparent)" : "transparent",
          backdropFilter: scrolled ? "blur(18px) saturate(160%)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(18px) saturate(160%)" : "none",
          borderBottom: scrolled ? "1px solid var(--border)" : "1px solid transparent",
        }}
      >
        <a href="#top" aria-label="Noviq — back to top" className="shrink-0">
          <Logo size={20} />
        </a>

        <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[13.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Dashboard, not the resume builder directly, is the primary CTA —
            it's the hub the builder, CV scan, job tracker, and artisan
            directory all live inside, so one tap from anywhere always
            lands somewhere useful instead of one specific tool. */}
        <div className="flex shrink-0 items-center gap-2">
          <motion.button
            onClick={onOpenDashboard}
            whileTap={{ scale: 0.95 }}
            className="hidden min-h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-[13px] font-bold text-primary-foreground sm:flex"
          >
            <LayoutDashboard className="size-3.5" />
            Dashboard
          </motion.button>
          <motion.button
            onClick={onOpenDashboard}
            whileTap={{ scale: 0.9 }}
            aria-label="Dashboard"
            className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground sm:hidden"
          >
            <LayoutDashboard className="size-4" />
          </motion.button>

          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground lg:hidden"
          >
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            aria-label="Mobile"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-b border-border bg-background/95 backdrop-blur-xl lg:hidden"
          >
            <div className="flex flex-col gap-1 px-5 py-3">
              {LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={(e) => {
                    // A plain anchor jump racing the menu's own closing
                    // animation (its height going from "auto" to 0 the same
                    // tick) landed at scrollY 0 instead of the section —
                    // the collapse was still shifting layout underneath the
                    // browser's native scroll calculation. Closing first,
                    // then scrolling on the next frame once that shift has
                    // already happened, sidesteps the race entirely.
                    e.preventDefault();
                    setMenuOpen(false);
                    requestAnimationFrame(() => {
                      document.getElementById(l.href.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
                    });
                  }}
                  className="rounded-lg px-3 py-3 text-[15px] font-semibold text-foreground active:bg-muted"
                >
                  {l.label}
                </a>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
