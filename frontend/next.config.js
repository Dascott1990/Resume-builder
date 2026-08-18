const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // instrumentation.js (Sentry's server-side init hook) needs this on
  // Next.js 14.x — it only became on-by-default in 15. Harmless to leave
  // set even once that stops mattering.
  experimental: {
    instrumentationHook: true,
  },
};

// @sentry/nextjs is pinned to ^8 in package.json, not latest — v9 and v10
// both ship a newer Node auto-instrumentation ("Orchestrion"/OpenTelemetry
// hook-based) that expects an ESM `--import` loader Next's webpack-bundled
// server build can't provide, surfacing as "Module not found" / "Critical
// dependency" warnings on every server compile even with tracing fully
// disabled — tried both, confirmed on this exact Next 14.2.5 setup. v8
// predates that machinery entirely and compiles clean. Worth re-trying a
// newer major once that friction is resolved upstream, not before.
//
// withSentryConfig here exists only for its webpack config patches (also
// part of what keeps server bundling clean) — NOT for its source-map
// upload feature, which is explicitly disabled below since that needs its
// own auth token/org/project env vars, exactly the kind of extra manual
// setup this integration is trying to avoid requiring. Errors still
// report fully without it; stack traces just show minified code instead
// of the original source.
module.exports = withSentryConfig(nextConfig, {
  silent: true,
  disableServerWebpackPlugin: true,
  disableClientWebpackPlugin: true,
  telemetry: false,
});
