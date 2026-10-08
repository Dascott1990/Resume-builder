"use client";
/**
 * JobsBoard.js — browse real, verified job listings sourced from official
 * ATS company boards (Greenhouse, Ashby) and public job aggregators
 * (Remotive, Arbeitnow). Distinct from Apply with AI (the "Jobs" nav tab):
 * that flow fills out an application for a job you already found; this
 * screen is how you find one, with an honest trust signal on every
 * listing instead of a bare title-and-apply-button.
 *
 * Reads GET /api/v1/jobs (filtered, paginated) and GET /api/v1/jobs/meta
 * (last-updated + per-source health + live category/country totals for
 * the filter dropdowns — never hardcoded, see backend/app/api/
 * jobs_board.py's own docstring on why) — both public, no auth needed,
 * same as this screen itself.
 *
 * Desktop shares Dashboard.js's exact three-column shell (NavRail, see
 * shared/NavRail.js) instead of its own isolated back-button header:
 * trending + search stay in the scrollable middle column, Filters move
 * into a right rail so they're always visible instead of pushing results
 * further down the page. Mobile keeps the original single-column,
 * back-button pattern — narrower viewports don't have room to spare for
 * a third column.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ExternalLink, ShieldCheck, ShieldQuestion, MapPin, Search,
  ChevronDown, Loader2, Inbox, Info, X, Flame, TrendingUp,
  Bell, Moon, Sun, Building2, ArrowRight, Home, Briefcase, ClipboardList, CircleUser, Check,
} from "lucide-react";
import { apiRequest } from "./shared/api";
import { Btn } from "./guest/components/primitives";
import { NavRail } from "./shared/NavRail";
import { Avatar } from "./shared/Avatar";
import { firstNameOf } from "./shared/artisanDisplay";
import { MobileFloatingNav } from "./shared/MobileFloatingNav";
import { NotificationsDialog } from "./shared/NotificationsDialog";
import { JobDetail } from "./JobDetail";
import { SOURCE_LABELS, SOURCES_WITHOUT_DIRECT_LINK, timeAgo } from "./shared/jobsBoardShared";
import { useAuth } from "@/lib/useAuth";
import { useViewport } from "@/lib/useViewport";
import { useUnreadNotifications } from "@/lib/useUnreadNotifications";
import { useTheme } from "@/lib/useTheme";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { tapFeedback } from "@/lib/haptics";
import { useLanguage } from "@/lib/i18n";

// Same four destinations, same icon set as Dashboard.js's own
// MOBILE_NAV_ITEMS — one shared visual language across every mobile
// screen that mounts MobileFloatingNav, not a second hand-copy. A
// function, not a plain array, like remoteOptions/levelOptions above —
// needs the current language but lives outside any component.
const mobileNavItems = (t) => [
  { id: "home", Icon: Home, label: t("navItem.home") },
  { id: "jobsboard", Icon: Briefcase, label: t("navItem.jobs") },
  { id: "jobtracker", Icon: ClipboardList, label: t("navItem.applications") },
  { id: "profile", Icon: CircleUser, label: t("navItem.profile") },
];

// `t` passed in — same identical function as Dashboard.js's own, reused
// here rather than imported (this file never imports from Dashboard.js
// in either direction, see the file-level docstring's own reasoning for
// jobsBoardShared.js existing in the first place).
function greeting(t) {
  const h = new Date().getHours();
  if (h < 5) return t("dashboard.greeting.lateNight");
  if (h < 12) return t("dashboard.greeting.morning");
  if (h < 18) return t("dashboard.greeting.afternoon");
  return t("dashboard.greeting.evening");
}

// Functions, not plain arrays — these feed <option> labels, which need
// the current language, but live outside any component and can't call
// useLanguage() themselves.
const remoteOptions = (t) => [
  { id: "", label: t("jobsBoard.remoteOrOnsite") },
  { id: "true", label: t("jobsBoard.remoteOnly") },
  { id: "false", label: t("jobsBoard.onsiteOnly") },
];

const levelOptions = (t) => [
  { id: "", label: t("jobsBoard.anyVerificationLevel") },
  { id: "2", label: t("jobsBoard.level2Plus") },
  { id: "3", label: t("jobsBoard.level3Plus") },
];

function countryName(code) {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

function VerificationBadge({ verification }) {
  const { t } = useLanguage();
  const { level, checks_not_attempted } = verification;
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const label = level >= 3 ? t("jobsBoard.domainAgeVerified") : level === 2 ? t("jobsBoard.domainConfirmed") : t("jobsBoard.sourceVerified");
  const Icon = level >= 2 ? ShieldCheck : ShieldQuestion;

  // Every job card has its own backdrop-filter (.glass-surface's blur),
  // and backdrop-filter creates a new CSS stacking context — a z-20
  // absolute child can never paint above a SIBLING card once each card
  // is its own isolated stacking context, confirmed live: the popover was
  // rendering underneath the next card in the grid instead of on top of
  // it. Portaling straight to document.body escapes every card's own
  // stacking context entirely, the same way Radix/shadcn's own
  // Dialog/Popover primitives already do for this exact reason.
  const toggle = (e) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const left = Math.min(r.left, window.innerWidth - 272);
      setPos({ top: r.bottom + 6, left: Math.max(8, left) });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10.5px] font-bold text-primary-text [-webkit-tap-highlight-color:transparent]"
      >
        <Icon className="size-3" /> Level {level} · {label}
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0 z-[90]" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div
            onClick={(e) => e.stopPropagation()}
            className="fixed z-[91] w-64 rounded-xl border border-border bg-card p-3 shadow-lg"
            style={{ top: pos.top, left: pos.left }}
          >
            <p className="m-0 mb-1.5 text-[11px] font-bold text-foreground">{t("jobsBoard.whatWasChecked")}</p>
            <ul className="m-0 grid gap-1 p-0 pl-4 text-[11px] text-muted-foreground">
              {verification.checks_passed.map((c) => <li key={c}>{c.replace(/^level\d_/, "").replace(/_/g, " ")}</li>)}
            </ul>
            {checks_not_attempted?.length > 0 && (
              <p className="m-0 mt-1.5 text-[10.5px] text-muted-foreground/70">
                {t("jobsBoard.notAttempted", { list: checks_not_attempted.map((c) => c.replace(/^level\d_/, "").replace(/_/g, " ")).join(", ") })}
              </p>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

// Same card architecture as Dashboard.js's RecommendedJobCard — company-
// initials logo tile, title/company, meta line, a real salary line when
// the source actually has one, Apply as its own pill rather than the
// whole card being one giant anchor (that also fixes VerificationBadge's
// inner button being invalid HTML nested inside an <a>, same "no
// interactive element inside another one" issue TrendingChip's own
// comment already documents below). Jobs Board keeps the extra trust
// content Dashboard's compact teaser doesn't need — category/remote
// chips, the verification badge, source attribution — this screen's
// whole reason to exist per its own docstring above.
function JobCard({ job, applied, onOpen }) {
  const { t } = useLanguage();
  // The card itself opens JobDetail on click — Apply and the verification
  // popover are real nested interactive elements, so each stops its own
  // click from bubbling up to the card (otherwise tapping Apply would
  // open both the external link AND the detail screen at once).
  return (
    <div
      role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(); }}
      className="glass-surface flex cursor-pointer flex-col gap-2.5 rounded-2xl p-4 text-left [-webkit-tap-highlight-color:transparent]"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-muted font-mono text-[11px] font-bold text-muted-foreground">
          {job.company_name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-[14px] font-bold text-foreground">{job.title}</p>
          <p className="m-0 truncate text-[12px] text-muted-foreground">{job.company_name}</p>
        </div>
        {applied && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10.5px] font-bold text-success">
            <Check className="size-3" /> {t("status.applied")}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-bold text-muted-foreground">{job.category}</span>
        {job.remote && <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10.5px] font-bold text-success">{t("common.remote")}</span>}
        {job.location && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="size-3" /> {job.location}
          </span>
        )}
      </div>

      {/* Real, employer-entered text (see sources.py's fetch_remotive) —
          only Remotive exposes real compensation data today, so this is
          absent, not guessed, on every other source's jobs. */}
      {job.salary && <p className="m-0 text-[12.5px] font-bold text-success">{job.salary}</p>}

      {SOURCES_WITHOUT_DIRECT_LINK.has(job.source) && (
        <p className="m-0 text-[10.5px] text-muted-foreground/70">{t("jobsBoard.opensCompanyPage", { company: job.company_name })}</p>
      )}

      {/* flex-wrap — both children are shrink-0 (the badge must never
          wrap its own text into the distorted rounded-full blob that
          caused live, see VerificationBadge above) so at a squeezed
          card width the "via ..." text drops to its own line below
          instead of forcing the row wider than the card. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <VerificationBadge verification={job.verification} />
        <span className="shrink-0 text-[10.5px] text-muted-foreground/70">
          {t("jobsBoard.viaSource", { source: SOURCE_LABELS[job.source] || job.source })} · {timeAgo(job.posted_at, t)}
        </span>
      </div>

      <a
        href={job.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
        className="flex w-fit items-center gap-1 self-start rounded-[10px] bg-primary px-3.5 py-1.5 text-[12px] font-bold text-primary-foreground [-webkit-tap-highlight-color:transparent]"
      >
        {t("jobsBoard.apply")} <ExternalLink className="size-3" />
      </a>
    </div>
  );
}

// Mobile-only replacement for JobCard — the strict monochrome "invisible
// container" treatment from the approved mobile reference: no border, no
// colored tag fills, a line-weight building glyph instead of a colored
// company-initials tile. Spec pills only ever show REAL fields this
// backend actually returns (category/remote/location) — no fabricated
// employment-type or experience-level tags, since nothing in the real job
// object carries that data (see jobs_board.py's own documented shape).
// Tapping the card (not a separate Apply button) opens JobDetail — Apply
// itself now lives on that screen's sticky action bar.
function JobCardMobile({ job, applied, onOpen }) {
  const { t } = useLanguage();
  const specs = [
    job.category,
    job.remote ? t("common.remote") : (job.location ? t("jobsBoard.onsite") : null),
    job.location,
  ].filter(Boolean);

  return (
    <button
      type="button" onClick={onOpen}
      className="flex w-full flex-col gap-2.5 rounded-2xl border-none bg-background p-4 text-left [-webkit-tap-highlight-color:transparent]"
      style={{ boxShadow: "var(--job-card-shadow)" }}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Building2 className="size-[18px] text-muted-foreground/70" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="m-0 truncate text-[15px] font-bold tracking-tight text-foreground">{job.title}</p>
            {applied && <Check className="size-3.5 shrink-0 text-foreground" strokeWidth={2.5} />}
          </div>
          <p className="m-0 truncate text-[12px] font-medium text-muted-foreground/70">
            {job.company_name}{applied ? ` · ${t("status.applied")}` : ""}
          </p>
        </div>
        {job.salary && (
          <span className="shrink-0 pt-0.5 text-[13px] font-bold tracking-tight text-foreground">{job.salary}</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 pl-[52px]">
        {specs.map((s, i) => (
          <span key={s} className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground/60">
            {i > 0 && <span className="text-muted-foreground/30">&middot;</span>} {s}
          </span>
        ))}
        {job.posted_at && (
          <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground/60">
            {specs.length > 0 && <span className="text-muted-foreground/30">&middot;</span>} {timeAgo(job.posted_at, t)}
          </span>
        )}
        <span className="ml-auto shrink-0 text-muted-foreground/40">
          <ArrowRight className="size-4" strokeWidth={1.75} />
        </span>
      </div>
    </button>
  );
}

// "Category" filter chips — real categoryOptions (meta.live_category_totals),
// not a hardcoded list. "All" is the one solid pitch-black pill; every
// other chip floats as plain grey text with zero background/border, per
// the approved monochrome reference.
function CategoryPills({ categoryOptions, value, onChange }) {
  const { t } = useLanguage();
  const chipClass = (selected) =>
    selected
      ? "rounded-full bg-foreground px-4 py-2 text-background"
      : "rounded-full bg-transparent px-3 py-2 text-muted-foreground/60";
  return (
    <div className="-mx-5 mb-6 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
      <button type="button" onClick={() => onChange("")} className={`shrink-0 border-none text-[13px] font-semibold [-webkit-tap-highlight-color:transparent] ${chipClass(value === "")}`}>
        {t("jobsBoard.all")}
      </button>
      {categoryOptions.filter((c) => c.id).map((c) => (
        <button
          key={c.id} type="button" onClick={() => onChange(c.id)}
          className={`shrink-0 border-none text-[13px] font-semibold [-webkit-tap-highlight-color:transparent] ${chipClass(value === c.id)}`}
        >
          {c.id}
        </button>
      ))}
    </div>
  );
}

function FilterSelect({ value, onChange, options, placeholder, fullWidth }) {
  return (
    <div className={`relative ${fullWidth ? "w-full" : ""}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`min-w-0 appearance-none rounded-xl border border-border bg-card py-2 pr-8 pl-3 text-[12.5px] font-semibold text-foreground [-webkit-tap-highlight-color:transparent] ${fullWidth ? "w-full" : ""}`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

// Shared between the mobile sticky-header row (flex-wrap) and the desktop
// right rail (stacked, full-width selects) — same four filters either way.
function FiltersPanel({ category, setCategory, country, setCountry, remote, setRemote, minLevel, setMinLevel, categoryOptions, countryOptions, vertical }) {
  const { t } = useLanguage();
  return (
    <div className={vertical ? "grid gap-2" : "flex flex-wrap gap-2"}>
      <FilterSelect value={category} onChange={setCategory} options={categoryOptions} fullWidth={vertical} />
      <FilterSelect value={country} onChange={setCountry} options={countryOptions} fullWidth={vertical} />
      <FilterSelect value={remote} onChange={setRemote} options={remoteOptions(t)} fullWidth={vertical} />
      <FilterSelect value={minLevel} onChange={setMinLevel} options={levelOptions(t)} fullWidth={vertical} />
    </div>
  );
}

// What's actually narrowing the list right now, spelled out — not just a
// generic "Clear" link. Confirmed live this was a real gap: the search
// box and the 4 filter selects all collapse away (scroll-to-collapse on
// desktop, the overlay panel closing on mobile), and once they're gone
// there was no remaining trace of what was still filtering the results
// underneath — a plain-looking, un-searched-feeling list that was
// actually quietly narrowed to "Engineering, remote, Level 3+." Each
// pill names one active constraint in plain language and clears just
// that one; this renders independently of controlsCollapsed/
// mobileSearchOpen so it stays visible exactly when the controls that
// set these values are not. Trending gets no pill of its own here — it
// already replaces the search box with its own dedicated "Showing: X"
// banner (searchOrActiveTrending), which stays visible as long as it's
// active.
function ActiveFilterChips({ search, setSearch, category, setCategory, country, setCountry, remote, setRemote, minLevel, setMinLevel }) {
  const { t } = useLanguage();
  const chips = [];
  if (search.trim()) chips.push({ key: "search", label: `"${search.trim()}"`, clear: () => setSearch("") });
  if (category) chips.push({ key: "category", label: category, clear: () => setCategory("") });
  if (country) chips.push({ key: "country", label: countryName(country), clear: () => setCountry("") });
  if (remote) chips.push({ key: "remote", label: remoteOptions(t).find((o) => o.id === remote)?.label, clear: () => setRemote("") });
  if (minLevel) chips.push({ key: "minLevel", label: t("jobsBoard.levelPlus", { n: minLevel }), clear: () => setMinLevel("") });

  if (!chips.length) return null;
  return (
    <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.clear}
          className="flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 py-1 pr-1.5 pl-2.5 text-[11.5px] font-semibold text-primary-text [-webkit-tap-highlight-color:transparent]"
        >
          {chip.label}
          <X className="size-3" />
        </button>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={() => { setSearch(""); setCategory(""); setCountry(""); setRemote(""); setMinLevel(""); }}
          className="border-none bg-transparent p-0 text-[11.5px] font-bold text-muted-foreground [-webkit-tap-highlight-color:transparent]"
        >
          {t("jobsBoard.clearAll")}
        </button>
      )}
    </div>
  );
}

// One trending field — the growth stat is real and cited (see backend/
// app/jobs_ingest/trending.py), never invented; tapping it searches THIS
// pipeline's own live inventory for that field, so "hottest right now"
// stays honest about the gap between "the labor market is growing here"
// and "here's what's actually postable in this jobs board today."
function TrendingChip({ field, active, onClick }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      {/* A real <div role="button">, not a nested <button> — the inner
          Info toggle is its own real <button>, and HTML forbids a
          <button> inside a <button> (confirmed live: React threw a
          hydration-mismatch warning over exactly this before the fix). */}
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className={`flex cursor-pointer flex-col items-start gap-1 rounded-2xl border px-3.5 py-2.5 text-left [-webkit-tap-highlight-color:transparent] ${active ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/30"}`}
        style={{ minWidth: 148 }}
      >
        <div className="flex w-full items-center justify-between gap-2">
          <span className="text-[12.5px] font-bold text-foreground">{field.label}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            aria-label={t("jobsBoard.source")}
            className="shrink-0 border-none bg-transparent p-0 text-muted-foreground/60"
          >
            <Info className="size-3" />
          </button>
        </div>
        {field.growth ? (
          <span className="flex items-center gap-1 text-[11px] font-bold text-success">
            <TrendingUp className="size-3" /> {field.growth} <span className="font-normal text-muted-foreground">{field.window}</span>
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-muted-foreground">{t("jobsBoard.highDemand", { window: field.window })}</span>
        )}
        <span className="text-[10.5px] text-muted-foreground/70">{t("jobsBoard.openNow", { n: field.live_count })}</span>
      </div>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1.5 w-60 rounded-xl border border-border bg-card p-3 text-[11px] leading-relaxed text-muted-foreground shadow-lg">
          {field.source}
        </div>
      )}
    </div>
  );
}

