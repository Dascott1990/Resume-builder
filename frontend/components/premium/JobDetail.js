"use client";
/**
 * JobDetail.js — the monochrome job detail screen opened by tapping a
 * card on JobsBoard.js's mobile list. Its own file (not another function
 * bolted onto the already-large JobsBoard.js) per the same "neat,
 * separate code" standard this session has already applied elsewhere
 * (see shared/email_logo.py's equivalent on the backend side).
 *
 * Every field shown here is real — this backend's job objects carry
 * title/company_name/category/remote/location/salary/description_text/
 * verification/source/posted_at/url, nothing else (see jobs_board.py's
 * own docstring on the shape). There is no employment-type, experience-
 * level, or review data anywhere in the pipeline, so none of those are
 * fabricated here: the spec tag row only ever shows real fields, and the
 * Review tab is an honest "not available" state rather than invented
 * star ratings or testimonials.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Share2, Building2, ShieldCheck, ShieldQuestion, Check, Sparkles } from "lucide-react";
import { SOURCE_LABELS, SOURCES_WITHOUT_DIRECT_LINK, timeAgo } from "./shared/jobsBoardShared";
import { pickTemplateForJob } from "@/lib/jobTemplateMatch";
import { setPreferredStyle } from "@/lib/templatePreference";
import { useLanguage } from "@/lib/i18n";

const TAB_IDS = ["Description", "Company", "Review"];
const READ_MORE_CUTOFF = 280;

// Defense in depth, not the real fix — backend/app/jobs_ingest/sources.py's
// own _strip_html already tries to do this server-side, but confirmed live
// against the real feed: some arbeitnow listings still carry raw markup
// ("<div class=\"content-intro\"><p>...") through to description_text.
// Rendered as plain text (never dangerouslySetInnerHTML — this is
// third-party content from a public feed, not something to execute as
// HTML), those tags would show up as literal visible text. Stripped here
// too so a real backend data-quality gap doesn't read as a broken screen.
function stripTags(text) {
  if (!text) return "";
  return text
    // Block-level tags become real line breaks FIRST, so a leaked
    // "<p>...</p><p>...</p>" still reads as separate paragraphs (and
    // splitQualifications below can still find a heading line) instead of
    // collapsing into one run-on sentence once the tags themselves are gone.
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Confirmed against the real, live ingested inventory (every source,
// Greenhouse/Ashby/Arbeitnow alike): description_text routinely has ZERO
// newlines anywhere in it, HTML-tagged or not — this isn't a rendering
// bug losing real structure, the source genuinely hands over one
// continuous run of prose with no paragraph breaks at all. Rendered
// as-is, a 1500-character wall of text with no visual rest stops is
// exactly the "everything just runs together" a reader gives up on
// partway through. Nothing here invents content or reorders anything —
// it only ever regroups the source's own sentences into paragraph-sized
// chunks. A block that already has its own line breaks (recovered from
// real <p>/<div> tags, or just short) is left alone; only a genuinely
// structureless long run gets this treatment.
function autoParagraphs(text) {
  if (!text) return text;
  return text
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed || trimmed.length < 400 || trimmed.includes("\n")) return trimmed;
      const sentences = trimmed.match(/[^.!?]+[.!?]+(?:\s+|$)/g) || [trimmed];
      const paras = [];
      for (let i = 0; i < sentences.length; i += 3) {
        paras.push(sentences.slice(i, i + 3).join("").trim());
      }
      return paras.join("\n\n");
    })
    .join("\n\n");
}

// Real postings (confirmed against live Indeed-style listings) carry real
// named section headings — "Key Responsibilities", "Qualifications and
// Skills", "Nice to have:", "Benefits:" — plus a trailing block of short
// factual fields ("Job Type: Full-time", "Schedule:", "Experience:",
// "Language:") that are sometimes inline ("Label: value" on one line) and
// sometimes a heading with its values as bullets underneath. Nothing here
// invents a heading or a value — every section/field rendered is one the
// source text actually contained; text with none of these just stays one
// "About this role" block, same as before.
const CONTENT_HEADING_RE =
  /^(key responsibilities|responsibilities( and duties)?|duties( and responsibilities)?|roles and responsibilities|what you.ll do|day.to.day responsibilities|(required |minimum |preferred )?qualifications( and skills)?|(job )?requirements|skills( required)?|what you.ll need|what you bring|who you are|nice to have|good to have|bonus points|benefits( and perks)?|perks|what we offer)$/i;

const METADATA_LABELS = [
  "job type", "schedule", "experience", "language", "education",
  "pay", "salary", "work location", "shift", "travel",
];
const METADATA_INLINE_RE = new RegExp(`^(${METADATA_LABELS.join("|")})\\s*:\\s*(.+)$`, "i");
const METADATA_HEADING_RE = new RegExp(`^(${METADATA_LABELS.join("|")})$`, "i");

function titleCase(s) {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function parseJobSections(text) {
  if (!text) return { about: "", sections: [], metadata: [] };
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  const introLines = [];
  const sections = [];
  const metadata = [];
  let current = null; // { title, lines } for a content section
  let metaCollector = null; // { label, lines } for a heading-style metadata field

  const closeMetaCollector = () => {
    if (metaCollector && metaCollector.lines.length > 0) {
      metadata.push({ label: titleCase(metaCollector.label), value: metaCollector.lines.join(", ") });
    }
    metaCollector = null;
  };
  const closeSection = () => {
    if (current && current.lines.length > 0) sections.push(current);
    current = null;
  };

  for (const rawLine of lines) {
    const hadColon = /:\s*$/.test(rawLine);
    const bareHeading = rawLine.replace(/:\s*$/, "").trim();
    const inlineMeta = rawLine.match(METADATA_INLINE_RE);

    if (inlineMeta) {
      closeMetaCollector();
      metadata.push({ label: titleCase(inlineMeta[1]), value: inlineMeta[2].trim() });
      continue;
    }
    // Metadata labels ("Education", "Pay", "Shift"...) are single common
    // words that real bullet content collides with — confirmed live: a
    // "Freelance Copywriter" listing's industry list has a bare
    // "Education" line as one of many industries, not a field heading.
    // A real metadata heading always has its own colon ("Education:");
    // requiring one here is what tells the two apart. Content headings
    // ("Responsibilities", "Qualifications") don't need this guard — they're
    // distinctive multi-word phrases a stray bullet won't coincidentally match.
    if (hadColon && METADATA_HEADING_RE.test(bareHeading)) {
      closeSection();
      closeMetaCollector();
      metaCollector = { label: bareHeading, lines: [] };
      continue;
    }
    if (CONTENT_HEADING_RE.test(bareHeading)) {
      closeSection();
      closeMetaCollector();
      current = { title: titleCase(bareHeading), lines: [] };
      continue;
    }

    const cleaned = rawLine.replace(/^[-•*]\s*/, "").trim();
    if (!cleaned) continue;
    if (metaCollector) metaCollector.lines.push(cleaned);
    else if (current) current.lines.push(cleaned);
    else introLines.push(cleaned);
  }
  closeSection();
  closeMetaCollector();

  return { about: introLines.join("\n\n"), sections, metadata };
}

