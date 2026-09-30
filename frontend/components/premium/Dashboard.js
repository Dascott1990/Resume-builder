"use client";
/**
 * Dashboard.js — the app's real home base. Hierarchy follows the approved
 * design reference exactly (see the "Dashboard redesign: desktop view"
 * artifact this was built against): greeting → one unified job-search
 * stats card → Recommended for you (real jobs, never empty — this is
 * public marketplace data, not scoped to whether THIS user has done
 * anything yet) → your resume (a compact secondary card once the primary
 * CTA has been acted on) → Tools (compact chips, not big tiles) → recent
 * activity. Every section carries its own small uppercase label so the
 * grouping is never ambiguous, and nothing after Recommended-for-you can
 * ever leave the screen looking empty, even for a brand-new account with
 * zero resumes and zero applications.
 *
 * Nav is four items everywhere — Home, Jobs, Applications, Profile — the
 * same set on the desktop rail and the mobile bottom bar.
 *
 * Every icon tile shares ONE neutral system-accent treatment (see ArtTile)
 * instead of each having its own colored gradient. Semantic color
 * (success/destructive) is untouched — it means something specific and
 * stays separate from decoration.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowRight, ChevronRight, X, Clock, MapPin, ExternalLink,
  Inbox, Check, AlertTriangle, CheckCircle2,
  MoreVertical, Trash2, StickyNote,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Btn } from "./guest/components/primitives";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { tintFor, initialsOf } from "./shared/artisanDisplay";
import Emoji3D from "./shared/Emoji3D";
import { useAuth } from "@/lib/useAuth";
import { useViewport } from "@/lib/useViewport";
import { useUnreadNotifications } from "@/lib/useUnreadNotifications";
import { tapFeedback } from "@/lib/haptics";
import { apiRequest } from "./shared/api";
import { apiListSaved, apiDelete } from "./guest/api";
import { BottomNav } from "./shared/BottomNav";
import { ThemeToggle } from "./shared/ThemeToggle";
import { NavRail } from "./shared/NavRail";
import { QUICK_ACTION_ART } from "./shared/quickActionArt";
import { DASHBOARD_ART } from "./shared/dashboardArt";
import { SparkleBackground } from "./shared/SparkleBackground";
import { Skeleton } from "@/components/ui/skeleton";
import Logo from "./Logo";

// One neutral system-accent tile behind every illustrated icon on this
// screen — deliberately ignores each art entry's own `bg` (a colored
// gradient per icon, the "rainbow tiles" the redesign moved away from).
function ArtTile({ art, size = 32, iconSize }) {
  const { Svg } = art;
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[28%] bg-primary/10"
      style={{ width: size, height: size }}
    >
      <Svg size={iconSize || Math.round(size * 0.56)} />
    </span>
  );
}

function navArt(art) {
  return function NavArtIcon() {
    return <ArtTile art={art} size={26} iconSize={15} />;
  };
}

const MOBILE_NAV_ITEMS = [
  { id: "home", Icon: navArt(DASHBOARD_ART.home), label: "Home" },
  { id: "apply", Icon: navArt(QUICK_ACTION_ART.apply), label: "Jobs" },
  { id: "jobtracker", Icon: navArt(QUICK_ACTION_ART.tracker), label: "Applications" },
  { id: "profile", Icon: navArt(DASHBOARD_ART.profile), label: "Profile" },
];

const RECOMMENDED_CACHE_KEY = "noqeev_cached_recommended_jobs";

const STATUS_META = {
  applied: { label: "Applied", className: "text-muted-foreground" },
  interview: { label: "Interview", className: "text-primary" },
  offer: { label: "Offer", className: "text-success" },
  rejected: { label: "Rejected", className: "text-destructive" },
};
const STATUS_ORDER = ["applied", "interview", "offer", "rejected"];

function timeAgo(iso) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function daysSinceApplied(dateStr) {
  if (!dateStr) return null;
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (Number.isNaN(days)) return null;
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still up?";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// The one unified "Your job search" card — Applied/Responses/Interviews/
// Offers, all four real counts derived from the same applications list,
// plus one link into the full tracker. Replaces three separate stat
// cards (Saved resumes/Applications/Interviews) that didn't read as one
// story — this is the actual funnel, so it reads as one, matching the
// approved design reference.
function JobSearchStatsCard({ applications, loading, onViewAll }) {
  const applied = applications.length;
  const responses = applications.filter((a) => a.status !== "applied").length;
  const interviews = applications.filter((a) => a.status === "interview").length;
  const offers = applications.filter((a) => a.status === "offer").length;

  return (
    <div className="glass-surface mb-5 rounded-2xl p-5">
      <p className="m-0 mb-4 font-mono text-[10px] font-bold tracking-[0.1em] text-muted-foreground/60 uppercase">Your job search</p>
      <div className="mb-4 grid grid-cols-4 gap-2.5">
        {loading ? (
          <>
            <Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" />
          </>
        ) : (
          <>
            <div><span className="block text-[24px] font-bold text-foreground">{applied}</span><span className="text-[11px] text-muted-foreground">Applied</span></div>
            <div><span className="block text-[24px] font-bold text-foreground">{responses}</span><span className="text-[11px] text-muted-foreground">Responses</span></div>
            <div><span className="block text-[24px] font-bold text-success">{interviews}</span><span className="text-[11px] text-muted-foreground">Interviews</span></div>
            <div><span className="block text-[24px] font-bold text-success">{offers}</span><span className="text-[11px] text-muted-foreground">Offers</span></div>
          </>
        )}
      </div>
      <button onClick={onViewAll} className="flex items-center gap-1 border-none bg-transparent p-0 text-[13px] font-bold text-primary [-webkit-tap-highlight-color:transparent]">
        View applications <ArrowRight className="size-3.5" />
      </button>
    </div>
  );
}

// Real listings from the verified jobs pipeline (see JobsBoard.js /
// backend/app/jobs_ingest/) — always populated regardless of whether
// this particular account has done anything yet, which is what actually
// keeps Home from ever looking empty. Not personalized (no real matching
// engine exists) — freshest, most-verified listings, honestly, rather
// than pretending this is tailored to the viewer.
function RecommendedJobCard({ job }) {
  return (
    <div className="glass-surface flex flex-col gap-2.5 rounded-2xl p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-muted font-mono text-[11px] font-bold text-muted-foreground">
          {job.company_name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="m-0 truncate text-[13px] font-bold text-foreground">{job.title}</p>
          <p className="m-0 truncate text-[11px] text-muted-foreground">{job.company_name}</p>
        </div>
      </div>
      <p className="m-0 flex items-center gap-1 text-[11px] text-muted-foreground">
        {job.remote ? "Remote" : <><MapPin className="size-3" />{job.location || "Onsite"}</>}
      </p>
      {/* Real, employer-entered text off the source's own payload (see
          backend/app/jobs_ingest/sources.py's fetch_remotive) — only
          Remotive exposes real compensation data today, so this is
          absent (not guessed) on every other source's jobs. */}
      {job.salary && <p className="m-0 text-[12px] font-bold text-success">{job.salary}</p>}
      <a
        href={job.url} target="_blank" rel="noreferrer"
        className="flex w-fit items-center gap-1 self-start rounded-[10px] bg-primary px-3.5 py-1.5 text-[12px] font-bold text-primary-foreground [-webkit-tap-highlight-color:transparent]"
      >
        Apply <ExternalLink className="size-3" />
      </a>
    </div>
  );
}

