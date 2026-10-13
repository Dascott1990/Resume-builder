// lib/viewRoutes.js — the two-way map between app/page.js's internal
// `view` state and a real, visible, bookmarkable URL path. Before this,
// every screen in the app lived at the same bare "/" — Resume, Profile,
// Job Tracker, all of it — which meant no bookmarking a specific screen,
// no sharing a link to it, and the browser's own back/forward buttons
// did nothing useful. One view per path, single segment only (no
// resumeId/runId encoded in the URL — that's a bigger change than what
// this maps, and the view-level URL is the actual thing asked for).
//
// "dashboard" and "launcher" both resolve to "/" on purpose — same root
// either way, the signed-in home or the signed-out landing page depending
// on who's looking, the same pattern most real apps already use for their
// own root URL.
//
// personal-profile and brand-workspace are deliberately absent:
// personal-profile is a sub-screen reached from Profile, not a primary
// nav destination; brand-workspace already has its own real URL scheme
// (the ?ws=<token> query param, see app/page.js) that predates this and
// works differently (the token IS the access control, not an auth-gated
// view name) — giving it a second, different kind of path here would
// conflict with that, not complement it.
export const VIEW_TO_PATH = {
  dashboard: "/",
  launcher: "/",
  resume: "/resume",
  cvscan: "/scan",
  jobtracker: "/tracker",
  news: "/news",
  apply: "/apply",
  profile: "/profile",
  jobsboard: "/jobs",
  templates: "/templates",
  login: "/login",
  signup: "/signup",
};

// The reverse of the above, keyed by the single path segment (no leading
// slash) — what app/[view]/page.js checks a visited URL against, and
// what app/page.js's own mount effect reads back on a direct load of one
// of these paths. Deliberately NOT auto-derived from VIEW_TO_PATH:
// dashboard/launcher both map to "/" going one direction, which doesn't
// invert to a single well-defined view going the other.
export const PATH_TO_VIEW = {
  resume: "resume",
  scan: "cvscan",
  tracker: "jobtracker",
  news: "news",
  apply: "apply",
  profile: "profile",
  jobs: "jobsboard",
  templates: "templates",
  login: "login",
  signup: "signup",
};
