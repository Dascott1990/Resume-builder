"use client";
import { useState } from "react";
import Resume from "../components/premium/Resume";
import ErrorBoundary from "../components/premium/ErrorBoundary";
import Artisans from "../components/premium/Artisans";
import LandingPage from "../components/premium/landing/LandingPage";

export default function Home() {
  const [view, setView] = useState("launcher"); // "launcher" | "resume" | "artisans"
  // Bumped on "Try Again" to force a fresh <Resume> instance without leaving
  // the studio — see ErrorBoundary's onReset below.
  const [sessionId, setSessionId] = useState(0);

  if (view === "launcher") {
    return (
      <LandingPage
        onOpen={() => { setSessionId((id) => id + 1); setView("resume"); }}
        onOpenArtisans={() => setView("artisans")}
      />
    );
  }
  if (view === "artisans") {
    return (
      <ErrorBoundary onReset={() => setView("artisans")} onClose={() => setView("launcher")}>
        <Artisans onClose={() => setView("launcher")} />
      </ErrorBoundary>
    );
  }
  return (
    <ErrorBoundary
      // "Try Again": remount a clean Resume tree (clears whatever state caused
      // the crash) but stays open — the user doesn't lose their place in the app.
      onReset={() => setSessionId((id) => id + 1)}
      // "Close": actually leave the studio and go back to the launcher screen.
      onClose={() => setView("launcher")}
    >
      <Resume key={sessionId} onClose={() => setView("launcher")} />
    </ErrorBoundary>
  );
}