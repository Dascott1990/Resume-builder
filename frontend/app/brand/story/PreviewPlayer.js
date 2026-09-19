"use client";
/**
 * PreviewPlayer.js — full in-browser playback of the assembled sequence
 * before committing to a server render, so "preview before export" is a
 * real requirement, not a formality. One <canvas> at the real platform
 * pixel size; each clip's own already-loaded <img>/<video> element
 * (created once in clipModel.js's loadClipFromFile) is drawn straight
 * into it — reusing those instead of swapping one shared element's `src`
 * per clip avoids a reload/seek stall every time playback crosses a clip
 * boundary.
 *
 * The aspect-fit letterbox math here (scale to fit, center, pad) mirrors
 * exactly what the backend's ffmpeg `scale=...force_original_aspect_ratio
 * =decrease,pad=...` filter does (see api/story.py), so what's previewed
 * is what gets rendered.
 *
 * Preview and controls are two real, separate, non-overlapping regions —
 * NOT playback controls floating on top of the canvas. An earlier version
 * of this file overlaid them (YouTube/iOS-style), which looked right but
 * broke caption dragging: a caption placed in roughly the bottom quarter
 * of the frame (a completely normal subtitle position) sat physically
 * underneath the transport-controls overlay, so every pointer event meant
 * for that caption landed on the controls' own DOM nodes instead of the
 * canvas — the drag never reached it. Two stacked siblings (preview box,
 * then a control strip below it) makes that category of bug structurally
 * impossible: there is no screen coordinate that both the canvas and the
 * controls can claim at once, on any viewport size. The preview is capped
 * at ~38vh so it can never crowd out the control strip on a short phone
 * screen; the control strip is sized by its own content (button row +
 * filmstrip + timecode), not a forced percentage, since forcing a fixed
 * vh height on it would risk clipping or wasted padding depending on the
 * device rather than actually being more robust.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Play, Pause, RotateCcw, SkipBack, SkipForward, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { renderPost } from "../postTemplates";
import { ensureFontsReady } from "../assetKit";
import { clipLengthSec } from "./clipModel";
import { wordTimings, activeWordIndex as pickActiveWordIndex } from "./karaoke";
import { getNarrationPreview, narrationContentKey } from "./narrationPreview";
import { drawClipThumbnail } from "./clipThumbnail";

function drawContain(ctx, el, naturalW, naturalH, w, h) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  if (!naturalW || !naturalH) return;
  const scale = Math.min(w / naturalW, h / naturalH);
  const dw = naturalW * scale, dh = naturalH * scale;
  ctx.drawImage(el, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function hasNarration(clip) {
  return !clip.narrationMuted && !!clip.narrationText?.trim();
}

// A clip with narrationFit "extend" holds open at least as long as its
// own voice-over — same rule backend/app/api/story.py's /render applies
// when it stretches duration_sec/trim_out to fit the synthesized audio
// (see its narration_duration handling). knownDurations is keyed by
// narrationContentKey, filled in as narration-preview.js's fetches
// resolve — until a clip's own narration duration is known, this falls
// back to its plain visual length, exactly like an unextended clip.
function clipEffectiveLength(clip, knownDurations) {
  const base = clipLengthSec(clip);
  if (clip.narrationFit !== "extend" || !hasNarration(clip)) return base;
  const known = knownDurations[narrationContentKey({ text: clip.narrationText, voice: clip.narrationVoice, rate: clip.narrationRate, pitch: clip.narrationPitch })];
  return known ? Math.max(base, known) : base;
}

function clipStarts(clips, knownDurations) {
  let t = 0;
  return clips.map((c) => { const start = t; t += clipEffectiveLength(c, knownDurations); return start; });
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const SEEK_STEP_SEC = 10; // double-tap / skip buttons / arrow keys all agree on one increment
const DOUBLE_TAP_MS = 350;

// One clip's own thumbnail, cover-cropped into a fixed internal canvas
// resolution and CSS-stretched to whatever proportional width the
// filmstrip below gives it — drawn once when the clip's media is ready,
// via the same drawClipThumbnail() ClipTimeline.js's own ClipThumb uses,
// not a second copy of that logic.
const THUMB_W = 120, THUMB_H = 56;
function FilmstripThumb({ clip, widthPct }) {
  const canvasRef = useRef(null);
  useEffect(() => { drawClipThumbnail(clip, canvasRef.current, THUMB_W, THUMB_H); }, [clip]);
  return (
    <canvas
      ref={canvasRef}
      className="block h-full shrink-0"
      style={{ width: `${widthPct}%` }}
    />
  );
}

/**
 * FilmstripScrubber — the seek bar, redesigned as an actual filmstrip
 * (thumbnails from every clip, sized to that clip's own share of the
 * total runtime) instead of a bare progress track, closer to what a
 * real video-trimming UI's scrubber looks like than a generic <input
 * type="range"> ever could — a plain range input can't show per-clip
 * content on its own track at all. Lives in its own solid control strip
 * now (see PreviewPlayer's header comment) — normal app chrome
 * (border-border/bg-[#0a0a0a]/text-muted-foreground), not the glass-
 * over-unpredictable-video treatment a canvas overlay would have needed.
 */
