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
 */
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, ExternalLink, ShieldCheck, ShieldQuestion, MapPin, Search,
  ChevronDown, Loader2, Inbox, Info, X,
} from "lucide-react";
import { apiRequest } from "./shared/api";
import { Btn } from "./guest/components/primitives";

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

const SOURCE_LABELS = { remotive: "Remotive", arbeitnow: "Arbeitnow", greenhouse: "Greenhouse", ashby: "Ashby" };

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

function JobCard({ job }) {
  return (
    <a
      href={job.url}
      target="_blank"
      rel="noreferrer"
      className="glass-surface flex flex-col gap-2 rounded-2xl p-4 [-webkit-tap-highlight-color:transparent] hover:border-primary/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 truncate text-[14.5px] font-bold text-foreground">{job.title}</p>
          <p className="m-0 truncate text-[12.5px] text-muted-foreground">{job.company_name}</p>
        </div>
        <ExternalLink className="size-4 shrink-0 text-muted-foreground/50" />
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

      <div className="flex items-center justify-between gap-3">
        <VerificationBadge verification={job.verification} />
        <span className="shrink-0 text-[10.5px] text-muted-foreground/70">
          via {SOURCE_LABELS[job.source] || job.source} · {timeAgo(job.posted_at)}
        </span>
      </div>
    </a>
  );
}

function FilterSelect({ value, onChange, options, placeholder }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 appearance-none rounded-xl border border-border bg-card py-2 pr-8 pl-3 text-[12.5px] font-semibold text-foreground [-webkit-tap-highlight-color:transparent]"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export default function JobsBoard({ onClose }) {
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [country, setCountry] = useState("");
  const [remote, setRemote] = useState("");
  const [minLevel, setMinLevel] = useState("");

  const LIMIT = 20;

  const buildParams = useCallback((offset) => {
    const params = new URLSearchParams({ limit: LIMIT, offset });
    if (search.trim()) params.set("search", search.trim());
    if (category) params.set("category", category);
    if (country) params.set("country", country);
    if (remote) params.set("remote", remote);
    if (minLevel) params.set("min_verification_level", minLevel);
    return params.toString();
  }, [search, category, country, remote, minLevel]);

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
  }, []);

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

      <div className="mx-auto w-full max-w-3xl min-h-0 flex-1 overflow-y-auto px-5 pb-6 lg:max-w-4xl">
        <div className="sticky top-0 z-10 -mx-5 mb-4 bg-background px-5 pt-1 pb-3">
          <div className="relative mb-2.5">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or company"
              className="w-full rounded-xl border border-border bg-card py-2.5 pr-3 pl-9 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterSelect value={category} onChange={setCategory} options={categoryOptions} />
            <FilterSelect value={country} onChange={setCountry} options={countryOptions} />
            <FilterSelect value={remote} onChange={setRemote} options={REMOTE_OPTIONS} />
            <FilterSelect value={minLevel} onChange={setMinLevel} options={LEVEL_OPTIONS} />
          </div>
        </div>

        {loading ? (
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
            <div className="grid grid-cols-1 gap-2.5">
              {jobs.map((j) => <JobCard key={j.id} job={j} />)}
            </div>
            {jobs.length < total && (
              <div className="mt-4 flex justify-center">
                <Btn small variant="ghost" onClick={loadMore} loading={loadingMore}>Load more</Btn>
              </div>
            )}
          </>
        )}
      </div>

      {healthOpen && meta?.source_health && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setHealthOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-t-2xl border border-border bg-card p-4 sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="m-0 text-[14px] font-bold text-foreground">Source health — latest run</p>
              <button onClick={() => setHealthOpen(false)} aria-label="Close"><X className="size-4 text-muted-foreground" /></button>
            </div>
            <div className="grid gap-1.5">
              {Object.entries(meta.source_health).filter(([s]) => s !== "coverage_retry").map(([source, stats]) => (
                <div key={source} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span className="text-[12.5px] font-bold text-foreground">{SOURCE_LABELS[source] || source}</span>
                  <span className="text-[11.5px] text-muted-foreground">{stats.verified} verified{stats.error ? " · error" : ""}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
