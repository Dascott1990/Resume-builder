"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import ErrorBoundary from "../components/premium/ErrorBoundary";
import LandingPage from "../components/premium/landing/LandingPage";
import Dashboard from "../components/premium/Dashboard";
import Logo from "../components/premium/Logo";

// Every screen here used to be a plain static import — meaning a
// brand-new visitor's very first page load pulled down the full code for
// the resume editor, Settings, Artisans (map included), the job tracker,
// CV scan, and the whole Apply-with-AI agent flow, all before they'd
// even seen the landing page, since this file is the one root client
// component every one of those screens is reached through (see the
// view-state switch below — there's no real per-route code splitting to
// fall back on the way file-based Next.js routes get for free). next/
// dynamic defers each one to its own chunk, fetched only the first time
// someone actually navigates there. LandingPage and Dashboard stay
// static/eager on purpose — they're what a first-time visitor and a
// returning visitor respectively see FIRST, so those two shouldn't pay a
// loading-chunk delay on top of everything else; every screen reached
// one click deeper than that is fair game.
const dynamicScreen = (loader) => dynamic(loader, { ssr: false, loading: () => <ScreenLoading /> });
const Resume = dynamicScreen(() => import("../components/premium/Resume"));
const Artisans = dynamicScreen(() => import("../components/premium/Artisans"));
const ArtisanDashboard = dynamicScreen(() => import("../components/premium/artisan/ArtisanDashboard"));
const Settings = dynamicScreen(() => import("../components/premium/Settings"));
const Login = dynamicScreen(() => import("../components/premium/auth/Login"));
const Signup = dynamicScreen(() => import("../components/premium/auth/Signup"));
const CVScan = dynamicScreen(() => import("../components/premium/CVScan"));
const JobTracker = dynamicScreen(() => import("../components/premium/JobTracker"));
const ApplyWithAI = dynamicScreen(() => import("../components/premium/ApplyWithAI"));

// Same pulsing-logo treatment as the !mounted gate below, not a generic
// spinner — a chunk fetch is usually near-instant on a warm cache, but
// when it isn't, this should still feel like part of the same product.
function ScreenLoading() {
  return (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-background">
      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}>
        <Logo size={28} />
      </motion.div>
    </div>
  );
}

// Once someone's actually used the product, refreshing the tab shouldn't
// bounce them back out to the marketing page — that's a re-onboarding
// flow you'd only want for a brand-new visitor. This is the one thing
// that decides "have they entered the app before," so a plain refresh
// lands back on the dashboard instead.
const ENTERED_KEY = "noviq_entered_app";

// Which screen a refresh should land back on — the last one actually
// worth returning to. Deliberately excludes "launcher" (governed by
// ENTERED_KEY instead) and "login"/"signup" (transient forms; refreshing
// mid-signup and finding the same empty form again isn't "picking up
// where you left off," it's just confusing — dashboard is the more
// sensible landing spot for those two).
const VIEW_KEY = "noviq_last_view";
const RESTORABLE_VIEWS = new Set([
  "dashboard", "resume", "cvscan", "jobtracker", "apply", "settings", "artisans", "artisan-dashboard",
]);

function restoreView() {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return RESTORABLE_VIEWS.has(v) ? v : "dashboard";
  } catch {
    return "dashboard";
  }
}