function RecommendedJobs({ jobs, loading, onSeeAll }) {
  if (!loading && jobs.length === 0) return null;
  return (
    <div className="mb-6">
      <SectionHeader onViewAll={onSeeAll} viewAllLabel="See all">Recommended for you</SectionHeader>
      {/* grid-cols-2 unconditionally, even on phones — stacked
          full-width cards meant all 4 real jobs cost a whole screen's
          worth of scroll before anything past them (Tools, recent
          activity) came into view. Two-up keeps every job real and
          visible without burying what comes after it. */}
      <div className="grid grid-cols-2 gap-2.5">
        {loading
          ? <><Skeleton className="h-[126px] w-full rounded-2xl" /><Skeleton className="h-[126px] w-full rounded-2xl" /></>
          : jobs.slice(0, 4).map((j) => <RecommendedJobCard key={j.id} job={j} />)}
      </div>
    </div>
  );
}

// Compact secondary card — a real checkmark once a resume exists ("Resume
// ready"), a plain prompt before that. Demoted below Recommended for you:
// the primary CTA weight moved to the row of Tools chips below it, this
// is now "here's the state of the thing you already made," not the
// biggest element on the screen.
function ResumeStatusCard({ latestResume, onOpen }) {
  return (
    <div className="mb-6">
      <SectionHeader>Your resume</SectionHeader>
      <button
        type="button" onClick={onOpen}
        className="glass-surface flex w-full items-center gap-3 rounded-2xl p-4 text-left [-webkit-tap-highlight-color:transparent]"
      >
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-[11px] ${latestResume ? "bg-success/15 text-success" : "bg-primary/10 text-primary"}`}>
          {latestResume ? <CheckCircle2 className="size-4" /> : <ArrowRight className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-[13.5px] font-bold text-foreground">
            {latestResume ? (latestResume.name || "Resume ready") : "First resume"}
          </p>
          <p className="m-0 truncate text-[11.5px] text-muted-foreground">
            {latestResume ? `Last updated ${timeAgo(latestResume.generated_at)}` : "Tailored, ATS-ready in minutes"}
          </p>
        </div>
        <span className="shrink-0 text-[12.5px] font-bold text-primary">{latestResume ? "View / Edit" : "Start"}</span>
      </button>
    </div>
  );
}

function ToolChip({ art, label, onClick }) {
  const { Svg } = art;
  return (
    <button
      type="button" onClick={onClick}
      className="glass-surface flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl px-3.5 py-3 [-webkit-tap-highlight-color:transparent]"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Svg size={16} />
      </span>
      <span className="truncate text-[12px] font-bold text-foreground">{label}</span>
    </button>
  );
}

// The desktop-only mirror of the left nav rail: "Your resume" and Tools
// live here, fixed beside the scrollable middle column, so they're always
// on screen instead of waiting at the bottom of a long scroll.
function DesktopRightRail({ savedResumes, go }) {
  const latestResume = savedResumes[0];
  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-border bg-card p-5">
      <ResumeStatusCard
        latestResume={latestResume}
        onOpen={() => go("resume", latestResume ? { resumeId: latestResume.id } : undefined)}
      />
      <div>
        <SectionHeader>Tools</SectionHeader>
        <div className="grid grid-cols-1 gap-2">
          <ToolChip art={DASHBOARD_ART.resume} label="Resume" onClick={() => go("resume")} />
          <ToolChip art={QUICK_ACTION_ART.apply} label="Auto Apply" onClick={() => go("apply")} />
          <ToolChip art={QUICK_ACTION_ART.scan} label="CV Scan" onClick={() => go("scan")} />
          <ToolChip art={QUICK_ACTION_ART.tracker} label="Tracker" onClick={() => go("jobtracker")} />
        </div>
      </div>
    </aside>
  );
}

function AddNoteDialog({ app, open, onClose, onSaved }) {
  const [notes, setNotes] = useState(app?.notes || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setNotes(app?.notes || ""); }, [app]);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await apiRequest(`/api/v1/applications/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes.trim() }),
      });
      onSaved(updated);
      onClose();
    } catch (e) {
      toast.error(e.message || "Couldn't save that note.");
    } finally {
      setSaving(false);
    }
  };

  if (!app) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Note — {app.role} at {app.company}</DialogTitle></DialogHeader>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="What's worth remembering about this one?" autoFocus />
        <DialogFooter>
          <Btn small variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn small variant="gold" onClick={save} loading={saving}>Save note</Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Apply with AI's own item shape — the only kind useUnreadNotifications
