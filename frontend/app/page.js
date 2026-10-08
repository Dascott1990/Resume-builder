"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import ErrorBoundary from "../components/premium/ErrorBoundary";
import LandingPage from "../components/premium/landing/LandingPage";
import { Navbar } from "../components/premium/landing/Navbar";
import Dashboard from "../components/premium/Dashboard";
import Logo from "../components/premium/Logo";
import { getToken, hasAccountOnDevice } from "@/lib/authToken";

// Every screen here used to be a plain static import — meaning a
// brand-new visitor's very first page load pulled down the full code for
// the resume editor, Settings, the job tracker, CV scan, and the whole
// Apply-with-AI agent flow, all before they'd even seen the landing page,
// since this file is the one root client
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
// "Resume" is the AI-driven Guest Mode wizard — the app's only resume
// editor now. There used to be a second "My Resumes" mode (a static
// pre-built template gallery) living in its own components/premium/
// Resume.js wrapper; it added a whole parallel editor, data model, and a
// confusing top-level choice for something Guest Mode already does
// better (real tailored content from your own info + a job posting,
// not a fictional example to hand-edit) — removed rather than kept
// around unused.
const Resume = dynamicScreen(() => import("../components/premium/guest"));
const Profile = dynamicScreen(() => import("../components/premium/Profile"));
const PersonalProfile = dynamicScreen(() => import("../components/premium/PersonalProfile"));
const JobsBoard = dynamicScreen(() => import("../components/premium/JobsBoard"));
const TemplatesGallery = dynamicScreen(() => import("../components/premium/TemplatesGallery"));
const Login = dynamicScreen(() => import("../components/premium/auth/Login"));
const Signup = dynamicScreen(() => import("../components/premium/auth/Signup"));
const CVScan = dynamicScreen(() => import("../components/premium/CVScan"));
const JobTracker = dynamicScreen(() => import("../components/premium/JobTracker"));
const News = dynamicScreen(() => import("../components/premium/News"));
const ApplyWithAI = dynamicScreen(() => import("../components/premium/ApplyWithAI"));
const BrandWorkspaceView = dynamicScreen(() => import("../components/premium/brand/BrandWorkspaceView").then((m) => ({ default: m.BrandWorkspaceView })));

