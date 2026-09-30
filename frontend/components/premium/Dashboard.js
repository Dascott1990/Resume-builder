"use client";
/**
 * Dashboard.js — the app's real home base, not a grid of tiles pretending
 * to be one. One dominant primary action (dynamic: "Continue" the most
 * recently saved resume once one exists, "Build a resume" before that), a
 * quick-glance stats row, a demoted tools row underneath it, and a
 * recent-activity feed.
 *
 * Nav is four items everywhere now — Home, Jobs, Applications, Profile —
 * the same set on the desktop rail and the mobile bottom bar, replacing
 * the old Resume/Scan/Tracker/Artisans split (Artisan is gone from this
 * app entirely; Resume/Scan move into the Quick Actions row instead of
 * competing for a permanent nav slot).
 *
 * Every icon tile across this screen (nav, hero card, stat cards, quick
 * actions, notifications) shares ONE neutral system-accent treatment now
 * instead of each having its own colored gradient — see ArtTile below.
 * Semantic color (success/destructive) is untouched; it means something
 * specific and stays separate from decoration.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowRight, ChevronRight, X, Clock,
  Inbox, Check, AlertTriangle,
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
import { QUICK_ACTION_ART } from "./shared/quickActionArt";
import { DASHBOARD_ART } from "./shared/dashboardArt";
import { SparkleBackground } from "./shared/SparkleBackground";
import { Skeleton } from "@/components/ui/skeleton";
import Logo from "./Logo";

// One neutral system-accent tile behind every illustrated icon on this
// screen — deliberately ignores each art entry's own `bg` (a colored
// gradient per icon, the "rainbow tiles" the redesign moved away from).
// The icon glyph itself still comes from shared/dashboardArt.js /
// quickActionArt.js; only the surrounding tile color is unified here.
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

// Same four everywhere — desktop rail and mobile bottom bar both show the
// app's real top-level structure now instead of two different subsets.
const NAV_ITEMS = [
  { id: "home", art: DASHBOARD_ART.home, label: "Home" },
  { id: "apply", art: QUICK_ACTION_ART.apply, label: "Jobs" },
  { id: "jobtracker", art: QUICK_ACTION_ART.tracker, label: "Applications" },
  { id: "profile", art: DASHBOARD_ART.profile, label: "Profile" },
];
const MOBILE_NAV_ITEMS = [
  { id: "home", Icon: navArt(DASHBOARD_ART.home), label: "Home" },
  { id: "apply", Icon: navArt(QUICK_ACTION_ART.apply), label: "Jobs" },
  { id: "jobtracker", Icon: navArt(QUICK_ACTION_ART.tracker), label: "Applications" },
  { id: "profile", Icon: navArt(DASHBOARD_ART.profile), label: "Profile" },
];

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

function StatCard({ label, value, art, loading, needsAttention }) {
  return (
    <div className="glass-surface relative flex flex-col gap-2 rounded-2xl p-4">
      {needsAttention && <span className="absolute top-3 right-3 size-2 rounded-full bg-destructive" />}
      <ArtTile art={art} size={28} iconSize={16} />
      {loading ? <Skeleton className="h-7 w-10" /> : <span className="text-2xl font-bold text-foreground">{value}</span>}
      <span className="text-[11.5px] leading-tight text-muted-foreground">{label}</span>
    </div>
  );
}

// Demoted below the primary card and the stats row — shortcuts, not
// content, sized and weighted accordingly (Cash App/Venmo's own "quick
// actions" shape). Artisans is gone; three tiles now, not four.
function QuickAction({ art, label, onClick }) {
  const { Svg } = QUICK_ACTION_ART[art];
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-2xl border-none bg-card/60 p-3 [-webkit-tap-highlight-color:transparent]"
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 shadow-[0_8px_18px_-10px_rgba(0,0,0,0.3)]">
        <Svg size={24} />
      </span>
      <span className="flex min-h-[2lh] items-start justify-center text-center text-[11px] leading-tight font-semibold text-foreground">
        {label}
      </span>
    </motion.button>
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
    <div className="mb-3 flex items-center justify-between">
      <span className="font-mono text-[10.5px] font-bold tracking-[0.1em] text-muted-foreground/60 uppercase">{children}</span>
      {onViewAll && (
        <button onClick={onViewAll} className="flex items-center gap-0.5 border-none bg-transparent p-0 text-[12px] font-bold text-primary">
          {viewAllLabel} <ChevronRight className="size-3" />
        </button>
      )}
    </div>
  );
}

// The avatar next to the greeting — tapping it opens Personal Profile
// (name/photo/phone/account type/email), a level below the Profile nav
// tab's own broader account hub.
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

function DashboardContent({ user, statsLoading, savedResumes, applications, go, onDeleteResume, onDeleteApplication, onUpdateApplicationStatus, onAddNote, isDesktop, onOpenPersonalProfile }) {
  const interviews = applications.filter((a) => a.status === "interview").length;
  const recentResumes = savedResumes.slice(0, 3);
  const recentApps = applications.slice(0, 3);
  const followupCount = applications.filter((a) => a.needs_followup).length;
  const latestResume = savedResumes[0];

  {/* Avatar leads the greeting, same order Logo.js's own lockup uses —
      icon first, then the text that names it (there, LogoMark then
      "NOQEEV"; here, the avatar then "Good evening, you"). Not trailing
      it: this is the same "who" the text is about, read left to right,
      not a decoration tucked on at the end. */}
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
          className="dark relative mb-6 flex h-[130px] items-center overflow-hidden rounded-3xl"
        >
          <img src="/dashboard/greeting-banner.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/10" />
          <div className="relative w-full px-6">{greetingRow}</div>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-6">
          {greetingRow}
        </motion.div>
      )}

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

      {/* Dynamic: once a resume exists, this is "continue the most recent
          one" (a real, specific next action) instead of the same generic
          prompt forever. */}
      <motion.button
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => go("resume", latestResume ? { resumeId: latestResume.id } : undefined)}
        className="glass-surface mb-5 flex w-full items-center justify-between gap-4 rounded-3xl border-none p-6 text-left [-webkit-tap-highlight-color:transparent]"
      >
        <div className="flex min-w-0 items-center gap-3.5">
          <ArtTile art={DASHBOARD_ART.resume} size={44} iconSize={24} />
          <div className="min-w-0">
            <p className="m-0 truncate text-xl font-bold text-foreground">
              {latestResume ? (latestResume.name || "Continue your resume") : "Build a resume"}
            </p>
            <p className="m-0 truncate text-[12px] text-muted-foreground">
              {latestResume ? `Saved ${timeAgo(latestResume.generated_at)} · Tailored, ATS-ready` : "Tailored, ATS-ready in minutes"}
            </p>
          </div>
        </div>
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <ArrowRight className="size-5 text-primary" />
        </div>
      </motion.button>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }} className="mb-6">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <QuickAction art="apply" label="Auto Apply" onClick={() => go("apply")} />
          <QuickAction art="scan" label="CV Scan" onClick={() => go("scan")} />
          <QuickAction art="tracker" label="Tracker" onClick={() => go("jobtracker")} />
        </div>
      </motion.div>

      {(statsLoading || savedResumes.length > 0 || applications.length > 0) && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.15 }} className="mb-6">
          {statsLoading ? (
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Saved resumes" art={DASHBOARD_ART.resume} loading />
              <StatCard label="Applications" art={QUICK_ACTION_ART.tracker} loading />
              <StatCard label="Interviews" art={DASHBOARD_ART.interviews} loading />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Saved resumes" value={savedResumes.length} art={DASHBOARD_ART.resume} />
              <StatCard label="Applications" value={applications.length} art={QUICK_ACTION_ART.tracker} needsAttention={followupCount > 0} />
              <StatCard label="Interviews" value={interviews} art={DASHBOARD_ART.interviews} />
            </div>
          )}
        </motion.div>
      )}

      {recentResumes.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.2 }} className="mb-6">
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
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.25 }} className="mb-6">
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
    user, statsLoading, savedResumes, applications, go, isDesktop,
    onDeleteResume: deleteResume,
    onDeleteApplication: deleteApplication,
    onUpdateApplicationStatus: updateApplicationStatus,
    onAddNote: setNoteApp,
    onOpenPersonalProfile: () => go("personal-profile"),
  };

  if (isDesktop) {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 flex bg-background font-sans"
      >
        <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
          <div className="p-5" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}><Logo size={22} /></div>
          <nav className="flex flex-col gap-1 px-3" aria-label="Dashboard">
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
                  <ArtTile art={item.art} size={26} iconSize={15} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex-1 px-3 pt-2">
            {user ? (
              <button
                onClick={() => go("profile")}
                className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-muted/40 p-3 text-left [-webkit-tap-highlight-color:transparent] hover:border-primary/30"
              >
                <div className={`flex size-8 shrink-0 items-center justify-center rounded-full border ${user.avatar_emoji ? "" : "font-mono text-xs font-bold"} ${tintFor(user.name || user.email)}`}>
                  {user.avatar_emoji ? <Emoji3D emoji={user.avatar_emoji} size={32} /> : initialsOf(user.name || user.email)}
                </div>
                <div className="min-w-0">
                  <p className="m-0 truncate text-[12.5px] font-bold text-foreground">{user.name || user.email}</p>
                </div>
              </button>
            ) : (
              <button
                onClick={() => go("profile")}
                className="w-full rounded-xl border border-primary/25 bg-primary/10 p-3 text-left [-webkit-tap-highlight-color:transparent]"
              >
                <p className="m-0 text-[12.5px] font-bold text-primary">Sign in</p>
                <p className="m-0 mt-0.5 text-[11px] leading-snug text-muted-foreground">Sync across devices</p>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border p-3">
            <ThemeToggle compact />
            <button
              onClick={() => setNotifOpen(true)}
              aria-label="Notifications"
              className="relative flex size-10 items-center justify-center rounded-xl border border-border bg-transparent text-muted-foreground [-webkit-tap-highlight-color:transparent] hover:text-foreground"
            >
              <ArtTile art={DASHBOARD_ART.bell} size={24} iconSize={14} />
              {needsAttention && (
                unread.count > 0 ? (
                  <span className="absolute top-1 right-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
                    {unread.count > 9 ? "9+" : unread.count}
                  </span>
                ) : (
                  <span className="absolute top-1 right-1 size-2.5 rounded-full bg-destructive" />
                )
              )}
            </button>
          </div>
        </aside>

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
