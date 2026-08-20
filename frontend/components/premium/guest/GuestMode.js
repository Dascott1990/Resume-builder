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
 * Props: { onClose, onBack }
 */
import { useState, useEffect, useRef, useCallback, useReducer } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, X, RefreshCw, ScanLine, Bookmark } from "lucide-react";
import Logo3D from "../Logo3D";
import { Btn } from "./components/primitives";
import { LivePreview } from "./components/LivePreview";
import { ResumeSkeleton } from "./components/ResumeSkeleton";
import { PackagePreviewModal } from "./components/PackagePreviewModal";
import { DesktopTabNav } from "./components/DesktopTabNav";
import { MobileNav } from "./components/MobileNav";
import { InfoStep } from "./components/PanelContent/InfoStep";
import { JobDescStep } from "./components/PanelContent/JobDescStep";
import { ResultStep } from "./components/PanelContent/ResultStep";
import { StyleTab } from "./components/PanelContent/StyleTab";
import { SavedTab } from "./components/PanelContent/SavedTab";
import { SettingsTab } from "./components/PanelContent/SettingsTab";
import { DEFAULT_STYLE, EMPTY_INFO } from "./constants";
import { resumeReducer, onEditHandler } from "./guestReducer";
import { loadDraft, clearDraft, loadProfile, saveProfile, clearProfile, DRAFT_KEY } from "./useGuestDraft";
import { apiGenerate, apiOptimize, apiListSaved, apiGetSaved, apiDelete } from "./api";
import { downloadDocx } from "./export/docx";
import { downloadCoverLetterDocx } from "./export/coverLetterDocx";
import { printPdf, printCoverLetterPdf } from "../shared/printPdf";
import { useViewport } from "@/lib/useViewport";
import { useSignupNudge } from "@/lib/useSignupNudge";
import { SignupNudgeModal } from "../shared/SignupNudgeModal";

