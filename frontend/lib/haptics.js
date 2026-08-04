// A short vibration pulse for meaningful confirmations (rating submitted,
// listing removed) — the mobile-web equivalent of the haptic tick native
// apps use for the same moments. Not wired to every tap: reserved for
// actions worth confirming, the same restraint native apps apply.
// Silently does nothing where unsupported (desktop browsers, iOS Safari —
// the Vibration API has no iOS support at all) — never throws either way.
export function tapFeedback() {
  try {
    navigator.vibrate?.(10);
  } catch {
    // no-op — feedback is a nicety, never worth surfacing an error over
  }
}
