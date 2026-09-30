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
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, ExternalLink, ShieldCheck, ShieldQuestion, MapPin, Search,
  ChevronDown, Loader2, Inbox, Info, X, Flame, TrendingUp,
} from "lucide-react";
import { apiRequest } from "./shared/api";
import { Btn } from "./guest/components/primitives";
import { NavRail } from "./shared/NavRail";
import { useAuth } from "@/lib/useAuth";
import { useViewport } from "@/lib/useViewport";
import { tapFeedback } from "@/lib/haptics";

const REMOTE_OPTIONS = [
  { id: "", label: "Remote or onsite" },
  { id: "true", label: "Remote only" },
  { id: "false", label: "Onsite only" },
];

const LEVEL_OPTIONS = [
  { id: "", label: "Any verification level" },
  { id: "2", label: "Level 2+ — domain confirmed" },
  { id: "3", label: "Level 3+ — domain + age checked" },
];

const SOURCE_LABELS = { remotive: "Remotive", arbeitnow: "Arbeitnow", greenhouse: "Greenhouse", ashby: "Ashby", scrapegraphai: "company careers page" };
// Extracted straight off the employer's own site, which — confirmed live
// while building this — doesn't always expose a real per-listing link
// (client-side-routed job cards, no <a href>) the way an ATS API does.
// Honest about the tradeoff rather than hiding it: this source's `url`
// is always the company's real jobs LIST page, not a deep link to this
// specific posting.
const SOURCES_WITHOUT_DIRECT_LINK = new Set(["scrapegraphai"]);

function timeAgo(iso) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function countryName(code) {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

function VerificationBadge({ verification }) {
  const { level, checks_not_attempted } = verification;
  const [open, setOpen] = useState(false);
  const label = level >= 3 ? "Domain + age verified" : level === 2 ? "Domain confirmed" : "Source verified";
  const Icon = level >= 2 ? ShieldCheck : ShieldQuestion;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10.5px] font-bold text-primary-text [-webkit-tap-highlight-color:transparent]"
      >
        <Icon className="size-3" /> Level {level} · {label}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1.5 w-64 rounded-xl border border-border bg-card p-3 shadow-lg">
          <p className="m-0 mb-1.5 text-[11px] font-bold text-foreground">What was checked</p>
          <ul className="m-0 grid gap-1 p-0 pl-4 text-[11px] text-muted-foreground">
            {verification.checks_passed.map((c) => <li key={c}>{c.replace(/^level\d_/, "").replace(/_/g, " ")}</li>)}
          </ul>
          {checks_not_attempted?.length > 0 && (
            <p className="m-0 mt-1.5 text-[10.5px] text-muted-foreground/70">
              Not attempted: {checks_not_attempted.map((c) => c.replace(/^level\d_/, "").replace(/_/g, " ")).join(", ")}
            </p>
          )}
        </div>
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
function JobCard({ job }) {
  return (
    <div className="glass-surface flex flex-col gap-2.5 rounded-2xl p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-muted font-mono text-[11px] font-bold text-muted-foreground">
          {job.company_name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-[14px] font-bold text-foreground">{job.title}</p>
          <p className="m-0 truncate text-[12px] text-muted-foreground">{job.company_name}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-bold text-muted-foreground">{job.category}</span>
        {job.remote && <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10.5px] font-bold text-success">Remote</span>}
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
        <p className="m-0 text-[10.5px] text-muted-foreground/70">Opens {job.company_name}'s jobs page — search for this title there.</p>
      )}

      <div className="flex items-center justify-between gap-3">
        <VerificationBadge verification={job.verification} />
        <span className="shrink-0 text-[10.5px] text-muted-foreground/70">
          via {SOURCE_LABELS[job.source] || job.source} · {timeAgo(job.posted_at)}
        </span>
      </div>

      <a
        href={job.url} target="_blank" rel="noreferrer"
        className="flex w-fit items-center gap-1 self-start rounded-[10px] bg-primary px-3.5 py-1.5 text-[12px] font-bold text-primary-foreground [-webkit-tap-highlight-color:transparent]"
      >
        Apply <ExternalLink className="size-3" />
      </a>
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
  return (
    <div className={vertical ? "grid gap-2" : "flex flex-wrap gap-2"}>
      <FilterSelect value={category} onChange={setCategory} options={categoryOptions} fullWidth={vertical} />
      <FilterSelect value={country} onChange={setCountry} options={countryOptions} fullWidth={vertical} />
      <FilterSelect value={remote} onChange={setRemote} options={REMOTE_OPTIONS} fullWidth={vertical} />
      <FilterSelect value={minLevel} onChange={setMinLevel} options={LEVEL_OPTIONS} fullWidth={vertical} />
    </div>
  );
}

// One trending field — the growth stat is real and cited (see backend/
// app/jobs_ingest/trending.py), never invented; tapping it searches THIS
// pipeline's own live inventory for that field, so "hottest right now"
// stays honest about the gap between "the labor market is growing here"
// and "here's what's actually postable in this jobs board today."
function TrendingChip({ field, active, onClick }) {
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
            aria-label="Source"
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
          <span className="text-[11px] font-semibold text-muted-foreground">High demand · {field.window}</span>
        )}
        <span className="text-[10.5px] text-muted-foreground/70">{field.live_count} open now</span>
      </div>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1.5 w-60 rounded-xl border border-border bg-card p-3 text-[11px] leading-relaxed text-muted-foreground shadow-lg">
          {field.source}
        </div>
      )}
    </div>
  );
}