export function JobDetail({ job, applied, onClose, onNavigate }) {
  const { t } = useLanguage();
  const TAB_LABELS = { Description: t("jobDetail.tabDescription"), Company: t("jobDetail.tabCompany"), Review: t("jobDetail.tabReview") };
  const [tab, setTab] = useState("Description");
  const [expanded, setExpanded] = useState(false);
  const { about: rawAbout, sections, metadata } = parseJobSections(stripTags(job.description_text));
  const about = autoParagraphs(rawAbout);

  const specs = [
    job.category,
    job.remote ? t("common.remote") : (job.location ? t("jobDetail.onsite") : null),
    job.location,
  ].filter(Boolean);

  const share = async () => {
    const shareData = { title: job.title, text: `${job.title} at ${job.company_name}`, url: job.url };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* user cancelled */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(job.url);
      toast.success(t("jobDetail.linkCopied"));
    } catch {
      toast.error(t("jobDetail.couldntCopyLink"));
    }
  };

  // Instant, no AI call: job.category is already real, computed once at
  // ingestion time (backend/app/jobs_ingest/categories.py's categorize())
  // — pickTemplateForJob is a pure lookup against it (see lib/
  // jobTemplateMatch.js for the actual reasoning), not a network round
  // trip. setPreferredStyle is the same mechanism TemplatesGallery.js's
  // own picker already uses — GuestMode reads it back on mount via
  // getEffectiveStyle(). The job's own description text rides along via
  // onNavigate's existing jobDesc passthrough (the same one the "tailor
  // for this job" bookmarklet already uses, see app/page.js's openResume),
  // so this lands straight on the job-posting step with both the style
  // and the text already filled in — no separate paste needed.
  const buildResumeForJob = () => {
    setPreferredStyle(pickTemplateForJob(job));
    onNavigate?.("resume", { jobDesc: stripTags(job.description_text) });
  };

  const { level, checks_passed, checks_not_attempted } = job.verification || {};
  const VerifyIcon = level >= 2 ? ShieldCheck : ShieldQuestion;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
      transition={{ type: "spring", damping: 28, stiffness: 320 }}
      className="fixed inset-0 z-[70] flex flex-col bg-background font-sans text-foreground"
    >
      <div className="flex shrink-0 items-center justify-between px-5" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
        <button onClick={onClose} aria-label={t("personalProfile.back")} className="flex size-9 items-center justify-center border-none bg-transparent p-0 text-foreground [-webkit-tap-highlight-color:transparent]">
          <ArrowLeft className="size-5" strokeWidth={1.75} />
        </button>
        <button onClick={share} aria-label={t("jobDetail.share")} className="flex size-9 items-center justify-center border-none bg-transparent p-0 text-foreground [-webkit-tap-highlight-color:transparent]">
          <Share2 className="size-[18px]" strokeWidth={1.75} />
        </button>
      </div>

      <div className="mx-auto min-h-0 w-full max-w-xl flex-1 overflow-y-auto px-5 pb-32">
        <div className="flex flex-col items-center pt-1 text-center">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-muted">
            <Building2 className="size-7 text-muted-foreground/70" strokeWidth={1.5} />
          </span>
          <h1 className="m-0 mt-3 text-2xl font-bold tracking-tight text-foreground">{job.title}</h1>
          <p className="m-0 mt-1 text-[13px] font-medium text-muted-foreground">
            {job.company_name}{job.location ? ` · ${job.location}` : ""}
          </p>
          {applied && (
            <span className="mt-2 flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-bold text-success">
              <Check className="size-3" strokeWidth={2.5} /> {t("jobDetail.youveAppliedAt", { company: job.company_name })}
            </span>
          )}
        </div>

        {specs.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
            {specs.map((s, i) => (
              <span key={s} className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground/70">
                {i > 0 && <span className="text-muted-foreground/30">&middot;</span>} {s}
              </span>
            ))}
          </div>
        )}

        <div className="mt-6 grid grid-cols-3 border-b border-border">
          {TAB_IDS.map((id) => (
            <button
              key={id} type="button" onClick={() => setTab(id)}
              className={`border-none bg-transparent pb-3 text-[13px] font-semibold [-webkit-tap-highlight-color:transparent] ${tab === id ? "text-foreground" : "text-muted-foreground/50"}`}
              style={tab === id ? { borderBottom: "2px solid var(--foreground)" } : undefined}
            >
              {TAB_LABELS[id]}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "Description" && (
            <>
              {about ? (
                <div className="mb-6">
                  <h2 className="m-0 mb-2 text-[15px] font-bold text-foreground">{t("jobDetail.aboutThisRole")}</h2>
                  <p className="m-0 text-[13.5px] leading-relaxed whitespace-pre-line text-neutral-700 dark:text-neutral-300">
                    {expanded || about.length <= READ_MORE_CUTOFF ? about : `${about.slice(0, READ_MORE_CUTOFF).trimEnd()}…`}{" "}
                    {about.length > READ_MORE_CUTOFF && (
                      <button
                        type="button" onClick={() => setExpanded((v) => !v)}
                        className="border-none bg-transparent p-0 font-semibold text-foreground underline [-webkit-tap-highlight-color:transparent]"
                      >
                        {expanded ? t("jobDetail.showLess") : t("jobDetail.readMore")}
                      </button>
                    )}
                  </p>
                </div>
              ) : sections.length === 0 ? (
                <p className="m-0 text-[13px] text-muted-foreground">{t("jobDetail.noDescriptionProvided")}</p>
              ) : null}

              {sections.map((s) => (
                <div key={s.title} className="mb-6">
                  <h2 className="m-0 mb-2 text-[15px] font-bold text-foreground">{s.title}</h2>
                  <ul className="m-0 flex list-disc flex-col gap-3 pl-5 text-[13.5px] leading-relaxed text-neutral-700 dark:text-neutral-300">
                    {s.lines.map((line, i) => <li key={i}>{line}</li>)}
                  </ul>
                </div>
              ))}

              {metadata.length > 0 && (
                <div>
                  <h2 className="m-0 mb-2.5 text-[11px] font-bold tracking-[0.1em] text-muted-foreground/60 uppercase">{t("jobDetail.jobDetails")}</h2>
                  <dl className="m-0 flex flex-col gap-2">
                    {metadata.map((m) => (
                      <div key={m.label} className="flex items-baseline justify-between gap-4 border-b border-border/60 py-1.5 text-[13px]">
                        <dt className="shrink-0 font-medium text-muted-foreground">{m.label}</dt>
                        <dd className="m-0 text-right font-semibold text-foreground">{m.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </>
          )}

          {tab === "Company" && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="m-0 mb-1 text-[15px] font-bold text-foreground">{job.company_name}</h2>
                <p className="m-0 text-[13px] text-muted-foreground">
                  {t("jobDetail.listedVia", { source: SOURCE_LABELS[job.source] || job.source })}{job.posted_at ? ` · ${timeAgo(job.posted_at, t)}` : ""}
                </p>
                {SOURCES_WITHOUT_DIRECT_LINK.has(job.source) && (
                  <p className="m-0 mt-1 text-[12px] text-muted-foreground/70">{t("jobDetail.opensCompanyJobsPage", { company: job.company_name })}</p>
                )}
              </div>
              <div>
                <h2 className="m-0 mb-2.5 text-[11px] font-bold tracking-[0.1em] text-muted-foreground/60 uppercase">{t("jobDetail.verification")}</h2>
                <div className="flex items-center gap-2 text-foreground">
                  <VerifyIcon className="size-4" strokeWidth={1.75} />
                  <span className="text-[13px] font-semibold">
                    {t("jobDetail.levelLabel", { n: level, detail: level >= 3 ? t("jobDetail.domainAgeVerified") : level === 2 ? t("jobDetail.domainConfirmed") : t("jobDetail.sourceVerified") })}
                  </span>
                </div>
                {checks_passed?.length > 0 && (
                  <ul className="m-0 mt-2.5 flex list-disc flex-col gap-1.5 pl-5 text-[12.5px] leading-relaxed text-muted-foreground">
                    {checks_passed.map((c) => <li key={c}>{c.replace(/^level\d_/, "").replace(/_/g, " ")}</li>)}
                  </ul>
                )}
                {checks_not_attempted?.length > 0 && (
                  <p className="m-0 mt-2 text-[11.5px] text-muted-foreground/60">
                    {t("jobDetail.notAttempted", { list: checks_not_attempted.map((c) => c.replace(/^level\d_/, "").replace(/_/g, " ")).join(", ") })}
                  </p>
                )}
              </div>
            </div>
          )}

          {tab === "Review" && (
            <div className="grid justify-items-center gap-2 py-10 text-center">
              <p className="m-0 text-[13px] font-semibold text-foreground">{t("jobDetail.noReviewsYet")}</p>
              <p className="m-0 text-[12.5px] text-muted-foreground">{t("jobDetail.reviewsNotAvailable")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Deliberately theme-constant pitch black, not bg-foreground — same
          reasoning as Dashboard.js's own floating "+" FAB: this is the
          one thumb-anchor action on the screen, and it should look
          identical in light or dark mode, not invert to a white button
          the moment the OS switches themes. */}
      <div
        className="fixed inset-x-0 bottom-0 px-5 pt-6"
        style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))", background: "linear-gradient(to top, var(--background) 55%, transparent)" }}
      >
        {onNavigate && (
          <button
            type="button" onClick={buildResumeForJob}
            className="mx-auto mb-2.5 flex h-[44px] w-full max-w-xl items-center justify-center gap-1.5 rounded-2xl border border-border bg-background text-[13.5px] font-bold text-foreground [-webkit-tap-highlight-color:transparent]"
          >
            <Sparkles className="size-4" strokeWidth={2} /> {t("jobDetail.buildResumeForJob")}
          </button>
        )}
        <a
          href={job.url} target="_blank" rel="noreferrer"
          className="mx-auto flex h-[52px] w-full max-w-xl items-center justify-center rounded-2xl text-[15px] font-bold text-white [-webkit-tap-highlight-color:transparent]"
          style={{ background: "#0a0a0a" }}
        >
          {t("jobDetail.applyThisJob")}
        </a>
      </div>
    </motion.div>
  );
}
