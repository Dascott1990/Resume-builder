"use client";
/**
 * GuestMode.js — app/components/premium/guest/GuestMode.js
 *
 * Standalone guest resume builder.
 * - 2-step wizard: info → job description → AI generates
 * - Live editable preview (click any text)
 * - Download as real .docx (editable in Word/Google Docs) via hand-rolled OOXML
 * - Download as real text PDF via browser print (selectable, copyable text)
 * - "Saved" tab: all previously generated resumes, reload & re-download any
 * - Saves to backend: POST /api/v1/resume/generate (Groq)
 *
 * Props: { onClose }
 */
import { useState, useEffect, useRef, useCallback, useReducer } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { X, RefreshCw, ScanLine, Bookmark, Check, Zap } from "lucide-react";
import Logo3D from "../Logo3D";
import { Btn } from "./components/primitives";
import { LivePreview } from "./components/LivePreview";
import { ResumeSkeleton } from "./components/ResumeSkeleton";
import { ScanningResume } from "./components/ScanningResume";
import { PackagePreviewModal } from "./components/PackagePreviewModal";
import { DesktopTabNav } from "./components/DesktopTabNav";
import { MobileNav } from "./components/MobileNav";
import { InfoStep } from "./components/PanelContent/InfoStep";
import { QuickBuildIntro } from "./components/PanelContent/QuickBuildIntro";
import { JobDescStep } from "./components/PanelContent/JobDescStep";
import { ResultStep } from "./components/PanelContent/ResultStep";
import { StyleTab } from "./components/PanelContent/StyleTab";
import { SavedTab } from "./components/PanelContent/SavedTab";
import { SettingsTab } from "./components/PanelContent/SettingsTab";
import { DEFAULT_STYLE, EMPTY_INFO } from "./constants";
import { resumeReducer, onEditHandler } from "./guestReducer";
import { loadDraft, clearDraft, loadProfile, saveProfile, clearProfile, DRAFT_KEY } from "./useGuestDraft";
import { apiGenerate, apiOptimize, apiListSaved, apiGetSaved, apiDelete, apiConsumeDownload, apiGetDownloadCount } from "./api";
import { downloadDocx } from "./export/docx";
import { downloadCoverLetterDocx } from "./export/coverLetterDocx";
import { printPdf, printCoverLetterPdf } from "../shared/printPdf";
import { useViewport } from "@/lib/useViewport";
import { useAuth } from "@/lib/useAuth";
import { useSignupNudge } from "@/lib/useSignupNudge";
import { SignupNudgeModal } from "../shared/SignupNudgeModal";
import { DownloadCapModal } from "./components/DownloadCapModal";
import { DidYouApplyModal } from "./components/DidYouApplyModal";
import { AtsScoreModal } from "./components/AtsScoreModal";
import { BuilderSidebar } from "./components/workspace/BuilderSidebar";
import { FormattingToolbar } from "./components/workspace/FormattingToolbar";
import { AnalysisPanel } from "./components/workspace/AnalysisPanel";
import { getToken } from "@/lib/authToken";
import { getPreferredTemplate } from "@/lib/templatePreference";
import { apiRequest } from "../shared/api";
import { useLanguage } from "@/lib/i18n";