function TrendingRow({ fields, activeId, onPick }) {
  if (!fields?.length) return null;
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-1.5">
        <Flame className="size-3.5 text-primary" />
        <span className="font-mono text-[10.5px] font-bold tracking-[0.1em] text-muted-foreground/60 uppercase">Hottest right now</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {fields.map((f) => <TrendingChip key={f.id} field={f} active={f.id === activeId} onClick={() => onPick(f)} />)}
      </div>
    </div>
  );
}

export default function JobsBoard({ onClose, onNavigate }) {
  const { user } = useAuth();
  const { isDesktop } = useViewport();
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [meta, setMeta] = useState(null);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);

  const [search, setSearch] = useState("");
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

  const LIMIT = 20;

  const buildParams = useCallback((offset) => {
    const params = new URLSearchParams({ limit: LIMIT, offset });
    if (activeTrending) params.set("trending", activeTrending);
    else if (search.trim()) params.set("search", search.trim());
    if (category) params.set("category", category);
    if (country) params.set("country", country);
    if (remote) params.set("remote", remote);
    if (minLevel) params.set("min_verification_level", minLevel);
    return params.toString();
  }, [search, category, country, remote, minLevel, activeTrending]);

  const load = useCallback(() => {
    setLoading(true);
    apiRequest(`/api/v1/jobs?${buildParams(0)}`)
      .then((d) => { setJobs(d.jobs); setTotal(d.total); })
      .catch(() => { setJobs([]); setTotal(0); })
      .finally(() => setLoading(false));
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

  const categoryOptions = [{ id: "", label: "All categories" }, ...Object.entries(meta?.live_category_totals || {}).map(([c, n]) => ({ id: c, label: `${c} (${n})` }))];
  const countryOptions = [{ id: "", label: "All countries" }, ...Object.entries(meta?.live_country_totals || {}).map(([c, n]) => ({ id: c, label: `${countryName(c)} (${n})` }))];

  const go = (id, opts) => {
    tapFeedback();
    onNavigate?.(id, opts);
  };

  const resultsList = loading ? (
    <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  ) : jobs.length === 0 ? (
    <div className="grid justify-items-center gap-2.5 py-16 text-center">
      <div className="flex size-11 items-center justify-center rounded-full border border-border bg-card">
        <Inbox className="size-[18px] text-muted-foreground" />
      </div>
      <p className="m-0 text-[13.5px] font-bold text-foreground">No jobs match those filters</p>
      <p className="m-0 text-[12.5px] text-muted-foreground">Try clearing one or two of them.</p>
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
        {jobs.map((j) => <JobCard key={j.id} job={j} />)}
      </div>
      {jobs.length < total && (
        <div className="mt-4 flex justify-center">
          <Btn small variant="ghost" onClick={loadMore} loading={loadingMore}>Load more</Btn>
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
        Showing: {trending.find((f) => f.id === activeTrending)?.label}
      </span>
      <X className="size-3.5 shrink-0 text-primary-text" />
    </button>
  ) : (
    <div className="relative mb-2.5">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search title or company"
        className="w-full rounded-xl border border-border bg-card py-2.5 pr-3 pl-9 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
    </div>
  );

  const sourceHealthList = meta?.source_health && (
    <div className="grid gap-1.5">
      {Object.entries(meta.source_health).filter(([s]) => s !== "coverage_retry").map(([source, stats]) => (
        <div key={source} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <span className="text-[12.5px] font-bold text-foreground">{SOURCE_LABELS[source] || source}</span>
          <span className="text-[11.5px] text-muted-foreground">{stats.verified} verified{stats.error ? " · error" : ""}</span>
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
        <NavRail user={user} onNavigate={go} onNotifClick={() => go("home")} />

        <main className="relative min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-8 py-8">
            <div className="mb-5">
              <p className="m-0 text-[22px] font-bold text-foreground">Jobs board</p>
              {meta?.last_run_at && (
                <p className="m-0 mt-1 text-[12.5px] text-muted-foreground">Updated {timeAgo(meta.last_run_at)} · {total} verified listings</p>
              )}
            </div>

            <TrendingRow fields={trending} activeId={activeTrending} onPick={pickTrending} />
            <div className="sticky top-0 z-10 -mx-8 mb-4 bg-background px-8 pt-1 pb-3">
              {searchOrActiveTrending}
            </div>

            {resultsList}
          </div>
        </main>

        <aside className="flex w-72 shrink-0 flex-col gap-6 overflow-y-auto border-l border-border bg-card p-5">
          <div>
            <p className="m-0 mb-2.5 font-mono text-[10.5px] font-bold tracking-[0.1em] text-muted-foreground/60 uppercase">Filters</p>
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
              <p className="m-0 mb-2.5 font-mono text-[10.5px] font-bold tracking-[0.1em] text-muted-foreground/60 uppercase">Source health</p>
              {sourceHealthList}
            </div>
          )}
        </aside>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-background font-sans text-foreground"
    >
      <div className="flex shrink-0 items-center justify-between px-5 pb-3" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-3">
          {onClose && (
            <button onClick={onClose} aria-label="Back" className="flex size-9 items-center justify-center rounded-full border border-border bg-muted text-foreground">
              <ArrowLeft className="size-4" />
            </button>
          )}
          <div>
            <p className="m-0 text-[16px] font-bold text-foreground">Jobs board</p>
            {meta?.last_run_at && (
              <p className="m-0 text-[11px] text-muted-foreground">Updated {timeAgo(meta.last_run_at)} · {total} verified listings</p>
            )}
          </div>
        </div>
        {meta?.source_health && (
          <button onClick={() => setHealthOpen(true)} aria-label="Source health" className="flex size-9 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
            <Info className="size-4" />
          </button>
        )}
      </div>

      <div className="mx-auto w-full max-w-3xl min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <TrendingRow fields={trending} activeId={activeTrending} onPick={pickTrending} />
        <div className="sticky top-0 z-10 -mx-5 mb-4 bg-background px-5 pt-1 pb-3">
          {searchOrActiveTrending}
          <FiltersPanel
            category={category} setCategory={setCategory}
            country={country} setCountry={setCountry}
            remote={remote} setRemote={setRemote}
            minLevel={minLevel} setMinLevel={setMinLevel}
            categoryOptions={categoryOptions} countryOptions={countryOptions}
          />
        </div>

        {resultsList}
      </div>

      {healthOpen && meta?.source_health && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setHealthOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-t-2xl border border-border bg-card p-4 sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="m-0 text-[14px] font-bold text-foreground">Source health — latest run</p>
              <button onClick={() => setHealthOpen(false)} aria-label="Close"><X className="size-4 text-muted-foreground" /></button>
            </div>
            {sourceHealthList}
          </div>
        </div>
      )}
    </motion.div>
  );
}
