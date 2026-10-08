// registry.js — the single list of real visual resume layouts that Guest
// Mode AI's (guest/GuestMode.js) template picker reads, so a new layout
// only ever needs to be added here once. `label`/`description` are the
// English fallback shown wherever a caller doesn't have `t` on hand yet;
// callers that render these to a user should prefer `layouts(t)` below.
export const LAYOUTS = [
  {
    id: "classic",
    label: "Classic",
    description: "Centered header, colored section rules",
  },
  {
    id: "sidebar",
    label: "Modern Sidebar",
    description: "Two columns — colored panel for contact & skills",
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "Quiet typography, generous whitespace",
  },
];

export const layouts = (t) => [
  { id: "classic", label: t("templates.classicLabel"), description: t("templates.classicDescription") },
  { id: "sidebar", label: t("templates.sidebarLabel"), description: t("templates.sidebarDescription") },
  { id: "minimal", label: t("templates.minimalLabel"), description: t("templates.minimalDescription") },
];

export const DEFAULT_LAYOUT = "classic";
