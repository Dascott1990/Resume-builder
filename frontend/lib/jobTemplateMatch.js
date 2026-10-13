// lib/jobTemplateMatch.js — a fast, honest template pick for a specific
// real job listing (JobDetail.js's "Build a resume for this job"), not an
// AI call: every job already carries a real `category` field computed
// once at ingestion time (backend/app/jobs_ingest/categories.py's
// categorize(), the exact same function), so this is a pure instant
// lookup, no network round trip for the pick itself.
//
// Deliberately conservative about what counts as "reasoned" here:
// - Layout varies by category, and only among the four ATS-safe layouts
//   (registry.js's own atsSafe flag) — never Modern Sidebar automatically,
//   since that's a real, already-documented ATS risk this app itself
//   flags; recommending it without the visitor explicitly choosing it
//   would undercut the whole point of a "safe default."
// - A real seniority signal already sits in the job's own title text
//   (not invented) — "Senior", "Director", "VP", etc. — and overrides the
//   category pick toward Executive, which exists for exactly this.
// - Font varies only along a real, broadly-understood convention (serif
//   reads more traditional/formal, sans more modern/clean) for categories
//   where that distinction is actually meaningful.
// - Accent color is NOT varied by category — there's no real basis for
//   "this color suits this job," the same reasoning lib/resumeRegions.js
//   already applies to not varying colors by country.
//
// This is a sensible match for the kind of role it is, never framed as
// "the best" or "proven to convert" — there's no outcome data anywhere
// in this app to back a stronger claim than that.

const SENIOR_TITLE_RE = /\b(senior|sr\.?|lead|director|vp|vice president|head of|chief|principal|president)\b/i;

const CATEGORY_LAYOUT = {
  "Finance": "compact",
  "Operations": "compact",
  "Cybersecurity": "minimal",
  "Data & Analytics": "minimal",
  "Engineering": "minimal",
};
const DEFAULT_LAYOUT = "classic";

const SERIF_CATEGORIES = new Set(["Finance", "People & HR", "Operations"]);

export function pickTemplateForJob(job) {
  const category = job?.category || "Other";
  const title = job?.title || "";

  const layout = SENIOR_TITLE_RE.test(title) ? "executive" : (CATEGORY_LAYOUT[category] || DEFAULT_LAYOUT);
  const font = SERIF_CATEGORIES.has(category) ? "garamond" : "calibri";

  return { layout, accent: "navy", font };
}