export default function Home() {
  const [view, setView] = useState("launcher"); // "launcher" | "dashboard" | "login" | "signup" | "resume" | "artisans" | "artisan-dashboard" | "cvscan" | "jobtracker" | "apply" | "settings"
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
  // Shared remount key for every view below that isn't Resume (which already
  // has its own sessionId for this exact purpose). A crash's "Try Again"
  // needs a genuinely fresh child instance, not just the error screen
  // hiding itself over the same broken one — see ErrorBoundary.js's own
  // usage note.
  const [errorResetKey, setErrorResetKey] = useState(0);
  const retryView = () => setErrorResetKey((k) => k + 1);

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
            if (localStorage.getItem(ENTERED_KEY) === "1") setView(restoreView());
          } catch { /* best-effort */ }
        })
        // Held until the fetch settles either way — flipping this straight
        // away would flash the marketing launcher for a moment (view is
        // still its initial "launcher" value) before the redirect lands.
        .finally(() => setMounted(true));
      return;
    }

    try {
      if (localStorage.getItem(ENTERED_KEY) === "1") setView(restoreView());
    } catch { /* best-effort */ }
    setMounted(true);
  }, []);

  // Marks "entered" the moment they leave the launcher via any path —
  // Dashboard's own tiles, the landing page's direct CTAs, all of it.
  useEffect(() => {
    if (!mounted || view === "launcher") return;
    try { localStorage.setItem(ENTERED_KEY, "1"); } catch { /* best-effort */ }
  }, [mounted, view]);

  // Remembers whichever restorable screen is current, so a refresh lands
  // back where they actually were instead of always bouncing to the
  // dashboard — the same reasoning as ENTERED_KEY above, one level more
  // specific. Only ever reads back through restoreView() at mount time
  // (above), never mid-session, so this can't fight with normal in-app
  // navigation.
  useEffect(() => {
    if (!mounted) return;
    try {
      if (RESTORABLE_VIEWS.has(view)) localStorage.setItem(VIEW_KEY, view);
      else localStorage.removeItem(VIEW_KEY);
    } catch { /* best-effort */ }
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
      <ErrorBoundary key={errorResetKey} onReset={retryView}>
        <LandingPage
          onOpen={openResume}
          onOpenArtisans={() => setView("artisans")}
          onOpenDashboard={() => setView("dashboard")}
        />
      </ErrorBoundary>
    );
  }

  if (view === "dashboard") {
    return (
      <ErrorBoundary
        key={errorResetKey}
        onReset={retryView}
        onClose={() => {
          try { localStorage.removeItem(ENTERED_KEY); localStorage.removeItem(VIEW_KEY); } catch { /* best-effort */ }
          setView("launcher");
        }}
      >
        <Dashboard
          // The one true exit back to the marketing page — everywhere else,
          // "close" means "back to the dashboard," not "back out of the app."
          onClose={() => {
            try { localStorage.removeItem(ENTERED_KEY); localStorage.removeItem(VIEW_KEY); } catch { /* best-effort */ }
            setView("launcher");
          }}
          onNavigate={(id) => {
            if (id === "resume") openResume();
            else if (id === "scan") setView("cvscan");
            else if (id === "jobtracker") setView("jobtracker");
            else if (id === "artisans") setView("artisans");
            else if (id === "apply") setView("apply");
            else if (id === "settings") setView("settings");
          }}
        />
      </ErrorBoundary>
    );
  }

  if (view === "login") {
    return (
      <ErrorBoundary key={errorResetKey} onReset={retryView} onClose={() => setView("dashboard")}>
        <Login
          onClose={() => setView("dashboard")}
          onSuccess={() => setView("dashboard")}
          onSwitchToSignup={() => setView("signup")}
        />
      </ErrorBoundary>
    );
  }

  if (view === "signup") {
    return (
      <ErrorBoundary key={errorResetKey} onReset={retryView} onClose={() => setView("dashboard")}>
        <Signup
          onClose={() => setView("dashboard")}
          onSuccess={() => setView("dashboard")}
          onSwitchToLogin={() => setView("login")}
        />
      </ErrorBoundary>
    );
  }

  if (view === "cvscan") {
    return (
      <ErrorBoundary key={errorResetKey} onReset={retryView} onClose={() => setView("dashboard")}>
        <CVScan
          onClose={() => setView("dashboard")}
          onImported={(data) => {
            setPendingImport(data);
            setPendingJobDesc(null);
            setSessionId((id) => id + 1);
            setView("resume");
          }}
        />
      </ErrorBoundary>
    );
  }

  if (view === "jobtracker") {
    return (
      <ErrorBoundary key={errorResetKey} onReset={retryView} onClose={() => setView("dashboard")}>
        <JobTracker onClose={() => setView("dashboard")} />
      </ErrorBoundary>
    );
  }

  if (view === "apply") {
    return (
      <ErrorBoundary key={errorResetKey} onReset={retryView} onClose={() => setView("dashboard")}>
        <ApplyWithAI onClose={() => setView("dashboard")} />
      </ErrorBoundary>
    );
  }

  if (view === "settings") {
    return (
      <ErrorBoundary key={errorResetKey} onReset={retryView} onClose={() => setView("dashboard")}>
        <Settings
          onClose={() => setView("dashboard")}
          onOpenLogin={() => setView("login")}
          onOpenArtisanAuth={() => setView("artisan-dashboard")}
        />
      </ErrorBoundary>
    );
  }

  if (view === "artisans") {
    return (
      <ErrorBoundary key={errorResetKey} onReset={retryView} onClose={() => setView("dashboard")}>
        <Artisans onClose={() => setView("dashboard")} onOpenArtisanDashboard={() => setView("artisan-dashboard")} />
      </ErrorBoundary>
    );
  }

  if (view === "artisan-dashboard") {
    return (
      <ErrorBoundary key={errorResetKey} onReset={retryView} onClose={() => setView("artisans")}>
        <ArtisanDashboard onClose={() => setView("artisans")} />
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
