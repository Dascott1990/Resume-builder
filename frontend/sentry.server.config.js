// sentry.server.config.js — error tracking for Next.js's own server-side
// rendering (mostly the landing page and shared layout — most of this
// app's real screens are next/dynamic({ ssr: false }), so this covers a
// smaller slice than the client config, but SSR crashes are exactly the
// kind that otherwise show up only as a blank page with nothing in the
// browser console to explain why).
//
// Same no-op-until-configured guard as sentry.client.config.js. Reads the
// plain (non-NEXT_PUBLIC_) var — this only ever runs on the server, so it
// never needs to be bundled into client-side JS.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "production",
    // Server-side tracing off, not just low — @sentry/node's performance
    // tracing pulls in OpenTelemetry auto-instrumentation that expects an
    // ESM `--import` loader hook, which Next.js's webpack-bundled server
    // build can't satisfy (surfaces as a "Module not found" warning on
    // every server compile). Error capture (the actual point of this
    // integration) is unaffected either way — this only trades away
    // request-timing traces on the server, which the client config's own
    // tracesSampleRate still covers for page-level navigation timing.
    tracesSampleRate: 0,
  });
}
