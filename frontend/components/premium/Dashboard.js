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
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowRight, ChevronRight, X, Clock, ExternalLink,
  Inbox, Check, CheckCircle2, Loader2, Zap,
  MoreVertical, Trash2, StickyNote,
  Bell, Moon, Sun, Home, Briefcase, ClipboardList, CircleUser, Building2, ArrowUpRight,
} from "lucide-react";
import { useTheme } from "@/lib/useTheme";

// Wrapped to the same { Svg } shape ArtTile/ToolChip expect everywhere
// else — a plain lucide icon, not a custom art asset, since "quick build"
// is a behavior (skip straight to pasting a job description) rather than
// its own illustrated concept the way Resume/Auto Apply/Tracker are.
const QUICK_BUILD_ART = { Svg: Zap };
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Btn } from "./guest/components/primitives";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "./shared/Avatar";
import { useAuth } from "@/lib/useAuth";
import { useViewport } from "@/lib/useViewport";
import { useUnreadNotifications } from "@/lib/useUnreadNotifications";
import { tapFeedback } from "@/lib/haptics";
import { apiRequest } from "./shared/api";
import { apiListSaved, apiDelete } from "./guest/api";
import { NavRail } from "./shared/NavRail";
import { MobileFloatingNav } from "./shared/MobileFloatingNav";
import { JobSearchStatsCard } from "./shared/JobSearchStatsCard";
import { NotificationsDialog } from "./shared/NotificationsDialog";
import { WelcomeNamePrompt } from "./shared/WelcomeNamePrompt";
import { QUICK_ACTION_ART } from "./shared/quickActionArt";
import { DASHBOARD_ART } from "./shared/dashboardArt";
import { Skeleton } from "@/components/ui/skeleton";
import { LAYOUTS } from "./shared/resumeLayouts/registry";
import { getPreferredTemplate, setPreferredTemplate } from "@/lib/templatePreference";
import Logo from "./Logo";
import { FONTS, ACCENTS } from "./guest/constants";

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

// "Jobs" means the Jobs Board — see NavRail.js's own NAV_ITEMS comment,
// same bug, same fix, mirrored here for the mobile floating nav. Plain
// single-stroke lucide icons (not the colored ArtTile illustrations the
// rest of this screen's cards use) — MobileFloatingNav fills them solid
// on the active tab and leaves everything else a resting grey outline,
// per the approved monochrome mobile reference.
const MOBILE_NAV_ITEMS = [
  { id: "home", Icon: Home, label: "Home" },
  { id: "jobsboard", Icon: Briefcase, label: "Jobs" },
  { id: "jobtracker", Icon: ClipboardList, label: "Applications" },
  { id: "profile", Icon: CircleUser, label: "Profile" },
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
// Real listings from the verified jobs pipeline (see JobsBoard.js /
// backend/app/jobs_ingest/) — always populated regardless of whether
// this particular account has done anything yet, which is what actually
// keeps Home from ever looking empty. Not personalized (no real matching
// engine exists) — freshest, most-verified listings, honestly, rather
// than pretending this is tailored to the viewer. A line-weight building
// glyph, not a text-initials tile ("SP") — the strict monochrome pass
// drops every placeholder-initial circle in favor of real vector icons,
// desktop included.
function RecommendedJobRow({ job }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Building2 className="size-4 text-muted-foreground/70" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-[12.5px] font-bold tracking-tight text-foreground">{job.title}</p>
        <p className="m-0 truncate text-[11px] font-medium text-muted-foreground/70">
          {job.company_name}{job.remote ? " · Remote" : ""}
        </p>
      </div>
      <a
        href={job.url} target="_blank" rel="noreferrer" aria-label={`Apply to ${job.title}`}
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground [-webkit-tap-highlight-color:transparent]"
      >
        <ArrowUpRight className="size-3.5" strokeWidth={1.75} />
      </a>
    </div>
  );
}

