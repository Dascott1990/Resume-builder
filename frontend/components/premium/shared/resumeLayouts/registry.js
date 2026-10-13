// registry.js — the single list of real visual resume layouts that Guest
// Mode AI's (guest/GuestMode.js) template picker reads, so a new layout
// only ever needs to be added here once. `label`/`description` are the
// English fallback shown wherever a caller doesn't have `t` on hand yet;
// callers that render these to a user should prefer `layouts(t)` below.
// atsSafe: real, not cosmetic — single-column layouts flow as one linear
// text stream in both the .docx and PDF export, which is what every ATS
// parser actually reads cleanly. Sidebar's two-column visual is a real,
// commonly-documented ATS risk (contact info and skills sit in a separate
// column some parsers skip or reorder) — flagged honestly here rather
// than silently presenting all three as equally safe, which is the
// actual trust problem: a template that visually impresses a human but
// can cost someone a real application deserves a clear heads-up, not a
// confident claim with no basis.
export const LAYOUTS = [
  {
    id: "classic",
    label: "Classic",
    description: "Centered header, colored section rules",
    atsSafe: true,
  },
  {
    id: "sidebar",
    label: "Modern Sidebar",
    description: "Two columns — colored panel for contact & skills",
    atsSafe: false,
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "Quiet typography, generous whitespace",
    atsSafe: true,
  },
  {
    id: "compact",
    label: "Compact",
    description: "Tight spacing, built to fit a long history on one page",
    atsSafe: true,
  },
  {
    id: "executive",
    label: "Executive",
    description: "Bolder section labels, generous spacing",
    atsSafe: true,
  },
];

export const layouts = (t) => [
  { id: "classic", label: t("templates.classicLabel"), description: t("templates.classicDescription"), atsSafe: true },
  { id: "sidebar", label: t("templates.sidebarLabel"), description: t("templates.sidebarDescription"), atsSafe: false, atsNote: t("templates.atsSidebarNote") },
  { id: "minimal", label: t("templates.minimalLabel"), description: t("templates.minimalDescription"), atsSafe: true },
  { id: "compact", label: t("templates.compactLabel"), description: t("templates.compactDescription"), atsSafe: true },
  { id: "executive", label: t("templates.executiveLabel"), description: t("templates.executiveDescription"), atsSafe: true },
];

export const DEFAULT_LAYOUT = "classic";
