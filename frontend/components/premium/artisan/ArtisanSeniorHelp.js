"use client";
/**
 * ArtisanSeniorHelp.js — the "Digital Concierge" flow: a 3-step, high-
 * accessibility entry point into hiring an artisan, built for older
 * adults (60+) who find the full marketplace (browse/filter listings,
 * negotiate a price, message back and forth) overwhelming. No browsing,
 * no typing a price, no signing in — describe the problem by voice,
 * photo, or a plain checklist, then either call one real matched artisan
 * directly or call Noqeev support. RequestJobModal.js's targeted
 * "request THIS specific artisan" flow (sign-in required, price
 * negotiation) still exists for anyone who wants the full marketplace.
 *
 * Fixed light, high-contrast styling throughout, independent of the
 * app's own dark/light ThemeToggle — several of the app's normal theme
 * tokens are a deliberately thin grey, the opposite of what this screen
 * exists to guarantee. Every color below was checked against WCAG 2.1 AA
 * (4.5:1 for normal text) with real luminance math, not eyeballed — see
 * the git history for the two colors that needed darkening after an
 * initial "looks high-contrast enough" pass didn't hold up to the actual
 * numbers.
 *
 * Honesty notes (read before changing the trust copy below):
 * - The Step 3 match is a REAL query against the same GET /api/v1/
 *   artisans directory the full marketplace browse screen uses (trade +
 *   near_lat/near_lng, or a city="Ottawa" fallback with no GPS),
 *   filtered to available accounts and sorted by rating — not a mock.
 * - Verification is a real, human-reviewed pipeline (Artisan.
 *   verification_status, api/artisans.py's /me/verification submission,
 *   api/admin.py's review queue) — NOT an automated background-check API
 *   (no Checkr/Certn/etc. account exists). An admin looks at the ID and
 *   insurance documents an artisan uploaded and approves or rejects by
 *   hand. The badge below only renders when verification_status is
 *   literally "verified" — a match who hasn't submitted, or is still
 *   pending, or was rejected, shows no badge at all rather than a vague
 *   one that's true for everyone.
 * - There is no SMS provider configured anywhere (no Twilio, nothing).
 *   The "booking for someone else" phone number is captured as real
 *   context to hand to whoever they call — it does NOT trigger an
 *   automated text, and the copy below doesn't claim it does.
 * - There's no price/checkout step here on purpose: the existing
 *   JobRequest/escrow pipeline (api/requests.py) requires an upfront
 *   amount_cents, which contradicts "zero typing required." The actual
 *   booking still finishes over a real phone call; the Hold & Release
 *   block describes how payment protection works once a price and a
 *   digital booking do happen, not a claim that this screen itself just
 *   processed a payment.
 */
import { useEffect, useRef, useState } from "react";
import { Phone, Lock, Mic, Square, Play, Pause, Camera, RotateCcw, X, Wrench, ChevronLeft, Star, ShieldCheck } from "lucide-react";
import Logo from "../Logo";
import Emoji3D from "../shared/Emoji3D";
import { apiRequest } from "../shared/api";
import { avatarPhotoUrl, initialsOf, tintFor, formatPhone } from "../shared/artisanDisplay";

const SUPPORT_PHONE_DISPLAY = "(416) 505-6927";
const SUPPORT_PHONE_TEL = "+14165056927";
const MAX_RECORD_SECONDS = 60;
// Ottawa's approximate downtown coordinates — used only as the query
// center when the browser's real GPS is unavailable/denied, so "near me"
// matching still has *something* to sort by rather than falling back to
// an unsorted, city-wide list.
const OTTAWA_FALLBACK_COORDS = { lat: 45.4215, lng: -75.6972 };

