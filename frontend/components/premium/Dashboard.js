"use client";
/**
 * Dashboard.js — the app's real home base, not a grid of tiles pretending
 * to be one. Modeled on how banking apps and job boards actually structure
 * a home screen: one dominant primary action (the "balance card" — here,
 * building a resume), a quick-glance stats row, secondary quick actions,
 * and a recent-activity feed — not four equally-weighted cards with no
 * hierarchy between them.
 *
 * Desktop gets a persistent left rail (the way every real SaaS dashboard —
 * Stripe, Notion, a bank's own web app — keeps navigation always visible
 * instead of behind a menu). Mobile gets a fixed bottom nav, the same
 * shared component and visual language Artisans.js already uses, so the
 * whole app's navigation vocabulary stays one thing, not several.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Home, FileText, ScanLine, ClipboardList, Hammer, LogIn, LogOut,
  ArrowRight, ChevronRight, CalendarCheck, X, Clock,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { useViewport } from "@/lib/useViewport";
import { tapFeedback } from "@/lib/haptics";
import { apiRequest } from "./shared/api";
import { apiListSaved } from "./guest/api";
import { BottomNav } from "./shared/BottomNav";
import { IconTile } from "./shared/IconTile";
import { ThemeToggle } from "./shared/ThemeToggle";
import { Skeleton } from "@/components/ui/skeleton";
import Logo from "./Logo";

const NAV_ITEMS = [
  { id: "home", Icon: Home, label: "Home" },
  { id: "resume", Icon: FileText, label: "Resume" },
  { id: "scan", Icon: ScanLine, label: "Scan" },
  { id: "jobtracker", Icon: ClipboardList, label: "Tracker" },
  { id: "artisans", Icon: Hammer, label: "Artisans" },
];

const STATUS_META = {
  applied: { label: "Applied", className: "text-muted-foreground" },
  interview: { label: "Interview", className: "text-primary" },
  offer: { label: "Offer", className: "text-emerald-500" },
  rejected: { label: "Rejected", className: "text-destructive" },
};

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still up?";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function StatCard({ label, value, Icon, loading }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <Icon className="size-4 text-primary" />
      {loading ? <Skeleton className="h-7 w-10" /> : <span className="text-2xl font-bold text-foreground">{value}</span>}
      <span className="text-[11.5px] leading-tight text-muted-foreground">{label}</span>
    </div>
  );
}

function ActionTile({ Icon, label, sub, onClick }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="flex flex-col items-start gap-2.5 rounded-2xl border border-border bg-card p-4 text-left [-webkit-tap-highlight-color:transparent]"
    >
      <IconTile icon={Icon} size="sm" />
      <div>
        <p className="m-0 text-[13.5px] font-bold text-foreground">{label}</p>
        <p className="m-0 mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{sub}</p>
      </div>
    </motion.button>
  );
}

function SectionHeader({ children, onViewAll }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <span className="font-mono text-[10.5px] font-bold tracking-[0.1em] text-muted-foreground/60 uppercase">{children}</span>
      {onViewAll && (
        <button onClick={onViewAll} className="flex items-center gap-0.5 border-none bg-transparent p-0 text-[12px] font-bold text-primary">
          View all <ChevronRight className="size-3" />
        </button>
      )}
    </div>
  );
}

function DashboardContent({ user, statsLoading, savedResumes, applications, go }) {
  const interviews = applications.filter((a) => a.status === "interview").length;
  const recentResumes = savedResumes.slice(0, 3);
  const recentApps = applications.slice(0, 3);
  const followupCount = applications.filter((a) => a.needs_followup).length;

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-8 sm:py-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-6">
        <p className="m-0 text-[13px] font-semibold text-muted-foreground">
          {greeting()}{user ? `, ${user.email.split("@")[0]}` : ""}
        </p>
        <h1 className="m-0 text-[26px] font-bold text-foreground">Let's get you hired.</h1>
      </motion.div>

      {/* Secondary, dismissable-by-nature (it only appears when true) nudge —
          sits above the one dominant action below, not competing with it,
          since there's nothing to build here, just a suggestion to check in
          on applications that have gone quiet for a week. */}
      {followupCount > 0 && (
        <motion.button
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => go("jobtracker")}
          className="mb-3.5 flex w-full items-center gap-2.5 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-left [-webkit-tap-highlight-color:transparent]"
        >
          <Clock className="size-4 shrink-0 text-primary" />
          <span className="flex-1 text-[13px] font-semibold text-foreground">
            {followupCount} application{followupCount === 1 ? "" : "s"} could use a follow-up
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
        </motion.button>
      )}

      {/* The one dominant action — everything else on this screen supports it */}
      <motion.button
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => go("resume")}
        className="mb-5 flex w-full items-center justify-between gap-4 rounded-3xl border-none bg-primary p-6 text-left [-webkit-tap-highlight-color:transparent]"
      >
        <div className="min-w-0">
          <p className="m-0 text-[11px] font-bold tracking-[0.1em] text-primary-foreground/70 uppercase">Main product</p>
          <p className="m-0 mt-1 text-xl font-bold text-primary-foreground">Build a resume</p>
          <p className="m-0 mt-1 text-[13px] text-primary-foreground/80">Tailored to any job posting in under 2 minutes</p>
        </div>
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15">
          <ArrowRight className="size-5 text-primary-foreground" />
        </div>
      </motion.button>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }}
        className="mb-6 grid grid-cols-3 gap-3">
        <StatCard label="Saved resumes" value={savedResumes.length} Icon={FileText} loading={statsLoading} />
        <StatCard label="Applications" value={applications.length} Icon={ClipboardList} loading={statsLoading} />
        <StatCard label="Interviews" value={interviews} Icon={CalendarCheck} loading={statsLoading} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.15 }} className="mb-6">
        <SectionHeader>Quick actions</SectionHeader>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <ActionTile Icon={ScanLine} label="CV Scan" sub="Import an existing resume" onClick={() => go("scan")} />
          <ActionTile Icon={ClipboardList} label="Job Tracker" sub="Track your applications" onClick={() => go("jobtracker")} />
          <ActionTile Icon={Hammer} label="Find an Artisan" sub="Browse local tradespeople" onClick={() => go("artisans")} />
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.2 }} className="mb-6">
        <SectionHeader onViewAll={() => go("resume")}>Recent resumes</SectionHeader>
        {statsLoading ? (
          <div className="grid gap-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : recentResumes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-4 text-center">
            <p className="m-0 text-[12.5px] text-muted-foreground">Nothing saved yet — build your first resume to see it here.</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {recentResumes.map((r) => (
              <button key={r.id} onClick={() => go("resume")}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left [-webkit-tap-highlight-color:transparent]">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10">
                  <FileText className="size-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-[13px] font-bold text-foreground">{r.name || "Untitled"}</p>
                  <p className="m-0 truncate text-[11.5px] text-muted-foreground">{r.role || "—"}</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
              </button>
            ))}
          </div>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.25 }}>
        <SectionHeader onViewAll={() => go("jobtracker")}>Recent applications</SectionHeader>
        {statsLoading ? (
          <div className="grid gap-2">
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : recentApps.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-4 text-center">
            <p className="m-0 text-[12.5px] text-muted-foreground">No applications tracked yet.</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {recentApps.map((a) => {
              const meta = STATUS_META[a.status] || STATUS_META.applied;
              return (
                <button key={a.id} onClick={() => go("jobtracker")}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left [-webkit-tap-highlight-color:transparent]">
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[13px] font-bold text-foreground">{a.role}</p>
                    <p className="m-0 truncate text-[11.5px] text-muted-foreground">{a.company}</p>
                  </div>
                  <span className={`shrink-0 text-[11.5px] font-bold ${meta.className}`}>{meta.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function Dashboard({ onClose, onNavigate, onOpenLogin }) {
  const { user, loading: authLoading, logout } = useAuth();
  const { isDesktop } = useViewport();
  const [savedResumes, setSavedResumes] = useState([]);
  const [applications, setApplications] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    // Signing out happens right on this screen (see the Sign out button
    // below) — without keying this on the account, the dashboard kept
    // showing the outgoing user's recent resumes and applications until
    // the next full remount, even though the header had already flipped
    // to "signed out."
    if (authLoading) return;
    setStatsLoading(true);
    setSavedResumes([]);
    setApplications([]);
    Promise.all([
      apiListSaved(),
      apiRequest("/api/v1/applications").catch(() => []),
    ]).then(([resumes, apps]) => {
      setSavedResumes(resumes);
      setApplications(apps);
    }).finally(() => setStatsLoading(false));
  }, [authLoading, user?.id]);

  const go = (id) => {
    tapFeedback();
    if (id === "home") return;
    onNavigate(id);
  };

  const contentProps = { user, statsLoading, savedResumes, applications, go };

  if (isDesktop) {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 flex bg-background font-sans"
      >
        <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
          <div className="p-5" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}><Logo size={22} /></div>
          <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Dashboard">
            {NAV_ITEMS.map((item) => {
              const active = item.id === "home";
              return (
                <button
                  key={item.id}
                  onClick={() => go(item.id)}
                  className={`flex items-center gap-2.5 rounded-xl border-none px-3 py-2.5 text-left text-[13.5px] font-bold [-webkit-tap-highlight-color:transparent] ${
                    active ? "bg-primary/10 text-primary" : "bg-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <item.Icon className="size-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="border-t border-border p-3">
            <ThemeToggle />
            {!authLoading && (
              user ? (
                <button onClick={logout} className="flex w-full items-center gap-2 rounded-xl border-none bg-transparent px-3 py-2.5 text-left text-[13px] font-semibold text-muted-foreground [-webkit-tap-highlight-color:transparent]">
                  <LogOut className="size-3.5" />
                  <span className="min-w-0 flex-1 truncate">{user.email}</span>
                </button>
              ) : (
                <button onClick={onOpenLogin} className="flex w-full items-center gap-2 rounded-xl border border-border bg-transparent px-3 py-2.5 text-left text-[13px] font-bold text-foreground [-webkit-tap-highlight-color:transparent]">
                  <LogIn className="size-3.5" />
                  Sign in
                </button>
              )
            )}
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          {onClose && (
            <div className="flex justify-end p-4" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
              <button onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-full border border-border bg-muted text-foreground">
                <X className="size-4" />
              </button>
            </div>
          )}
          <DashboardContent {...contentProps} />
        </main>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-background font-sans"
    >
      {/* Standalone PWA on iOS puts this right under the status bar/notch
          otherwise — a plain py-4 has no idea that space exists. */}
      <header
        className="flex shrink-0 items-center justify-between px-5 pb-4"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <Logo size={22} />
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          {!authLoading && (
            user ? (
              <button onClick={logout} aria-label="Sign out" className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-muted px-3 text-[12px] font-bold text-foreground">
                <LogOut className="size-3.5" />
              </button>
            ) : (
              <button onClick={onOpenLogin} className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-muted px-3 text-[12px] font-bold text-foreground">
                <LogIn className="size-3.5" />
                Sign in
              </button>
            )
          )}
          {onClose && (
            <button onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-full border border-border bg-muted text-foreground">
              <X className="size-[17px]" />
            </button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto" style={{ paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>
        <DashboardContent {...contentProps} />
      </div>

      <BottomNav items={NAV_ITEMS} active="home" onChange={go} />
    </motion.div>
  );
}
