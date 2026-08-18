// sentry.client.config.js — error tracking for everything that happens in
// the browser: unhandled exceptions, unhandled promise rejections, and
// (via ErrorBoundary.js's onError, wired in app/page.js) React render
// crashes, which Sentry's own global handlers can't see on their own.
//
// A no-op until NEXT_PUBLIC_SENTRY_DSN is actually set — this file runs
// on every page load regardless, so it must never be the thing that
// breaks the app for someone who hasn't set that up yet.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "production",
    // Light performance tracing, not 100% — this is a free-tier quota,
    // not something to burn through on a small app's normal traffic.
    tracesSampleRate: 0.1,
  });
}
