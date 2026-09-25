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
import { toast } from "sonner";
import {
  Home, FileText, ScanLine, ClipboardList, Hammer, Settings as SettingsIcon,
  ArrowRight, ChevronRight, CalendarCheck, X, Clock, Sparkles, Bell,
  MessageCircle, Wrench, Inbox, User, Megaphone, Globe, Cpu, Atom, Landmark, Briefcase,
  MoreVertical, Trash2, StickyNote, Check, AlertTriangle,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/useAuth";
import { useViewport } from "@/lib/useViewport";
import { useUnreadNotifications } from "@/lib/useUnreadNotifications";
import { tapFeedback } from "@/lib/haptics";
import { apiRequest } from "./shared/api";
import { apiListSaved, apiDelete } from "./guest/api";
import { BottomNav } from "./shared/BottomNav";
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
// Same 4 statuses JobTracker.js's own STATUSES array uses (this is that
// same backend enum — VALID_STATUSES in api/applications.py) — just this
// screen's own compact order for the per-row "mark status" menu.
const STATUS_ORDER = ["applied", "interview", "offer", "rejected"];

// One accent, used once: Apply with AI is the flagship feature and gets
// the brand primary; every other quick action shares the same neutral
// treatment and is told apart by its glyph and label, not an arbitrary
// hue — a rainbow-per-icon row reads as a kids' app, not this one.
const QUICK_ACTION_COLORS = {
  amber: "border-primary/25 bg-primary/10 text-primary",
  neutral: "border-border bg-muted/60 text-muted-foreground",
};

// Same source /brand/news reads (backend/app/api/brand.py's GET /news and
// /world-feed — both public reads, no admin gate) — this is the read-only
// consumer-facing view of the same real content, not a second copy of it.
const FEED_CATEGORY_META = {
  world: { label: "World", Icon: Globe },
  tech: { label: "Technology", Icon: Cpu },
  physics: { label: "Physics", Icon: Atom },
  history: { label: "History", Icon: Landmark },
  jobs: { label: "Jobs", Icon: Briefcase },
};

function timeAgo(iso) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

// date_applied is a plain YYYY-MM-DD string (see JobApplication model —
// free text from the user, not a real deadline system), not an ISO
// timestamp like the other dates on this screen, so it needs its own
// parse instead of reusing timeAgo.
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

function StatCard({ label, value, Icon, loading, needsAttention }) {
  return (
    <div className="glass-surface relative flex flex-col gap-2 rounded-2xl p-4">
      {/* Same red-means-action-needed signal as the header bell badge —
          ties this stat to the follow-up nudge banner above instead of
          the two existing as two separately-discovered facts. */}
      {needsAttention && <span className="absolute top-3 right-3 size-2 rounded-full bg-destructive" />}
      <Icon className="size-4 text-primary" />
      {loading ? <Skeleton className="h-7 w-10" /> : <span className="text-2xl font-bold text-foreground">{value}</span>}
      <span className="text-[11.5px] leading-tight text-muted-foreground">{label}</span>
    </div>
  );
}

// A compact circular-icon row (Cash App/Venmo's own "quick actions" shape),
// not a 2x2 grid of square cards — those were competing with the primary
// "Build a resume" CTA for the same big-card visual weight real content
// (stats, recent activity) should get instead. This is shortcuts, not
// content, and industry dashboards size it accordingly: small, scannable,
// out of the way in one line. A quiet bg-card/60 tile with no border gives
// each one a single tappable boundary without going back to the heavier
// bordered-card look; min-h-[2lh] on the label reserves the same two-
// line-height block whether that label wraps once or twice, so all four
// tiles end at the same bottom edge instead of a crooked row.
function QuickAction({ Icon, label, onClick, color = "amber" }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-2xl border-none bg-card/60 p-3 [-webkit-tap-highlight-color:transparent]"
    >
      <span className={`flex size-12 items-center justify-center rounded-full border ${QUICK_ACTION_COLORS[color]}`}>
        <Icon className="size-[19px]" />
      </span>
      <span className="flex min-h-[2lh] items-start justify-center text-center text-[11px] leading-tight font-semibold text-foreground">
        {label}
      </span>
    </motion.button>
  );
}