export default function GuestMode({ onClose, pendingImport, pendingJobDesc, pendingLoadResumeId, pendingViewAllResumes, pendingQuickBuild, onRequireAuth }) {
  const { t } = useLanguage();
  const { isPhone, isTablet, isDesktop } = useViewport();
  const { user } = useAuth();
  const signupNudge = useSignupNudge();
  // Real, server-tracked cap (see backend/app/models.py's
  // GuestDownloadCount) — signed-in sessions never see this banner or
  // gate, since consume always no-ops uncapped for them.
  const isSignedIn = !!getToken();
  const [downloadCount, setDownloadCount] = useState(0);
  const [capModalOpen, setCapModalOpen] = useState(false);
  useEffect(() => {
    if (isSignedIn) return;
    apiGetDownloadCount().then((d) => setDownloadCount(d.count));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Called at the top of every resume-download handler (NOT the
  // cover-letter-only ones — the cap is about resumes) before it builds
  // anything. Returns false and opens the gate modal on a real cap hit;
  // fails open (returns true) on any OTHER error, e.g. a network blip —
  // an unrelated hiccup in the cap-tracking subsystem should never be
  // what blocks someone's actual download.
  const checkDownloadAllowed = async () => {
    try {
      const d = await apiConsumeDownload();
      setDownloadCount(d.count);
      return true;
    } catch (e) {
      if (e.code === "DOWNLOAD_CAP_REACHED") {
        setCapModalOpen(true);
        return false;
      }
      return true;
    }
  };

  // "Did you apply?" — asked once per generated resume (appliedPromptDone
  // resets on a fresh generate/optimize and on "Build another"), fired
  // from the first successful download of it. Saying yes writes a real
  // row to the Job Tracker with the pasted job description as its notes
  // and this resume linked by id — the whole point being someone who just
  // actually applied doesn't also have to go re-type it into the tracker
  // by hand afterward.
  const [appliedPromptOpen, setAppliedPromptOpen] = useState(false);
  const [appliedPromptDone, setAppliedPromptDone] = useState(false);
  const maybeAskIfApplied = () => {
    if (appliedPromptDone) return;
    setAppliedPromptDone(true);
    setAppliedPromptOpen(true);
  };
  const saveApplication = async ({ company, role }) => {
    try {
      await apiRequest("/api/v1/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company, role, status: "applied",
          date_applied: new Date().toISOString().slice(0, 10),
          notes: jobDesc.slice(0, 900),
          resume_id: resume?.saved_id || genResult?.saved_id || null,
        }),
      });
      toast.success(t("guestMode.addedToJobTracker"));
    } catch (e) {
      toast.error(e.message || t("guestMode.couldntSaveApplication"));
    }
  };

  // Tablet used to be lumped in with phone — a single full-screen view at a
  // time, switching between the style/form panel and the resume preview.
  // On an iPad that's needless: there's plenty of width for both side by
  // side, same as desktop, so a style change shows up immediately instead
  // of "tweak → leave the panel → look → go back → tweak again." Only true
  // phones still need the one-screen-at-a-time flow.
  const showSplit = isDesktop || isTablet;

  // Phone only: which screen is showing — "panel" (form/list) or "preview".
  // Meaningless once showSplit is true (both are always visible), but kept
  // as one flag rather than two so existing call sites below don't need a
  // parallel isDesktop/isTablet branch of their own.
  const [mobileView, setMobileView] = useState("panel");

  // Phone only, Style tab specifically: same "edit here, see it there"
  // problem showSplit solves for tablet/desktop, solved differently since
  // a phone is too narrow to fit a sidebar AND a legible preview at once.
  // The preview stays the full-screen base the whole time; this just
  // tracks whether the style controls are showing as a sheet over it.
  const [styleSheetOpen, setStyleSheetOpen] = useState(false);
  // Phone's own entry point into the same BuilderSidebar desktop's workspace
  // uses — same bottom-sheet pattern as Style above, just over the Build
  // accordion (sections, add/remove entries, the AI rewrite bar) instead of
  // font/layout controls. Only ever opens once a resume actually exists —
  // before that, phone's existing 2-step wizard is still how one gets built.
  const [buildSheetOpen, setBuildSheetOpen] = useState(false);

  // One localStorage read on mount, reused below to seed every persisted field.
  const [draftAtMount]   = useState(loadDraft);
  // Saved personal info from a previous session — used only when there's no
  // in-progress draft to restore (an active draft already has the freshest info).
  const [profileAtMount] = useState(loadProfile);

  // A resume just parsed out of an uploaded CV (see CVScan.js) takes priority
  // over any restored draft — someone who just scanned a file wants to see
  // that result, not whatever they were doing before they navigated away to
  // scan it. A job description handed off by the "tailor for this job"
  // bookmarklet (see lib/bookmarklet.js) takes the same priority, landing
  // one step earlier — Job Posting, not the result — since there's no
  // resume yet, just the posting someone was just reading. A specific saved
  // resume clicked from Dashboard's Recent list (pendingLoadResumeId) gets
  // the exact same priority — someone who tapped THAT resume should see
  // that resume, not whatever unrelated draft was last left open here.
  // pendingViewAllResumes (Dashboard's "View all") is its own destination —
  // the Saved list itself, "templates" — distinct from all of the above,
  // which land on "new" (the editor/wizard).
  const [tab,        setTab]        = useState(() => {
    if (pendingViewAllResumes) return "templates";
    if (pendingImport || pendingJobDesc || pendingLoadResumeId) return "new";
    return draftAtMount?.tab || "new";
  });   // "new" | "style" | "templates" | "settings"
  // Skipping straight to step 2 only makes sense if there's already usable
  // info to generate from (a saved profile) — otherwise Optimize/Generate
  // would just fail on a missing name/title. With no profile yet, land on
  // step 1 instead; the job description is already saved below and waiting
  // on step 2 the moment they finish it.
  const hasUsableProfile = !!(profileAtMount?.name && profileAtMount?.title && profileAtMount?.location);
  const [step,       setStep]       = useState(() => {
    if (pendingImport || pendingLoadResumeId) return 3;
    if (pendingJobDesc) return hasUsableProfile ? 2 : 1;
    // Quick Build always lands on step 1 first, even with a usable profile
    // — it's just a different, much shorter step 1 (QuickBuildIntro below,
    // name + phone + email choice only) rather than skipping straight to
    // the job posting paste the way it used to. Without a profile yet,
    // it's the exact same full InfoStep everyone else sees — Quick Build
    // needs one real build on file before it has anything to reuse.
    if (pendingQuickBuild) return 1;
    return draftAtMount?.step || 1;
  });       // 1 | 2 | 3
  // Quick Build (Dashboard's Tools chip) skips straight to "just paste a
  // job description" using the saved profile for everything else — same
  // screen as step 2 always was, just entered without stopping at step 1
  // first. Stays true across "Build another" in resetWizard below, so a
  // whole quick session (several jobs in a row) keeps skipping step 1,
  // not just the first one.
  const [quickMode, setQuickMode] = useState(!!pendingQuickBuild && hasUsableProfile);

  // The floating nav recedes while someone's actively scrolling down through
  // a form (same idea as Instagram's bar shrinking on scroll) and comes back
  // on scroll-up or near the top. Reserved padding at the bottom of every
  // scroll container is still the hard guarantee against covering a button —
  // this is the polish on top, not the safety net itself.
  const [navHidden, setNavHidden] = useState(false);
  const lastScrollY = useRef(0);
  const handlePanelScroll = (e) => {
    const y = Math.max(0, e.target.scrollTop);
    const delta = y - lastScrollY.current;
    if (y < 24) setNavHidden(false);
    else if (delta > 8) setNavHidden(true);
    else if (delta < -8) setNavHidden(false);
    lastScrollY.current = y;
  };
  // Always resurface the nav on a fresh screen/tab/step — never leave it
  // hidden from wherever the previous scroll position happened to land.
  useEffect(() => { setNavHidden(false); lastScrollY.current = 0; }, [tab, mobileView, step]);

  const [info,       setInfo]       = useState(() => {
    if (pendingImport?.contact) {
      const c = pendingImport.contact;
      return { ...EMPTY_INFO, name: c.name || "", title: c.title || "", location: c.location || "", email: c.email || "", phone: c.phone || "" };
    }
    // A specific saved resume (pendingLoadResumeId) is on its way in via
    // loadSaved()'s async fetch below — starting from an unrelated draft's
    // info here would just be a flash of the wrong person's contact card.
    if (pendingLoadResumeId) return EMPTY_INFO;
    if (draftAtMount?.info) return draftAtMount.info;
    // profileAtMount is purely local (localStorage, this browser only) —
    // it has no name yet on a brand-new device/browser even for someone
    // who already set one on their account (see WelcomeNamePrompt.js,
    // asked once right after first login). Falling back to the real
    // account's user.name here — never overwriting a name the local
    // profile already has — is what makes that account-level name
    // actually reach the resume builder instead of silently only
    // affecting the dashboard greeting.
    const base = profileAtMount || EMPTY_INFO;
    return base.name ? base : { ...base, name: user?.name || "" };
  });
  // useAuth()'s user arrives asynchronously (a real fetch, not available on
  // the very first render) — the useState initializer above only ever runs
  // ONCE, at mount, so it can miss user.name entirely if this component
  // mounted before that fetch resolved (the common case). Catches that:
  // fills info.name from the account the moment it does resolve, but only
  // if nothing already filled it first (a restored draft, a local profile,
  // or someone who's already started typing one by hand).
  useEffect(() => {
    if (!user?.name || pendingImport?.contact || pendingLoadResumeId) return;
    setInfo((cur) => (cur.name ? cur : { ...cur, name: user.name }));
  }, [user?.name]);
  // Shown once, only when we actually pre-filled the form from a saved profile
  // (not when restoring a live draft — that already gets its own banner).
  const [infoFromProfile, setInfoFromProfile] = useState(() => !pendingImport && !pendingLoadResumeId && !draftAtMount?.info && !!profileAtMount);
  const [jobDesc,    setJobDesc]    = useState(() => pendingJobDesc || draftAtMount?.jobDesc || "");
  const [generating, setGenerating] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [error,      setError]      = useState("");
  // A scan that also had a job description pasted alongside it comes back
  // from /resume/scan in the exact same shape as /resume/optimize (keywords,
  // cover letter, interview tips, apply info) — carry all of it through
  // instead of discarding it, so "scan + paste a JD" lands in the same
  // reviewed-package state a plain Optimize click would.
  const [genResult,  setGenResult]  = useState(() => {
    if (pendingImport) {
      return {
        keywords: pendingImport.keywords || [],
        saved_id: pendingImport.saved_id || null,
        job_location: pendingImport.job_location || null,
      };
    }
    if (pendingLoadResumeId) return null;
    return draftAtMount?.genResult || null;
  });
  const [coverLetter,  setCoverLetter]  = useState(() => pendingLoadResumeId ? "" : (pendingImport?.cover_letter || draftAtMount?.coverLetter || ""));
  const [interviewTips, setInterviewTips] = useState(() => pendingLoadResumeId ? [] : (pendingImport?.interview_tips || draftAtMount?.interviewTips || []));
  const [application, setApplication] = useState(() => pendingLoadResumeId ? null : (pendingImport?.application || draftAtMount?.application || null)); // { method, value, instructions }
  // Mirrors what clicking "Optimize" does — the review package opens
  // immediately when the import already came back tailored to a job.
  const [packageOpen, setPackageOpen] = useState(() => !!pendingImport?.cover_letter);
  const [atsModalOpen, setAtsModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // pendingLoadResumeId starts this at null (not draftAtMount?.resume) for
  // the exact same reason as `info` above — the correct resume is on its
  // way in via loadSaved()'s fetch; showing someone else's draft in the
  // meantime is the whole bug this block exists to fix (see GuestMode's
  // own pendingLoadResumeId effect further down).
  const [resume,     dispatch]      = useReducer(resumeReducer, pendingImport || (pendingLoadResumeId ? null : draftAtMount?.resume) || null);
  const onEdit = useCallback(onEditHandler(dispatch), [dispatch]);
  // A draft in progress always wins (same reasoning as every other
  // draftAtMount field); failing that, an explicitly-picked template (see
  // Dashboard's Templates card / lib/templatePreference.js) beats
  // DEFAULT_STYLE's own "classic" fallback.
  const [docStyle,   setDocStyle]   = useState(() => draftAtMount?.docStyle || {
    ...DEFAULT_STYLE,
    layout: getPreferredTemplate() || DEFAULT_STYLE.layout,
  });
  // Restored on mount only if there's actually something worth telling the user about.
  const [draftRestored, setDraftRestored] = useState(() => !pendingImport && !pendingLoadResumeId && !!(draftAtMount?.resume || draftAtMount?.jobDesc));
  // A one-time banner distinct from draftRestored — this is "we just parsed
  // your upload," not "you refreshed mid-draft."
  const [importNoticeVisible, setImportNoticeVisible] = useState(() => !!pendingImport);
  // Same idea, for a job description handed off by the bookmarklet.
  const [jobDescNoticeVisible, setJobDescNoticeVisible] = useState(() => !!pendingJobDesc);
  const [saved,      setSaved]      = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [loadingResumeId, setLoadingResumeId] = useState(null); // id currently being fetched, drives skeleton
  const [downloading, setDownloading]   = useState(null);
  // On phone/tablet the resume preview isn't mounted while the form panel is
  // showing — this flags "print as soon as the preview screen mounts".
  const [pendingPrint, setPendingPrint] = useState(false);
  const [scale,       setScale]         = useState(1);

  const canvasRef  = useRef(null);
  const previewRef = useRef(null);

  // Scale preview to fit available width
  useEffect(() => {
    const compute = () => {
      if (!canvasRef.current) return;
      const pad = isPhone ? 16 : 40;
      const available = canvasRef.current.clientWidth - pad;
      setScale(Math.min(1, Math.max(0.25, available / 794)));
    };
    compute();
    // See Resume.js's matching effect for why: a single post-paint
    // measurement can land before layout's fully settled on a real
    // mobile device (e.g. a webfont swap-in), leaving the preview
    // unscaled ("zoomed in") until something unrelated happens to
    // re-run this effect. These two catch that without needing that.
    const raf = requestAnimationFrame(() => requestAnimationFrame(compute));
    document.fonts?.ready?.then(compute).catch(() => {});
    const ro = window.ResizeObserver ? new ResizeObserver(compute) : null;
    if (ro && canvasRef.current) ro.observe(canvasRef.current);
    window.addEventListener("resize", compute);
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); window.removeEventListener("resize", compute); };
  }, [isPhone, mobileView]);

  useEffect(() => {
    if (tab !== "templates" && tab !== "settings") return;
    setLoadingSaved(true);
    apiListSaved().then(setSaved).finally(() => setLoadingSaved(false));
  }, [tab]);

  // Auto-switch to preview screen on phone once resume is ready
  useEffect(() => {
    if (!showSplit && resume && step === 3) setMobileView("preview");
  }, [resume, step, showSplit]);

  // Mirror the in-progress build to localStorage (debounced) so a refresh
  // restores it instead of wiping it. A write failure (storage full/
  // blocked) still doesn't block the app, but it's no longer swallowed
  // silently — this is the one safety net protecting unsaved work, so the
  // user gets told once (not on every debounced attempt while broken,
  // which would spam identical toasts) rather than just losing it quietly.
  const draftSaveTimer = useRef(null);
  const draftSaveWarnedRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify({
          tab, step, info, jobDesc, genResult, coverLetter, interviewTips,
          application, resume, docStyle,
        }));
      } catch {
        if (!draftSaveWarnedRef.current) {
          draftSaveWarnedRef.current = true;
          toast.error(t("guestMode.couldntSaveProgress"));
        }
      }
    }, 300);
    return () => clearTimeout(draftSaveTimer.current);
  }, [tab, step, info, jobDesc, genResult, coverLetter, interviewTips, application, resume, docStyle]);

  // Mirror personal info to its own profile key (debounced), independent of
  // the job-specific draft — this is what survives "Build another".
  const profileSaveTimer = useRef(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (profileSaveTimer.current) clearTimeout(profileSaveTimer.current);
    profileSaveTimer.current = setTimeout(() => {
      const hasSomething = Object.values(info).some((v) => (v || "").trim());
      if (hasSomething) saveProfile(info);
    }, 400);
    return () => clearTimeout(profileSaveTimer.current);
  }, [info]);

  // Used to ask "are you sure, you'll lose your work" here — but the draft
  // autosaves (see draftSaveTimer above) and restores itself on the next
  // visit, so that warning was never actually true. Closing just closes.
  const requestClose = onClose;

  const set = (k) => (v) => setInfo(p => ({ ...p, [k]: v }));
  const ready1 = info.name.trim() && info.title.trim() && info.location.trim();
  const ready2 = jobDesc.trim().length >= 80;

  const generate = async () => {
    setGenerating(true);
    setError("");
    try {
      const data = await apiGenerate(info, jobDesc);
      const resumeObj = {
        contact:  data.contact  || {},
        sections: data.sections || [],
        keywords: data.keywords || [],
        saved_id: data.saved_id || null,
      };
      dispatch({ type: "SET", resume: resumeObj });
      setGenResult({ keywords: data.keywords || [], saved_id: data.saved_id, job_location: data.job_location });
      setStep(3);
      setAppliedPromptDone(false);
      signupNudge.recordAction();
    } catch (e) {
      setError(e.message || "Generation failed. Try again.");
    } finally {
      setGenerating(false);
    }
  };

  const optimize = async () => {
    setOptimizing(true);
    setError("");

    // Generate the resume/cover-letter/tips/apply-info via the API. Any failure
    // here is a real optimization failure — nothing was produced, so we bail out.
    let data;
    try {
      data = await apiOptimize(info, jobDesc);
    } catch (e) {
      setError(e.message || "Optimization failed. Try again.");
      setOptimizing(false);
      return;
    }

    const resumeObj = {
      contact:  data.contact  || {},
      sections: data.sections || [],
      keywords: data.keywords || [],
      saved_id: data.saved_id || null,
    };
    dispatch({ type: "SET", resume: resumeObj });
    setGenResult({ keywords: data.keywords || [], saved_id: data.saved_id, job_location: data.job_location });
    setCoverLetter(data.cover_letter || "");
    setInterviewTips(data.interview_tips || []);
    setApplication(data.application || null);
    setStep(3);
    setAppliedPromptDone(false);
    setOptimizing(false);
    signupNudge.recordAction();

    // One click, one result: the whole package — resume, cover letter, apply
    // instructions, interview tips — opens for review immediately. Nothing
    // downloads yet; the Download button inside the modal is the only thing
    // that writes a file, so the person always sees what they're getting first.
    setPackageOpen(true);
  };

  const downloadCoverLetterTxt = () => {
    if (!coverLetter) return;
    const name = (resume?.contact?.name || info.name || "Resume").replace(/\s+/g, "_");
    const blob = new Blob([coverLetter], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `${name}_Cover_Letter.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  // One click: cover letter text straight to the clipboard, ready to paste into
  // an email or an ATS "cover letter" text box.
  const copyCoverLetter = async () => {
    if (!coverLetter) return;
    try {
      await navigator.clipboard.writeText(coverLetter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be blocked (permissions, non-HTTPS) — fall back to a file
      // download so the person still gets the cover letter in one click either way.
      downloadCoverLetterTxt();
    }
  };

  // The single download action inside the package-preview modal: resume .docx
  // and cover letter .docx both save in one click, after the person has
  // reviewed everything on screen — matching formats, both editable.
  const downloadPackage = async () => {
    if (!resume) return;
    if (!(await checkDownloadAllowed())) return;
    setDownloading("docx");
    try {
      const name = (resume.contact?.name || info.name || "Resume").replace(/\s+/g, "_");
      await downloadDocx(resume, docStyle, `${name}_Resume.docx`);
      if (coverLetter) await downloadCoverLetterDocx(coverLetter, resume.contact || info, docStyle, `${name}_Cover_Letter.docx`);
      maybeAskIfApplied();
    } catch (e) {
      setError("Download failed: " + e.message);
    } finally {
      setDownloading(null);
    }
  };

  const handleCoverLetterDocx = async () => {
    if (!coverLetter) return;
    setDownloading("cl-docx");
    try {
      const name = (resume?.contact?.name || info.name || "Cover_Letter").replace(/\s+/g, "_");
      await downloadCoverLetterDocx(coverLetter, resume?.contact || info, docStyle, `${name}_Cover_Letter.docx`);
    } catch (e) {
      setError("Download failed: " + e.message);
    } finally {
      setDownloading(null);
    }
  };

  const handleCoverLetterPdf = () => {
    if (!coverLetter) return;
    setDownloading("cl-pdf");
    try {
      printCoverLetterPdf(coverLetter, resume?.contact || info);
    } catch (e) {
      setError("Download failed: " + e.message);
    } finally {
      setTimeout(() => setDownloading(null), 1500);
    }
  };

  const loadSaved = async (id) => {
    setLoadingResumeId(id);
    setError("");
    if (!showSplit) setMobileView("preview");
    try {
      const data = await apiGetSaved(id);
      dispatch({ type: "SET", resume: { contact: data.contact || {}, sections: data.sections || [], keywords: data.keywords || [], saved_id: id } });
      setGenResult({ keywords: data.keywords || [], saved_id: id, job_location: data.job_location });
      // A resume saved via Optimize persisted the whole package server-side
      // (see /optimize's Media.file_data in api/resume.py) — GET /<id>
      // returns it all back, so restore it here too. A plain Generate-only
      // save has none of these fields, so they correctly fall back to empty.
      // Not auto-opening the package modal (packageOpen stays false) — this
      // is just reopening a saved resume, not a freshly-generated one; the
      // "Review & Download" button in ResultStep is enough to reach it.
      setCoverLetter(data.cover_letter || ""); setInterviewTips(data.interview_tips || []); setApplication(data.application || null); setPackageOpen(false);
      setTab("new"); setStep(3);
    } catch (e) {
      setError("Could not load: " + e.message);
    } finally {
      setLoadingResumeId(null);
    }
  };

  useEffect(() => {
    if (pendingLoadResumeId) loadSaved(pendingLoadResumeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDocx = async () => {
    if (!resume) return;
    if (!(await checkDownloadAllowed())) return;
    setDownloading("docx");
    try {
      const name = resume.contact?.name?.replace(/\s+/g, "_") || "Resume";
      await downloadDocx(resume, docStyle, `${name}_Resume.docx`);
      maybeAskIfApplied();
    } catch (e) {
      setError("Download failed: " + e.message);
    } finally {
      setDownloading(null);
    }
  };

  // Fires once the preview screen has actually mounted after handlePdf
  // switched to it — printing immediately would still see the old (form) DOM.
  useEffect(() => {
    if (!pendingPrint || (!showSplit && mobileView !== "preview")) return;
    const raf = requestAnimationFrame(() => {
      if (previewRef.current) {
        printPdf(previewRef.current);
        maybeAskIfApplied();
      } else {
        setError("Nothing to export yet. Generate a resume first.");
      }
      setPendingPrint(false);
      setTimeout(() => setDownloading(null), 1500);
    });
    return () => cancelAnimationFrame(raf);
  }, [pendingPrint, mobileView, showSplit]);

  const handlePdf = async () => {
    if (!resume) { setError("Nothing to export yet. Generate a resume first."); return; }
    if (!(await checkDownloadAllowed())) return;
    setDownloading("pdf");
    // On phone the preview isn't rendered while the form panel is showing,
    // so previewRef.current would be null here — switch screens and let
    // the effect above print once it's actually mounted. Tablet/desktop
    // (showSplit) always have the preview mounted, so this branch never
    // triggers for them.
    if (!showSplit && mobileView !== "preview") {
      setPendingPrint(true);
      setMobileView("preview");
      return;
    }
    if (!previewRef.current) {
      setDownloading(null);
      setError("Nothing to export yet. Generate a resume first.");
      return;
    }
    printPdf(previewRef.current);
    maybeAskIfApplied();
    setTimeout(() => setDownloading(null), 1500);
  };

  // "Build another" starts a fresh job application, but keeps the person's
  // saved info (name, contact, background, education, skills) — that's the
  // whole point of saving it. Only the job-specific stuff resets.
  const resetWizard = () => {
    setStep(quickMode && hasUsableProfile ? 2 : 1); setJobDesc("");
    setError(""); setGenResult(null);
    setCoverLetter(""); setInterviewTips([]);
    setApplication(null); setPackageOpen(false);
    setAppliedPromptDone(false); setAppliedPromptOpen(false);
    dispatch({ type: "SET", resume: null }); // was never cleared before — stale resume could linger
    if (!showSplit) setMobileView("panel");
    clearDraft();
  };

  // Explicit opt-out for someone applying on behalf of someone else, or who
  // just wants to start their info over from scratch.
  const useDifferentInfo = () => {
    setInfo(EMPTY_INFO);
    setInfoFromProfile(false);
    clearProfile();
  };

  const A4w = 794;
  const A4h = 1123;
  const scaledW = Math.round(A4w * scale);
  const scaledH = Math.round(A4h * scale);

  // The bottom nav is `position: fixed` so every phone scroll container
  // reserves this much space at its bottom so the last item is never hidden
  // underneath the bar. Deliberately generous — a bit of extra blank space
  // at the end of a scroll is harmless, a covered button is not. Only
  // rendered at all on phone (see MobileNav below) — tablet/desktop have
  // no bottom bar to clear.
  const mobileNavClearance = !showSplit ? "calc(116px + env(safe-area-inset-bottom, 0px))" : undefined;

  // ── Reusable preview canvas (used in both the split-view pane and the
  // phone's own full-screen preview mode) ──
  const PreviewCanvas = () => (
    <div ref={canvasRef} onScroll={!showSplit ? handlePanelScroll : undefined}
      className="flex flex-1 flex-col items-center overflow-y-auto overscroll-contain bg-[#C8C8C8] [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
      style={{
        paddingTop: isPhone ? 14 : 24,
        paddingLeft: 0,
        paddingRight: 0,
        // Longhand throughout (not the `padding` shorthand) — React warns when
        // the same inline style flips between shorthand and a longhand override
        // for the same side across renders (mobileNavClearance is only defined
        // on phone), and the mixed form is genuinely fragile: browsers aren't
        // all consistent about which value wins once both are present.
        paddingBottom: mobileNavClearance ?? (isPhone ? 24 : 48),
      }}>
      <p className="m-0 mb-2.5 px-3 text-center font-mono text-[9px] tracking-[0.08em] text-[#666] select-none">
        {loadingResumeId ? "Loading…" : (generating || optimizing) ? "Building your resume…" : `${Math.round(scale * 100)}% · ${resume ? "Tap any text to edit" : "Generate to see your resume"}`}
      </p>
      {loadingResumeId || generating || optimizing ? (
        <div style={{ width: scaledW, height: scaledH }} className="relative shrink-0">
          <div style={{ width: A4w, height: A4h, transform: `scale(${scale})` }}
            className="absolute top-0 left-0 origin-top-left shadow-[0_6px_40px_rgba(0,0,0,0.35)]">
            {loadingResumeId ? <ResumeSkeleton /> : <ScanningResume />}
          </div>
        </div>
      ) : (
        // LivePreview now owns its own page sizing/scaling — how many
        // sheets exist is inherently its own concern once a resume can
        // span more than one page (see LivePreview.js's own file-level
        // comment), so it's no longer wrapped in a single fixed-size box
        // from out here the way a strictly-one-page component would be.
        <LivePreview ref={previewRef} resume={resume} docStyle={docStyle} onEdit={onEdit} scale={scale} />
      )}
    </div>
  );

  // ── Reusable sidebar/panel content (form, templates list, or results) ──────
  const PanelContent = () => (
    <>
      {/* BUILD */}
      {tab === "new" && (
        <div onScroll={!showSplit ? handlePanelScroll : undefined}
          className="flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none]"
          style={{ paddingBottom: mobileNavClearance }}>
          {draftRestored && (
            <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2.5">
              <RefreshCw className="size-[13px] text-primary" />
              <span className="flex-1 text-xs text-muted-foreground">
                {t("guestMode.draftRestored")}
              </span>
              <button onClick={() => setDraftRestored(false)} aria-label={t("guestMode.dismiss")}
                className="border-none bg-transparent p-0.5 text-muted-foreground/60">
                <X className="size-[13px]" />
              </button>
            </div>
          )}
          {importNoticeVisible && (
            <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2.5">
              <ScanLine className="size-[13px] text-primary" />
              <span className="flex-1 text-xs text-foreground">
                {t("guestMode.importedNotice")}
              </span>
              <button onClick={() => setImportNoticeVisible(false)} aria-label={t("guestMode.dismiss")}
                className="border-none bg-transparent p-0.5 text-muted-foreground/60">
                <X className="size-[13px]" />
              </button>
            </div>
          )}
          {jobDescNoticeVisible && (
            <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2.5">
              <Bookmark className="size-[13px] text-primary" />
              <span className="flex-1 text-xs text-foreground">
                {step === 1
                  ? t("guestMode.jobDescNoticeStep1")
                  : t("guestMode.jobDescNoticeReady")}
              </span>
              <button onClick={() => setJobDescNoticeVisible(false)} aria-label={t("guestMode.dismiss")}
                className="border-none bg-transparent p-0.5 text-muted-foreground/60">
                <X className="size-[13px]" />
              </button>
            </div>
          )}

          {/* Quick Build tapped with no saved profile yet — there's nothing
              to reuse, so this silently fell back to the full form above;
              say so explicitly instead of a chip that just quietly did
              something other than what it promised. */}
          {pendingQuickBuild && !hasUsableProfile && step === 1 && (
            <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2.5">
              <Zap className="size-[13px] shrink-0 text-primary" />
              <span className="flex-1 text-xs font-semibold text-foreground">
                Build one resume first — Quick Build after that.
              </span>
            </div>
          )}

          {step === 3 && genResult && (
            <ResultStep
              genResult={genResult}
              application={application}
              coverLetter={coverLetter}
              isPhone={isPhone}
              isDesktop={showSplit}
              downloading={downloading}
              resume={resume}
              jobDescription={jobDesc}
              onOpenPackage={() => setPackageOpen(true)}
              onDownloadWord={handleDocx}
              onOpenPreview={() => setMobileView("preview")}
              onDownloadPdf={handlePdf}
              onBuildAnother={resetWizard}
              onApplyAts={(fixed) => dispatch({ type: "SET", resume: { ...resume, contact: fixed.contact, sections: fixed.sections } })}
            />
          )}

          {step < 3 && (
            <div className="p-4 pt-0 pb-[18px]">
              <div className="mb-5 mt-4 flex items-center justify-between">
                <span className="text-xl font-bold text-foreground">{step === 1 ? "Your Info" : "Job Posting"}</span>
                <span className="text-[13px] font-semibold text-muted-foreground">Step {step} of 2</span>
              </div>
              <div className="mb-5 flex gap-1.5">
                {["Your Info", "Job Posting"].map((s, i) => (
                  <div key={s} className={`h-[5px] flex-1 rounded-sm ${i < step ? "bg-primary" : "bg-border"}`} />
                ))}
              </div>

              {error && (
                <div role="alert" className="mb-3.5 flex gap-2 border-l-2 border-destructive py-0.5 pl-[11px] text-[12.5px] leading-relaxed text-destructive">
                  {error}
                </div>
              )}

              {step === 1 && quickMode && hasUsableProfile && (
                <QuickBuildIntro
                  info={info}
                  set={set}
                  accountEmail={user?.email || ""}
                  isPhone={isPhone}
                  onNext={() => { setError(""); setStep(2); }}
                />
              )}

              {step === 1 && !(quickMode && hasUsableProfile) && (
                <InfoStep
                  info={info}
                  set={set}
                  infoFromProfile={infoFromProfile}
                  useDifferentInfo={useDifferentInfo}
                  dismissInfoFromProfile={() => setInfoFromProfile(false)}
                  isPhone={isPhone}
                  ready1={ready1}
                  onNext={() => { setError(""); setStep(2); }}
                />
              )}

              {step === 2 && (
                <JobDescStep
                  jobDesc={jobDesc}
                  setJobDesc={setJobDesc}
                  isPhone={isPhone}
                  ready2={ready2}
                  generating={generating}
                  optimizing={optimizing}
                  onBack={() => setStep(1)}
                  onGenerate={generate}
                  onOptimize={optimize}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* STYLE */}
      {tab === "style" && (
        <div onScroll={!showSplit ? handlePanelScroll : undefined}
          className="flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none]"
          style={{ paddingBottom: mobileNavClearance }}>
          <StyleTab docStyle={docStyle} setDocStyle={setDocStyle} isDesktop={showSplit} onPreview={() => setMobileView("preview")} />
        </div>
      )}

      {/* SAVED */}
      {tab === "templates" && (
        <div onScroll={!showSplit ? handlePanelScroll : undefined}
          className="flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none]"
          style={{ paddingBottom: mobileNavClearance }}>
          <SavedTab
            loadingSaved={loadingSaved}
            saved={saved}
            loadingResumeId={loadingResumeId}
            onLoad={loadSaved}
            onDelete={async (id) => { await apiDelete(id); setSaved(s => s.filter(x => x.id !== id)); }}
            onNew={() => setTab("new")}
          />
        </div>
      )}

      {/* SETTINGS */}
      {tab === "settings" && (
        <div onScroll={!showSplit ? handlePanelScroll : undefined}
          className="flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none]"
          style={{ paddingBottom: mobileNavClearance }}>
          <SettingsTab
            saved={saved}
            onResetStyle={() => setDocStyle(DEFAULT_STYLE)}
            onClearAll={async () => { await Promise.all(saved.map(r => apiDelete(r.id))); setSaved([]); }}
          />
        </div>
      )}
    </>
  );

  // The full 3-pane workspace (Build/Templates sidebar, floating toolbar +
  // canvas, Skill Alignment/Text/Colors panel) only replaces the old 2-pane
  // split once there's an actual resume to work on, on tablet/desktop — the
  // AI-generation wizard (steps 1-2) and phone both keep their existing,
  // already-working UI untouched. DesktopTabNav's Build/Style/Saved/
  // Settings tab strip is hidden here too: Build/Templates now lives inside
  // BuilderSidebar itself, and Style's old controls moved into AnalysisPanel.
  const isWorkspace = showSplit && tab === "new" && step === 3 && !!genResult;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-background font-sans">

      <style>{`
        @media print{body *{visibility:hidden!important}#__resume_pdf_print__,#__resume_pdf_print__ *{visibility:visible!important}#__resume_pdf_print__{position:fixed!important;left:0!important;top:0!important;width:100%!important;transform:none!important;box-shadow:none!important}}
        .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
      `}</style>

      {/* ── Top bar — title, close, and the two actions that matter most ──
          min-h instead of a fixed h-16, plus safe-area padding-top: as an
          installed standalone PWA (not a browser tab, which already
          reserves this space via its own chrome), this bar sits directly
          under the notch/status bar/dynamic island on iOS unless it grows
          to make room — a fixed height would just clip the header content
          up under there instead. */}
      <header
        className="flex min-h-16 shrink-0 items-center justify-between gap-2.5 border-b border-border bg-card px-3.5 pb-2"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >

        <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
          <button onClick={requestClose} aria-label={t("guestMode.closeNoqeev")}
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-foreground">
            <X className="size-[17px]" />
          </button>
          {/* The real extruded-3D mark (slow ambient spin, tilts toward the
              cursor) instead of the flat 2D glyph — this is the screen
              people actually build in, not just glance at, so it's the one
              place in the app where a persistent bit of "this feels alive"
              is worth the (small — the canvas itself is tiny) extra weight.
              Logo3D already carries its own WebGL-support check + error
              boundary, falling back to the flat mark on anything that can't
              render it, so this never risks a blank/broken header.
              Wordmark text stays icon-only on mobile/tablet for the same
              space reason as before — back button + close button + the two
              download buttons already crowd this 64px bar tightly enough
              that the full "NOQEEV" text had nowhere to go (it was getting
              hard-clipped mid-letter by this row's own overflow-hidden). */}
          <div style={{ width: 26, height: 26 }} className="shrink-0">
            <Logo3D style={{ width: "100%", height: "100%", display: "block" }} />
          </div>
          {isDesktop && (
            // Same Unbounded treatment as Logo.js's own wordmark span (see
            // --font-wordmark in globals.css) — this one's hand-duplicated
            // rather than going through <Logo>, since this header only
            // wants the 3D mark (Logo3D) paired with plain text, not the
            // full flat-mark-plus-wordmark lockup <Logo> renders.
            <span className="[font-family:var(--font-wordmark)] text-[17px] font-extrabold tracking-[0.02em] text-foreground">NOQEEV</span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isWorkspace && (
            <Btn small icon="Gauge" onClick={() => setAtsModalOpen(true)} variant="ghost">
              {t("guestMode.analyze")}
            </Btn>
          )}
          {/* Phone only — tablet/desktop already have Style as a permanent
              tab in DesktopTabNav next to the always-visible split preview,
              so a second entry point here would be redundant for them. */}
          {!showSplit && step === 3 && genResult && (
            <Btn small icon="Pencil" onClick={() => { setTab("new"); setMobileView("preview"); setBuildSheetOpen(true); }}
              className="max-[380px]:gap-0 max-[380px]:px-2.5"
              disabled={!resume} variant="ghost">
              <span className="max-[380px]:hidden">{t("guestMode.build")}</span>
            </Btn>
          )}
          {!showSplit && (
            <Btn small icon="Palette" onClick={() => { setTab("style"); setMobileView("preview"); setStyleSheetOpen(true); }}
              className="max-[380px]:gap-0 max-[380px]:px-2.5"
              disabled={!resume} variant="ghost">
              <span className="max-[380px]:hidden">{t("guestMode.style")}</span>
            </Btn>
          )}
          <Btn small icon="FileDown" loading={downloading === "docx"}
            className="max-[380px]:gap-0 max-[380px]:px-2.5"
            onClick={handleDocx} disabled={!resume || !!downloading} variant="gold">
            <span className="max-[380px]:hidden">Word</span>
          </Btn>
          <Btn small icon="FileDown" loading={downloading === "pdf"}
            className="max-[380px]:gap-0 max-[380px]:px-2.5"
            onClick={handlePdf} disabled={!resume || !!downloading} variant="ghost">
            <span className="max-[380px]:hidden">PDF</span>
          </Btn>
        </div>
      </header>

      {showSplit && !isWorkspace && <DesktopTabNav tab={tab} onChange={setTab} />}

      {/* ── Body — split (sidebar + always-visible preview) on tablet and
          desktop, one full-screen view at a time on phone. Tablet's sidebar
          is narrower than desktop's (300px vs 380px) — the same 380px on a
          768px-wide iPad would leave the preview too cramped to actually
          read while styling it, defeating the point of showing it at all. ── */}
      <div className="flex flex-1 overflow-hidden">
        {isWorkspace ? (
          <>
            <div className="flex w-[280px] shrink-0 flex-col border-r border-border bg-card">
              <BuilderSidebar resume={resume} onEdit={onEdit} jobDesc={jobDesc} docStyle={docStyle} setDocStyle={setDocStyle} onBuildAnother={resetWizard} />
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex shrink-0 justify-center pt-4 pb-1">
                <FormattingToolbar docStyle={docStyle} setDocStyle={setDocStyle} />
              </div>
              {PreviewCanvas()}
            </div>
            <div className="flex w-[288px] shrink-0 flex-col border-l border-border bg-card">
              <AnalysisPanel
                resume={resume}
                jobDescription={jobDesc}
                onApplyAts={(fixed) => dispatch({ type: "SET", resume: { ...resume, contact: fixed.contact, sections: fixed.sections } })}
                docStyle={docStyle}
                setDocStyle={setDocStyle}
              />
            </div>
          </>
        ) : showSplit ? (
          <>
            <div className={`flex ${isDesktop ? "w-[380px]" : "w-[300px]"} shrink-0 flex-col border-r border-border bg-card`}>
              {PanelContent()}
            </div>
            {PreviewCanvas()}
          </>
        ) : (
          // Style on phone: entry point is the header button (beside Word/
          // PDF, see the header above), and opening it never covers any
          // part of the resume — no overlay at all. Instead the preview
          // and the style panel share the column as normal, in-flow flex
          // siblings: the panel claims a fixed slice at the bottom, and
          // the preview (already its own independently scrolling column —
          // see PreviewCanvas' overflow-y-auto) simply gets the rest of
          // the height. Nothing is ever drawn on top of the resume; there's
          // just less of it in view per scroll before you scroll for more,
          // exactly like the preview behaves at any other screen height.
          <div className="flex flex-1 flex-col overflow-hidden">
            {mobileView === "panel" ? PanelContent() : PreviewCanvas()}
            {tab === "style" && styleSheetOpen && mobileView !== "panel" && (
              <div className="flex shrink-0 flex-col border-t border-border bg-card" style={{ maxHeight: "38vh" }}>
                <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
                  <span className="text-[15px] font-bold text-foreground">{t("guestMode.style")}</span>
                  <button
                    onClick={() => setStyleSheetOpen(false)}
                    className="flex h-8 items-center gap-1.5 rounded-full border-none bg-primary px-3.5 text-[13px] font-bold text-primary-foreground [-webkit-tap-highlight-color:transparent]"
                  >
                    <Check className="size-3.5" /> {t("guestMode.done")}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]" style={{ paddingBottom: mobileNavClearance }}>
                  <StyleTab docStyle={docStyle} setDocStyle={setDocStyle} isDesktop={true} />
                </div>
              </div>
            )}
            {tab === "new" && buildSheetOpen && mobileView !== "panel" && step === 3 && genResult && (
              <div className="flex shrink-0 flex-col border-t border-border bg-card" style={{ maxHeight: "60vh" }}>
                <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
                  <span className="text-[15px] font-bold text-foreground">{t("guestMode.build")}</span>
                  <button
                    onClick={() => setBuildSheetOpen(false)}
                    className="flex h-8 items-center gap-1.5 rounded-full border-none bg-primary px-3.5 text-[13px] font-bold text-primary-foreground [-webkit-tap-highlight-color:transparent]"
                  >
                    <Check className="size-3.5" /> {t("guestMode.done")}
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden" style={{ paddingBottom: mobileNavClearance }}>
                  <BuilderSidebar resume={resume} onEdit={onEdit} jobDesc={jobDesc} docStyle={docStyle} setDocStyle={setDocStyle} onBuildAnother={resetWizard} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!showSplit && (
        <MobileNav
          tab={tab}
          mobileView={mobileView}
          navHidden={navHidden}
          onNavigate={(id) => {
            if (id === "preview") { setStyleSheetOpen(false); setBuildSheetOpen(false); setMobileView("preview"); return; }
            setStyleSheetOpen(false);
            setBuildSheetOpen(false);
            setTab(id);
            setMobileView("panel");
          }}
        />
      )}

      <PackagePreviewModal
        open={packageOpen}
        onClose={() => setPackageOpen(false)}
        genResult={genResult}
        application={application}
        coverLetter={coverLetter}
        interviewTips={interviewTips}
        jobDescription={jobDesc}
        onCopyCoverLetter={copyCoverLetter}
        copied={copied}
        onDownloadAll={downloadPackage}
        downloading={downloading}
        onCoverLetterDocx={handleCoverLetterDocx}
        onCoverLetterPdf={handleCoverLetterPdf}
        onCoverLetterChange={setCoverLetter}
      />

      <SignupNudgeModal open={signupNudge.show} onDismiss={signupNudge.dismiss} />
      <DownloadCapModal
        open={capModalOpen}
        onClose={() => setCapModalOpen(false)}
        onRequireAuth={onRequireAuth}
      />
      <DidYouApplyModal
        open={appliedPromptOpen}
        onClose={() => setAppliedPromptOpen(false)}
        defaultRole={info.title}
        onConfirm={saveApplication}
      />
      <AtsScoreModal
        open={atsModalOpen}
        onClose={() => setAtsModalOpen(false)}
        resume={resume}
        jobDescription={jobDesc}
        onApply={(fixed) => dispatch({ type: "SET", resume: { ...resume, contact: fixed.contact, sections: fixed.sections } })}
      />
    </motion.div>
  );
}
