"use client";
/**
 * app/error.js — Next's App Router segment error boundary. This is the
 * fallback for anything ErrorBoundary.js (components/premium/ErrorBoundary.js)
 * doesn't already cover: a crash during the initial render of page.js itself,
 * or inside the routes that don't wrap themselves in it yet
 * (admin/page.js, reset-password/page.js, verify-email/page.js).
 *
 * Must be a Client Component and must accept exactly {error, reset} — that's
 * the contract Next.js calls this with.
 */
import { useEffect } from "react";
import ErrorScreen from "@/components/premium/shared/ErrorScreen";

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error("Noviq crashed (segment boundary):", error);
  }, [error]);

  const variant = error?.code === "NETWORK_ERROR" ? "offline" : "crash";

  return (
    <ErrorScreen
      variant={variant}
      error={error}
      fullScreen
      onRetry={reset}
      closeHref={variant === "crash" ? "/" : undefined}
      closeLabel="Go Home"
    />
  );
}