// Real PATCH /api/v1/applications/<id> (same route JobTracker.js's own
// edit form uses — see api/applications.py), just a small dialog instead
// of the full Job Tracker screen, so adding a quick note from the
// dashboard doesn't require leaving it.
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
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save note"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Apply with AI's own item shape (kind: "apply_run") carries a whole `run`
// record, not the per-thread fields messages use — this is what turns
// that into the same {icon, title, subtitle} shape the dialog below
// renders every item as, so one finished automation reads as clearly as
// one unread message rather than a raw status string.
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

// The actual notification list — each item is either its own message
// thread or a finished Apply with AI run (see useUnreadNotifications), so
// a click opens whatever THAT item is actually about (a customer's own
// request, a job in an artisan's own dashboard, or that specific run's
// result), never a single guessed destination regardless of which item
// was tapped.
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
              if (it.kind === "apply_run") {
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
              }
              return (
                <button
                  key={it.job_request_id}
                  type="button"
                  onClick={() => onOpenItem(it)}
                  className="flex w-full items-start gap-3 border-b border-border p-4 text-left last:border-b-0 hover:bg-muted/50"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                    {it.viewer_role === "artisan" ? <Wrench className="size-4" /> : <MessageCircle className="size-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[13px] font-bold text-foreground">
                      {it.viewer_role === "artisan"
                        ? `${it.other_name} messaged you about a ${it.trade} job`
                        : `${it.other_name} messaged you about your ${it.trade} request`}
                    </p>
                    {it.preview && (
                      <p className="m-0 mt-0.5 truncate text-[12px] text-muted-foreground">{it.preview}</p>
                    )}
                  </div>
                  {it.unread_count > 1 && (
                    <span className="mt-0.5 flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10.5px] font-bold text-primary-foreground">
                      {it.unread_count}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// A real thumbnail straight from the source's own RSS feed (see
// world_feed.py's _rss_item_image) when one exists — never a stock photo
// or anything generated to fill the slot. Sources that genuinely don't
// carry one (Hacker News, arXiv, Indeed Hiring Lab) — or a real image URL
// that happens to 404/hotlink-block by the time someone's browser
// requests it — fall back to a plain category-icon tile instead of a
// broken-image icon or a fake photo standing in for a real one.
function NewsCardImage({ imageUrl, Icon }) {
  const [failed, setFailed] = useState(false);
  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="aspect-[16/10] w-full rounded-lg object-cover"
      />
    );
  }
  return (
    <div className="flex aspect-[16/10] w-full items-center justify-center rounded-lg bg-muted">
      <Icon className="size-5 text-muted-foreground/50" />
    </div>
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

function DashboardContent({ user, statsLoading, savedResumes, applications, updates, worldFeed, go, onDeleteResume, onDeleteApplication, onUpdateApplicationStatus, onAddNote }) {
  const interviews = applications.filter((a) => a.status === "interview").length;
  const recentResumes = savedResumes.slice(0, 3);
  const recentApps = applications.slice(0, 3);
  const followupCount = applications.filter((a) => a.needs_followup).length;
  const [showAllFeed, setShowAllFeed] = useState(false);

  // max-w-3xl (768px) was sized for mobile, where it never binds — a
  // viewport has to be >=768px wide before this cap even matters, and the
  // desktop layout's isDesktop breakpoint doesn't kick in until 1024px
  // (see useViewport.js), leaving that first mobile-width guess as the
  // desktop content width too: a widening gap of unused space next to the
  // 256px sidebar as the window gets wider. lg:max-w-4xl only changes the
  // desktop case (mobile never reaches the lg breakpoint) — still a real
  // reading-width cap on ultra-wide monitors, just one actually sized for
  // a desktop, not a phone.
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-8 sm:py-8 lg:max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-6">
        <p className="m-0 text-[13px] font-semibold text-muted-foreground">
          {greeting()}{user ? `, ${user.name || user.email.split("@")[0]}` : ""}
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

      {/* The one dominant action — everything else on this screen supports
          it. Weight comes from size, position, and typography, not from
          filling the whole card edge-to-edge with saturated brand color —
          a full-bleed vivid-amber surface this large reads as a banner ad,
          not a premium "balance card." Same glass-surface neutral body
          StatCard uses below; the accent is confined to the icon badge
          (the same small IconTile-style squircle used everywhere else in
          the app) and the trailing arrow, exactly the "one accent, used
          sparingly" rule the Quick Actions row below now also follows. */}
      <motion.button
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => go("resume")}
        className="glass-surface mb-5 flex w-full items-center justify-between gap-4 rounded-3xl border-none p-6 text-left [-webkit-tap-highlight-color:transparent]"
      >
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-[26%] bg-gradient-to-br from-primary to-primary/75 shadow-[0_6px_16px_-4px_color-mix(in_oklch,var(--primary)_55%,transparent)]">
            <FileText className="size-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="m-0 text-xl font-bold text-foreground">Build a resume</p>
            <p className="m-0 text-[12px] text-muted-foreground">Tailored, ATS-ready in minutes</p>
          </div>
        </div>
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <ArrowRight className="size-5 text-primary" />
        </div>
      </motion.button>

      {/* Right under the primary action, one uncaptioned horizontal row —
          same shape/position Cash App and Venmo use for their own quick
          actions under the balance. Always shown regardless of whether
          there's any data yet: these are navigation shortcuts, not
          content, so "nothing tracked yet" doesn't apply to them the way
          it does to the stats/activity below. One neutral treatment for
          all four, told apart by icon + label — see QUICK_ACTION_COLORS —
          except Apply with AI, the one flagship feature that keeps the
          brand accent. */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }} className="mb-6">
        {/* grid grid-cols-4, not flex — a flex row's leftover space
            distributes unevenly between gaps; a 4-column grid gives every
            tile the exact same width and every gap the exact same size,
            same pattern as the stats row's own grid-cols-3 below. */}
        <div className="grid grid-cols-4 gap-3">
          <QuickAction Icon={Sparkles} label="Auto Apply" color="amber" onClick={() => go("apply")} />
          <QuickAction Icon={ScanLine} label="CV Scan" color="neutral" onClick={() => go("scan")} />
          <QuickAction Icon={ClipboardList} label="Tracker" color="neutral" onClick={() => go("jobtracker")} />
          <QuickAction Icon={Hammer} label="Artisan" color="neutral" onClick={() => go("artisans")} />
        </div>
      </motion.div>

      {/* Stats, recent resumes, and recent applications below all share one
          rule now: a brand-new visitor with nothing tracked anywhere sees
          NONE of these sections, not an empty "Nothing yet" placeholder
          for each — three dashed boxes in a row reads like a scoreboard
          stuck at zero, not an invitation. The moment there's real data
          (even just one saved resume), the section it belongs to appears
          on its own. */}
      {(statsLoading || savedResumes.length > 0 || applications.length > 0) && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.15 }} className="mb-6">
          {statsLoading ? (
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Saved resumes" Icon={FileText} loading />
              <StatCard label="Applications" Icon={ClipboardList} loading />
              <StatCard label="Interviews" Icon={CalendarCheck} loading />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Saved resumes" value={savedResumes.length} Icon={FileText} />
              <StatCard label="Applications" value={applications.length} Icon={ClipboardList} needsAttention={followupCount > 0} />
              <StatCard label="Interviews" value={interviews} Icon={CalendarCheck} />
            </div>
          )}
        </motion.div>
      )}

      {/* No loading skeleton here (or on Recent applications below) —
          unlike the stats row above, these two sections might resolve to
          nothing at all, and a skeleton promises content that's coming.
          A skeleton that then just vanishes (because there was nothing to
          show) reads as broken, not as "still loading" — the same silent-
          pop-in-when-ready treatment "What's new"/"Worth a look" already
          use below, now applied consistently instead of only there. */}
      {recentResumes.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.2 }} className="mb-6">
          <SectionHeader onViewAll={() => go("resume", { viewAllResumes: true })}>Recent resumes</SectionHeader>
          <div className="grid gap-2">
              {recentResumes.map((r) => (
                <div key={r.id} className="glass-surface flex items-center gap-2 rounded-xl p-3">
                  <button onClick={() => go("resume", { resumeId: r.id })}
                    className="flex min-w-0 flex-1 items-center gap-3 border-none bg-transparent p-0 text-left [-webkit-tap-highlight-color:transparent]">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10">
                      <FileText className="size-4 text-primary" />
                    </div>
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
                        {/* Deferred, not called directly: Radix's DropdownMenu
                            returns focus to its trigger as part of closing, and
                            doing that in the same tick as mounting a Dialog
                            steals the Dialog's own focus trap / pointer-events
                            lock before it finishes opening — the dialog never
                            becomes visible. Letting the menu's close finish
                            first (a plain setTimeout 0) is the standard fix. */}
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

      {updates.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.3 }} className="mb-6">
          <SectionHeader>
            <span className="flex items-center gap-1.5"><Megaphone className="size-3.5" /> What's new</span>
          </SectionHeader>
          <div className="grid gap-2">
            {updates.slice(0, 3).map((u) => (
              <div key={u.id} className="glass-surface rounded-xl p-3">
                <p className="m-0 text-[13px] font-bold text-foreground">{u.title}</p>
                {u.body && <p className="m-0 mt-1 text-[12px] leading-relaxed text-muted-foreground">{u.body}</p>}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-[10.5px] text-muted-foreground/60">{timeAgo(u.created_at)}</span>
                  {u.link && (
                    <a href={u.link} target="_blank" rel="noreferrer" className="text-[10.5px] font-semibold text-primary no-underline">
                      Learn more
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {worldFeed.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.35 }} className="mb-6">
          <SectionHeader onViewAll={() => setShowAllFeed((v) => !v)} viewAllLabel={showAllFeed ? "Show less" : "View all"}>
            Worth a look
          </SectionHeader>
          {/* Horizontal, not another vertical list — this is idle-moment
              browsing, not a task queue, so it shouldn't compete for the
              same "scroll down for more of your stuff" rhythm as Recent
              resumes/applications above it. Items aren't lost when they
              scroll out of the default top-8 — the feed keeps everything
              fetched (up to 40 here) reachable via "View all" instead of
              only ever showing the newest 8. "View all" itself switches to
              a vertical grid, not just a longer version of the same
              horizontal strip — the strip is for a quick idle glance at a
              handful of headlines; someone who explicitly asked to see
              everything is actually browsing 40 items, and scrolling
              sideways through that many cards one at a time is a bad way
              to do it. A real 2-column grid scrolls the normal way,
              alongside everything else on the page. */}
          <div className={showAllFeed
            ? "grid grid-cols-2 gap-2.5"
            : "-mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:-mx-8 sm:px-8 [&::-webkit-scrollbar]:hidden"
          }>
            {worldFeed.slice(0, showAllFeed ? 40 : 8).map((item) => {
              const meta = FEED_CATEGORY_META[item.category] || FEED_CATEGORY_META.world;
              return (
                <a
                  key={item.id} href={item.url} target="_blank" rel="noreferrer"
                  className={`glass-surface flex flex-col gap-2 overflow-hidden rounded-xl p-2 no-underline ${showAllFeed ? "" : "w-56 shrink-0"}`}
                >
                  <NewsCardImage imageUrl={item.image_url} Icon={meta.Icon} />
                  <div className="flex flex-1 flex-col gap-1.5 px-1 pb-1">
                    <span className="flex items-center gap-1 text-[10px] font-bold tracking-wide text-muted-foreground/70 uppercase">
                      <meta.Icon className="size-3" /> {meta.label}
                    </span>
                    <p className="m-0 text-[12.5px] leading-snug font-bold text-foreground">{item.title}</p>
                    <span className="mt-auto pt-1 text-[10px] text-muted-foreground/50">{timeAgo(item.published_at || item.fetched_at)}</span>
                  </div>
                </a>
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
  const [updates, setUpdates] = useState([]);
  const [worldFeed, setWorldFeed] = useState([]);

  // Both routes are public reads (backend/app/api/brand.py's GET /news and
  // /world-feed — no login, no admin gate) and the same real content
  // /brand/news shows — this just surfaces it somewhere an actual customer
  // would see it, instead of only existing inside the internal /brand
  // workspace nobody outside the team ever opens. Independent of
  // auth/user state on purpose — a guest gets this too.
  useEffect(() => {
    apiRequest("/api/v1/brand/news").then((list) => setUpdates(list.filter((u) => !u.resolved))).catch(() => {});
    apiRequest("/api/v1/brand/world-feed").then(setWorldFeed).catch(() => {});
  }, []);

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

  const [notifOpen, setNotifOpen] = useState(false);
  const [noteApp, setNoteApp] = useState(null);

  const go = (id, opts) => {
    tapFeedback();
    if (id === "home") return;
    onNavigate(id, opts);
  };

  // Each notification already knows what it's actually about (see
  // useUnreadNotifications' viewer_role) — this is what replaced the
  // earlier version's single blind guess ("go wherever has more unread"),
  // which sent every click to the same screen regardless of which item
  // someone actually meant to open.
  const openNotification = (item) => {
    setNotifOpen(false);
    if (item.kind === "apply_run") { go("apply", { runId: item.run.id }); return; }
    if (item.viewer_role === "artisan") go("artisan-dashboard");
    else go("artisans", { tab: "requests" });
  };

  // Real mutations (same endpoints JobTracker.js's own full screen uses —
  // see api/resume.py's DELETE /<id> and api/applications.py's PATCH/DELETE
  // /<id>), just reachable from a row's overflow menu here so a quick edit
  // doesn't require leaving the dashboard. Optimistic locally, since
  // there's nowhere richer to show a failure than the toast itself.
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

  // Same real signal the follow-up nudge banner and the Applications stat
  // dot already use — the header bell now shares it too, instead of the
  // badge only ever reflecting unread messages and staying its normal
  // color regardless of whether anything shown actually needs attention.
  const followupCount = applications.filter((a) => a.needs_followup).length;
  const needsAttention = unread.count > 0 || followupCount > 0;

  const contentProps = {
    user, statsLoading, savedResumes, applications, updates, worldFeed, go,
    onDeleteResume: deleteResume,
    onDeleteApplication: deleteApplication,
    onUpdateApplicationStatus: updateApplicationStatus,
    onAddNote: setNoteApp,
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
                  <item.Icon className="size-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Fills what used to be dead space below a five-item nav on any
              screen taller than ~600px — real content instead of blank
              rail, and a genuine value-prop nudge (this app is anonymous by
              default; syncing across devices is the one real reason to
              create an account) rather than decoration for its own sake. */}
          <div className="flex-1 px-3 pt-2">
            {user ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 p-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                  <User className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="m-0 truncate text-[12.5px] font-bold text-foreground">{user.name || user.email}</p>
                </div>
              </div>
            ) : (
              <button
                onClick={() => go("settings")}
                className="w-full rounded-xl border border-primary/25 bg-primary/10 p-3 text-left [-webkit-tap-highlight-color:transparent]"
              >
                <p className="m-0 text-[12.5px] font-bold text-primary">Sign in</p>
                <p className="m-0 mt-0.5 text-[11px] leading-snug text-muted-foreground">Sync across devices</p>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border p-3">
            <ThemeToggle compact />
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setNotifOpen(true)}
                aria-label="Notifications"
                className="relative flex size-9 items-center justify-center rounded-xl border border-border bg-transparent text-muted-foreground [-webkit-tap-highlight-color:transparent] hover:text-foreground"
              >
                <Bell className="size-4" />
                {/* Red = needs action (an unread message or a stalled
                    application — see needsAttention above), not just a
                    flat count with no severity signal. A real unread-
                    message count still shows when that's the reason;
                    a plain dot covers the "stalled application, no new
                    message" case, which has no natural number of its own
                    here (see the stat row's own dot + the nudge banner
                    for that count instead). */}
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
              <button
                onClick={() => go("settings")}
                aria-label="Settings"
                className="flex size-9 items-center justify-center rounded-xl border border-border bg-transparent text-muted-foreground [-webkit-tap-highlight-color:transparent] hover:text-foreground"
              >
                <SettingsIcon className="size-4" />
              </button>
            </div>
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
      {/* Standalone PWA on iOS puts this right under the status bar/notch
          otherwise — a plain py-4 has no idea that space exists. */}
      <header
        className="flex shrink-0 items-center justify-between px-5 pb-4"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <Logo size={22} />
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <button onClick={() => setNotifOpen(true)} aria-label="Notifications" className="relative flex size-9 items-center justify-center rounded-full border border-border bg-muted text-foreground">
            <Bell className="size-[15px]" />
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
          <button onClick={() => go("settings")} aria-label="Settings" className="flex size-9 items-center justify-center rounded-full border border-border bg-muted text-foreground">
            <SettingsIcon className="size-[15px]" />
          </button>
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
      <NotificationsDialog open={notifOpen} onClose={() => setNotifOpen(false)} items={unread.items} onOpenItem={openNotification} />
      <AddNoteDialog app={noteApp} open={!!noteApp} onClose={() => setNoteApp(null)} onSaved={onNoteSaved} />
    </motion.div>
  );
}
