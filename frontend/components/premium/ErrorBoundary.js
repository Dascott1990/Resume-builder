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
    this.state = { hasError: false, error: null, componentStack: null, showDetails: false, copied: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ componentStack: info?.componentStack || null });
    // Always visible in dev tools without leaking a stack trace to the user...
    console.error("Resume Builder crashed:", error, info?.componentStack);
    // ...and pluggable into real logging (Sentry, etc.) via a prop, so this
    // component doesn't need to know which logging service the app uses.
    this.props.onError?.(error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, componentStack: null, showDetails: false, copied: false });
    if (this.props.onReset) this.props.onReset();
  };

  handleCopyDetails = async () => {
    const { error, componentStack } = this.state;
    const report = [
      `Resume Builder error — ${new Date().toISOString()}`,
      `${error?.name || "Error"}: ${error?.message || "Unknown error"}`,
      error?.stack ? `\nStack:\n${error.stack}` : "",
      componentStack ? `\nComponent stack:${componentStack}` : "",
    ].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(report);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // Clipboard blocked — details are still visible on screen to copy manually.
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const { error, componentStack, showDetails, copied } = this.state;
    // Always show the real message — a generic "something went wrong" screen
    // wastes everyone's time. If a message is genuinely missing, say so
    // plainly rather than pretending nothing is known.
    const message = error?.message || "No error message was provided.";

    return (
      <div
        role="alert"
        style={{
          height: "100%", minHeight: 320, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", textAlign: "center",
          background: C.bg, color: C.text, fontFamily: C.sans, padding: 32, gap: 16,
          overflowY: "auto",
        }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: "50%", background: C.surface,
          border: `1px solid ${C.border}`, display: "flex", alignItems: "center",
          justifyContent: "center", flexShrink: 0,
        }}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke={C.gold}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <div style={{ maxWidth: 460, width: "100%" }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 14.5, color: C.muted, lineHeight: 1.5, marginBottom: 14 }}>
            Your work isn't lost — this screen just hit a snag. You can pick back up
            from here.
          </div>

          {/* The actual error, front and center — this is the whole point:
              no guessing, no support back-and-forth to find out what broke. */}
          <div style={{
            textAlign: "left", background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: "12px 14px", marginBottom: 10,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.04em",
              textTransform: "uppercase", marginBottom: 5 }}>
              What happened
            </div>
            <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.5, fontFamily: "'SF Mono','JetBrains Mono',monospace",
              wordBreak: "break-word" }}>
              {error?.name && error.name !== "Error" ? `${error.name}: ` : ""}{message}
            </div>
          </div>

          {(componentStack || error?.stack) && (
            <div style={{ textAlign: "left", marginBottom: 4 }}>
              <button
                onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
                style={{
                  background: "none", border: "none", cursor: "pointer", color: C.gold,
                  fontSize: 12.5, fontWeight: 600, fontFamily: C.sans, padding: "4px 0",
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                {showDetails ? "Hide" : "Show"} technical details
              </button>

              {showDetails && (
                <div style={{
                  marginTop: 6, background: "#0A0B0E", border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: 12, maxHeight: 180, overflow: "auto",
                }}>
                  <pre style={{
                    margin: 0, fontSize: 11, lineHeight: 1.5, color: C.muted,
                    fontFamily: "'SF Mono','JetBrains Mono',monospace",
                    whiteSpace: "pre-wrap", wordBreak: "break-word",
                  }}>
                    {error?.stack || message}
                    {componentStack || ""}
                  </pre>
                  <button
                    onClick={this.handleCopyDetails}
                    style={{
                      marginTop: 8, background: "none", border: `1px solid ${C.border}`,
                      borderRadius: 6, color: C.muted, fontSize: 11, fontFamily: C.sans,
                      padding: "5px 10px", cursor: "pointer",
                    }}
                  >
                    {copied ? "Copied" : "Copy details"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 6, flexShrink: 0 }}>
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