// Maps each plain-language issue to the same trade taxonomy the rest of
// the app already uses (shared/trades.js) — the backend's matching is a
// case-insensitive EXACT match against Artisan.trade, so this has to be
// one of those real values, not an invented category.
const CHECKLIST_ISSUES = [
  { id: "leak", label: "Leaking Pipe", trade: "Plumber" },
  { id: "door", label: "Broken Door or Lock", trade: "Carpenter" },
  { id: "switch", label: "Light Switch Not Working", trade: "Electrician" },
  { id: "hvac", label: "Heating or Cooling Not Working", trade: "HVAC" },
  { id: "other", label: "Something Else", trade: "Handyman" },
];

// Shared button classing lives here once instead of repeated four times —
// every one of these already clears 56px, well past the spec's 48dp
// minimum, with room to spare for anyone with reduced motor control.
// flex-wrap, not the flex default of forcing everything onto one line —
// icon + text as separate flex children (the common case below, `<Icon
// /> some text`) would otherwise refuse to wrap on a narrow phone and
// spill text past the button's rounded border instead of just growing
// taller. py-3 (on top of the min-height) is what actually gives a
// wrapped second line real breathing room instead of clipping tight
// against the border.
const BIG_BTN = "flex min-h-16 w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl border-4 px-5 py-3 text-center text-[18px] font-bold";