export default function GuestMode({ onClose, onBack, pendingImport, pendingJobDesc }) {
  const { isPhone, isTablet, isDesktop } = useViewport();
  const signupNudge = useSignupNudge();

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
  // resume yet, just the posting someone was just reading.
  const [tab,        setTab]        = useState(() => (pendingImport || pendingJobDesc) ? "new" : (draftAtMount?.tab || "new"));   // "new" | "style" | "templates" | "settings"
  // Skipping straight to step 2 only makes sense if there's already usable
  // info to generate from (a saved profile) — otherwise Optimize/Generate
  // would just fail on a missing name/title. With no profile yet, land on
  // step 1 instead; the job description is already saved below and waiting
  // on step 2 the moment they finish it.
  const hasUsableProfile = !!(profileAtMount?.name && profileAtMount?.title && profileAtMount?.location);
  const [step,       setStep]       = useState(() => {
    if (pendingImport) return 3;
    if (pendingJobDesc) return hasUsableProfile ? 2 : 1;
    return draftAtMount?.step || 1;
  });       // 1 | 2 | 3

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
    return draftAtMount?.info || profileAtMount || EMPTY_INFO;
  });
  // Shown once, only when we actually pre-filled the form from a saved profile
  // (not when restoring a live draft — that already gets its own banner).
  const [infoFromProfile, setInfoFromProfile] = useState(() => !pendingImport && !draftAtMount?.info && !!profileAtMount);
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
    return draftAtMount?.genResult || null;
  });
  const [coverLetter,  setCoverLetter]  = useState(() => pendingImport?.cover_letter || draftAtMount?.coverLetter || "");
  const [interviewTips, setInterviewTips] = useState(() => pendingImport?.interview_tips || draftAtMount?.interviewTips || []);
  const [application, setApplication] = useState(() => pendingImport?.application || draftAtMount?.application || null); // { method, value, instructions }
  // Mirrors what clicking "Optimize" does — the review package opens
  // immediately when the import already came back tailored to a job.
  const [packageOpen, setPackageOpen] = useState(() => !!pendingImport?.cover_letter);
  const [copied, setCopied] = useState(false);
  const [resume,     dispatch]      = useReducer(resumeReducer, pendingImport || draftAtMount?.resume || null);
  const onEdit = useCallback(onEditHandler(dispatch), [dispatch]);
  const [docStyle,   setDocStyle]   = useState(() => draftAtMount?.docStyle || DEFAULT_STYLE);
  // Restored on mount only if there's actually something worth telling the user about.
  const [draftRestored, setDraftRestored] = useState(() => !pendingImport && !!(draftAtMount?.resume || draftAtMount?.jobDesc));
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
    const ro = window.ResizeObserver ? new ResizeObserver(compute) : null;
    if (ro && canvasRef.current) ro.observe(canvasRef.current);
    window.addEventListener("resize", compute);
    return () => { ro?.disconnect(); window.removeEventListener("resize", compute); };
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
  // restores it instead of wiping it. Best-effort only — a write failure
  // (storage full/blocked) is swallowed rather than surfaced as an app error.
  const draftSaveTimer = useRef(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify({
          tab, step, info, jobDesc, genResult, coverLetter, interviewTips,
          application, resume, docStyle,
        }));
      } catch { /* best-effort */ }
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
    setDownloading("docx");
    try {
      const name = (resume.contact?.name || info.name || "Resume").replace(/\s+/g, "_");
      await downloadDocx(resume, docStyle, `${name}_Resume.docx`);
      if (coverLetter) await downloadCoverLetterDocx(coverLetter, resume.contact || info, docStyle, `${name}_Cover_Letter.docx`);
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
      // Saved records only ever store the resume itself — clear any cover
      // letter / apply-info left over from a previous Optimize in this session.
      setCoverLetter(""); setInterviewTips([]); setApplication(null); setPackageOpen(false);
      setTab("new"); setStep(3);
    } catch (e) {
      setError("Could not load: " + e.message);
    } finally {
      setLoadingResumeId(null);
    }
  };

  const handleDocx = async () => {
    if (!resume) return;
    setDownloading("docx");
    try {
      const name = resume.contact?.name?.replace(/\s+/g, "_") || "Resume";
      await downloadDocx(resume, docStyle, `${name}_Resume.docx`);
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
      } else {
        setError("Nothing to export yet — generate a resume first.");
      }
      setPendingPrint(false);
      setTimeout(() => setDownloading(null), 1500);
    });
    return () => cancelAnimationFrame(raf);
  }, [pendingPrint, mobileView, showSplit]);

  const handlePdf = () => {
    if (!resume) { setError("Nothing to export yet — generate a resume first."); return; }
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
      setError("Nothing to export yet — generate a resume first.");
      return;
    }
    printPdf(previewRef.current);
    setTimeout(() => setDownloading(null), 1500);
  };

  // "Build another" starts a fresh job application, but keeps the person's
  // saved info (name, contact, background, education, skills) — that's the
  // whole point of saving it. Only the job-specific stuff resets.
  const resetWizard = () => {
    setStep(1); setJobDesc("");
    setError(""); setGenResult(null);
    setCoverLetter(""); setInterviewTips([]);
    setApplication(null); setPackageOpen(false);
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
        {loadingResumeId ? "Loading…" : `${Math.round(scale * 100)}% · ${resume ? "Tap any text to edit" : "Generate to see your resume"}`}
      </p>
      {loadingResumeId ? (
        <div style={{ width: scaledW, height: scaledH }} className="relative shrink-0">
          <div style={{ width: A4w, height: A4h, transform: `scale(${scale})` }}
            className="absolute top-0 left-0 origin-top-left shadow-[0_6px_40px_rgba(0,0,0,0.35)]">
            <ResumeSkeleton />
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
                Restored your in-progress draft from before the refresh.
              </span>
              <button onClick={() => setDraftRestored(false)} aria-label="Dismiss"
                className="border-none bg-transparent p-0.5 text-muted-foreground/60">
                <X className="size-[13px]" />
              </button>
            </div>
          )}
          {importNoticeVisible && (
            <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2.5">
              <ScanLine className="size-[13px] text-primary" />
              <span className="flex-1 text-xs text-foreground">
                Imported from your uploaded resume — review everything below before downloading.
              </span>
              <button onClick={() => setImportNoticeVisible(false)} aria-label="Dismiss"
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
                  ? "Job description brought in from the bookmarklet — finish your info to tailor a resume to it."
                  : "Job description brought in from the bookmarklet — ready below."}
              </span>
              <button onClick={() => setJobDescNoticeVisible(false)} aria-label="Dismiss"
                className="border-none bg-transparent p-0.5 text-muted-foreground/60">
                <X className="size-[13px]" />
              </button>
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

              {step === 1 && (
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
          {/* onBack (→ "My Resumes") is distinct from onClose (→ launcher, full
              exit). Draft + profile both autosave, so either direction is safe —
              this just gives people a way OUT of the wizard that isn't also a
              way out of the whole app. Only rendered when the parent wired it up. */}
          {onBack && (
            <button onClick={onBack} aria-label="Back to My Resumes"
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-muted px-3 text-[12.5px] font-bold text-muted-foreground">
              <ChevronLeft className="size-3.5" />
            </button>
          )}
          <button onClick={requestClose} aria-label="Close Noviq"
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
              that the full "NOVIQ" text had nowhere to go (it was getting
              hard-clipped mid-letter by this row's own overflow-hidden). */}
          <div style={{ width: 26, height: 26 }} className="shrink-0">
            <Logo3D style={{ width: "100%", height: "100%", display: "block" }} />
          </div>
          {isDesktop && (
            <span className="text-[17px] font-bold tracking-[0.14em] text-foreground">NOVIQ</span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
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

      {showSplit && <DesktopTabNav tab={tab} onChange={setTab} />}

      {/* ── Body — split (sidebar + always-visible preview) on tablet and
          desktop, one full-screen view at a time on phone. Tablet's sidebar
          is narrower than desktop's (300px vs 380px) — the same 380px on a
          768px-wide iPad would leave the preview too cramped to actually
          read while styling it, defeating the point of showing it at all. ── */}
      <div className="flex flex-1 overflow-hidden">
        {showSplit ? (
          <>
            <div className={`flex ${isDesktop ? "w-[380px]" : "w-[300px]"} shrink-0 flex-col border-r border-border bg-card`}>
              {PanelContent()}
            </div>
            {PreviewCanvas()}
          </>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            {mobileView === "panel" ? PanelContent() : PreviewCanvas()}
          </div>
        )}
      </div>

      {!showSplit && (
        <MobileNav
          tab={tab}
          mobileView={mobileView}
          navHidden={navHidden}
          onNavigate={(id) => {
            if (id === "preview") { setMobileView("preview"); return; }
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
    </motion.div>
  );
}
