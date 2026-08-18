// instrumentation.js — the hook Next.js itself calls once per server
// runtime at boot, before anything else runs. No edge config here on
// purpose: this project has no middleware.js and nothing else running on
// the edge runtime, so there's nothing for sentry.edge.config.js to cover.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config.js");
  }
}