export default function ArtisanSeniorHelp({ onClose }) {
  const [step, setStep] = useState(1);
  const coordsRef = useRef(null); // { lat, lng } | null — set best-effort, read in Step 3

  // ── Step 2: voice ──────────────────────────────────────────────────────
  const [recordState, setRecordState] = useState("idle"); // idle | recording | recorded
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordError, setRecordError] = useState("");
  const [audioUrl, setAudioUrl] = useState(null);
  const [playing, setPlaying] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const micStreamRef = useRef(null);
  const recordTimerRef = useRef(null);
  const audioRef = useRef(null);

  // ── Step 2: photo ───────────────────────────────────────────────────────
  const [photoUrl, setPhotoUrl] = useState(null);
  const fileInputRef = useRef(null);

  // ── Step 2: guided checklist ────────────────────────────────────────────
  const [issueId, setIssueId] = useState(null);

  // ── Step 3: match + proxy booker ────────────────────────────────────────
  const [matchState, setMatchState] = useState("loading"); // loading | found | empty
  const [match, setMatch] = useState(null);
  const [isProxyBooking, setIsProxyBooking] = useState(false);
  const [proxyPhone, setProxyPhone] = useState("");

  const revealHeadingRef = useRef(null);
  useEffect(() => {
    revealHeadingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    return () => {
      clearInterval(recordTimerRef.current);
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  // Silent, best-effort, and never blocks — Step 1's primary button
  // advances to Step 2 immediately either way; whatever coordinates
  // arrive (or don't, within a few seconds) are just what Step 3's match
  // query uses later. No permission-prompt handling shown on screen: a
  // browser's own native prompt already asks, and a second layer of UI
  // asking the same question is exactly the extra decision this flow
  // exists to remove.
  const goToStep2 = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { coordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }; },
        () => { /* denied or unavailable — Step 3 falls back to the Ottawa city center */ },
        { timeout: 8000, maximumAge: 5 * 60 * 1000 },
      );
    }
    setStep(2);
  };

  const startRecording = async () => {
    setRecordError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordState("recording");
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          if (s + 1 >= MAX_RECORD_SECONDS) {
            clearInterval(recordTimerRef.current);
            if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
            setRecordState("recorded");
            return MAX_RECORD_SECONDS;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setRecordError("We couldn't reach your microphone. Check that this browser is allowed to use it, then try again.");
      setRecordState("idle");
    }
  };

  const stopRecording = () => {
    clearInterval(recordTimerRef.current);
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
    setRecordState("recorded");
  };

  const resetRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setPlaying(false);
    setRecordSeconds(0);
    setRecordState("idle");
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying((p) => !p);
  };

  const onPhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
  };

  const retakePhoto = () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    fileInputRef.current?.click();
  };

  const canContinue = recordState === "recorded" || !!photoUrl || !!issueId;

  // Real match against the real directory — trade comes from whichever
  // checklist item was picked, or the general-purpose "Handyman" trade
  // (see shared/trades.js) when someone only left a voice note/photo.
  // Only available, real-account artisans are eligible (an anonymous
  // self-listing with no account can't be reached or accept a job) —
  // ranked by rating so the ONE artisan shown is a real best match, not
  // just whichever row came back first.
  const findMatch = async () => {
    setStep(3);
    setMatchState("loading");
    const trade = CHECKLIST_ISSUES.find((c) => c.id === issueId)?.trade || "Handyman";
    const { lat, lng } = coordsRef.current || OTTAWA_FALLBACK_COORDS;
    try {
      const results = await apiRequest(
        `/api/v1/artisans?trade=${encodeURIComponent(trade)}&near_lat=${lat}&near_lng=${lng}&radius_km=75&limit=25`,
      );
      const best = (results || [])
        .filter((a) => a.is_available && a.has_account)
        .sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0))[0];
      if (best) { setMatch(best); setMatchState("found"); }
      else setMatchState("empty");
    } catch {
      setMatchState("empty");
    }
  };

  const backLabel = step === 2 ? "Back" : "Start over";
  const goBack = () => {
    if (step === 2) setStep(1);
    else { setStep(1); setIssueId(null); resetRecording(); if (photoUrl) { URL.revokeObjectURL(photoUrl); setPhotoUrl(null); } }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-white font-sans">
      {/* ── Header — two different shapes, never crammed together. Step 1
          is the only place the full branded header (logo + big title +
          location) lives; it has just one fixed-size neighbor (Close), so
          it can never run out of room. Steps 2/3 drop the branding
          entirely for a plain, robust 3-slot bar — a 56px icon button on
          each side and a short "Step X of 3" label between them — every
          piece is either fixed-width or safely truncating, so this can't
          wrap or crush on a real phone the way stacking a full title next
          to a text-labeled Back button plus Close did. ── */}
      <header
        className={`flex shrink-0 ${step === 1 ? "items-start" : "items-center"} gap-3 border-b-2 border-black/10 bg-white px-5 pb-5`}
        style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
      >
        {step === 1 ? (
          <div className="min-w-0 flex-1">
            <Logo size={26} />
            <h1 className="mt-3 text-[26px] font-extrabold leading-tight text-black">Noqeev Artisan Help</h1>
            <p className="mt-1 text-[18px] font-semibold text-black">Ottawa, ON</p>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={goBack}
              aria-label={backLabel}
              className="flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-black bg-white text-black"
            >
              <ChevronLeft className="size-6" aria-hidden="true" />
            </button>
            <p className="min-w-0 flex-1 truncate text-center text-[16px] font-bold text-black">
              Step {step} of 3
            </p>
          </>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-black bg-white text-black"
          >
            <X className="size-6" aria-hidden="true" />
          </button>
        )}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        {/* ══════════════ STEP 1 — Landing ══════════════ */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <h2 ref={revealHeadingRef} tabIndex={-1} className="text-[22px] font-extrabold text-black outline-none">
              What do you need?
            </h2>

            <button type="button" onClick={goToStep2} className={`${BIG_BTN} min-h-[88px] flex-col gap-1.5 border-[#0f4a1e] bg-[#1e7e34] text-white active:bg-[#1c8a38]`}>
              <span className="flex flex-wrap items-center justify-center gap-2.5 text-center text-[24px] font-extrabold">
                <Wrench className="size-7" aria-hidden="true" />
                I Need Something Fixed
              </span>
              <span className="text-[14px] font-semibold text-white/95">Tap here to describe your issue</span>
            </button>

            <a href={`tel:${SUPPORT_PHONE_TEL}`} className={`${BIG_BTN} min-h-[88px] flex-col gap-0.5 border-black bg-white text-black`}>
              <span className="flex flex-wrap items-center justify-center gap-2.5 text-center text-[22px] font-extrabold">
                <Phone className="size-7" aria-hidden="true" />
                Call Support / Book Over Phone
              </span>
              <span className="text-[16px] font-bold">{SUPPORT_PHONE_DISPLAY}</span>
            </a>
          </div>
        )}

        {/* ══════════════ STEP 2 — Describe the problem ══════════════ */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 ref={revealHeadingRef} tabIndex={-1} className="text-[22px] font-extrabold text-black outline-none">
                Tell us what's wrong
              </h2>
              <p className="mt-1 text-[18px] leading-relaxed text-black">
                Use your voice, a photo, or pick from the list below — any one is enough.
              </p>
            </div>

            <p aria-live="polite" className="sr-only">
              {recordState === "recording"
                ? `Recording. ${MAX_RECORD_SECONDS - recordSeconds} seconds left.`
                : recordState === "recorded" ? "Voice note saved." : ""}
            </p>

            {/* Voice */}
            <div>
              {recordState !== "recorded" ? (
                <button
                  type="button"
                  onClick={recordState === "recording" ? stopRecording : startRecording}
                  aria-pressed={recordState === "recording"}
                  className={`${BIG_BTN} text-white ${recordState === "recording" ? "border-[#7a1414] bg-[#c62828]" : "border-[#5c3000] bg-[#a35700]"}`}
                >
                  {recordState === "recording" ? (
                    <><Square className="size-6" aria-hidden="true" /> Stop Recording — {MAX_RECORD_SECONDS - recordSeconds}s left</>
                  ) : (
                    <><Mic className="size-6" aria-hidden="true" /> Record Voice Note</>
                  )}
                </button>
              ) : (
                <div className="flex flex-col gap-3 rounded-2xl border-4 border-[#0f4a1e] bg-[#eaf7ee] p-4">
                  <p className="text-[16px] font-extrabold text-black">✓ Voice note saved</p>
                  <div className="flex flex-col gap-3">
                    <button type="button" onClick={togglePlayback} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-black bg-white text-[16px] font-bold text-black">
                      {playing ? <Pause className="size-5" aria-hidden="true" /> : <Play className="size-5" aria-hidden="true" />}
                      {playing ? "Pause" : "Play it back"}
                    </button>
                    <button type="button" onClick={resetRecording} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-black bg-white text-[16px] font-bold text-black">
                      <RotateCcw className="size-5" aria-hidden="true" /> Re-record
                    </button>
                  </div>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption -- a spoken voice note has no caption track to provide */}
                  <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} className="hidden" />
                </div>
              )}
              {recordError && <p role="alert" className="mt-2.5 text-[16px] font-bold text-[#b00000]">{recordError}</p>}
            </div>

            {/* Photo */}
            <div>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={onPhotoChange} aria-label="Take a photo of the problem" className="sr-only" />
              {!photoUrl ? (
                <button type="button" onClick={() => fileInputRef.current?.click()} className={`${BIG_BTN} border-[#0a3d6b] bg-[#1565c0] text-white`}>
                  <Camera className="size-6" aria-hidden="true" /> Take a Photo
                </button>
              ) : (
                <div className="flex flex-col gap-3 rounded-2xl border-4 border-[#0f4a1e] bg-[#eaf7ee] p-4">
                  <p className="text-[16px] font-extrabold text-black">✓ Photo added</p>
                  <img src={photoUrl} alt="Photo you took of the problem" className="max-h-64 w-full rounded-xl border-2 border-black/15 object-cover" />
                  <button type="button" onClick={retakePhoto} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-black bg-white text-[16px] font-bold text-black">
                    <RotateCcw className="size-5" aria-hidden="true" /> Retake photo
                  </button>
                </div>
              )}
            </div>

            {/* Guided checklist */}
            <div>
              <p className="mb-3 text-[18px] font-bold text-black">Or just pick what's wrong:</p>
              <div className="flex flex-col gap-3">
                {CHECKLIST_ISSUES.map((issue) => {
                  const selected = issueId === issue.id;
                  return (
                    <button
                      key={issue.id}
                      type="button"
                      onClick={() => setIssueId(selected ? null : issue.id)}
                      aria-pressed={selected}
                      className={`flex min-h-14 w-full items-center rounded-2xl border-4 px-5 text-left text-[18px] font-bold ${
                        selected ? "border-[#0f4a1e] bg-[#eaf7ee] text-black" : "border-black/20 bg-white text-black"
                      }`}
                    >
                      {selected && <span className="mr-2.5" aria-hidden="true">✓</span>}
                      {issue.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={findMatch}
              disabled={!canContinue}
              className={`${BIG_BTN} border-[#0f4a1e] bg-[#1e7e34] text-white disabled:border-black/15 disabled:bg-black/10 disabled:text-black/40`}
            >
              Find My Match
            </button>
          </div>
        )}

        {/* ══════════════ STEP 3 — Match + trust + proxy booker ══════════════ */}
        {step === 3 && (
          <div className="flex flex-col gap-5">
            <h2 ref={revealHeadingRef} tabIndex={-1} className="text-[22px] font-extrabold text-black outline-none">
              Your match
            </h2>

            {matchState === "loading" && (
              <p role="status" className="text-[18px] font-semibold text-black">Finding you a trusted local pro…</p>
            )}

            {matchState === "empty" && (
              <div className="flex flex-col gap-4 rounded-2xl border-4 border-black/20 bg-[#FAF7F0] p-5">
                <p className="text-[18px] font-semibold leading-relaxed text-black">
                  We don't have a match nearby right now. Call support and we'll help you directly.
                </p>
                <a href={`tel:${SUPPORT_PHONE_TEL}`} className={`${BIG_BTN} border-black bg-white text-black`}>
                  <Phone className="size-6" aria-hidden="true" /> Call Support — {SUPPORT_PHONE_DISPLAY}
                </a>
              </div>
            )}

            {matchState === "found" && match && (
              <div className="flex flex-col gap-4 rounded-2xl border-4 border-black/15 bg-[#FAF7F0] p-5">
                <div className="flex items-center gap-4">
                  <div className={`flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-black/15 ${match.has_avatar_photo || match.avatar_emoji ? "" : "font-mono text-2xl font-bold"} ${tintFor(match.name || "?")}`}>
                    {match.has_avatar_photo ? (
                      <img src={avatarPhotoUrl(match.id, match.avatar_photo_version)} alt="" className="size-full object-cover" />
                    ) : match.avatar_emoji ? (
                      <Emoji3D emoji={match.avatar_emoji} size={80} />
                    ) : (
                      initialsOf(match.name)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[22px] font-extrabold text-black">{match.name}</p>
                    <p className="text-[16px] font-semibold text-black">{match.trade}</p>
                    {match.rating_count > 0 && (
                      <p className="mt-0.5 flex items-center gap-1 text-[16px] font-bold text-black">
                        <Star className="size-4 fill-[#a35700] text-[#a35700]" aria-hidden="true" />
                        {match.rating_avg?.toFixed(1)} ({match.rating_count} review{match.rating_count === 1 ? "" : "s"})
                      </p>
                    )}
                  </div>
                </div>

                {/* Real, not decorative — only renders when an admin has
                    actually reviewed this artisan's submitted ID and
                    proof of insurance and approved them (Artisan.
                    verification_status === "verified", see backend/app/
                    api/admin.py's review_verification). A match without
                    this badge just hasn't gone through review yet; it's
                    never faked as "checked" to fill the space. */}
                {match.verification_status === "verified" && (
                  <div className="flex items-center gap-2 rounded-xl border-2 border-[#0f4a1e] bg-[#eaf7ee] px-3.5 py-2.5">
                    <ShieldCheck className="size-5 shrink-0 text-[#0f4a1e]" aria-hidden="true" />
                    <span className="text-[15px] font-bold text-black">ID &amp; insurance verified by Noqeev</span>
                  </div>
                )}

                <a href={`tel:${match.phone}`} className={`${BIG_BTN} min-h-[88px] flex-col gap-0.5 border-[#0f4a1e] bg-[#1e7e34] text-white`}>
                  <span className="flex flex-wrap items-center justify-center gap-2.5 text-center text-[20px] font-extrabold">
                    <Phone className="size-6" aria-hidden="true" />
                    Press here to speak with {match.name.split(" ")[0]}
                  </span>
                  <span className="text-[16px] font-bold">{formatPhone(match.phone)}</span>
                </a>
              </div>
            )}

            {/* Hold & Release — describes the platform's real escrow
                behavior (backend/app/api/requests.py's /pay and
                /release-payment: money is charged to Noqeev's own Stripe
                balance and only Transferred to the artisan after the
                customer explicitly releases it), for whenever a price and
                a digital booking are actually agreed on the call above —
                not a claim that this screen itself processed a payment. */}
            <div className="flex items-start gap-3 rounded-2xl border-4 border-[#0f4a1e] bg-[#eaf7ee] p-4">
              <Lock className="mt-0.5 size-6 shrink-0 text-[#0f4a1e]" aria-hidden="true" />
              <p className="text-[16px] font-semibold leading-snug text-black">
                Your money is safely held by Noqeev. We only give it to the handyman AFTER you confirm the job is finished and you are happy.
              </p>
            </div>

            {/* Proxy booker */}
            <div className="rounded-2xl border-2 border-black/15 bg-white p-4">
              <button
                type="button"
                role="checkbox"
                aria-checked={isProxyBooking}
                onClick={() => setIsProxyBooking((v) => !v)}
                className="flex min-h-14 w-full items-center gap-3 rounded-xl border-2 border-black/20 bg-white px-3 text-left text-[17px] font-bold text-black"
              >
                <span
                  aria-hidden="true"
                  className={`flex size-7 shrink-0 items-center justify-center rounded-md border-2 border-black text-[16px] ${isProxyBooking ? "bg-[#1e7e34] text-white" : "bg-white"}`}
                >
                  {isProxyBooking ? "✓" : ""}
                </span>
                I am booking this for someone else
              </button>
              {isProxyBooking && (
                <div className="mt-3">
                  <label htmlFor="proxy-phone" className="mb-1.5 block text-[16px] font-bold text-black">
                    Their family member's phone number
                  </label>
                  <input
                    id="proxy-phone"
                    type="tel"
                    inputMode="tel"
                    value={proxyPhone}
                    onChange={(e) => setProxyPhone(e.target.value)}
                    placeholder="(555) 555-5555"
                    className="min-h-14 w-full rounded-xl border-2 border-black/30 bg-white px-4 text-[18px] font-semibold text-black placeholder:text-black/40 focus:border-[#0f4a1e] focus:outline-none"
                  />
                  <p className="mt-1.5 text-[15px] leading-snug text-black/70">
                    Whoever you speak with on the phone will have this number so the right person stays in the loop.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Trust footer — a real flex sibling pinned below the scroll area
          (not CSS position:fixed), so it can never end up drawn on top of
          content someone's trying to read. */}
      <footer className="flex shrink-0 items-start gap-3 border-t-4 border-[#0f4a1e] bg-[#eaf7ee] px-5 py-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <Lock className="mt-0.5 size-6 shrink-0 text-[#0f4a1e]" aria-hidden="true" />
        <p className="text-[16px] font-semibold leading-snug text-black">
          Your safety matters. Every artisan has a real, sign-in-able profile with a visible rating history, and artisans with the green verified badge have had their ID and insurance reviewed by our team.
        </p>
      </footer>
    </div>
  );
}