// surfaces now that the artisan-message side of that hook is gone.
function applyRunNotifCopy(run) {
  let company = "that application";
  try { company = new URL(run.target_url).hostname.replace(/^www\./, ""); } catch { /* keep the fallback */ }
  const map = {
    submitted: { Icon: Check, title: `Application submitted — ${company}`, subtitle: "Added to your Job Tracker." },
    failed: { Icon: AlertTriangle, title: `Couldn't finish — ${company}`, subtitle: run.error_message || "Something went wrong." },
    cancelled: { Icon: X, title: `Cancelled — ${company}`, subtitle: "Nothing was submitted." },
    expired: { Icon: AlertTriangle, title: `Review window expired — ${company}`, subtitle: "Nothing was submitted." },
  };
  return map[run.status] || map.failed;
}

function NotificationsDialog({ open, onClose, items, onOpenItem }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent showCloseButton className="flex max-h-[70dvh] w-full max-w-[420px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[420px]">
        <div className="shrink-0 border-b border-border p-4">
          <p className="m-0 text-lg font-bold text-foreground">Notifications</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="grid justify-items-center gap-2.5 px-5 py-10 text-center">
              <div className="flex size-11 items-center justify-center rounded-full border border-border bg-card">
                <Inbox className="size-[18px] text-muted-foreground" />
              </div>
              <p className="m-0 text-sm font-bold text-foreground">All caught up</p>
            </div>
          ) : (
            items.map((it) => {
              const { Icon, title, subtitle } = applyRunNotifCopy(it.run);
              return (
                <button
                  key={it.run.id}
                  type="button"
                  onClick={() => onOpenItem(it)}
                  className="flex w-full items-start gap-3 border-b border-border p-4 text-left last:border-b-0 hover:bg-muted/50"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[13px] font-bold text-foreground">{title}</p>
                    <p className="m-0 mt-0.5 truncate text-[12px] text-muted-foreground">{subtitle}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionHeader({ children, onViewAll, viewAllLabel = "View all" }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <span className="font-mono text-[10.5px] font-bold tracking-[0.1em] text-muted-foreground/60 uppercase">{children}</span>
      {onViewAll && (
        <button onClick={onViewAll} className="flex items-center gap-0.5 border-none bg-transparent p-0 text-[12px] font-bold text-primary">
          {viewAllLabel} <ChevronRight className="size-3" />
        </button>
      )}
    </div>
  );
}

// The avatar leads the greeting, same order Logo.js's own lockup uses —
// icon first, then the text that names it.
function GreetingAvatar({ user, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Personal profile"
      className={`flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border [-webkit-tap-highlight-color:transparent] ${user?.avatar_emoji ? "" : "font-mono text-xs font-bold"} ${tintFor(user?.name || user?.email || "?")}`}
    >
      {user?.avatar_emoji ? <Emoji3D emoji={user.avatar_emoji} size={36} /> : initialsOf(user?.name || user?.email || "?")}
    </button>
  );
}

// On desktop, "Your resume" and Tools move into their own right-hand rail
// (see DesktopRightRail) so they're always visible next to the nav rather
// than requiring a scroll past Recommended-for-you to find them — the
// middle column stays scrollable, but nothing sits below the fold.
function DashboardContent({
  user, statsLoading, savedResumes, applications, recommendedJobs, recommendedLoading,
  go, onDeleteResume, onDeleteApplication, onUpdateApplicationStatus, onAddNote, isDesktop, onOpenPersonalProfile,
  showResumeAndTools = true,
}) {
  const recentResumes = savedResumes.slice(0, 3);
  const recentApps = applications.slice(0, 3);
  const followupCount = applications.filter((a) => a.needs_followup).length;
  const latestResume = savedResumes[0];

  const greetingRow = (
    <div className="flex items-center gap-3">
      {user && <GreetingAvatar user={user} onClick={onOpenPersonalProfile} />}
      <div className="min-w-0">
        <p className="m-0 truncate text-[13px] font-semibold text-muted-foreground">
          {greeting()}{user ? `, ${user.name || user.email.split("@")[0]}` : ""}
        </p>
        <h1 className="m-0 text-[26px] font-bold text-foreground">Let's get you hired.</h1>
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-8 sm:py-8 lg:max-w-4xl">
      {isDesktop ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="dark relative mb-5 flex h-[130px] items-center overflow-hidden rounded-3xl"
        >
          <img src="/dashboard/greeting-banner.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/10" />
          <div className="relative w-full px-6">{greetingRow}</div>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-5">
          {greetingRow}
        </motion.div>
      )}

      {followupCount > 0 && (
        <motion.button
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => go("jobtracker")}
          className="mb-4 flex w-full items-center gap-2.5 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-left [-webkit-tap-highlight-color:transparent]"
        >
          <Clock className="size-4 shrink-0 text-primary" />
          <span className="flex-1 text-[13px] font-semibold text-foreground">
            {followupCount} application{followupCount === 1 ? "" : "s"} could use a follow-up
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
        </motion.button>
      )}

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }}>
        <JobSearchStatsCard applications={applications} loading={statsLoading} onViewAll={() => go("jobtracker")} />
      </motion.div>

      {/* On mobile (showResumeAndTools is only true there — desktop
          renders this same pair in its own right rail instead, see
          DesktopRightRail), Tools comes before Recommended-for-you:
          actions you take right now shouldn't sit under a whole
          scroll's worth of job cards first. Reordering here is
          invisible to desktop since it renders these two elsewhere. */}
      {showResumeAndTools && (
        <>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }}>
            <ResumeStatusCard latestResume={latestResume} onOpen={() => go("resume", latestResume ? { resumeId: latestResume.id } : undefined)} />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.15 }} className="mb-6">
            <SectionHeader>Tools</SectionHeader>
            {/* grid-cols-2, not a single flex row — a row of 4 chips has
                no room left for labels once the viewport gets much
                narrower than a typical phone (checked live down to a
                344px foldable cover screen: labels shrank to an
                unreadable sliver before they ever actually overflowed).
                Two columns keeps every label legible at any width this
                app runs at. */}
            <div className="grid grid-cols-2 gap-2">
              <ToolChip art={DASHBOARD_ART.resume} label="Resume" onClick={() => go("resume")} />
              <ToolChip art={QUICK_ACTION_ART.apply} label="Auto Apply" onClick={() => go("apply")} />
              <ToolChip art={QUICK_ACTION_ART.scan} label="CV Scan" onClick={() => go("scan")} />
              <ToolChip art={QUICK_ACTION_ART.tracker} label="Tracker" onClick={() => go("jobtracker")} />
            </div>
          </motion.div>
        </>
      )}

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.2 }}>
        <RecommendedJobs jobs={recommendedJobs} loading={recommendedLoading} onSeeAll={() => go("jobsboard")} />
      </motion.div>

      {recentResumes.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.25 }} className="mb-6">
          <SectionHeader onViewAll={() => go("resume", { viewAllResumes: true })}>Recent resumes</SectionHeader>
          <div className="grid gap-2">
              {recentResumes.map((r) => (
                <div key={r.id} className="glass-surface flex items-center gap-2 rounded-xl p-3">
                  <button onClick={() => go("resume", { resumeId: r.id })}
                    className="flex min-w-0 flex-1 items-center gap-3 border-none bg-transparent p-0 text-left [-webkit-tap-highlight-color:transparent]">
                    <ArtTile art={DASHBOARD_ART.resume} size={36} iconSize={19} />
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-[13px] font-bold text-foreground">{r.name || "Untitled"}</p>
                      <p className="m-0 truncate text-[11.5px] text-muted-foreground">
                        {r.role ? `${r.role} · ` : ""}Saved {timeAgo(r.generated_at)}
                      </p>
                    </div>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button aria-label="More options" onClick={(e) => e.stopPropagation()}
                        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground [-webkit-tap-highlight-color:transparent] hover:bg-muted hover:text-foreground">
                        <MoreVertical className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem className="text-destructive data-highlighted:text-destructive" onSelect={() => onDeleteResume(r.id)}>
                        <Trash2 className="size-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
                </div>
              ))}
          </div>
        </motion.div>
      )}

      {recentApps.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.3 }} className="mb-6">
          <SectionHeader onViewAll={() => go("jobtracker")}>Recent applications</SectionHeader>
          <div className="grid gap-2">
              {recentApps.map((a) => {
                const meta = STATUS_META[a.status] || STATUS_META.applied;
                const since = daysSinceApplied(a.date_applied);
                return (
                  <div key={a.id} className="glass-surface flex items-center gap-2 rounded-xl p-3">
                    <button onClick={() => go("jobtracker")}
                      className="min-w-0 flex-1 border-none bg-transparent p-0 text-left [-webkit-tap-highlight-color:transparent]">
                      <div className="flex items-center gap-2">
                        <p className="m-0 min-w-0 flex-1 truncate text-[13px] font-bold text-foreground">{a.role}</p>
                        <span className={`shrink-0 text-[11.5px] font-bold ${meta.className}`}>{meta.label}</span>
                      </div>
                      <p className="m-0 truncate text-[11.5px] text-muted-foreground">
                        {a.company}{since ? ` · Applied ${since}` : ""}
                      </p>
                      {a.notes && <p className="m-0 mt-0.5 truncate text-[11px] text-muted-foreground/75">{a.notes}</p>}
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button aria-label="More options" onClick={(e) => e.stopPropagation()}
                          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground [-webkit-tap-highlight-color:transparent] hover:bg-muted hover:text-foreground">
                          <MoreVertical className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {STATUS_ORDER.filter((s) => s !== a.status).map((s) => (
                          <DropdownMenuItem key={s} onSelect={() => onUpdateApplicationStatus(a.id, s)}>
                            Mark as {STATUS_META[s].label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuItem onSelect={() => setTimeout(() => onAddNote(a), 0)}>
                          <StickyNote className="size-3.5" /> {a.notes ? "Edit note" : "Add note"}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive data-highlighted:text-destructive" onSelect={() => onDeleteApplication(a.id)}>
                          <Trash2 className="size-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
          </div>
        </motion.div>
      )}

    </div>
  );
}

export default function Dashboard({ onClose, onNavigate }) {
  const { user, loading: authLoading } = useAuth();
  const { isDesktop } = useViewport();
  const unread = useUnreadNotifications();
  const [savedResumes, setSavedResumes] = useState([]);
  const [applications, setApplications] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [recommendedJobs, setRecommendedJobs] = useState([]);
  const [recommendedLoading, setRecommendedLoading] = useState(true);

  useEffect(() => {
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

  // Public marketplace data, not scoped to the signed-in account — same
  // "fetch once, fail into an empty array, never a broken section"
  // reasoning every other public-data fetch in this app already follows.
  // No real job-matching engine exists, so this is honestly the
  // freshest, most-verified listings, not a personalized ranking —
  // real data is what actually keeps this section (and the dashboard as
  // a whole) from ever reading as empty, not a fabricated "for you" claim.
  //
  // Pulls a wider pool (12) than it shows (4) and keeps at most one job
  // per company from it — sorted by posted_at, a source whose real post
  // date isn't available (ScrapeGraphAI falls back to "when this run
  // found it," see backend/app/jobs_ingest/sources.py) always looks
  // newest, and without this a handful of same-day listings from one
  // company can fill the entire section. One per company keeps this
  // reading as a real spread, not a repeat.
  useEffect(() => {
    setRecommendedLoading(true);
    apiRequest("/api/v1/jobs?limit=12&min_verification_level=2")
      .then((d) => {
        const seen = new Set();
        const diversified = (d.jobs || []).filter((j) => {
          if (seen.has(j.company_name)) return false;
          seen.add(j.company_name);
          return true;
        });
        const next = diversified.slice(0, 4);
        setRecommendedJobs(next);
        // Cached so a transient failure (rate limit, network blip, a
        // backend restart) has something real to fall back to below
        // instead of this section just vanishing — confirmed live: it
        // did exactly that the first time this hit a 429.
        try { localStorage.setItem(RECOMMENDED_CACHE_KEY, JSON.stringify(next)); } catch { /* best-effort */ }
      })
      .catch(() => {
        let cached = [];
        try { cached = JSON.parse(localStorage.getItem(RECOMMENDED_CACHE_KEY) || "[]"); } catch { /* best-effort */ }
        setRecommendedJobs(cached);
      })
      .finally(() => setRecommendedLoading(false));
  }, []);

  const [notifOpen, setNotifOpen] = useState(false);
  const [noteApp, setNoteApp] = useState(null);

  const go = (id, opts) => {
    tapFeedback();
    if (id === "home") return;
    onNavigate(id, opts);
  };

  const openNotification = (item) => go("apply", { runId: item.run.id });

  const deleteResume = async (id) => {
    setSavedResumes((list) => list.filter((r) => r.id !== id));
    const ok = await apiDelete(id);
    if (!ok) toast.error("Couldn't delete that resume.");
  };
  const deleteApplication = async (id) => {
    setApplications((list) => list.filter((a) => a.id !== id));
    try {
      await apiRequest(`/api/v1/applications/${id}`, { method: "DELETE" });
    } catch (e) {
      toast.error(e.message || "Couldn't delete that application.");
    }
  };
  const updateApplicationStatus = async (id, status) => {
    setApplications((list) => list.map((a) => (a.id === id ? { ...a, status } : a)));
    try {
      const updated = await apiRequest(`/api/v1/applications/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      });
      setApplications((list) => list.map((a) => (a.id === id ? { ...a, ...updated } : a)));
    } catch (e) {
      toast.error(e.message || "Couldn't update that application.");
    }
  };
  const onNoteSaved = (updated) => {
    setApplications((list) => list.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
  };

  const followupCount = applications.filter((a) => a.needs_followup).length;
  const needsAttention = unread.count > 0 || followupCount > 0;

  const contentProps = {
    user, statsLoading, savedResumes, applications, recommendedJobs, recommendedLoading, go, isDesktop,
    onDeleteResume: deleteResume,
    onDeleteApplication: deleteApplication,
    onUpdateApplicationStatus: updateApplicationStatus,
    onAddNote: setNoteApp,
    onOpenPersonalProfile: () => go("personal-profile"),
    showResumeAndTools: !isDesktop,
  };

  if (isDesktop) {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 flex bg-background font-sans"
      >
        <NavRail active="home" user={user} onNavigate={go} onNotifClick={() => setNotifOpen(true)} />

        <main className="relative min-w-0 flex-1 overflow-y-auto">
          <SparkleBackground />
          {onClose && (
            <div className="flex justify-end p-4" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
              <button onClick={onClose} aria-label="Close" className="flex size-10 items-center justify-center rounded-full border border-border bg-muted text-foreground">
                <X className="size-4" />
              </button>
            </div>
          )}
          <DashboardContent {...contentProps} />
        </main>
        <DesktopRightRail savedResumes={savedResumes} go={go} />
        <NotificationsDialog open={notifOpen} onClose={() => setNotifOpen(false)} items={unread.items} onOpenItem={openNotification} />
        <AddNoteDialog app={noteApp} open={!!noteApp} onClose={() => setNoteApp(null)} onSaved={onNoteSaved} />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-background font-sans"
    >
      <header
        className="flex shrink-0 items-center justify-between px-5 pb-4"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <Logo size={22} />
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <button onClick={() => setNotifOpen(true)} aria-label="Notifications" className="relative flex size-10 items-center justify-center rounded-full border border-border bg-muted text-foreground">
            <ArtTile art={DASHBOARD_ART.bell} size={24} iconSize={14} />
            {needsAttention && (
              unread.count > 0 ? (
                <span className="absolute top-0.5 right-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
                  {unread.count > 9 ? "9+" : unread.count}
                </span>
              ) : (
                <span className="absolute top-0.5 right-0.5 size-2.5 rounded-full bg-destructive" />
              )
            )}
          </button>
          {onClose && (
            <button onClick={onClose} aria-label="Close" className="flex size-10 items-center justify-center rounded-full border border-border bg-muted text-foreground">
              <X className="size-[17px]" />
            </button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto" style={{ paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>
        <SparkleBackground />
        <DashboardContent {...contentProps} />
      </div>

      <BottomNav
        items={MOBILE_NAV_ITEMS}
        active="home"
        onChange={(id) => go(id)}
      />
      <NotificationsDialog open={notifOpen} onClose={() => setNotifOpen(false)} items={unread.items} onOpenItem={openNotification} />
      <AddNoteDialog app={noteApp} open={!!noteApp} onClose={() => setNoteApp(null)} onSaved={onNoteSaved} />
    </motion.div>
  );
}
