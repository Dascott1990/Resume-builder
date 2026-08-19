// registry.js — the single list of real visual resume layouts. Both
// "My Resumes" (Resume.js) and Guest Mode AI (guest/GuestMode.js) read
// this same list for their template pickers, so a new layout only ever
// needs to be added here once.
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

export const DEFAULT_LAYOUT = "classic";
