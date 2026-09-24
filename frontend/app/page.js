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
const ArtisanListingManager = dynamicScreen(() => import("../components/premium/artisan/ArtisanListingManager"));
const Settings = dynamicScreen(() => import("../components/premium/Settings"));
const Login = dynamicScreen(() => import("../components/premium/auth/Login"));
const Signup = dynamicScreen(() => import("../components/premium/auth/Signup"));
const CVScan = dynamicScreen(() => import("../components/premium/CVScan"));
const JobTracker = dynamicScreen(() => import("../components/premium/JobTracker"));
const ApplyWithAI = dynamicScreen(() => import("../components/premium/ApplyWithAI"));
const BrandWorkspaceView = dynamicScreen(() => import("../components/premium/brand/BrandWorkspaceView").then((m) => ({ default: m.BrandWorkspaceView })));

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
const ENTERED_KEY = "noqeev_entered_app";

// Which screen a refresh should land back on — the last one actually
// worth returning to. Deliberately excludes "launcher" (governed by
// ENTERED_KEY instead) and "login"/"signup" (transient forms; refreshing
// mid-signup and finding the same empty form again isn't "picking up
// where you left off," it's just confusing — dashboard is the more
// sensible landing spot for those two).
const VIEW_KEY = "noqeev_last_view";
const RESTORABLE_VIEWS = new Set([
  "dashboard", "resume", "cvscan", "jobtracker", "apply", "settings", "artisans", "artisan-dashboard", "artisan-listing-manager", "brand-workspace",
]);

