"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Resume from "../components/premium/Resume";
import ErrorBoundary from "../components/premium/ErrorBoundary";
import Artisans from "../components/premium/Artisans";
import LandingPage from "../components/premium/landing/LandingPage";
import Dashboard from "../components/premium/Dashboard";
import Login from "../components/premium/auth/Login";
import Signup from "../components/premium/auth/Signup";
import CVScan from "../components/premium/CVScan";
import JobTracker from "../components/premium/JobTracker";
import Logo from "../components/premium/Logo";

// Once someone's actually used the product, refreshing the tab shouldn't
// bounce them back out to the marketing page — that's a re-onboarding
// flow you'd only want for a brand-new visitor. This is the one thing
// that decides "have they entered the app before," so a plain refresh
// lands back on the dashboard instead.
const ENTERED_KEY = "noviq_entered_app";

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
  // Same idea, for a job description handed off by the "tailor for this
  // job" bookmarklet (see lib/bookmarklet.js) — set once, from the ?jd=
  // query param below, consumed once by GuestMode, then cleared.
  const [pendingJobDesc, setPendingJobDesc] = useState(null);

  // This page is server-rendered at "/" — the server has no way to know
  // whether this browser has visited before, so it always renders the
  // launcher. Deciding "actually, go straight to the dashboard" has to
  // happen after mount (same fix as Hero.js's own SSR-safe viewport
  // check), otherwise the server's HTML and the client's first paint
  // disagree and hydration fails outright.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // The bookmarklet opens this exact URL shape: /?jd=<capture id>. Takes
    // priority over the plain "have they visited before" check below —
    // someone clicking the bookmarklet wants the job posting they were
    // just reading, not just their last-used screen.
    const jdId = new URLSearchParams(window.location.search).get("jd");
    if (jdId) {
      // Strip the param immediately so a later refresh of this tab doesn't
      // try to redeem an id that's already been consumed (capture rows are
      // single-use — see backend/app/api/capture.py).
      window.history.replaceState({}, "", window.location.pathname);
      // Plain fetch, not the shared apiRequest helper — that helper always
      // attaches an X-Guest-Id header, and this endpoint's CORS is
      // deliberately narrower/more permissive-by-origin than the rest of
      // the API (see backend/app/__init__.py) since it also has to accept
      // calls from arbitrary job board pages via the bookmarklet. Capture
      // rows aren't scoped to a guest/user anyway, so there's nothing for
      // that header to do here except fail the preflight.
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/capture/jd/${jdId}`)
        .then((r) => { if (!r.ok) throw new Error("capture fetch failed"); return r.json(); })
        .then((json) => {
          setPendingImport(null);
          setPendingJobDesc(json.data.text);
          setSessionId((id) => id + 1);
          setView("resume");
        })
        .catch(() => {
          // Expired/already used/network hiccup — fall back to the normal
          // "have they visited before" flow below rather than stalling on
          // a blank screen.
          try {
            if (localStorage.getItem(ENTERED_KEY) === "1") setView("dashboard");
          } catch { /* best-effort */ }
        })
        // Held until the fetch settles either way — flipping this straight
        // away would flash the marketing launcher for a moment (view is
        // still its initial "launcher" value) before the redirect lands.
        .finally(() => setMounted(true));
      return;
    }

    try {
      if (localStorage.getItem(ENTERED_KEY) === "1") setView("dashboard");
    } catch { /* best-effort */ }
    setMounted(true);
  }, []);

  // Marks "entered" the moment they leave the launcher via any path —
  // Dashboard's own tiles, the landing page's direct CTAs, all of it.
  useEffect(() => {
    if (!mounted || view === "launcher") return;
    try { localStorage.setItem(ENTERED_KEY, "1"); } catch { /* best-effort */ }
  }, [mounted, view]);

  if (!mounted) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-background">
        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}>
          <Logo size={28} />
        </motion.div>
      </div>
    );
  }

  const openResume = () => {
    setPendingImport(null);
    setPendingJobDesc(null);
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
        // The one true exit back to the marketing page — everywhere else,
        // "close" means "back to the dashboard," not "back out of the app."
        onClose={() => {
          try { localStorage.removeItem(ENTERED_KEY); } catch { /* best-effort */ }
          setView("launcher");
        }}
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
          setPendingJobDesc(null);
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
      <ErrorBoundary onReset={() => setView("artisans")} onClose={() => setView("dashboard")}>
        <Artisans onClose={() => setView("dashboard")} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary
      // "Try Again": remount a clean Resume tree (clears whatever state caused
      // the crash) but stays open — the user doesn't lose their place in the app.
      onReset={() => setSessionId((id) => id + 1)}
      // "Close": back to the dashboard, not out of the app entirely.
      onClose={() => setView("dashboard")}
    >
      <Resume key={sessionId} onClose={() => setView("dashboard")} pendingImport={pendingImport} pendingJobDesc={pendingJobDesc} />
    </ErrorBoundary>
  );
}