// Desktop — now its own full-width section (no longer squeezed into a
// half-width grid cell beside Templates, see DashboardContent), so this
// shows real listings 4-wide instead of cropping to 2.
function RecommendedCard({ jobs, loading, onSeeAll }) {
  return (
    <div className="mb-7">
      <SectionHeader onViewAll={onSeeAll} viewAllLabel="See all">Recommended</SectionHeader>
      <div className="flex flex-col divide-y divide-border">
        {loading ? (
          <><Skeleton className="my-2.5 h-9 w-full" /><Skeleton className="my-2.5 h-9 w-full" /></>
        ) : jobs.length === 0 ? (
          <p className="m-0 py-2 text-[12px] text-muted-foreground">Nothing fresh right now. Check back soon.</p>
        ) : (
          jobs.slice(0, 4).map((j) => (
            <div key={j.id} className="py-2.5">
              <RecommendedJobRow job={j} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Template micro-previews — one real, structurally distinct miniature
// per LAYOUTS entry, not one generic shape reused three times. Each
// mirrors how that layout actually builds a resume (see
// shared/resumeLayouts/blockBuilders.js): classic's centered header +
// full-width section rules, sidebar's real two-column split with its own
// Real sample copy + the app's ACTUAL font-family/accent tokens (see
// guest/constants.js) rendered at thumbnail scale — replaces an earlier
// version that drew these as abstract gray bars (a "Line"/"SectionLabel"
// pair of plain <div> rectangles standing in for text). Confirmed live
// as a real complaint, not a style nitpick: at a glance these read as
// loading-skeleton placeholders, not a preview of an actual resume —
// the exact opposite of what a template PICKER needs to communicate
// ("this is what yours will look like"). Real (if small) glyphs have
// natural, irregular shapes a uniform bar can never fake, which is what
// actually sells "this is real text" even when it's too small to read
// word-for-word — the same reason Google Docs/Canva's own template
// galleries render real sample text instead of bars.
const THUMB_FONT = FONTS.find((f) => f.id === "times")?.css || FONTS[0].css;
const THUMB_ACCENT = ACCENTS.find((a) => a.id === "navy")?.hex || "#1F3864";
const THUMB_INK = "#1A1A1A";

function ThumbSectionLabel({ children }) {
  return (
    <div
      className="w-full border-b"
      style={{ fontFamily: THUMB_FONT, fontSize: 5.5, fontWeight: 700, letterSpacing: "0.04em", color: THUMB_ACCENT, borderColor: THUMB_ACCENT, paddingBottom: 1 }}
    >
      {children}
    </div>
  );
}

function ClassicThumb() {
  return (
    <div className="flex h-full w-full flex-col items-center px-3 pt-3.5" style={{ fontFamily: THUMB_FONT, color: THUMB_INK }}>
      <div style={{ fontSize: 8, fontWeight: 700, lineHeight: 1.2 }}>Jordan Casey</div>
      <div style={{ fontSize: 4.5, color: THUMB_ACCENT, marginTop: 1 }}>Senior Product Designer</div>
      <div className="mt-2 h-px w-full bg-border" />
      <div className="mt-2.5 flex w-full flex-col gap-[3px]">
        <ThumbSectionLabel>EXPERIENCE</ThumbSectionLabel>
        <div style={{ fontSize: 4.5, fontWeight: 700, marginTop: 1 }}>Product Designer — Acme Co.</div>
        <div style={{ fontSize: 4, lineHeight: 1.35, color: "#444" }}>
          Led redesign of the core checkout flow, lifting conversion 18%.
          Mentored three junior designers across two product teams.
        </div>
      </div>
      <div className="mt-2 flex w-full flex-col gap-[3px]">
        <ThumbSectionLabel>EDUCATION</ThumbSectionLabel>
        <div style={{ fontSize: 4.5, marginTop: 1 }}>B.A. Design — State University</div>
      </div>
    </div>
  );
}

function SidebarThumb() {
  return (
    <div className="flex h-full w-full" style={{ fontFamily: THUMB_FONT, color: THUMB_INK }}>
      <div className="flex w-[36%] shrink-0 flex-col gap-[5px] px-2 pt-3.5" style={{ backgroundColor: THUMB_ACCENT, color: "#fff" }}>
        <div className="size-6 shrink-0 self-center rounded-full bg-white/20" />
        <div style={{ fontSize: 5, fontWeight: 700, textAlign: "center", lineHeight: 1.2, marginTop: 2 }}>Jordan Casey</div>
        <div style={{ fontSize: 4, fontWeight: 700, letterSpacing: "0.05em", opacity: 0.85, marginTop: 3 }}>CONTACT</div>
        <div style={{ fontSize: 3.5, opacity: 0.85, lineHeight: 1.5 }}>jordan@email.com<br />(555) 019-2834</div>
        <div style={{ fontSize: 4, fontWeight: 700, letterSpacing: "0.05em", opacity: 0.85, marginTop: 3 }}>SKILLS</div>
        <div style={{ fontSize: 3.5, opacity: 0.85, lineHeight: 1.5 }}>Figma · Prototyping<br />Design Systems</div>
      </div>
      <div className="flex flex-1 flex-col gap-[4px] px-2.5 pt-3.5">
        <div style={{ fontSize: 6.5, fontWeight: 700, lineHeight: 1.2 }}>Senior Product Designer</div>
        <div className="mt-1.5 flex flex-col gap-[3px]">
          <ThumbSectionLabel>EXPERIENCE</ThumbSectionLabel>
          <div style={{ fontSize: 4.5, fontWeight: 700, marginTop: 1 }}>Acme Co. <span style={{ fontWeight: 400, color: "#666" }}>· 2021–Present</span></div>
          <div style={{ fontSize: 4, lineHeight: 1.35, color: "#444" }}>
            Owns end-to-end design for the checkout and billing surfaces.
          </div>
        </div>
      </div>
    </div>
  );
}

function MinimalThumb() {
  return (
    <div className="flex h-full w-full flex-col items-center px-4 pt-5 text-center" style={{ fontFamily: THUMB_FONT, color: THUMB_INK }}>
      <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.03em" }}>JORDAN CASEY</div>
      <div style={{ fontSize: 4, color: "#777", marginTop: 1 }}>Senior Product Designer</div>
      <div className="mt-4 flex w-full flex-col items-center gap-[7px]">
        <div style={{ fontSize: 4.5, fontWeight: 600 }}>Experience</div>
        <div style={{ fontSize: 4, lineHeight: 1.4, color: "#555" }}>
          Product Designer, Acme Co.<br />Led the checkout redesign that lifted conversion 18%.
        </div>
        <div style={{ fontSize: 4.5, fontWeight: 600, marginTop: 2 }}>Education</div>
        <div style={{ fontSize: 4, color: "#555" }}>B.A. Design, State University</div>
      </div>
    </div>
  );
}

const THUMB_BODY = { classic: ClassicThumb, sidebar: SidebarThumb, minimal: MinimalThumb };

// The mobile/desktop shared physical-document thumbnail. Depth (the active
// card's scale + shadow) is driven by the SAME real `selected` state
// TemplatesCard already saves via templatePreference.js — picking a
// layout here IS what moves it forward, not a separate decorative scroll
// position. Sized to an actual Letter-page ratio (~0.77) so each one
// reads as a real document, not an icon.
function DocThumb({ layoutId, active, size = "md" }) {
  const Body = THUMB_BODY[layoutId] || ClassicThumb;
  const dims = size === "lg"
    ? { w: active ? 172 : 148, h: active ? 224 : 192 }
    : { w: active ? 148 : 122, h: active ? 192 : 158 };
  return (
    <div
      className="flex shrink-0 flex-col overflow-hidden rounded-xl bg-background transition-all duration-300 ease-out"
      style={{
        width: dims.w,
        height: dims.h,
        boxShadow: active ? "0 16px 40px rgba(0,0,0,0.1)" : "none",
        opacity: active ? 1 : 0.5,
        border: active ? "none" : "1px solid var(--border)",
      }}
    >
      <Body />
    </div>
  );
}

// Horizontal scroll-snap carousel — snap-x snap-mandatory with snap-center
// on every card, plus symmetric edge padding equal to half the active
// card's own width so the FIRST and LAST cards can still reach true dead
// center (without that padding a flex track can only ever center items
// strictly between its edges, never the ones nearest them — that was the
// "uncentered, unstable" bug). Tapping a card both selects it (the real
// templatePreference write) and scrolls it to center, so the active
// template always sits confidently in the middle of the frame, never
// off to one side.
function TemplatesCarousel({ onSeeAll, onPick, selected }) {
  // 50vw, not 50% — this track bleeds past its own parent's padded column
  // via -mx-5 below, so percentages here would resolve against that
  // narrower containing block (the padded column), not the actual screen
  // width the track visually spans, under-centering every card by exactly
  // that padding amount. vw is anchored to the real viewport instead.
  const edgePad = "calc(50vw - 74px)";
  const trackRef = useRef(null);

  // Center the already-selected card the instant this mounts — without
  // this, a fresh page load starts the native scroll position at 0 (the
  // track's own left edge), so the real default template sat visually
  // left-of-center until someone touched the carousel. "auto", not
  // "smooth": a jump on first paint should be invisible, not animated.
  useEffect(() => {
    const el = trackRef.current?.querySelector('[aria-pressed="true"]');
    el?.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
  }, []);

  const pick = (id, el) => {
    onPick(id);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-[0.12em] text-foreground/70 uppercase">Templates</span>
        {onSeeAll && (
          <button onClick={onSeeAll} className="flex items-center border-none bg-transparent p-0 text-muted-foreground/60 [-webkit-tap-highlight-color:transparent]">
            <ChevronRight className="size-4" />
          </button>
        )}
      </div>
      <div
        ref={trackRef}
        className="-mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-1 [scrollbar-width:none]"
        style={{ paddingLeft: edgePad, paddingRight: edgePad }}
      >
        {LAYOUTS.map((l) => (
          <button
            key={l.id} type="button" onClick={(e) => pick(l.id, e.currentTarget)}
            aria-label={l.label} aria-pressed={selected === l.id}
            className="shrink-0 snap-center border-none bg-transparent p-0 [-webkit-tap-highlight-color:transparent]"
          >
            <DocThumb layoutId={l.id} active={selected === l.id} />
          </button>
        ))}
      </div>
    </div>
  );
}

// Desktop — a dedicated, fully centered grid (not sharing a half-width
// column with Recommended anymore, see DashboardContent) so each card
// actually sits centered within its own grid cell instead of being
// squeezed against the next one.
function TemplatesGridDesktop({ onSeeAll, onPick, selected }) {
  return (
    <div className="mb-8">
      <SectionHeader onViewAll={onSeeAll} viewAllLabel="See all">Templates</SectionHeader>
      <div className="grid grid-cols-3 content-center justify-items-center gap-8 py-2">
        {LAYOUTS.map((l) => (
          <button
            key={l.id} type="button" onClick={() => onPick(l.id)}
            aria-label={l.label} aria-pressed={selected === l.id}
            className="border-none bg-transparent p-0 [-webkit-tap-highlight-color:transparent]"
          >
            <DocThumb layoutId={l.id} active={selected === l.id} size="lg" />
          </button>
        ))}
      </div>
    </div>
  );
}

// Mobile-only row for RecommendedCard's real job data — a line-weight
// building glyph instead of a colored initials tile, and a translucent
// grey arrow button instead of a solid primary-colored one, matching the
// strict monochrome treatment. Same real fields (job.title/company_name/
// remote/url) as RecommendedJobRow, just restyled.
function RecommendedJobRowMobile({ job }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted">
        <Building2 className="size-[22px] text-muted-foreground/70" strokeWidth={1.75} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="m-0 truncate text-sm font-bold tracking-tight text-foreground">{job.title}</p>
        <p className="m-0 truncate text-xs font-medium text-muted-foreground/70">
          {job.company_name}{job.remote ? " · Remote" : ""}
        </p>
      </div>
      <a
        href={job.url} target="_blank" rel="noreferrer" aria-label={`Apply to ${job.title}`}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground [-webkit-tap-highlight-color:transparent]"
      >
        <ArrowUpRight className="size-4" strokeWidth={1.75} />
      </a>
    </div>
  );
}

// Mobile-only replacement for RecommendedCard — same borderless-canvas
// treatment as the stats strip above it (no outer card), real jobs,
// stacked with hairline dividers instead of each row owning its own card.
function RecommendedListMobile({ jobs, loading }) {
  return (
    <div className="mb-7">
      <span className="mb-1 block text-[11px] font-bold tracking-[0.12em] text-foreground/70 uppercase">Recommended</span>
      <div className="flex flex-col divide-y divide-border">
        {loading ? (
          <><Skeleton className="my-2.5 h-12 w-full" /><Skeleton className="my-2.5 h-12 w-full" /></>
        ) : jobs.length === 0 ? (
          <p className="m-0 py-2.5 text-[12px] text-muted-foreground">Nothing fresh right now. Check back soon.</p>
        ) : (
          jobs.slice(0, 3).map((j) => <RecommendedJobRowMobile key={j.id} job={j} />)
        )}
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
            {latestResume ? (latestResume.name || "Resume ready") : "First Resume"}
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

// MobileFloatingNav now lives in shared/MobileFloatingNav.js — JobsBoard.js
// needs the exact same floating glass nav + FAB, so it's a shared
// component instead of a second hand-copy drifting out of sync.

// The sheet CreateFab opens — exactly "Your Resume" + Tools, the same two
// sections and the same components (ResumeStatusCard, ToolChip) that used
// to sit inline on the page, just reached through one tap instead of
// always taking up scroll space.
function CreateSheet({ open, onClose, latestResume, go }) {
  const act = (id, opts) => { onClose(); go(id, opts); };
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/40"
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 340 }}
            className="fixed inset-x-0 bottom-0 z-[61] rounded-t-[26px] border-t border-border bg-card p-5"
            style={{ paddingBottom: "calc(28px + env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-border" />
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[16px] font-bold text-foreground">Create</span>
              <button onClick={onClose} aria-label="Close" className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground [-webkit-tap-highlight-color:transparent]">
                <X className="size-4" />
              </button>
            </div>

            <ResumeStatusCard
              latestResume={latestResume}
              onOpen={() => act("resume", latestResume ? { resumeId: latestResume.id } : undefined)}
            />

            <div className="mt-5">
              <SectionHeader>Tools</SectionHeader>
              <div className="grid grid-cols-2 gap-2">
                <ToolChip art={QUICK_BUILD_ART} label="Quick Build" onClick={() => act("resume", { quickBuild: true })} />
                <ToolChip art={QUICK_ACTION_ART.apply} label="Auto Apply" onClick={() => act("apply")} />
                <ToolChip art={QUICK_ACTION_ART.scan} label="CV Scan" onClick={() => act("scan")} />
                <ToolChip art={QUICK_ACTION_ART.tracker} label="Tracker" onClick={() => act("jobtracker")} />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
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
        {/* No "Resume" chip here — the "Your resume" card right above this
            already is that entry point (Start / View · Edit). A second
            button doing the identical thing read as clutter, not a
            shortcut — see the Dashboard cleanup note in DashboardContent. */}
        <div className="grid grid-cols-1 gap-2">
          <ToolChip art={QUICK_BUILD_ART} label="Quick Build" onClick={() => go("resume", { quickBuild: true })} />
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
        <DialogHeader><DialogTitle>Note for {app.role} at {app.company}</DialogTitle></DialogHeader>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="What's worth remembering about this one?" autoFocus />
        <DialogFooter>
          <Btn small variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn small variant="gold" onClick={save} loading={saving}>Save note</Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Only rendered on a rejected application — two short questions, not a
// whole screen: "why" and "reapply" each fetch one AI-generated 2-3
// sentence answer (see backend's POST /applications/<id>/insight) on
// demand, cached per-kind so re-opening one already fetched this render
// doesn't re-call the AI for text that hasn't changed.
function RejectionHelp({ appId }) {
  const [answers, setAnswers] = useState({}); // kind -> text
  const [loadingKind, setLoadingKind] = useState(null);
  const [openKind, setOpenKind] = useState(null);

  const ask = async (kind) => {
    if (openKind === kind) { setOpenKind(null); return; }
    setOpenKind(kind);
    if (answers[kind]) return;
    setLoadingKind(kind);
    try {
      const data = await apiRequest(`/api/v1/applications/${appId}/insight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      setAnswers((a) => ({ ...a, [kind]: data.text }));
    } catch (e) {
      setAnswers((a) => ({ ...a, [kind]: e.message || "Couldn't load that right now." }));
    } finally {
      setLoadingKind(null);
    }
  };

  return (
    <div className="mt-2 border-t border-border pt-2">
      <div className="flex gap-1.5">
        <button
          onClick={() => ask("why")}
          className={`flex-1 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold [-webkit-tap-highlight-color:transparent] ${
            openKind === "why" ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"
          }`}
        >
          What happened?
        </button>
        <button
          onClick={() => ask("reapply")}
          className={`flex-1 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold [-webkit-tap-highlight-color:transparent] ${
            openKind === "reapply" ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"
          }`}
        >
          Worth reapplying?
        </button>
      </div>
      {openKind && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-muted/40 p-2.5 text-[12px] leading-relaxed text-foreground">
          {loadingKind === openKind ? (
            <>
              <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Thinking…</span>
            </>
          ) : (
            answers[openKind]
          )}
        </div>
      )}
    </div>
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
      className="shrink-0 border-none bg-transparent p-0 [-webkit-tap-highlight-color:transparent]"
    >
      <Avatar user={user} size={36} />
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
}) {
  const recentResumes = savedResumes.slice(0, 3);
  const recentApps = applications.slice(0, 3);
  const followupCount = applications.filter((a) => a.needs_followup).length;

  // Deleting either of these is permanent — asked for up front rather than
  // firing straight off the dropdown item. setTimeout defers opening the
  // AlertDialog until after the dropdown's own closing animation, same
  // trick onAddNote already uses below for the same reason.
  const [confirmDeleteResumeId, setConfirmDeleteResumeId] = useState(null);
  const [confirmDeleteApplicationId, setConfirmDeleteApplicationId] = useState(null);

  const [selectedTemplate, setSelectedTemplate] = useState(() => getPreferredTemplate() || "classic");
  const pickTemplate = (id) => { setPreferredTemplate(id); setSelectedTemplate(id); };

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

  // Mobile-only — pure typography, no avatar (the header's own avatar-ring
  // button already covers that tap target, see Dashboard's header below),
  // tight line-height, a bolder headline than the desktop banner's version
  // per the approved mobile reference.
  const mobileGreetingRow = (
    <div className="min-w-0">
      <p className="m-0 truncate text-[13px] font-semibold text-muted-foreground">
        {greeting()}{user ? `, ${user.name || user.email.split("@")[0]}` : ""}
      </p>
      <h1 className="m-0 mt-0.5 text-3xl font-extrabold tracking-tight text-foreground">Let's get you hired.</h1>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-8 sm:py-8 lg:max-w-4xl">
      {isDesktop ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          // Sticky to the top of the scrollable center column, same as the
          // nav rail is fixed beside it — the greeting never has to be
          // scrolled back up to, it's just always there.
          className="dark sticky top-0 z-20 mb-2 flex h-[130px] items-center overflow-hidden rounded-3xl"
        >
          <img src="/dashboard/greeting-banner.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/10" />
          {/* Fades the photo's own bottom edge into the page background
              (no new color — bg-background is the same token the stats
              card sits on) so the banner dissolves into what's below it
              instead of ending on a hard photographic edge right above
              the card. Also doubles as the sticky banner's opaque floor —
              scrolled content passing underneath never shows through. */}
          <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-b from-transparent to-background" />
          <div className="relative w-full px-6">{greetingRow}</div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="sticky top-0 z-20 mb-6 bg-background pt-1 pb-4"
        >
          {mobileGreetingRow}
          <div className="mt-4 h-px bg-border" />
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
        <JobSearchStatsCard applications={applications} loading={statsLoading} onViewAll={() => go("jobtracker")} isDesktop={isDesktop} />
      </motion.div>

      {/* "Your Resume" and Tools used to live here inline on mobile (desktop
          still has them in its own right rail — DesktopRightRail). Moved
          into the Create sheet (CreateSheet, opened from the floating nav's
          own "+") instead: two whole sections of vertical space back on
          every phone, and Create is one tap away either way. Templates used
          to share a cramped half-width column with Recommended on desktop —
          that's exactly what made the cards read as uncentered/squeezed.
          Both are now their own full-width section on every breakpoint,
          each one centered in its own container. */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.2 }}>
        {isDesktop ? (
          <TemplatesGridDesktop onSeeAll={() => go("templates")} onPick={pickTemplate} selected={selectedTemplate} />
        ) : (
          <TemplatesCarousel onSeeAll={() => go("templates")} onPick={pickTemplate} selected={selectedTemplate} />
        )}
        {isDesktop ? (
          <RecommendedCard jobs={recommendedJobs} loading={recommendedLoading} onSeeAll={() => go("jobsboard")} />
        ) : (
          <RecommendedListMobile jobs={recommendedJobs} loading={recommendedLoading} />
        )}
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
                      <DropdownMenuItem className="text-destructive data-highlighted:text-destructive" onSelect={() => setTimeout(() => setConfirmDeleteResumeId(r.id), 0)}>
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
                  <div key={a.id} className="glass-surface rounded-xl p-3">
                    <div className="flex items-center gap-2">
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
                          <DropdownMenuItem className="text-destructive data-highlighted:text-destructive" onSelect={() => setTimeout(() => setConfirmDeleteApplicationId(a.id), 0)}>
                            <Trash2 className="size-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {a.status === "rejected" && <RejectionHelp appId={a.id} />}
                  </div>
                );
              })}
          </div>
        </motion.div>
      )}

      <AlertDialog open={!!confirmDeleteResumeId} onOpenChange={(o) => !o && setConfirmDeleteResumeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this resume?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => { onDeleteResume(confirmDeleteResumeId); setConfirmDeleteResumeId(null); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDeleteApplicationId} onOpenChange={(o) => !o && setConfirmDeleteApplicationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this application?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => { onDeleteApplication(confirmDeleteApplicationId); setConfirmDeleteApplicationId(null); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

export default function Dashboard({ onNavigate, onSignOut }) {
  const { user, loading: authLoading, logout, updateProfile } = useAuth();
  const { isDesktop } = useViewport();
  const { theme, toggleTheme } = useTheme();
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
  const [createOpen, setCreateOpen] = useState(false);

  const go = (id, opts) => {
    tapFeedback();
    if (id === "home") return;
    onNavigate(id, opts);
  };

  const openNotification = (item) => go("apply", { runId: item.run.id });

  const signOut = () => {
    logout();
    onSignOut?.();
  };

  const deleteResume = async (id) => {
    const prev = savedResumes;
    setSavedResumes((list) => list.filter((r) => r.id !== id));
    const ok = await apiDelete(id);
    if (!ok) {
      // Optimistic removal didn't actually happen server-side — restore
      // it instead of leaving the UI permanently out of sync with the
      // real saved-resumes list (previously the toast was the only
      // signal, and a later reload would silently bring it back,
      // reading as "my save was lost").
      setSavedResumes(prev);
      toast.error("Couldn't delete that resume.");
    }
  };
  const deleteApplication = async (id) => {
    const prev = applications;
    setApplications((list) => list.filter((a) => a.id !== id));
    try {
      await apiRequest(`/api/v1/applications/${id}`, { method: "DELETE" });
    } catch (e) {
      setApplications(prev);
      toast.error(e.message || "Couldn't delete that application.");
    }
  };
  const updateApplicationStatus = async (id, status) => {
    const prev = applications;
    setApplications((list) => list.map((a) => (a.id === id ? { ...a, status } : a)));
    try {
      const updated = await apiRequest(`/api/v1/applications/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      });
      setApplications((list) => list.map((a) => (a.id === id ? { ...a, ...updated } : a)));
    } catch (e) {
      setApplications(prev);
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
  };

  if (isDesktop) {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 flex bg-background font-sans"
      >
        <NavRail active="home" user={user} onNavigate={go} onNotifClick={() => setNotifOpen(true)} onSignOut={signOut} />

        {/* No SparkleBackground here — its amber/emerald twinkle dots are
            exactly the decorative accent color the strict monochrome pass
            now rules out on desktop too (see the mobile branch's own note
            below), not just mobile. */}
        <main className="relative min-w-0 flex-1 overflow-y-auto">
          <DashboardContent {...contentProps} />
        </main>
        <DesktopRightRail savedResumes={savedResumes} go={go} />
        <NotificationsDialog open={notifOpen} onClose={() => setNotifOpen(false)} items={unread.items} onOpenItem={openNotification} />
        <AddNoteDialog app={noteApp} open={!!noteApp} onClose={() => setNoteApp(null)} onSaved={onNoteSaved} />
        <WelcomeNamePrompt user={user} updateProfile={updateProfile} />
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
        <div className="flex items-center gap-3">
          <button onClick={() => setNotifOpen(true)} aria-label="Notifications" className="relative flex size-9 items-center justify-center rounded-full border border-border text-foreground [-webkit-tap-highlight-color:transparent]">
            <Bell className="size-[18px]" strokeWidth={1.75} />
            {needsAttention && (
              unread.count > 0 ? (
                <span className="absolute top-0 right-0 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
                  {unread.count > 9 ? "9+" : unread.count}
                </span>
              ) : (
                <span className="absolute top-0.5 right-0.5 size-2.5 rounded-full bg-destructive" />
              )
            )}
          </button>
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex size-9 items-center justify-center rounded-full border border-border text-foreground [-webkit-tap-highlight-color:transparent]"
          >
            {theme === "dark" ? <Sun className="size-[18px]" strokeWidth={1.75} /> : <Moon className="size-[18px]" strokeWidth={1.75} />}
          </button>
          <button
            onClick={() => go("personal-profile")}
            aria-label="Personal profile"
            className="rounded-full ring-1 ring-border [-webkit-tap-highlight-color:transparent]"
          >
            <Avatar user={user} size={34} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto" style={{ paddingBottom: "calc(110px + env(safe-area-inset-bottom, 0px))" }}>
        <DashboardContent {...contentProps} />
      </div>

      <MobileFloatingNav
        items={MOBILE_NAV_ITEMS}
        active="home"
        onChange={(id) => go(id)}
        onCreate={() => setCreateOpen(true)}
      />
      <CreateSheet open={createOpen} onClose={() => setCreateOpen(false)} latestResume={savedResumes[0]} go={go} />
      <NotificationsDialog open={notifOpen} onClose={() => setNotifOpen(false)} items={unread.items} onOpenItem={openNotification} />
      <AddNoteDialog app={noteApp} open={!!noteApp} onClose={() => setNoteApp(null)} onSaved={onNoteSaved} />
      <WelcomeNamePrompt user={user} updateProfile={updateProfile} />
    </motion.div>
  );
}
