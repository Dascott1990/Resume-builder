"use client";
/**
 * ErrorBoundary.js — app/components/premium/ErrorBoundary.js
 *
 * Catches render-time crashes anywhere below it in the tree and shows a calm,
 * on-brand recovery screen (ErrorScreen.js) instead of a blank white page.
 * Class component is required here — React error boundaries cannot be
 * written as hooks.
 *
 * Usage:
 *   <ErrorBoundary
 *     onReset={() => setSessionId(id => id + 1)}  // "Try Again": remount a clean child
 *     onClose={() => setOpen(false)}               // "Close": actually leave
 *     onError={(error, info) => logToSentry(error, info)}  // optional, for real logging
 *   >
 *     <Resume key={sessionId} onClose={onClose} />
 *   </ErrorBoundary>
 *
 * Important: onReset must do more than clear this component's own state — the
 * crash usually comes from bad state inside the child, so onReset should force
 * a fresh child instance (e.g. by changing the child's `key`), not just hide
 * the error screen and leave the same broken instance mounted underneath it.
 */

import React from "react";
import * as Sentry from "@sentry/nextjs";
import ErrorScreen from "./shared/ErrorScreen";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ componentStack: info?.componentStack || null });
    // Always visible in dev tools without leaking a stack trace to the user...
    console.error("Resume Builder crashed:", error, info?.componentStack);
    // ...and reported for real (Sentry.init is a no-op until
    // NEXT_PUBLIC_SENTRY_DSN is set, so this is safe to fire unconditionally
    // even before that's configured — it just goes nowhere until it is).
    // React render crashes are exactly what Sentry's own global handlers
    // CAN'T see on their own; this is what actually surfaces them.
    Sentry.captureException(error, { contexts: { react: { componentStack: info?.componentStack } } });
    // Still pluggable via a prop for any call site that wants MORE than
    // the default reporting above, not instead of it.
    this.props.onError?.(error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, componentStack: null });
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const { error, componentStack } = this.state;
    // A dropped connection (see shared/api.js's NETWORK_ERROR tag) is a
    // different story than an actual bug — "check your connection," not
    // "here's a stack trace" — so it gets its own calmer screen.
    const variant = error?.code === "NETWORK_ERROR" ? "offline" : "crash";

    return (
      <ErrorScreen
        variant={variant}
        error={error}
        componentStack={componentStack}
        onRetry={this.handleReset}
        onClose={this.props.onClose}
      />
    );
  }
}

export default ErrorBoundary;