// Same pulsing-logo treatment as the !mounted gate below, not a generic
// spinner — a chunk fetch is usually near-instant on a warm cache, but
// when it isn't, this should still feel like part of the same product.
// The one loading state every screen transition in this app shows —
// between a nav click and the target screen's chunk finishing (below,
// via dynamicScreen's own `loading:`) and before first hydration (the
// !mounted gate further down, which used to hand-duplicate this same
// markup instead of sharing it). A plain opacity pulse read as "waiting,"
// not "something's happening" — the sweep crossing the mark reads as a
// literal scan, which is also just a more honest match for what's
// actually going on (loading a real content bundle, not sitting idle).
// Still just two GPU-cheap transform/opacity animations, nothing that
// risks feeling slower than the load it's covering for.
function ScreenLoading() {
  return (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-background">
      <div className="relative overflow-hidden">
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
          <Logo size={28} />
        </motion.div>
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2"
          style={{ background: "linear-gradient(90deg, transparent, color-mix(in oklch, var(--primary) 55%, transparent), transparent)" }}
          animate={{ x: ["0%", "260%"] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}

// Which screen a refresh should land back on — for an ALREADY-authenticated
// visitor only; resolveLandingView() below never calls this without a real
// token in hand. Deliberately excludes "login"/"signup" (transient forms;
// refreshing mid-signup and finding the same empty form again isn't
// "picking up where you left off," it's just confusing — dashboard is the
// more sensible landing spot for those two).
const VIEW_KEY = "noqeev_last_view";
const RESTORABLE_VIEWS = new Set([
  "dashboard", "resume", "cvscan", "jobtracker", "news", "apply", "profile", "personal-profile", "jobsboard", "templates", "brand-workspace",
]);

// The branding workspace has no account to restore into — RESTORABLE_VIEWS
// above only remembers which SCREEN a refresh should land on, not the
// token that screen actually needs, so it gets its own small persisted
// value alongside VIEW_KEY. Same "the token in the URL is the whole
// access control" shape the backend uses (see BrandWorkspace.token) —
// this is just where the browser keeps hold of it between visits, not a
// second credential. It's also the one screen exempt from the auth gating
// below: a brand client opening this link was never meant to need a
// Noqeev account at all.
const WORKSPACE_TOKEN_KEY = "noqeev_brand_workspace_token";

function restoreView() {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return RESTORABLE_VIEWS.has(v) ? v : "dashboard";
  } catch {
    return "dashboard";
  }
}

// The single source of truth for "what should a page load show." No more
// anonymous dashboard access — every one of RESTORABLE_VIEWS is gated on
// a real account now, not just "has this browser been in the app before":
// a valid token wins outright (restore wherever they were); no token but
// this browser has signed in/up before gets Sign in, not a blank Sign up
// form or the marketing pitch they've already seen; genuinely first-time
// gets the marketing launcher, signup as the only forward path.
function resolveLandingView() {
  if (getToken()) return restoreView();
  if (hasAccountOnDevice()) return "login";
  return "launcher";
}

export default function Home() {
  const [view, setView] = useState("launcher"); // "launcher" | "dashboard" | "login" | "signup" | "resume" | "cvscan" | "jobtracker" | "apply" | "settings"
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
  // Set only by Dashboard's "Quick Build" tool chip — skips straight to
  // "just paste a job description" using the saved profile for name/title/
  // location/background, same as pendingJobDesc's own skip-step-1 case
  // (see GuestMode.js's step initializer) but entered directly rather than
  // via a job description handed in from outside.
  const [pendingQuickBuild, setPendingQuickBuild] = useState(false);
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

  // Where closing out of THIS screen should actually land — whatever the
  // user was really on just before. Every cross-screen navigation call
  // (go(), below) records the view it's leaving before switching, and
  // every screen's own onClose/X reads this back instead of a hardcoded
  // fixed destination — previously almost every screen closed straight to
  // "dashboard" regardless of where it was actually opened from (Profile's
  // Shortcuts, Jobs Board's nav, Templates' Done button, all landed back
  // on Home instead of wherever the user actually came from). Only set
  // while leaving a real destination (the login/signup guard) so bouncing
  // back and forth between those two forms doesn't overwrite the real
  // origin with "login"/"signup" itself.
  const [returnView, setReturnView] = useState("dashboard");
  const go = (nextView) => {
    // Navigating to the screen already showing would set returnView to
    // itself — every X/back button on that screen reads returnView, so
    // it'd silently become a no-op (stuck until a refresh resets state)
    // instead of actually closing anything. Individual screens guard
    // their own nav items against this today (e.g. Dashboard.js's and
    // JobsBoard.js's local go() wrappers), but this is the one choke
    // point every navigation actually passes through, so the guard
    // belongs here too — it's a correctness no-op either way.
    if (nextView === view) return;
    if (view !== "login" && view !== "signup") setReturnView(view);
    setView(nextView);
  };
  const openAuth = (mode) => go(mode);

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
          // landing-resolution flow below rather than stalling on a blank
          // screen.
          try { setView(resolveLandingView()); } catch { /* best-effort */ }
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
      // Brand-workspace is the one exception to the auth gating below —
      // see WORKSPACE_TOKEN_KEY's own comment — so it's checked on its own
      // saved token, independent of whether this browser has ever signed
      // up or signed in.
      if (localStorage.getItem(VIEW_KEY) === "brand-workspace") {
        const savedToken = localStorage.getItem(WORKSPACE_TOKEN_KEY);
        // No saved token somehow (cleared storage, a different browser) —
        // there's nothing this screen can do without one, so fall back to
        // the normal landing resolution instead of a workspace view stuck
        // showing its own "invalid link" state forever.
        if (savedToken) { setWorkspaceToken(savedToken); setView("brand-workspace"); }
        else setView(resolveLandingView());
      } else {
        setView(resolveLandingView());
      }
    } catch { /* best-effort */ }
    setMounted(true);
  }, []);

  // Admin's own "how many people click our link" ask — one raw hit per
  // real load of this root route, regardless of which view it resolves
  // into (landing, a restored dashboard, whatever). Plain fetch, not the
  // shared apiRequest helper (same reasoning as the ?jd= capture fetch
  // above: no X-Guest-Id header needed for an anonymous hit-counter, and
  // fire-and-forget — a failed/slow network call here must never affect
  // the page someone's actually trying to load).
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/meta/track-visit`, { method: "POST" }).catch(() => {});
  }, []);

  // The hard guarantee behind resolveLandingView() above: even if `view`
  // somehow ends up on an authenticated screen without a real token (a
  // stray setView call, a future bug), yank it back before anything
  // renders rather than silently showing dashboard/resume/etc. content to
  // someone who was never actually signed in. brand-workspace is exempt —
  // it was never gated on a Noqeev account to begin with.
  useEffect(() => {
    if (!mounted || getToken() || view === "brand-workspace") return;
    if (RESTORABLE_VIEWS.has(view)) {
      setView(hasAccountOnDevice() ? "login" : "launcher");
      // Whatever landed `view` on an auth-gated screen with no token
      // (stray setView call, a token that expired mid-session) almost
      // certainly also left `returnView` pointing at an auth-gated
      // screen — every X/back button reads returnView, so without this
      // the very next close-button click would try to go right back to
      // that same invalid screen and get bounced here again, looking
      // exactly like a dead button. "launcher" is never auth-gated, so
      // this is the one value that's always safe to land X on.
      setReturnView("launcher");
    }
  }, [mounted, view]);

  // Remembers whichever restorable screen is current, so a refresh lands
  // back where they actually were instead of always bouncing to the
  // dashboard default. Only ever reads back through restoreView() at mount
  // time (above), never mid-session, so this can't fight with normal
  // in-app navigation.
  useEffect(() => {
    if (!mounted) return;
    try {
      if (RESTORABLE_VIEWS.has(view)) localStorage.setItem(VIEW_KEY, view);
      else localStorage.removeItem(VIEW_KEY);
    } catch { /* best-effort */ }
  }, [mounted, view]);

  if (!mounted) {
    // The real root cause, found after chasing CSS theories that didn't
    // fix it: the server-rendered HTML for EVERY page load literally has
    // no navbar in it at all — mounted starts false on both server and
    // client, so this branch (ScreenLoading alone, no Navbar anywhere in
    // its tree) is what actually ships on first paint, every time,
    // before hydration ever runs. No amount of fixing the navbar's OWN
    // positioning could have helped — it doesn't exist in the DOM yet
    // during that window. Rendering it here too (same component,
    // identical props to LandingPage's own) means it's in the HTML from
    // the very first byte, the literal first thing to appear, matching
    // what was asked rather than a best-effort "appears as the page
    // loads." Harmless for an already-signed-in visitor about to land on
    // the dashboard instead — this shows for at most the single frame
    // before mount resolves, then LandingPage (if that's where they land)
    // renders its own identical Navbar in its place, or the dashboard
    // replaces it entirely.
    return (
      <>
        <Navbar onOpenSignup={() => openAuth("signup")} />
        <ScreenLoading />
      </>
    );
  }

  const openResume = (resumeId, { viewAllResumes = false, quickBuild = false } = {}) => {
    setPendingImport(null);
    setPendingJobDesc(null);
    setPendingLoadResumeId(typeof resumeId === "string" ? resumeId : null);
    setPendingViewAllResumes(viewAllResumes);
    setPendingQuickBuild(quickBuild);
    setSessionId((id) => id + 1);
    go("resume");
  };

  if (view === "launcher") {
    return (
      <ErrorBoundary key={errorResetKey} onReset={retryView}>
        <LandingPage onOpenSignup={() => openAuth("signup")} />
      </ErrorBoundary>
    );
  }

  if (view === "dashboard") {
    return (
      <ErrorBoundary
        key={errorResetKey}
        onReset={retryView}
        onClose={() => {
          try { localStorage.removeItem(VIEW_KEY); } catch { /* best-effort */ }
          setView("launcher");
        }}
      >
        <Dashboard
          // Sign out is the only way out of the authenticated app now — see
          // NavRail's sign-out icon — so this clears VIEW_KEY the same way
          // the old "close" button used to, just via signOut() -> onSignOut
          // in Dashboard.js instead of a button in the header.
          onSignOut={() => {
            try { localStorage.removeItem(VIEW_KEY); } catch { /* best-effort */ }
            // Bypasses go() on purpose (signing out isn't "navigating to
            // login", it's leaving the authenticated app), but that means
            // returnView is left pointing at whatever authenticated screen
            // was open (e.g. "dashboard") — clicking the Login screen's own
            // X then calls setView(returnView), which the auth-guard effect
            // below immediately bounces right back to "login" since there's
            // no token anymore. From the user's perspective the X looked
            // completely dead (confirmed live: sign out, click X, still on
            // the exact same sign-in screen). Resetting returnView to
            // "launcher" here — the one destination that's never auth-gated
            // — means X actually goes somewhere instead of looping forever.
            setReturnView("launcher");
            setView("login");
          }}
          onNavigate={(id, opts) => {
            if (id === "resume") openResume(opts?.resumeId, { viewAllResumes: opts?.viewAllResumes, quickBuild: opts?.quickBuild });
            else if (id === "scan") go("cvscan");
            else if (id === "jobtracker") go("jobtracker");
            else if (id === "news") go("news");
            else if (id === "apply") { setPendingApplyRunId(opts?.runId || null); go("apply"); }
            else if (id === "profile") go("profile");
            else if (id === "personal-profile") go("personal-profile");
            else if (id === "jobsboard") go("jobsboard");
            else if (id === "templates") go("templates");
          }}
        />
      </ErrorBoundary>
    );
  }

  if (view === "login") {
    return (
      <ErrorBoundary key={errorResetKey} onReset={retryView} onClose={() => setView(returnView)}>
        <Login
          onClose={() => setView(returnView)}
          onSuccess={() => setView("dashboard")}
          onSwitchToSignup={() => openAuth("signup")}
        />
      </ErrorBoundary>
    );
  }

  if (view === "signup") {
    return (
      <ErrorBoundary key={errorResetKey} onReset={retryView} onClose={() => setView(returnView)}>
        <Signup
          onClose={() => setView(returnView)}
          onSuccess={() => setView("dashboard")}
          onSwitchToLogin={() => openAuth("login")}
        />
      </ErrorBoundary>
    );
  }

  if (view === "cvscan") {
    return (
      <ErrorBoundary key={errorResetKey} onReset={retryView} onClose={() => setView(returnView)}>
        <CVScan
          onClose={() => setView(returnView)}
          onImported={(data) => {
            setPendingImport(data);
            setPendingJobDesc(null);
            setSessionId((id) => id + 1);
            go("resume");
          }}
        />
      </ErrorBoundary>
    );
  }

  if (view === "jobtracker") {
    return (
      <ErrorBoundary key={errorResetKey} onReset={retryView} onClose={() => setView(returnView)}>
        <JobTracker onClose={() => setView(returnView)} />
      </ErrorBoundary>
    );
  }

  if (view === "news") {
    return (
      <ErrorBoundary key={errorResetKey} onReset={retryView} onClose={() => setView(returnView)}>
        <News onClose={() => setView(returnView)} />
      </ErrorBoundary>
    );
  }

  if (view === "apply") {
    return (
      <ErrorBoundary key={errorResetKey} onReset={retryView} onClose={() => setView(returnView)}>
        <ApplyWithAI onClose={() => setView(returnView)} pendingRunId={pendingApplyRunId} />
      </ErrorBoundary>
    );
  }

  if (view === "profile") {
    return (
      <ErrorBoundary key={errorResetKey} onReset={retryView} onClose={() => setView(returnView)}>
        <Profile
          onClose={() => setView(returnView)}
          onOpenLogin={() => openAuth("login")}
          onOpenPersonalProfile={() => go("personal-profile")}
          go={(id, opts) => {
            if (id === "resume") openResume(opts?.resumeId, { viewAllResumes: opts?.viewAllResumes, quickBuild: opts?.quickBuild });
            else if (id === "scan") go("cvscan");
            else if (id === "jobtracker") go("jobtracker");
            else if (id === "apply") { setPendingApplyRunId(opts?.runId || null); go("apply"); }
            else if (id === "jobsboard") go("jobsboard");
          }}
        />
      </ErrorBoundary>
    );
  }

  if (view === "personal-profile") {
    return (
      <ErrorBoundary key={errorResetKey} onReset={retryView} onClose={() => setView("profile")}>
        <PersonalProfile onClose={() => setView("profile")} />
      </ErrorBoundary>
    );
  }

  if (view === "jobsboard") {
    return (
      <ErrorBoundary key={errorResetKey} onReset={retryView} onClose={() => setView(returnView)}>
        <JobsBoard
          onClose={() => setView(returnView)}
          onNavigate={(id, opts) => {
            if (id === "home") go("dashboard");
            else if (id === "resume") openResume(opts?.resumeId, { viewAllResumes: opts?.viewAllResumes, quickBuild: opts?.quickBuild });
            else if (id === "scan") go("cvscan");
            else if (id === "jobtracker") go("jobtracker");
            else if (id === "apply") { setPendingApplyRunId(opts?.runId || null); go("apply"); }
            else if (id === "profile") go("profile");
            else if (id === "personal-profile") go("personal-profile");
          }}
        />
      </ErrorBoundary>
    );
  }

  if (view === "templates") {
    return (
      <ErrorBoundary key={errorResetKey} onReset={retryView} onClose={() => setView(returnView)}>
        <TemplatesGallery
          onClose={() => setView(returnView)}
          onNavigate={(id) => {
            if (id === "home") go("dashboard");
            else if (id === "resume") openResume();
            else if (id === "apply") go("apply");
            else if (id === "jobtracker") go("jobtracker");
            else if (id === "profile") go("profile");
          }}
        />
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
      // "Close": back to wherever this was opened from, not always Home.
      onClose={() => setView(returnView)}
    >
      <Resume key={sessionId} onClose={() => setView(returnView)} onRequireAuth={openAuth} pendingImport={pendingImport} pendingJobDesc={pendingJobDesc} pendingLoadResumeId={pendingLoadResumeId} pendingViewAllResumes={pendingViewAllResumes} pendingQuickBuild={pendingQuickBuild} />
    </ErrorBoundary>
  );
}
