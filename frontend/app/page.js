"use client";
import { useState } from "react";
import Resume from "../components/premium/Resume";
import ErrorBoundary from "../components/premium/ErrorBoundary";

export default function Home() {
  const [open, setOpen] = useState(true);
  // Bumped on "Try Again" to force a fresh <Resume> instance without leaving
  // the studio — see ErrorBoundary's onReset below.
  const [sessionId, setSessionId] = useState(0);

  if (!open) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <button onClick={() => { setSessionId(id => id + 1); setOpen(true); }} style={{ padding: "10px 18px" }}>
          Open Resume Studio
        </button>
      </div>
    );
  }
  return (
    <ErrorBoundary
      // "Try Again": remount a clean Resume tree (clears whatever state caused
      // the crash) but stays open — the user doesn't lose their place in the app.
      onReset={() => setSessionId((id) => id + 1)}
      // "Close": actually leave the studio and go back to the launcher screen.
      onClose={() => setOpen(false)}
    >
      <Resume key={sessionId} onClose={() => setOpen(false)} />
    </ErrorBoundary>
  );
}