// What search + filters (mobile) / search alone (desktop, filters live in
// the always-visible right rail there) collapse down to once scrolled —
// tap it to bring the full controls back. Used to be two separate icons
// (Search + Filters) on mobile, but both ever did the exact same thing —
// tapping either expanded the identical combined panel — which read as
// broken ("I tapped Filters and it opened search too"), not as two real
// options. One button now; the dot is still the "something's set" signal,
// matching every other notification-dot in this app (NavRail's bell, etc).
function CollapsedControls({ onExpand, filtersActive }) {
  const { t } = useLanguage();
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <button
        type="button" onClick={onExpand} aria-label={t("jobsBoard.searchAndFilters")}
        className="relative flex size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground [-webkit-tap-highlight-color:transparent] hover:text-foreground"
      >
        <Search className="size-4" />
        {filtersActive && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" />}
      </button>
    </div>
  );
}

// Drifts sideways on its own — a slow, continuous ping-pong scroll (not a
// hard jump-reset at the end, which would read as a glitch) — while
// staying a real, fully manual-scrollable track: any touch/pointer down
// on it pauses the drift immediately, and it only resumes a couple
// seconds after release, so a deliberate swipe never fights the
// animation. Respects prefers-reduced-motion (the drift itself is purely
// decorative; manual scroll and tapping a chip both still work either
// way).
function TrendingRow({ fields, activeId, onPick }) {
  const { t } = useLanguage();
  const trackRef = useRef(null);
  const directionRef = useRef(1);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef(null);
  // The real, sub-pixel-precise scroll position, tracked separately from
  // el.scrollLeft — confirmed live: WebKit rounds that DOM property to
  // whole pixels on readback, so accumulating a ~0.45px/frame drift by
  // reading el.scrollLeft back each frame silently truncates to 0 every
  // single frame and the row never moves at all. This ref is the real
  // position; el.scrollLeft only ever receives the rounded result of it.
  const posRef = useRef(0);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reducedMotion || !fields?.length) return;
    let raf;
    const tick = () => {
      const el = trackRef.current;
      if (el && !pausedRef.current) {
        const max = el.scrollWidth - el.clientWidth;
        if (max > 1) {
          let next = posRef.current + directionRef.current * 0.6;
          if (next >= max) { next = max; directionRef.current = -1; }
          else if (next <= 0) { next = 0; directionRef.current = 1; }
          posRef.current = next;
          el.scrollLeft = next;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion, fields]);

  const pause = () => {
    pausedRef.current = true;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  };
  const scheduleResume = () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    // Pick the drift back up from wherever the user's own swipe actually
    // left it, not wherever the animation itself last was — otherwise
    // resuming would yank the row back to its pre-swipe position.
    resumeTimerRef.current = setTimeout(() => {
      if (trackRef.current) posRef.current = trackRef.current.scrollLeft;
      pausedRef.current = false;
    }, 2500);
  };
  useEffect(() => () => { if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current); }, []);

  if (!fields?.length) return null;
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-1.5">
        <Flame className="size-3.5 text-primary" />
        <span className="font-mono text-[10.5px] font-bold tracking-[0.1em] text-muted-foreground/60 uppercase">{t("jobsBoard.hottestRightNow")}</span>
      </div>
      {/* relative + an absolute fade on the right edge — horizontal-only
          scroll (no vertical drift, no wrapping) that reads as an
          intentional scroller instead of content abruptly cut off
          against the right rail's border. */}
      <div className="relative">
        <div
          ref={trackRef}
          onPointerDown={pause}
          onPointerUp={scheduleResume}
          onPointerCancel={scheduleResume}
          onPointerLeave={scheduleResume}
          className="flex gap-2 overflow-x-auto overflow-y-hidden pr-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {fields.map((f) => <TrendingChip key={f.id} field={f} active={f.id === activeId} onClick={() => onPick(f)} />)}
        </div>
        <div className="pointer-events-none absolute top-0 right-0 bottom-1 w-8 bg-gradient-to-r from-transparent to-background" />
      </div>
    </div>
  );
}

