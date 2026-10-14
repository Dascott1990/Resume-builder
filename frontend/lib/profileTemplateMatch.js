// lib/profileTemplateMatch.js — the CareerProfile-driven sibling of
// jobTemplateMatch.js's pickTemplateForJob: same honest, non-hypey pick
// (never claims "best"/"proven," never auto-suggests Modern Sidebar, the
// one atsSafe:false layout), but reasoning from a saved CareerProfile
// instead of a job listing. CareerProfile has no stored category field
// the way Job does (backend/app/models.py), so this classifies the user's
// own most recent role + skills text client-side — no network call, no
// AI, same pure-function style as the job picker.
import { SENIOR_TITLE_RE, CATEGORY_LAYOUT, DEFAULT_LAYOUT, SERIF_CATEGORIES } from "./jobTemplateMatch";

// Mirrors backend/app/jobs_ingest/categories.py's category groupings
// closely enough that a profile pick and a job pick never disagree on
// what a "Finance" or "Engineering" background looks like. Reimplemented
// here rather than imported since this must run client-side.
const CATEGORY_KEYWORDS = [
  ["Customer Support", ["customer support", "customer success", "support engineer", "technical support", "help desk"]],
  ["Cybersecurity", ["security engineer", "security analyst", "cybersecurity", "infosec", "penetration test", "application security", "cloud security", "security operations"]],
  ["Data & Analytics", ["data scientist", "data engineer", "data analyst", "analytics", "machine learning", "ml engineer", "ai engineer", "research scientist"]],
  ["Engineering", ["engineer", "developer", "swe", "software", "backend", "frontend", "full stack", "devops", "infrastructure", "qa", "sre"]],
  ["Design", ["designer", "ux", "product design"]],
  ["Product", ["product manager", "product owner", "product lead"]],
  ["Sales", ["sales", "account executive", "account manager", "business development", "sdr", "bdr", "partnerships"]],
  ["Marketing", ["marketing", "growth", "content writer", "seo", "brand", "communications", "pr manager"]],
  ["Finance", ["finance", "accountant", "accounting", "controller", "payroll", "fp&a", "treasury"]],
  ["People & HR", ["recruiter", "recruiting", "talent", "people ops", "human resources", " hr ", "hrbp"]],
  ["Operations", ["operations", "office manager", "program manager", "logistics", "supply chain", "facilities"]],
];

function classify(text) {
  const t = ` ${text.toLowerCase()} `;
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => t.includes(kw))) return category;
  }
  return "Other";
}

// Returns null whenever there's no real signal to reason from — no
// confirmed profile, or a confirmed profile with no work history and no
// skills — rather than guessing. Callers must treat null as "show
// today's unchanged, unbadged behavior."
export function pickTemplateForProfile(profile) {
  if (!profile?.confirmed) return null;

  const mostRecentRole = (Array.isArray(profile.work_history) && profile.work_history[0]?.role) || "";
  const skillsText = Array.isArray(profile.skills) ? profile.skills.join(" ") : "";
  if (!mostRecentRole.trim() && !skillsText.trim()) return null;

  const category = classify(`${mostRecentRole} ${skillsText}`);
  const layout = SENIOR_TITLE_RE.test(mostRecentRole) ? "executive" : (CATEGORY_LAYOUT[category] || DEFAULT_LAYOUT);
  const font = SERIF_CATEGORIES.has(category) ? "garamond" : "calibri";

  return { layout, accent: "navy", font, category, role: mostRecentRole };
}