function FilmstripScrubber({ clips, effectiveLengths, time, duration, onScrub }) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const fracFromEvent = (e) => {
    const rect = trackRef.current.getBoundingClientRect();
    if (!rect.width) return 0;
    return clamp01((e.clientX - rect.left) / rect.width);
  };
  const onPointerDown = (e) => {
    if (!duration) return;
    setDragging(true);
    trackRef.current.setPointerCapture(e.pointerId);
    onScrub(fracFromEvent(e) * duration);
  };
  const onPointerMove = (e) => {
    if (!dragging || !duration) return;
    onScrub(fracFromEvent(e) * duration);
  };
  const onPointerUp = (e) => {
    setDragging(false);
    try { trackRef.current.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  };

  const empty = clips.length === 0;
  const progressFrac = duration > 0 ? clamp01(time / duration) : 0;

  return (
    <div
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={duration || 0}
      aria-valuenow={time}
      aria-disabled={empty}
      // touch-action: none, exactly like the canvas's own caption-drag
      // handling above — without it, dragging the handle on a touch
      // device also scrolls the page underneath it.
      style={{ touchAction: "none" }}
      className={`relative h-14 w-full select-none overflow-hidden rounded-full border border-border bg-[#0a0a0a] ${empty ? "opacity-60" : "cursor-pointer"}`}
    >
      {empty ? (
        <div className="flex h-full items-center justify-center px-4">
          <span className="text-center text-[11px] text-muted-foreground">Add images or short clips to start your sequence.</span>
        </div>
      ) : (
        <>
          {/* Thumbnails, edge to edge — the strip's own rounding comes
              from this container's overflow-hidden, not per-thumbnail,
              so it reads as one continuous shape. */}
          <div className="flex h-full w-full">
            {clips.map((clip, i) => (
              <FilmstripThumb key={clip.id} clip={clip} widthPct={duration > 0 ? (effectiveLengths[i] / duration) * 100 : 0} />
            ))}
          </div>
          {/* End-cap chevrons — a visual hint that the strip is a
              timeline, not a separate prev/next-clip control (that
              already exists as its own button in the transport row). */}
          <ChevronLeft className="pointer-events-none absolute left-1.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <ChevronRight className="pointer-events-none absolute right-1.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          {/* Scrub handle — position (left %) is NEVER transitioned, so
              it tracks the pointer/playhead with zero lag; only the
              inner circle's scale eases, on drag start/end. Always
              fully solid white — the one element that must stay crisply
              visible against any frame behind it. */}
          <div className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${progressFrac * 100}%` }}>
            <div
              className={`size-[30px] rounded-full bg-white shadow-md transition-transform duration-100 ${dragging ? "scale-110 shadow-lg" : ""}`}
            />
          </div>
        </>
      )}
    </div>
  );
}

export function PreviewPlayer({ clips, platform, accent, selectedIndex, onCaptionLive, onCaptionCommit, compact, seekRequest }) {
  const canvasRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [globalTime, setGlobalTime] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [narrationDurations, setNarrationDurations] = useState({}); // narrationContentKey -> seconds, filled in as previews resolve
  const fontsReadyRef = useRef(false);
  const rafRef = useRef(null);
  const lastFrameAtRef = useRef(0);
  const activeVideoRef = useRef(null); // the clip.el currently playing, if any
  const narrationAudioRef = useRef(null); // one reusable <audio>, src swapped per active clip
  const activeNarrationClipIdRef = useRef(null); // guards against a slow fetch resolving after playback already moved on
  const narrationErrorShownRef = useRef(false); // caps the "voice-over preview unavailable" toast at once per playback session, not once per failing clip
  const captionBoxRef = useRef(null); // last-drawn caption bbox, for drag hit-testing
  const dragRef = useRef(null);

  // ── Web Audio graph — real gain (0-2x, matching backend/app/api/
  // story.py's own ffmpeg `volume` filters exactly), not HTMLMediaElement.
  // volume (which tops out at 1) — narration and a video clip's own
  // original sound are two independent GainNodes so their volumes are
  // set (and previewed) completely independently, mixed together at
  // ctx.destination the same way ffmpeg's amix mixes them at render.
  const audioCtxRef = useRef(null);
  const narrationGainRef = useRef(null);
  const originalGainRef = useRef(null);
  const narrationSourceNodeRef = useRef(null); // MediaElementAudioSourceNode for narrationAudioRef — created once, reused forever
  const videoSourceNodesRef = useRef(new Map()); // clip.id -> MediaElementAudioSourceNode; createMediaElementSource can only be called ONCE per element ever, so each is cached permanently
  const activeVideoSourceNodeRef = useRef(null); // whichever video source node is currently connected to originalGainRef, if any
  const activeClipRef = useRef(null); // whichever clip is currently playing — read by applyMuteState() to know what gain to restore on unmute

  // ── Transport controls — restart/skip/double-tap-seek/mute, the same
  // "quick" set a real video player (YouTube included) ships with.
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false); // read inside audio callbacks, which close over stale state otherwise
  const [seekFlash, setSeekFlash] = useState(null); // { side: "back" | "forward", nonce } — the brief "«10/10»" flash on double-tap
  const lastTapRef = useRef({ time: 0, side: null }); // for double-tap detection on the canvas itself

  // tapCandidateRef tracks whether the current press is still eligible to
  // be read as a tap (for double-tap-seek) once it lifts — cleared by the
  // caption-drag hit-test claiming the press, or by the press moving too
  // far to be a tap. No overlay to show/hide anymore (see PreviewPlayer's
  // own header comment: controls live in a separate strip now, never on
  // top of the canvas), so this exists purely for double-tap-seek.
  const tapCandidateRef = useRef(false);
  const pointerDownPosRef = useRef(null);

  const starts = clipStarts(clips, narrationDurations);
  const totalDuration = starts.length ? starts[starts.length - 1] + clipEffectiveLength(clips[clips.length - 1], narrationDurations) : 0;

  useEffect(() => { ensureFontsReady().then(() => { fontsReadyRef.current = true; redraw(); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // One reusable <audio> element for narration playback — created once,
  // torn down on unmount. A plain DOM object, not JSX: nothing about it
  // needs to be visible or part of the render tree. The Web Audio
  // graph itself is NOT created here — an AudioContext must start from
  // a user gesture (autoplay policy), so it's created lazily in
  // ensureAudioGraph(), called the moment Play is actually pressed.
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    narrationAudioRef.current = audio;
    return () => {
      audio.pause();
      narrationAudioRef.current = null;
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
    };
  }, []);

  // Builds the graph on first use (idempotent) and resumes it — browsers
  // suspend a freshly-created AudioContext until a user gesture confirms
  // audio is actually wanted; togglePlay() is that gesture.
  const ensureAudioGraph = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null; // no Web Audio support — preview just stays silent, nothing to crash over
      const ctx = new AudioCtx();
      const narrationGain = ctx.createGain();
      narrationGain.connect(ctx.destination);
      const originalGain = ctx.createGain();
      originalGain.connect(ctx.destination);
      audioCtxRef.current = ctx;
      narrationGainRef.current = narrationGain;
      originalGainRef.current = originalGain;
    }
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume().catch(() => {});
    if (!narrationSourceNodeRef.current && narrationAudioRef.current) {
      try {
        const node = audioCtxRef.current.createMediaElementSource(narrationAudioRef.current);
        node.connect(narrationGainRef.current);
        narrationSourceNodeRef.current = node;
      } catch { /* already wired, or this browser doesn't support it — narration then just stays silent */ }
    }
    return audioCtxRef.current;
  };

  // Lazily wraps a video clip's own <video> element in a
  // MediaElementAudioSourceNode — cached per clip.id forever, since
  // calling createMediaElementSource twice on the same element throws.
  // Once wired, the element's audio ONLY flows through this graph (the
  // browser stops routing it directly to speakers), so `muted` is
  // cleared here rather than left true — gain/connection below is what
  // actually gates whether it's audible, not the element's own flag.
  const getVideoSourceNode = (clip) => {
    const ctx = audioCtxRef.current;
    if (!ctx || !clip?.el || clip.kind !== "video") return null;
    let node = videoSourceNodesRef.current.get(clip.id);
    if (!node) {
      try {
        node = ctx.createMediaElementSource(clip.el);
        videoSourceNodesRef.current.set(clip.id, node);
        clip.el.muted = false;
      } catch {
        return null;
      }
    }
    return node;
  };

  // Connects (or disconnects) whichever video clip's own sound should be
  // audible right now — only the ACTIVE clip's source node is ever
  // connected to originalGainRef, matching how only one clip plays at a
  // time visually too.
  const setActiveOriginalAudio = (clip) => {
    const gain = originalGainRef.current;
    if (!gain) return;
    if (activeVideoSourceNodeRef.current) {
      try { activeVideoSourceNodeRef.current.disconnect(gain); } catch { /* already disconnected */ }
      activeVideoSourceNodeRef.current = null;
    }
    if (!clip || clip.kind !== "video" || clip.keepOriginalAudio === false) return;
    const node = getVideoSourceNode(clip);
    if (!node) return;
    node.connect(gain);
    activeVideoSourceNodeRef.current = node;
    applyMuteState();
  };

  // Re-applies both gain values from activeClipRef's own configured
  // volumes, or 0 for both if the master Mute button is on — the single
  // place that actually writes to the AudioParams, so toggling mute
  // doesn't need to know anything about narration vs. original audio,
  // just "recompute what should be audible right now."
  const applyMuteState = () => {
    const clip = activeClipRef.current;
    if (narrationGainRef.current) {
      narrationGainRef.current.gain.value = mutedRef.current ? 0 : Math.min(2, Math.max(0, clip?.narrationVolume ?? 1));
    }
    if (originalGainRef.current) {
      originalGainRef.current.gain.value = mutedRef.current ? 0 : Math.min(2, Math.max(0, clip?.originalAudioVolume ?? 1));
    }
  };

  const toggleMute = () => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    applyMuteState();
  };

  // Debounced narration-preview prefetch — re-synthesizing on every
  // keystroke while someone's typing a script would hammer the backend.
  // Keyed off a signature of every clip's own narration-relevant fields,
  // not the whole `clips` array, so an unrelated edit (dragging a
  // caption, reordering clips) never re-fires this.
  const narrationSignature = clips
    .map((c) => (hasNarration(c) ? narrationContentKey({ text: c.narrationText, voice: c.narrationVoice, rate: c.narrationRate, pitch: c.narrationPitch }) : ""))
    .join("||");
  useEffect(() => {
    const timer = setTimeout(() => {
      clips.forEach((clip) => {
        if (!hasNarration(clip)) return;
        const key = narrationContentKey({ text: clip.narrationText, voice: clip.narrationVoice, rate: clip.narrationRate, pitch: clip.narrationPitch });
        getNarrationPreview({ text: clip.narrationText, voice: clip.narrationVoice, rate: clip.narrationRate, pitch: clip.narrationPitch })
          .then((entry) => {
            if (!entry) return;
            setNarrationDurations((prev) => (prev[key] === entry.duration ? prev : { ...prev, [key]: entry.duration }));
          })
          .catch(() => {}); // a failed synth just means this clip's timing falls back to its plain visual length
      });
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrationSignature]);

  // Starts (or stops) this clip's narration audio — called whenever
  // playback enters a new clip. Bails via activeNarrationClipIdRef if
  // playback has already moved on by the time a slow fetch resolves.
  const playNarrationForClip = (clip) => {
    const audio = narrationAudioRef.current;
    if (!audio) return;
    audio.pause();
    activeNarrationClipIdRef.current = clip?.id ?? null;
    if (!clip || !hasNarration(clip)) return;
    getNarrationPreview({ text: clip.narrationText, voice: clip.narrationVoice, rate: clip.narrationRate, pitch: clip.narrationPitch })
      .then((entry) => {
        if (!entry || activeNarrationClipIdRef.current !== clip.id || narrationAudioRef.current !== audio) return;
        audio.src = entry.url;
        audio.currentTime = 0;
        // Real gain via the Web Audio graph (0-2x, same range/filter
        // ffmpeg applies at render) — not audio.volume, which tops out
        // at 1 and can't represent anything past 100%. Routed through
        // applyMuteState() so the master Mute button (below) overrides
        // it without needing to know anything about narration itself.
        applyMuteState();
        narrationErrorShownRef.current = false; // a later clip succeeding means a later failure is worth a fresh toast again
        audio.play().catch(() => {}); // browser autoplay-policy rejection is fine here — silently no sound, nothing to surface as an error
      })
      .catch(() => {
        // A real backend/network failure, not just "this clip has no
        // narration" (that path returns early above and never reaches
        // here) — surfaced once per playback session, not once per
        // failing clip, so a whole story with narration doesn't fire a
        // toast for every single clip while the backend's unreachable.
        if (narrationErrorShownRef.current) return;
        narrationErrorShownRef.current = true;
        toast.error("Voice-over preview unavailable right now — playback continues without it.");
      });
  };

  // Jumping to a different clip in the timeline (while paused) previews
  // that clip's start, so editing its caption shows live feedback.
  useEffect(() => {
    if (playing || selectedIndex == null || !clips[selectedIndex]) return;
    setGlobalTime(starts[selectedIndex] ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  const locate = (t) => {
    if (!clips.length) return { index: 0, local: 0 };
    let index = starts.findIndex((s, i) => t < s + clipEffectiveLength(clips[i], narrationDurations));
    if (index === -1) index = clips.length - 1;
    const local = Math.max(0, t - starts[index]);
    return { index, local };
  };

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !platform || !fontsReadyRef.current) return;
    const { w, h } = platform;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!clips.length) { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h); return; }

    const { index, local } = locate(globalTime);
    const clip = clips[index];
    if (clip.kind === "video") {
      const targetTime = clip.trimIn + local;
      if (Math.abs(clip.el.currentTime - targetTime) > 0.12) clip.el.currentTime = targetTime;
    }
    drawContain(ctx, clip.el, clip.naturalW, clip.naturalH, w, h);
    if (clip.captionLayers?.length) {
      const caption = clip.captionLayers[0];
      // Word timing is derived fresh each redraw from the clip's own
      // duration, not memoized — cheap (a handful of words) and it needs
      // to track clip length live as the timeline's duration slider moves.
      const activeWordIndex = caption.karaoke
        ? pickActiveWordIndex(wordTimings(caption.text, clipLengthSec(clip)), local)
        : null;
      const boxes = renderPost(ctx, w, h, clip.captionLayers, null, accent, "", {}, { skipBackground: true, skipStamp: true, activeWordIndex });
      captionBoxRef.current = boxes.get(caption.id) || null;
    } else {
      captionBoxRef.current = null;
    }
  };

  useEffect(() => { redraw(); }); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing) {
      activeVideoRef.current?.pause();
      narrationAudioRef.current?.pause();
      activeNarrationClipIdRef.current = null;
      activeClipRef.current = null;
      setActiveOriginalAudio(null);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    ensureAudioGraph();
    lastFrameAtRef.current = performance.now();
    const { index } = locate(globalTime);
    const startClip = clips[index];
    if (startClip?.kind === "video") { startClip.el.currentTime = startClip.trimIn; startClip.el.play(); activeVideoRef.current = startClip.el; }
    activeClipRef.current = startClip;
    playNarrationForClip(startClip);
    setActiveOriginalAudio(startClip);

    const tick = (now) => {
      const dt = (now - lastFrameAtRef.current) / 1000;
      lastFrameAtRef.current = now;
      setGlobalTime((t) => {
        const next = t + dt;
        if (next >= totalDuration) { setPlaying(false); return totalDuration; }
        const before = locate(t).index;
        const after = locate(next).index;
        if (after !== before) {
          activeVideoRef.current?.pause();
          const nextClip = clips[after];
          if (nextClip?.kind === "video") { nextClip.el.currentTime = nextClip.trimIn; nextClip.el.play(); activeVideoRef.current = nextClip.el; }
          else activeVideoRef.current = null;
          activeClipRef.current = nextClip;
          playNarrationForClip(nextClip);
          setActiveOriginalAudio(nextClip);
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // ── Drag-to-reposition the caption, directly on the preview canvas —
  // same hit-test-the-last-drawn-box-then-track-pointer-offset pattern
  // PostComposer.js uses for its layers. Only active while paused and
  // showing the SELECTED clip (the one LayerPanel is currently editing),
  // so what's draggable always matches what the style controls affect. ──
  const pointFromEvent = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) };
  };

  // tapCandidateRef starts true on every press; the caption-drag hit-test
  // below clears it the moment a press actually claims the caption, and
  // onPointerMove clears it if the press turns into a swipe instead of a
  // tap. Whatever's left true by pointerup is a genuine tap, handled by
  // handleCanvasTap — this is the ONLY place tap detection lives now, so
  // it can never compete with caption dragging for the same gesture.
  const onPointerDown = (e) => {
    tapCandidateRef.current = true;
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    if (playing) return; // no caption drag while playing; tap handling still happens on pointerup below
    const { index } = locate(globalTime);
    if (index !== selectedIndex) return;
    const box = captionBoxRef.current;
    const layer = clips[index]?.captionLayers?.[0];
    if (!box || !layer || !platform) return;
    const p = pointFromEvent(e);
    // Padded well past the drawn text's own pixel bounds — a short
    // caption (a few words) has a genuinely small bbox, and requiring a
    // pixel-perfect hit on the glyphs themselves is exactly why this read
    // as "barely responding" on a touchscreen. Sized as a fraction of the
    // platform, not a fixed px count, so the grab margin scales the same
    // way the caption itself does across every preset/display size.
    const pad = Math.max(platform.w, platform.h) * 0.045;
    if (p.x < box.x - pad || p.x > box.x + box.w + pad || p.y < box.y - pad || p.y > box.y + box.h + pad) return; // a miss — stays a tap candidate
    tapCandidateRef.current = false; // a real caption drag claims this press, it's not a tap
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { dx: p.x / platform.w - layer.x, dy: p.y / platform.h - layer.y };
    setDragging(true);
  };
  const onPointerMove = (e) => {
    if (dragRef.current) {
      if (!platform) return;
      const { index } = locate(globalTime);
      const layer = clips[index]?.captionLayers?.[0];
      if (!layer) return;
      const p = pointFromEvent(e);
      const nx = clamp01(p.x / platform.w - dragRef.current.dx);
      const ny = clamp01(p.y / platform.h - dragRef.current.dy);
      onCaptionLive?.({ ...layer, x: nx, y: ny });
      return;
    }
    // Moved far enough to read as a swipe, not a tap — don't toggle the
    // overlay out from under a gesture that wasn't actually a press.
    if (tapCandidateRef.current && pointerDownPosRef.current) {
      const dx = e.clientX - pointerDownPosRef.current.x;
      const dy = e.clientY - pointerDownPosRef.current.y;
      if (Math.hypot(dx, dy) > 10) tapCandidateRef.current = false;
    }
  };
  const onPointerUp = (e) => {
    if (dragRef.current) {
      const { index } = locate(globalTime);
      const layer = clips[index]?.captionLayers?.[0];
      if (layer) onCaptionCommit?.(layer);
      dragRef.current = null;
      setDragging(false);
      return;
    }
    if (tapCandidateRef.current) handleCanvasTap(e);
  };

  const togglePlay = () => {
    if (!clips.length) return;
    if (!playing) {
      // A fresh Play press deserves its own chance at the narration-
      // failure toast, even if a PREVIOUS playthrough already showed
      // it once — only seekRelative's internal off/on flicker (a
      // continuation of the SAME playthrough) should stay suppressed.
      narrationErrorShownRef.current = false;
      if (globalTime >= totalDuration) setGlobalTime(0);
    }
    setPlaying((p) => !p);
  };

  const seek = (t) => {
    setPlaying(false);
    activeVideoRef.current?.pause();
    narrationAudioRef.current?.pause();
    activeNarrationClipIdRef.current = null;
    activeClipRef.current = null;
    setActiveOriginalAudio(null);
    setGlobalTime(Math.max(0, Math.min(totalDuration, t)));
  };

  // Seeks by a relative offset WITHOUT stopping playback if it's already
  // playing — a plain toggle-off-then-on re-triggers the `playing` effect
  // above, which already knows how to resolve whatever clip the new
  // position lands in and wire up its video/narration/original-audio;
  // reusing that instead of duplicating the same setup here.
  const seekRelative = (deltaSeconds) => {
    if (!clips.length) return;
    const target = Math.max(0, Math.min(totalDuration, globalTime + deltaSeconds));
    setGlobalTime(target);
    if (playing) {
      setPlaying(false);
      requestAnimationFrame(() => setPlaying(true));
    }
  };

  // "Start playing from the beginning" — resets position AND starts
  // playback even if paused, matching what a restart button implies.
  const restart = () => {
    if (!clips.length) return;
    setGlobalTime(0);
    if (playing) {
      setPlaying(false);
      requestAnimationFrame(() => setPlaying(true));
    } else {
      narrationErrorShownRef.current = false; // starting a new playthrough from paused, same reasoning as togglePlay
      setPlaying(true);
    }
  };

  // Chapter-style navigation — jump straight to a clip's own start
  // rather than scrubbing by seconds. Keeps playing if it already was,
  // same re-trigger-the-playing-effect approach as seekRelative.
  const jumpToClip = (index) => {
    if (index < 0 || index >= clips.length) return;
    setGlobalTime(starts[index]);
    if (playing) {
      setPlaying(false);
      requestAnimationFrame(() => setPlaying(true));
    }
  };
  const goToPreviousClip = () => {
    const { index, local } = locate(globalTime);
    // More than ~1s into the current clip: "previous" restarts THIS
    // clip first (the Spotify/YouTube convention) — only steps back an
    // extra clip once already sitting near its own start.
    jumpToClip(local > 1 ? index : index - 1);
  };
  const goToNextClip = () => {
    const { index } = locate(globalTime);
    jumpToClip(index + 1);
  };

  // Double-tap (or double-click) either half of the preview to seek —
  // tap the left half to go back, the right half to go forward, the
  // same YouTube-mobile gesture. A single tap does nothing (no overlay
  // to show/hide anymore — see the file header comment), so there's no
  // need to defer/confirm it the way a tap-toggle would have required.
  const handleCanvasTap = (e) => {
    if (!clips.length) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const side = (e.clientX - rect.left) / rect.width < 0.5 ? "back" : "forward";
    const now = performance.now();
    const isDoubleTap = lastTapRef.current.side === side && now - lastTapRef.current.time < DOUBLE_TAP_MS;
    if (isDoubleTap) {
      lastTapRef.current = { time: 0, side: null }; // consumed — a 3rd rapid tap starts a fresh pair, not a chained triple-seek
      seekRelative(side === "forward" ? SEEK_STEP_SEC : -SEEK_STEP_SEC);
      setSeekFlash({ side, nonce: now });
    } else {
      lastTapRef.current = { time: now, side };
    }
  };

  // Clears the "«10 / 10»" flash a beat after it appears — CSS can't
  // animate an unmount on its own without a library already in play
  // here, so a plain timeout is the quick version.
  useEffect(() => {
    if (!seekFlash) return;
    const timer = setTimeout(() => setSeekFlash(null), 550);
    return () => clearTimeout(timer);
  }, [seekFlash]);

  // Space = play/pause, arrows = seek, Home/0 = restart, M = mute — the
  // standard set, skipped entirely while typing anywhere else on the
  // page (narration script, caption text) so this never steals a
  // keystroke mid-sentence.
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;
      if (e.key === " ") { e.preventDefault(); togglePlay(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); seekRelative(SEEK_STEP_SEC); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); seekRelative(-SEEK_STEP_SEC); }
      else if (e.key === "Home" || e.key === "0") { e.preventDefault(); restart(); }
      else if (e.key === "m" || e.key === "M") { e.preventDefault(); toggleMute(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, globalTime, totalDuration, clips]);

  // An external "jump to this exact second" request — the quality
  // report's issues each link to a timestamp; clicking one seeks the
  // preview straight there in one click instead of scrubbing to find it.
  // {time, nonce}, not just a bare number: clicking the SAME issue twice
  // in a row is a real thing to support (re-check after fixing it), and
  // a nonce is what makes the second click register as a new request
  // even though `time` itself didn't change.
  useEffect(() => {
    if (seekRequest) seek(seekRequest.time);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekRequest]);

  // Both zones share the exact same width formula so they align edge to
  // edge as one visual unit even though they're separate elements — width
  // driven by height (aspect * capped-height), the same "height-driven
  // instead of width-driven" reasoning the old compact-only sizing used,
  // now applied everywhere so the layout holds identically on a phone, a
  // tablet, a foldable, or a desktop window, not just the phone case.
  // ~38vh keeps the preview roughly the "35-40% of the screen" a hero
  // preview should get without it ever being able to crowd the control
  // strip below off screen, on the shortest realistic viewport.
  const aspect = platform ? platform.w / platform.h : 1;
  const zoneWidthStyle = { width: `min(100%, calc(38vh * ${aspect})${compact ? "" : ", 420px"})` };
  const transportBtnClass = "flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground disabled:opacity-30 enabled:hover:bg-muted enabled:hover:text-foreground";
  return (
    <div className="grid gap-2">
      {/* PREVIEW — the canvas alone, nothing layered on top of it besides
          the momentary (pointer-events-none) double-tap flash. Nothing
          here can ever claim a pointer event meant for a caption drag. */}
      <div
        className="relative mx-auto flex items-center justify-center overflow-hidden rounded-xl bg-[#0a0a0a]"
        style={{ aspectRatio: platform ? `${platform.w} / ${platform.h}` : "1 / 1", maxHeight: "38vh", ...zoneWidthStyle }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="block h-full w-full"
          style={{
            cursor: dragging ? "grabbing" : (!playing && locate(globalTime).index === selectedIndex && captionBoxRef.current) ? "grab" : "default",
            touchAction: "none",
          }}
        />
        {/* The double-tap "«10 / 10»" flash — YouTube's own confirmation
            that the tap registered as a seek, not a miss. Half-width,
            pinned to whichever side was actually tapped. */}
        {seekFlash && (
          <div
            className={`pointer-events-none absolute inset-y-0 flex w-1/2 items-center justify-center ${seekFlash.side === "forward" ? "right-0" : "left-0"}`}
          >
            <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[13px] font-bold text-white">
              {seekFlash.side === "back" && <SkipBack className="size-3.5" />}
              {SEEK_STEP_SEC}s
              {seekFlash.side === "forward" && <SkipForward className="size-3.5" />}
            </span>
          </div>
        )}
      </div>

      {/* CONTROL STRIP — a real sibling element below the preview, never
          on top of it. Sized by its own content (button row + filmstrip
          + timecode), not a forced height, so it can't clip or leave
          dead padding depending on the device. */}
      <div className="mx-auto flex w-full flex-col gap-1.5 rounded-xl border border-border bg-[#0a0a0a] p-2" style={zoneWidthStyle}>
        <div className="flex flex-wrap items-center justify-center gap-1">
          <button type="button" onClick={goToPreviousClip} disabled={!clips.length} title="Previous clip" className={transportBtnClass}>
            <ChevronsLeft className="size-4" />
          </button>
          <button type="button" onClick={restart} disabled={!clips.length} title="Restart from the beginning" className={transportBtnClass}>
            <RotateCcw className="size-4" />
          </button>
          <button type="button" onClick={() => seekRelative(-SEEK_STEP_SEC)} disabled={!clips.length} title={`Back ${SEEK_STEP_SEC}s`} className={transportBtnClass}>
            <SkipBack className="size-4" />
          </button>
          <button type="button" onClick={togglePlay} disabled={!clips.length} className={`${transportBtnClass} border border-border text-foreground`}>
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button type="button" onClick={() => seekRelative(SEEK_STEP_SEC)} disabled={!clips.length} title={`Forward ${SEEK_STEP_SEC}s`} className={transportBtnClass}>
            <SkipForward className="size-4" />
          </button>
          <button type="button" onClick={goToNextClip} disabled={!clips.length} title="Next clip" className={transportBtnClass}>
            <ChevronsRight className="size-4" />
          </button>
          <button type="button" onClick={toggleMute} disabled={!clips.length} aria-pressed={muted} title={muted ? "Unmute" : "Mute"}
            className={`${transportBtnClass} ${muted ? "text-destructive" : ""}`}>
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
        </div>

        <FilmstripScrubber
          clips={clips}
          effectiveLengths={clips.map((c) => clipEffectiveLength(c, narrationDurations))}
          time={Math.min(globalTime, totalDuration || 0)}
          duration={totalDuration}
          onScrub={seek}
        />
        <p className="m-0 text-center font-mono text-[11px] text-muted-foreground">
          {globalTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
        </p>
      </div>
    </div>
  );
}
