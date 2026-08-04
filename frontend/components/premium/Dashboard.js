"use client";
/**
 * Dashboard.js — the app's home base once you're past the landing page.
 * Deliberately built from shadcn's own Button/Card primitives at their
 * default sizes, not the guest wizard's custom Btn — this is the one
 * screen meant to read as a plain, standard app dashboard rather than
 * carrying the wizard's own visual voice.
 */
import { motion } from "framer-motion";
import { FileText, ScanLine, ClipboardList, Hammer, LogIn, LogOut, X } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Logo from "./Logo";

const TILES = [
  {
    id: "resume", Icon: FileText, title: "Resume Studio",
    body: "Build a tailored, ATS-ready resume from a job posting, or start from one of the built-in templates.",
    cta: "Open",
  },
  {
    id: "scan", Icon: ScanLine, title: "CV Scan",
    body: "Upload a resume you already have — .pdf or .docx — and we'll pull it into the builder so you're editing, not retyping.",
    cta: "Upload a resume",
  },
  {
    id: "jobtracker", Icon: ClipboardList, title: "Job Tracker",
    body: "Keep track of where you've applied, your status at each one, and notes for the follow-up.",
    cta: "Open tracker",
  },
  {
    id: "artisans", Icon: Hammer, title: "Find an Artisan",
    body: "Browse local tradespeople, or list yourself. Same rules as everything else here — no account required.",
    cta: "Browse",
  },
];

export default function Dashboard({ onClose, onNavigate, onOpenLogin }) {
  const { user, loading, logout } = useAuth();

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col overflow-y-auto bg-background font-sans"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4 sm:px-8">
        <Logo size={22} />
        <div className="flex items-center gap-2">
          {!loading && (
            user ? (
              <Button variant="outline" size="sm" onClick={logout} className="gap-1.5">
                <LogOut className="size-3.5" />
                <span className="hidden sm:inline">{user.email}</span>
                <span className="sm:hidden">Sign out</span>
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={onOpenLogin} className="gap-1.5">
                <LogIn className="size-3.5" />
                Sign in
              </Button>
            )
          )}
          {onClose && (
            <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
              <X className="size-5" />
            </Button>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-8">
          <h1 className="m-0 text-2xl font-bold text-foreground sm:text-3xl">Dashboard</h1>
          <p className="m-0 mt-1.5 text-sm text-muted-foreground">
            {user ? `Signed in as ${user.email}.` : "Browsing anonymously — sign in any time to sync across devices."}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {TILES.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex size-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
                  <t.Icon className="size-[18px] text-primary" />
                </div>
                <div>
                  <h2 className="m-0 text-base font-semibold text-foreground">{t.title}</h2>
                  <p className="m-0 mt-1 text-[13px] leading-relaxed text-muted-foreground">{t.body}</p>
                </div>
                <Button onClick={() => onNavigate(t.id)} className="mt-1 w-full sm:w-auto">
                  {t.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
