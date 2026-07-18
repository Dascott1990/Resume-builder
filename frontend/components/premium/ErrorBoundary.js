"use client";
/**
 * ErrorBoundary.js — app/components/premium/ErrorBoundary.js
 *
 * Catches render-time crashes anywhere below it in the tree and shows a calm,
 * on-brand recovery screen instead of a blank white page. Class component is
 * required here — React error boundaries cannot be written as hooks.
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

const C = {
  bg:      "#0C0D10",
  panel:   "#111318",
  surface: "#15171D",
  border:  "rgba(255,255,255,0.10)",
  text:    "#F5F2EA",
  muted:   "#A6ABB4",
  gold:    "#C9A24E",
  goldFg:  "#1A1710",
  sans:    "'Helvetica Neue',Arial,sans-serif",
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Always visible in dev tools without leaking a stack trace to the user...
    console.error("Resume Builder crashed:", error, info?.componentStack);
    // ...and pluggable into real logging (Sentry, etc.) via a prop, so this
    // component doesn't need to know which logging service the app uses.
    this.props.onError?.(error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          height: "100%", minHeight: 320, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", textAlign: "center",
          background: C.bg, color: C.text, fontFamily: C.sans, padding: 32, gap: 16,
        }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: "50%", background: C.surface,
          border: `1px solid ${C.border}`, display: "flex", alignItems: "center",
          justifyContent: "center",
        }}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke={C.gold}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <div style={{ maxWidth: 340 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 14.5, color: C.muted, lineHeight: 1.5 }}>
            Your work isn't lost — this screen just hit a snag. You can pick back up
            from here.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          <button
            onClick={this.handleReset}
            style={{
              padding: "12px 20px", borderRadius: 10, border: `1.5px solid ${C.gold}`,
              background: C.gold, color: C.goldFg, fontSize: 14.5, fontWeight: 700,
              fontFamily: C.sans, cursor: "pointer", minHeight: 44,
            }}
          >
            Try Again
          </button>
          {this.props.onClose && (
            <button
              onClick={this.props.onClose}
              style={{
                padding: "12px 20px", borderRadius: 10, border: `1.5px solid ${C.border}`,
                background: C.surface, color: C.text, fontSize: 14.5, fontWeight: 600,
                fontFamily: C.sans, cursor: "pointer", minHeight: 44,
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;