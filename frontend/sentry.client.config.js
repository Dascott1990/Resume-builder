// sentry.client.config.js — error tracking for everything that happens in
// the browser: unhandled exceptions, unhandled promise rejections, and
// (via ErrorBoundary.js's onError, wired in app/page.js) React render
// crashes, which Sentry's own global handlers can't see on their own.
//
// A no-op until NEXT_PUBLIC_SENTRY_DSN is actually set. This USED to be a
// static `import * as Sentry from "@sentry/nextjs"` at the top of the
// file — real production measurement (Lighthouse against the built
// landing page) found that import alone cost ~2 seconds of main-thread
// script execution and ~91KB, EVEN WITH NO DSN CONFIGURED, because a
// static top-level import always gets bundled and its module-level code
// always runs regardless of the runtime `if (dsn)` check below — a
// bundler can't tree-shake around a value it only knows at runtime. That
// was the single largest contributor to this page's Total Blocking Time
// (1.6s) and Largest Contentful Paint (4.8s) of anything in the whole
// bundle. A dynamic import fixes both problems at once: the SDK is only
// ever fetched/parsed/executed when a DSN is actually present, and even
// then it loads off the critical rendering path instead of blocking it.
// Tradeoff, accepted deliberately: an error in the brief window before
// this import resolves won't be captured — standard, small cost for
// keeping Sentry off a marketing page's core-vitals-critical path.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "production",
      // Light performance tracing, not 100% — this is a free-tier quota,
      // not something to burn through on a small app's normal traffic.
      tracesSampleRate: 0.1,
    });
  });
}
