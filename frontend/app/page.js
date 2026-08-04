"use client";
import { useState } from "react";
import Resume from "../components/premium/Resume";
import ErrorBoundary from "../components/premium/ErrorBoundary";
import Artisans from "../components/premium/Artisans";
import LandingPage from "../components/premium/landing/LandingPage";
import Dashboard from "../components/premium/Dashboard";
import Login from "../components/premium/auth/Login";
import Signup from "../components/premium/auth/Signup";
import CVScan from "../components/premium/CVScan";
import JobTracker from "../components/premium/JobTracker";

export default function Home() {
  const [view, setView] = useState("launcher"); // "launcher" | "dashboard" | "login" | "signup" | "resume" | "artisans" | "cvscan" | "jobtracker"
  // Bumped on "Try Again" (and on any fresh entry into the studio) to force
  // a new <Resume> instance instead of reusing whatever was mounted before.
  const [sessionId, setSessionId] = useState(0);
  // Set only by CVScan's onImported, consumed once by Resume/GuestMode as
  // their initial state, then cleared — every other path into "resume"
  // clears it first so a stale scan never resurfaces on a later, unrelated
  // visit to the studio.
  const [pendingImport, setPendingImport] = useState(null);

  const openResume = () => {
    setPendingImport(null);
    setSessionId((id) => id + 1);
    setView("resume");
  };

  if (view === "launcher") {
    return (
      <LandingPage
        onOpen={openResume}
        onOpenArtisans={() => setView("artisans")}
        onOpenDashboard={() => setView("dashboard")}
      />
    );
  }

  if (view === "dashboard") {
    return (
      <Dashboard
        onClose={() => setView("launcher")}
        onOpenLogin={() => setView("login")}
        onNavigate={(id) => {
          if (id === "resume") openResume();
          else if (id === "scan") setView("cvscan");
          else if (id === "jobtracker") setView("jobtracker");
          else if (id === "artisans") setView("artisans");
        }}
      />
    );
  }

  if (view === "login") {
    return (
      <Login
        onClose={() => setView("dashboard")}
        onSuccess={() => setView("dashboard")}
        onSwitchToSignup={() => setView("signup")}
      />
    );
  }

  if (view === "signup") {
    return (
      <Signup
        onClose={() => setView("dashboard")}
        onSuccess={() => setView("dashboard")}
        onSwitchToLogin={() => setView("login")}
      />
    );
  }

  if (view === "cvscan") {
    return (
      <CVScan
        onClose={() => setView("dashboard")}
        onImported={(data) => {
          setPendingImport(data);
          setSessionId((id) => id + 1);
          setView("resume");
        }}
      />
    );
  }

  if (view === "jobtracker") {
    return <JobTracker onClose={() => setView("dashboard")} />;
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
      <Resume key={sessionId} onClose={() => setView("launcher")} pendingImport={pendingImport} />
    </ErrorBoundary>
  );
}
