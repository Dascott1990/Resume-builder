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
import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

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
        className="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 overflow-y-auto bg-background p-8 text-center text-foreground"
      >
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full border border-border bg-card">
          <AlertCircle className="size-6 text-primary" strokeWidth={2} />
        </div>

        <div className="w-full max-w-[460px]">
          <div className="mb-1.5 text-lg font-bold">Something went wrong</div>
          <div className="mb-3.5 text-[14.5px] leading-relaxed text-muted-foreground">
            Your work isn't lost — this screen just hit a snag. You can pick back up
            from here.
          </div>

          {/* The actual error, front and center — this is the whole point:
              no guessing, no support back-and-forth to find out what broke. */}
          <Alert className="mb-2.5 text-left">
            <AlertTitle className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              What happened
            </AlertTitle>
            <AlertDescription className="break-words font-mono text-[13.5px] leading-relaxed text-foreground">
              {error?.name && error.name !== "Error" ? `${error.name}: ` : ""}{message}
            </AlertDescription>
          </Alert>

          {(componentStack || error?.stack) && (
            <Collapsible
              open={showDetails}
              onOpenChange={(open) => this.setState({ showDetails: open })}
              className="mb-1 text-left"
            >
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-1 py-1 text-[12.5px] font-semibold text-primary">
                  {showDetails ? "Hide" : "Show"} technical details
                  {showDetails ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1.5 max-h-[180px] overflow-auto rounded-lg border border-border bg-black/30 p-3">
                <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {error?.stack || message}
                  {componentStack || ""}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={this.handleCopyDetails}
                >
                  {copied ? "Copied" : "Copy details"}
                </Button>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        <div className="mt-1.5 flex shrink-0 gap-2.5">
          <Button size="lg" className="h-11 px-5 text-[14.5px] font-bold" onClick={this.handleReset}>
            Try Again
          </Button>
          {this.props.onClose && (
            <Button
              variant="outline"
              size="lg"
              className="h-11 px-5 text-[14.5px] font-semibold"
              onClick={this.props.onClose}
            >
              Close
            </Button>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
