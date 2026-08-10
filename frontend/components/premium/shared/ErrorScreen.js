"use client";
/**
 * ErrorScreen.js — the one visual for every "this screen can't go on"
 * moment: a render crash (ErrorBoundary.js), a dead network (offline
 * variant), or a URL that doesn't exist (app/not-found.js). One component
 * so all three read as the same app, not three unrelated screens someone
 * bolted on at different times.
 *
 * The mark is the existing Logo3D (see Logo3D.js) — not a new 3D asset.
 * It already carries its own three-layer fallback to the flat 2D LogoMark
 * (no WebGL support, a render error inside the scene, a lost GL context),
 * which matters *especially* here: an error screen is the worst possible
 * place to introduce a second thing that can fail to render. The outer
 * wobble is just a plain CSS rotation on the wrapping div — the brand
 * asset itself is untouched — so a calm, confident mark reads as "something
 * knocked this off balance" without needing bespoke broken-logo geometry.
 */
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import Logo3D from "@/components/premium/Logo3D";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

const COPY = {
  crash: {
    title: "Something went wrong",
    message: "Your work isn't lost — this screen just hit a snag. You can pick back up from here.",
    retryLabel: "Try Again",
  },
  offline: {
    title: "Can't reach Noviq",
    message: "Check your connection and try again — nothing here was lost.",
    retryLabel: "Try Again",
  },
  notfound: {
    title: "This page doesn't exist",
    message: "The link might be old, or the address might be off.",
    retryLabel: "Go Home",
  },
};

function WobblingMark({ size }) {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <div
      className={reducedMotion ? undefined : "noviq-error-wobble"}
      style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <Logo3D style={{ width: size, height: size, display: "block" }} />
      {!reducedMotion && (
        <style jsx>{`
          .noviq-error-wobble {
            animation: noviq-error-wobble 2.6s ease-in-out infinite;
            transform-origin: 50% 65%;
          }
          @keyframes noviq-error-wobble {
            0%, 100% { transform: rotate(0deg); }
            20% { transform: rotate(-4deg); }
            50% { transform: rotate(3deg); }
            80% { transform: rotate(-2deg); }
          }
        `}</style>
      )}
    </div>
  );
}

/**
 * Props:
 *   variant       "crash" | "offline" | "notfound" — picks the default copy below.
 *   error         optional Error — its .message overrides the default copy for
 *                 "crash" (real message beats a generic one), and feeds the
 *                 technical-details panel.
 *   componentStack  optional React componentStack string, alongside error.stack.
 *   title, message  explicit overrides, if the default copy for the variant isn't right.
 *   onRetry       primary button handler. Omit to hide the primary button entirely.
 *   retryLabel    overrides the variant's default button label.
 *   onClose       secondary button handler (e.g. "Close" back to a dashboard).
 *   closeHref     alternative to onClose — renders the secondary action as a real link.
 *   closeLabel    defaults to "Close" (onClose) or "Go Home" (closeHref).
 *   fullScreen    true = fills the viewport (app/not-found.js, app/error.js).
 *                 false = fills its parent (an inline ErrorBoundary embedded in a panel).
 */
export default function ErrorScreen({
  variant = "crash",
  error,
  componentStack,
  title,
  message,
  onRetry,
  retryLabel,
  onClose,
  closeHref,
  closeLabel,
  fullScreen = false,
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = COPY[variant] || COPY.crash;
  const resolvedTitle = title || copy.title;
  const resolvedMessage = message || copy.message;
  // Real message beats generic copy, same rule the old crash-only screen used —
  // but only for "crash": an offline/notfound screen already has the right
  // user-facing story, and error.message here is usually the network client's
  // own wording ("Could not reach the server at http://…"), which belongs in
  // the technical panel, not the headline.
  const crashDetail = variant === "crash" ? error?.message : null;
  const hasTechnical = Boolean(error?.detail || error?.stack || componentStack || error?.message);

  const handleCopy = async () => {
    const report = [
      `Noviq error — ${variant}`,
      error?.name && error?.message ? `${error.name}: ${error.message}` : (error?.message || ""),
      error?.detail ? `\nDetail: ${error.detail}` : "",
      error?.stack ? `\nStack:\n${error.stack}` : "",
      componentStack ? `\nComponent stack:${componentStack}` : "",
    ].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the panel is still on screen to copy by hand.
    }
  };

  return (
    <div
      role="alert"
      className={
        "flex w-full flex-col items-center justify-center gap-4 overflow-y-auto bg-background p-8 text-center text-foreground " +
        (fullScreen ? "h-[100dvh]" : "h-full min-h-[320px]")
      }
      style={fullScreen ? { paddingTop: "max(2rem, env(safe-area-inset-top))", paddingBottom: "env(safe-area-inset-bottom, 0px)" } : undefined}
    >
      <div className="flex size-20 shrink-0 items-center justify-center rounded-[22px] border border-border bg-card">
        <WobblingMark size={44} />
      </div>

      <div className="w-full max-w-[460px]">
        <div className="mb-1.5 text-lg font-bold">{resolvedTitle}</div>
        <div className="mb-3.5 text-[14.5px] leading-relaxed text-muted-foreground">
          {resolvedMessage}
        </div>

        {crashDetail && (
          <Alert className="mb-2.5 text-left">
            <AlertTitle className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              What happened
            </AlertTitle>
            <AlertDescription className="break-words font-mono text-[13.5px] leading-relaxed text-foreground">
              {error?.name && error.name !== "Error" ? `${error.name}: ` : ""}{crashDetail}
            </AlertDescription>
          </Alert>
        )}

        {hasTechnical && (
          <Collapsible open={showDetails} onOpenChange={setShowDetails} className="mb-1 text-left">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-1 py-1 text-[12.5px] font-semibold text-primary">
                {showDetails ? "Hide" : "Show"} technical details
                {showDetails ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1.5 max-h-[180px] overflow-auto rounded-lg border border-border bg-black/30 p-3">
              <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
                {error?.detail || error?.stack || error?.message || "No further detail was provided."}
                {componentStack || ""}
              </pre>
              <Button variant="outline" size="sm" className="mt-2" onClick={handleCopy}>
                {copied ? "Copied" : "Copy details"}
              </Button>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      <div className="mt-1.5 flex shrink-0 gap-2.5">
        {onRetry && (
          <Button size="lg" className="h-11 px-5 text-[14.5px] font-bold" onClick={onRetry}>
            {retryLabel || copy.retryLabel}
          </Button>
        )}
        {onClose && (
          <Button variant="outline" size="lg" className="h-11 px-5 text-[14.5px] font-semibold" onClick={onClose}>
            {closeLabel || "Close"}
          </Button>
        )}
        {closeHref && !onClose && (
          <Button variant="outline" size="lg" className="h-11 px-5 text-[14.5px] font-semibold" asChild>
            <a href={closeHref}>{closeLabel || "Go Home"}</a>
          </Button>
        )}
      </div>
    </div>
  );
}