export default function JobsBoard({ onClose, onNavigate }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { isDesktop } = useViewport();
  const { theme, toggleTheme } = useTheme();
  const unread = useUnreadNotifications();
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [meta, setMeta] = useState(null);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);

  // Mobile's own search/filters trigger — deliberately NOT the same
  // controlsCollapsed state desktop's sticky header uses below. That one
  // lives inline in the scrollable column, so collapsing it is what keeps
  // it from permanently occupying space; this one renders as a fixed
  // overlay anchored right under the header icon that opened it, which
  // doesn't need (or want) scroll-driven collapsing at all — it floats
  // above the list regardless of scroll position, confirmed live that
  // rendering it inline instead meant tapping the (always-visible) header
  // icon while scrolled down expanded a panel that was scrolled out of
  // view above the current viewport, i.e. invisible, the actual bug being
  // fixed here.
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileHeaderRef = useRef(null);
  const [mobileOverlayTop, setMobileOverlayTop] = useState(0);
  useEffect(() => {
    if (mobileSearchOpen && mobileHeaderRef.current) {
      setMobileOverlayTop(mobileHeaderRef.current.getBoundingClientRect().bottom);
    }
  }, [mobileSearchOpen]);

  // Real applications — not shown as a stats strip here (that's
  // Dashboard's own section), but real signal for marking which jobs
  // below the user has already applied to (see appliedCompanies).
  const [applications, setApplications] = useState([]);
  useEffect(() => {
    if (!user) { setApplications([]); return; }
    apiRequest("/api/v1/applications").catch(() => []).then((apps) => setApplications(apps || []));
  }, [user?.id]);

  // JobApplication only ever stores company/role as free text, and the
  // two real paths that create a row disagree about what "company" even
  // means: a manually-tracked JobTracker entry has a real typed name
  // ("Spotify"), but Apply with AI's own auto-created rows set company to
  // the raw URL HOSTNAME instead (_company_name_from_url in apply.py —
  // "spotify.com", or for an ATS-hosted posting, the ATS's own domain
  // like "boards.greenhouse.io", not the employer at all). A plain
  // equality check against the job board's clean company_name ("Spotify")
  // never matches "spotify.com" — confirmed live, this was silently
  // failing for exactly that shape of row. Below checks both: exact name
  // match for manual entries, plus "does the stored value contain the
  // job's own name or verified domain" for hostname-shaped ones. Still
  // can't catch an Apply with AI run against a third-party ATS subdomain
  // (the hostname literally doesn't name the employer in that case) —
  // a real, inherent limit of what's actually stored, not something a
  // smarter string match can solve.
  const appliedCompanyValues = useMemo(
    () => applications.map((a) => (a.company || "").trim().toLowerCase()).filter(Boolean),
    [applications]
  );
  const isJobApplied = (job) => {
    const name = (job.company_name || "").trim().toLowerCase();
    if (!name) return false;
    const domain = (job.company_domain || "").trim().toLowerCase().replace(/^www\./, "");
    const domainRoot = domain.replace(/\.[a-z]{2,}$/, "");
    return appliedCompanyValues.some((v) => {
      if (v === name) return true;
      if (domain && v === domain) return true;
      // Guard short names/roots (e.g. "io") from matching almost anything
      // as a substring — only trust the "contains" check once there's
      // enough real signal in the string for it to mean something.
      if (name.length >= 4 && v.includes(name)) return true;
      if (domainRoot.length >= 4 && v.includes(domainRoot)) return true;
      return false;
    });
  };

  const [search, setSearch] = useState("");
  // The raw `search` state updates on every keystroke so the input itself
  // never lags — but only THIS debounced copy feeds buildParams/load, so
  // typing "engineer" fires one request ~300ms after the last keystroke
  // instead of eight requests, one per letter.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeoutId);
  }, [search]);
  const [category, setCategory] = useState("");
  const [country, setCountry] = useState("");
  const [remote, setRemote] = useState("");
  const [minLevel, setMinLevel] = useState("");
  // Set only by tapping a trending chip — a dedicated backend filter
  // (?trending=<id>, see jobs_board.py) that reuses the EXACT SAME
  // keyword match trending_counts used to compute the chip's own "N open
  // now" label, so tapping a chip can never show a different count than
  // the chip just promised (confirmed live: the first version used the
  // plain text `search` box instead, searching only the field's first
  // keyword — "Big Data Specialists" said "6 open now" but the search
  // came back empty, since most of those 6 matched a different one of
  // the field's 4 keywords, not the first).
  const [activeTrending, setActiveTrending] = useState(null);

  // Search (both breakpoints) and Filters (mobile only — desktop's own
  // Filters live in the always-visible right rail, never in this scrolling
  // header) collapse to a single icon each the instant a real scroll
  // happens — unless the search input itself is actually focused, in
  // which case the user is using it right now and scroll shouldn't yank
  // it away under their thumb.
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  // Mobile opens with search/filters already tucked away — on a phone
  // that panel (search box + 4 selects) was most of what pushed the real
  // job list below the fold on first paint. Desktop's own right-rail
  // filters are separate and always visible, so its sticky search bar
  // keeps defaulting open instead. Must set BOTH branches, not just the
  // mobile-collapse one: useViewport's isDesktop is guaranteed false on
  // first mount (its own pre-hydration default, before the real width is
  // measured — see useViewport.js), so this effect always fires once
  // with isDesktop still false. An earlier version only did `if
  // (!isDesktop) setControlsCollapsed(true)` — on an actual desktop
  // viewport, isDesktop then flips true on the very next tick, but
  // nothing ever told controlsCollapsed to flip back, so the search bar
  // stayed permanently collapsed to just its icon. Confirmed live.
  useEffect(() => { setControlsCollapsed(!isDesktop); }, [isDesktop]);
  const [searchFocused, setSearchFocused] = useState(false);
  const lastScrollY = useRef(0);
  // Tapping the header's Search icon to expand can land mid-momentum from
  // that very tap (the finger lifting still produces a scroll frame or
  // two), which would otherwise immediately collapse the panel someone
  // just opened. A short time-boxed guard swallows exactly that, not a
  // real deliberate scroll a moment later — this replaces the older
  // "stay open until back near the top" version of that same guard, which
  // kept the panel open far longer than scrolling-to-collapse should
  // allow once this became "close on any real scroll."
  const expandedAtRef = useRef(0);
  const expandControls = () => { setControlsCollapsed(false); expandedAtRef.current = Date.now(); };
  const handleScroll = (e) => {
    const y = Math.max(0, e.target.scrollTop);
    const delta = y - lastScrollY.current;
    lastScrollY.current = y;
    if (y < 32) { setControlsCollapsed(false); return; }
    if (searchFocused) return;
    if (Date.now() - expandedAtRef.current < 200) return;
    if (delta !== 0) setControlsCollapsed(true);
  };
  const filtersActive = !!(search.trim() || category || country || remote || minLevel);

  const LIMIT = 20;

  const buildParams = useCallback((offset) => {
    const params = new URLSearchParams({ limit: LIMIT, offset });
    if (activeTrending) params.set("trending", activeTrending);
    else if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (category) params.set("category", category);
    if (country) params.set("country", country);
    if (remote) params.set("remote", remote);
    if (minLevel) params.set("min_verification_level", minLevel);
    return params.toString();
  }, [debouncedSearch, category, country, remote, minLevel, activeTrending]);

  // Guards against responses landing out of order — a slow early request
  // (e.g. for "e") resolving AFTER a later, faster one (e.g. "engineer")
  // would otherwise silently overwrite the correct results with stale
  // ones, with no indication to the user why what they see doesn't match
  // what they typed.
  const requestIdRef = useRef(0);
  const load = useCallback(() => {
    const id = ++requestIdRef.current;
    setLoading(true);
    apiRequest(`/api/v1/jobs?${buildParams(0)}`)
      .then((d) => {
        if (requestIdRef.current !== id) return;
        setJobs(d.jobs); setTotal(d.total);
      })
      .catch(() => {
        if (requestIdRef.current !== id) return;
        setJobs([]); setTotal(0);
      })
      .finally(() => { if (requestIdRef.current === id) setLoading(false); });
  }, [buildParams]);

  useEffect(load, [load]);
  useEffect(() => {
    apiRequest("/api/v1/jobs/meta").then(setMeta).catch(() => setMeta(null));
    apiRequest("/api/v1/jobs/trending").then(setTrending).catch(() => setTrending([]));
  }, []);

  const pickTrending = (field) => {
    setCategory("");
    setSearch("");
    setActiveTrending((cur) => (cur === field.id ? null : field.id));
  };

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const d = await apiRequest(`/api/v1/jobs?${buildParams(jobs.length)}`);
      setJobs((list) => [...list, ...d.jobs]);
    } finally {
      setLoadingMore(false);
    }
  };

  const categoryOptions = [{ id: "", label: t("jobsBoard.allCategories") }, ...Object.entries(meta?.live_category_totals || {}).map(([c, n]) => ({ id: c, label: `${c} (${n})` }))];
  const countryOptions = [{ id: "", label: t("jobsBoard.allCountries") }, ...Object.entries(meta?.live_country_totals || {}).map(([c, n]) => ({ id: c, label: `${countryName(c)} (${n})` }))];

  const go = (id, opts) => {
    tapFeedback();
    if (id === "jobsboard") return;
    onNavigate?.(id, opts);
  };
  const openNotification = (item) => go("apply", { runId: item.run.id });

  const resultsList = loading ? (
    <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  ) : jobs.length === 0 ? (
    <div className="grid justify-items-center gap-2.5 py-16 text-center">
      <div className="flex size-11 items-center justify-center rounded-full border border-border bg-card">
        <Inbox className="size-[18px] text-muted-foreground" />
      </div>
      <p className="m-0 text-[13.5px] font-bold text-foreground">{t("jobsBoard.noJobsMatch")}</p>
      <p className="m-0 text-[12.5px] text-muted-foreground">{t("jobsBoard.tryClearing")}</p>
    </div>
  ) : (
    <>
      {/* grid-cols-1, not a bare "grid" — Tailwind's grid-cols-1 sets
          grid-template-columns: repeat(1, minmax(0, 1fr)), which is
          what actually lets a long, untruncated job title be
          constrained to the container's width instead of the
          browser's default "auto" track sizing growing the whole
          column (and every card in it) to that title's natural
          content width — confirmed live: without this, cards were
          rendering ~350px wider than the 390px mobile viewport,
          silently clipped by the screen's own overflow-hidden
          instead of visibly overflowing. */}
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        {jobs.map((j) => <JobCard key={j.id} job={j} applied={isJobApplied(j)} onOpen={() => setSelectedJob(j)} />)}
      </div>
      {jobs.length < total && (
        <div className="mt-4 flex justify-center">
          <Btn small variant="ghost" onClick={loadMore} loading={loadingMore}>{t("jobsBoard.loadMore")}</Btn>
        </div>
      )}
    </>
  );

  const searchOrActiveTrending = activeTrending ? (
    <button
      type="button"
      onClick={() => setActiveTrending(null)}
      className="mb-2.5 flex w-full items-center justify-between gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3.5 py-2.5 text-left [-webkit-tap-highlight-color:transparent]"
    >
      <span className="text-[12.5px] font-bold text-primary-text">
        {t("jobsBoard.showing", { label: trending.find((f) => f.id === activeTrending)?.label })}
      </span>
      <X className="size-3.5 shrink-0 text-primary-text" />
    </button>
  ) : (
    <div className="relative mb-2.5">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => setSearchFocused(true)}
        onBlur={() => setSearchFocused(false)}
        placeholder={t("jobsBoard.searchPlaceholder")}
        className="w-full rounded-xl border border-border bg-card py-2.5 pr-3 pl-9 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
    </div>
  );

  const sourceHealthList = meta?.source_health && (
    <div className="grid gap-1.5">
      {Object.entries(meta.source_health).filter(([s]) => s !== "coverage_retry").map(([source, stats]) => (
        <div key={source} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <span className="text-[12.5px] font-bold text-foreground">{SOURCE_LABELS[source] || source}</span>
          <span className="text-[11.5px] text-muted-foreground">{t("jobsBoard.verifiedCount", { n: stats.verified })}{stats.error ? ` · ${t("common.error")}` : ""}</span>
        </div>
      ))}
    </div>
  );

  if (isDesktop) {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 flex bg-background font-sans text-foreground"
      >
        <NavRail active="jobsboard" user={user} onNavigate={go} onNotifClick={() => setNotifOpen(true)} />

        <main className="relative min-w-0 flex-1 overflow-y-auto" onScroll={handleScroll}>
          <div className="mx-auto w-full max-w-4xl px-8 py-8">
            <div className="mb-5">
              <p className="m-0 text-[22px] font-bold text-foreground">{t("jobsBoard.jobsBoard")}</p>
              {meta?.last_run_at && (
                <p className="m-0 mt-1 text-[12.5px] text-muted-foreground">{t("jobsBoard.updated", { time: timeAgo(meta.last_run_at, t), total })}</p>
              )}
            </div>

            <div className="sticky top-0 z-10 -mx-8 mb-4 bg-background px-8 pt-1 pb-3">
              <TrendingRow fields={trending} activeId={activeTrending} onPick={pickTrending} />
              <AnimatePresence mode="wait" initial={false}>
                {controlsCollapsed ? (
                  <motion.div key="collapsed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                    <CollapsedControls onExpand={expandControls} filtersActive={filtersActive} />
                  </motion.div>
                ) : (
                  <motion.div key="expanded" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                    {searchOrActiveTrending}
                  </motion.div>
                )}
              </AnimatePresence>
              <ActiveFilterChips
                search={search} setSearch={setSearch}
                category={category} setCategory={setCategory}
                country={country} setCountry={setCountry}
                remote={remote} setRemote={setRemote}
                minLevel={minLevel} setMinLevel={setMinLevel}
              />
            </div>

            {resultsList}
          </div>
        </main>

        <aside className="flex w-72 shrink-0 flex-col gap-6 overflow-y-auto border-l border-border bg-card p-5">
          <div>
            <p className="m-0 mb-2.5 font-mono text-[10.5px] font-bold tracking-[0.1em] text-muted-foreground/60 uppercase">{t("jobsBoard.filters")}</p>
            <FiltersPanel
              category={category} setCategory={setCategory}
              country={country} setCountry={setCountry}
              remote={remote} setRemote={setRemote}
              minLevel={minLevel} setMinLevel={setMinLevel}
              categoryOptions={categoryOptions} countryOptions={countryOptions}
              vertical
            />
          </div>
          {sourceHealthList && (
            <div>
              <p className="m-0 mb-2.5 font-mono text-[10.5px] font-bold tracking-[0.1em] text-muted-foreground/60 uppercase">{t("jobsBoard.sourceHealth")}</p>
              {sourceHealthList}
            </div>
          )}
        </aside>

        {selectedJob && (
          <JobDetail
            job={selectedJob}
            applied={isJobApplied(selectedJob)}
            onClose={() => setSelectedJob(null)}
          />
        )}

        <NotificationsDialog open={notifOpen} onClose={() => setNotifOpen(false)} items={unread.items} onOpenItem={openNotification} />
      </motion.div>
    );
  }

  const mobileResults = loading ? (
    <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  ) : jobs.length === 0 ? (
    <div className="grid justify-items-center gap-2.5 py-16 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-muted">
        <Inbox className="size-[18px] text-muted-foreground" />
      </div>
      <p className="m-0 text-[13.5px] font-bold text-foreground">{t("jobsBoard.noJobsMatch")}</p>
      <p className="m-0 text-[12.5px] text-muted-foreground">{t("jobsBoard.tryClearing")}</p>
    </div>
  ) : (
    <>
      <div className="grid grid-cols-1 gap-2.5">
        {jobs.map((j) => <JobCardMobile key={j.id} job={j} applied={isJobApplied(j)} onOpen={() => setSelectedJob(j)} />)}
      </div>
      {jobs.length < total && (
        <div className="mt-4 flex justify-center">
          <Btn small variant="ghost" onClick={loadMore} loading={loadingMore}>{t("jobsBoard.loadMore")}</Btn>
        </div>
      )}
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-background font-sans text-foreground"
    >
      <header
        ref={mobileHeaderRef}
        className="relative z-50 flex shrink-0 items-center justify-between gap-3 bg-background px-5 pb-4"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <button
          onClick={() => go("personal-profile")} aria-label={t("common.personalProfile")}
          className="flex min-w-0 shrink items-center gap-2.5 border-none bg-transparent p-0 text-left [-webkit-tap-highlight-color:transparent]"
        >
          <span className="shrink-0 rounded-full ring-1 ring-border"><Avatar user={user} size={34} /></span>
          <span className="truncate text-sm font-medium tracking-tight text-muted-foreground">
            {greeting(t)}{user ? `, ${firstNameOf(user.name) || user.email.split("@")[0]}` : ""}
          </span>
        </button>
        {/* Same order as Dashboard.js's header (Bell, Theme) — Search has
            no equivalent there at all, so it's appended last instead of
            disrupting the one order shared between the two screens. */}
        <div className="flex shrink-0 items-center gap-3">
          <button onClick={() => setNotifOpen(true)} aria-label={t("common.notifications")} className="relative flex size-9 items-center justify-center rounded-full border border-border text-foreground [-webkit-tap-highlight-color:transparent]">
            <Bell className="size-[18px]" strokeWidth={1.75} />
            {unread.count > 0 && (
              <span className="absolute top-0 right-0 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
                {unread.count > 9 ? "9+" : unread.count}
              </span>
            )}
          </button>
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? t("common.lightMode") : t("common.darkMode")}
            className="flex size-9 items-center justify-center rounded-full border border-border text-foreground [-webkit-tap-highlight-color:transparent]"
          >
            {theme === "dark" ? <Sun className="size-[18px]" strokeWidth={1.75} /> : <Moon className="size-[18px]" strokeWidth={1.75} />}
          </button>
          <button onClick={() => setMobileSearchOpen((v) => !v)} aria-label={t("jobsBoard.searchAndFilters")} aria-expanded={mobileSearchOpen} className="relative flex size-9 items-center justify-center rounded-full border border-border text-foreground [-webkit-tap-highlight-color:transparent]">
            <Search className="size-[18px]" strokeWidth={1.75} />
            {filtersActive && <span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-primary" />}
          </button>
        </div>
      </header>

      {/* Anchored right under the header that opened it — not inline in
          the scrollable column below, which is what silently broke this
          before: tapping the (always-visible) header icon while already
          scrolled down expanded a panel that lived scrolled out of view
          above the current viewport. A fixed overlay is reachable from
          anywhere, every time, exactly where the icon is. */}
      <AnimatePresence>
        {mobileSearchOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/20"
              onClick={() => setMobileSearchOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="glass-surface fixed inset-x-4 z-40 rounded-2xl p-4"
              style={{ top: mobileOverlayTop + 8 }}
            >
              {searchOrActiveTrending}
              <FiltersPanel
                category={category} setCategory={setCategory}
                country={country} setCountry={setCountry}
                remote={remote} setRemote={setRemote}
                minLevel={minLevel} setMinLevel={setMinLevel}
                categoryOptions={categoryOptions} countryOptions={countryOptions}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="px-5">
        <h1 className="m-0 text-3xl leading-tight font-extrabold tracking-tight text-foreground">{t("dashboard.headline")}</h1>
        <div className="mt-3 h-px bg-border" />
      </div>

      {/* Lives outside the overlay above (and outside the scrollable
          column below) on purpose — closing the search/filters panel, or
          scrolling the list, used to mean "what's actually narrowing
          these results" had no trace left anywhere on screen. This stays
          put either way. */}
      <div className="px-5 pt-3">
        <ActiveFilterChips
          search={search} setSearch={setSearch}
          category={category} setCategory={setCategory}
          country={country} setCountry={setCountry}
          remote={remote} setRemote={setRemote}
          minLevel={minLevel} setMinLevel={setMinLevel}
        />
      </div>

      {/* No JobSearchStatsCard here — that's Dashboard's own section, and
          repeating it here just pushed the actual job list below the
          fold for no real benefit. Jobs Board opens straight into the
          thing it's for: real listings. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4" style={{ paddingBottom: "calc(110px + env(safe-area-inset-bottom, 0px))" }}>
        <CategoryPills categoryOptions={categoryOptions} value={category} onChange={setCategory} />

        <TrendingRow fields={trending} activeId={activeTrending} onPick={pickTrending} />

        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-[0.12em] text-foreground/70 uppercase">{t("jobsBoard.jobMatch")}</span>
          {(category || activeTrending || search) && (
            <button
              onClick={() => { setCategory(""); setSearch(""); setActiveTrending(null); }}
              className="border-none bg-transparent p-0 text-[12px] font-bold text-foreground [-webkit-tap-highlight-color:transparent]"
            >
              {t("common.seeAll")}
            </button>
          )}
        </div>

        {mobileResults}
      </div>

      <MobileFloatingNav
        items={mobileNavItems(t)}
        active="jobsboard"
        onChange={(id) => go(id)}
        onCreate={() => go("resume", { quickBuild: true })}
      />

      {healthOpen && meta?.source_health && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setHealthOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-t-2xl border border-border bg-card p-4 sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="m-0 text-[14px] font-bold text-foreground">{t("jobsBoard.sourceHealthLatestRun")}</p>
              <button onClick={() => setHealthOpen(false)} aria-label={t("common.close")}><X className="size-4 text-muted-foreground" /></button>
            </div>
            {sourceHealthList}
          </div>
        </div>
      )}

      <NotificationsDialog open={notifOpen} onClose={() => setNotifOpen(false)} items={unread.items} onOpenItem={openNotification} />

      {selectedJob && (
        <JobDetail
          job={selectedJob}
          applied={isJobApplied(selectedJob)}
          onClose={() => setSelectedJob(null)}
        />
      )}
    </motion.div>
  );
}
