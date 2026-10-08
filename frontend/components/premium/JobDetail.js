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
import { ArrowLeft, Share2, Building2, ShieldCheck, ShieldQuestion, Check } from "lucide-react";
import { SOURCE_LABELS, SOURCES_WITHOUT_DIRECT_LINK, timeAgo } from "./shared/jobsBoardShared";
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

// Real descriptions from these sources are one unstructured plain-text
// blob (HTML-stripped, see sources.py's _strip_html) — no separate
// "qualifications" field exists anywhere in the pipeline. This looks for
// a real heading line the source's own text already contains ("Qualifications:",
// "Requirements:", etc.) and, only when one's actually there, splits
// everything after it into real bullet items. No heading found means no
// Qualifications section is rendered at all — never invented bullets.
function splitQualifications(text) {
  if (!text) return { about: "", qualifications: [] };
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const headingIdx = lines.findIndex((l) =>
    /^(qualifications|requirements|what you.ll need|what you bring|who you are|skills( required)?)[:\s]*$/i.test(l)
  );
  if (headingIdx === -1) return { about: text.trim(), qualifications: [] };
  const about = lines.slice(0, headingIdx).join("\n\n");
  const qualifications = lines.slice(headingIdx + 1)
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
  return { about, qualifications };
}

export function JobDetail({ job, applied, onClose }) {
  const { t } = useLanguage();
  const TAB_LABELS = { Description: t("jobDetail.tabDescription"), Company: t("jobDetail.tabCompany"), Review: t("jobDetail.tabReview") };
  const [tab, setTab] = useState("Description");
  const [expanded, setExpanded] = useState(false);
  const { about, qualifications } = splitQualifications(stripTags(job.description_text));

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
              ) : qualifications.length === 0 ? (
                <p className="m-0 text-[13px] text-muted-foreground">{t("jobDetail.noDescriptionProvided")}</p>
              ) : null}

              {qualifications.length > 0 && (
                <div>
                  <h2 className="m-0 mb-2 text-[15px] font-bold text-foreground">{t("jobDetail.qualifications")}</h2>
                  <ul className="m-0 flex list-disc flex-col gap-3 pl-5 text-[13.5px] leading-relaxed text-neutral-700 dark:text-neutral-300">
                    {qualifications.map((q, i) => <li key={i}>{q}</li>)}
                  </ul>
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