// The branding workspace has no account to restore into — RESTORABLE_VIEWS
// above only remembers which SCREEN a refresh should land on, not the
// token that screen actually needs, so it gets its own small persisted
// value alongside VIEW_KEY. Same "the token in the URL is the whole
// access control" shape the backend uses (see BrandWorkspace.token) —
// this is just where the browser keeps hold of it between visits, not a
// second credential.
const WORKSPACE_TOKEN_KEY = "noqeev_brand_workspace_token";

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
  // Same idea, for a specific saved resume clicked from Dashboard.js's own
  // "Recent resumes" row — without this, every row opened the studio at
  // its default state regardless of which one was actually clicked. Set
  // by openResume's resumeId argument, consumed once by GuestMode (the
  // "guest" mode tab inside Resume.js, where saved resumes actually live),
  // then implicitly cleared the same way pendingImport is: every other
  // path into "resume" calls openResume() with no id, which resets this.
  const [pendingLoadResumeId, setPendingLoadResumeId] = useState(null);
  // Dashboard's "Recent resumes" section has a "View all" link, meant to
  // land on the full Saved list (GuestMode's own "templates" tab — see its
  // top-of-file comment, "'Saved' tab: all previously generated resumes").
  // Without this, that link just opened the studio at whatever mode/tab a
  // restored draft last left it in — often the AI wizard mid-draft, not a
  // list of anything, since nothing told it "the user asked for the list."
  const [pendingViewAllResumes, setPendingViewAllResumes] = useState(false);
  // Same idea again, for a specific Apply with AI run clicked from the
  // notification bell (Dashboard.js's own "X" run just finished" item) —
  // without this, opening "apply" always lands on the blank URL form
  // regardless of which finished run the notification was actually about.
  // Consumed once by ApplyWithAI, cleared the same implicit way as the
  // other pending* values: any other path into "apply" passes no runId.
  const [pendingApplyRunId, setPendingApplyRunId] = useState(null);
  // Same idea, for a job description handed off by the "tailor for this
  // job" bookmarklet (see lib/bookmarklet.js) — set once, from the ?jd=
  // query param below, consumed once by GuestMode, then cleared.
  const [pendingJobDesc, setPendingJobDesc] = useState(null);
  // Set only by Dashboard.js's notification bell, for a click on a
  // customer-side unread item — Artisans opens straight to "My requests"
  // instead of Browse. Cleared on every other path into "artisans" so a
  // stale deep-link never resurfaces on an unrelated later visit.
  const [artisansInitialTab, setArtisansInitialTab] = useState(null);
  // The branding workspace's own access token — set from the ?ws= deep
  // link (mount effect below) or restored from WORKSPACE_TOKEN_KEY,
  // never anywhere else. No login means this literally IS the session.
  const [workspaceToken, setWorkspaceToken] = useState(null);
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

    // The branding workspace's own deep link: /?ws=<token>. Same shape
    // as ?jd= above, same priority over the plain restore-last-view
    // check below — someone opening this link wants the workspace, not
    // whatever screen they last had open. Unlike ?jd= (single-use), the
    // token is kept (not just consumed) — there's no login to re-derive
    // it from later, so WORKSPACE_TOKEN_KEY is what lets a refresh (or
    // just re-opening the tab) land back in the same workspace without
    // needing the ?ws= link again.
    const wsToken = new URLSearchParams(window.location.search).get("ws");
    if (wsToken) {
      window.history.replaceState({}, "", window.location.pathname);
      try { localStorage.setItem(WORKSPACE_TOKEN_KEY, wsToken); } catch { /* best-effort */ }
      setWorkspaceToken(wsToken);
      setView("brand-workspace");
      setMounted(true);
      return;
    }

    try {
      if (localStorage.getItem(ENTERED_KEY) === "1") {
        const restored = restoreView();
        if (restored === "brand-workspace") {
          const savedToken = localStorage.getItem(WORKSPACE_TOKEN_KEY);
          // No saved token somehow (cleared storage, a different
          // browser) — there's nothing this screen can do without one,
          // so land on the dashboard instead of a workspace view stuck
          // showing its own "invalid link" state forever.
          if (savedToken) { setWorkspaceToken(savedToken); setView("brand-workspace"); }
          else setView("dashboard");
        } else {
          setView(restored);
        }
      }
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

  const openResume = (resumeId, { viewAllResumes = false } = {}) => {
    setPendingImport(null);
    setPendingJobDesc(null);
    // openResume is also used directly as an onClick handler in a few
    // places (FinalCTA.js, Footer.js's onOpen) — React calls it with the
    // SyntheticEvent as the first argument there, not a resume id. The
    // typeof guard is what keeps that from ever being mistaken for one.
    setPendingLoadResumeId(typeof resumeId === "string" ? resumeId : null);
    setPendingViewAllResumes(viewAllResumes);
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
          onNavigate={(id, opts) => {
            setArtisansInitialTab(id === "artisans" ? opts?.tab || null : null);
            if (id === "resume") openResume(opts?.resumeId, { viewAllResumes: opts?.viewAllResumes });
            else if (id === "scan") setView("cvscan");
            else if (id === "jobtracker") setView("jobtracker");
            else if (id === "artisans") setView("artisans");
            else if (id === "artisan-dashboard") setView("artisan-dashboard");
            else if (id === "apply") { setPendingApplyRunId(opts?.runId || null); setView("apply"); }
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
        <ApplyWithAI onClose={() => setView("dashboard")} pendingRunId={pendingApplyRunId} />
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
          onOpenArtisanListingManager={() => setView("artisan-listing-manager")}
        />
      </ErrorBoundary>
    );
  }

  if (view === "artisans") {
    return (
      <ErrorBoundary key={errorResetKey} onReset={retryView} onClose={() => setView("dashboard")}>
        <Artisans
          onClose={() => setView("dashboard")}
          onOpenArtisanDashboard={() => setView("artisan-dashboard")}
          initialTab={artisansInitialTab}
        />
      </ErrorBoundary>
    );
  }

  if (view === "artisan-dashboard") {
    return (
      <ErrorBoundary key={errorResetKey} onReset={retryView} onClose={() => setView("artisans")}>
        <ArtisanDashboard onClose={() => setView("artisans")} onOpenListingManager={() => setView("artisan-listing-manager")} />
      </ErrorBoundary>
    );
  }

  if (view === "artisan-listing-manager") {
    return (
      <ErrorBoundary key={errorResetKey} onReset={retryView} onClose={() => setView("artisan-dashboard")}>
        <ArtisanListingManager onClose={() => setView("artisan-dashboard")} />
      </ErrorBoundary>
    );
  }

  if (view === "brand-workspace") {
    return (
      <ErrorBoundary key={errorResetKey} onReset={retryView} onClose={() => setView("dashboard")}>
        <BrandWorkspaceView token={workspaceToken} onClose={() => setView("dashboard")} />
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
      <Resume key={sessionId} onClose={() => setView("dashboard")} pendingImport={pendingImport} pendingJobDesc={pendingJobDesc} pendingLoadResumeId={pendingLoadResumeId} pendingViewAllResumes={pendingViewAllResumes} />
    </ErrorBoundary>
  );
}
