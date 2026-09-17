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
 */
import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { renderPost } from "../postTemplates";
import { ensureFontsReady } from "../assetKit";
import { clipLengthSec } from "./clipModel";

function drawContain(ctx, el, naturalW, naturalH, w, h) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  if (!naturalW || !naturalH) return;
  const scale = Math.min(w / naturalW, h / naturalH);
  const dw = naturalW * scale, dh = naturalH * scale;
  ctx.drawImage(el, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function clipStarts(clips) {
  let t = 0;
  return clips.map((c) => { const start = t; t += clipLengthSec(c); return start; });
}

export function PreviewPlayer({ clips, platform, accent, selectedIndex }) {
  const canvasRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [globalTime, setGlobalTime] = useState(0);
  const fontsReadyRef = useRef(false);
  const rafRef = useRef(null);
  const lastFrameAtRef = useRef(0);
  const activeVideoRef = useRef(null); // the clip.el currently playing, if any

  const starts = clipStarts(clips);
  const totalDuration = starts.length ? starts[starts.length - 1] + clipLengthSec(clips[clips.length - 1]) : 0;

  useEffect(() => { ensureFontsReady().then(() => { fontsReadyRef.current = true; redraw(); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Jumping to a different clip in the timeline (while paused) previews
  // that clip's start, so editing its caption shows live feedback.
  useEffect(() => {
    if (playing || selectedIndex == null || !clips[selectedIndex]) return;
    setGlobalTime(starts[selectedIndex] ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  const locate = (t) => {
    if (!clips.length) return { index: 0, local: 0 };
    let index = starts.findIndex((s, i) => t < s + clipLengthSec(clips[i]));
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
      renderPost(ctx, w, h, clip.captionLayers, null, accent, "", {}, { skipBackground: true, skipStamp: true });
    }
  };

  useEffect(() => { redraw(); }); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing) {
      activeVideoRef.current?.pause();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    lastFrameAtRef.current = performance.now();
    const { index } = locate(globalTime);
    const startClip = clips[index];
    if (startClip?.kind === "video") { startClip.el.currentTime = startClip.trimIn; startClip.el.play(); activeVideoRef.current = startClip.el; }

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
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const togglePlay = () => {
    if (!clips.length) return;
    if (!playing && globalTime >= totalDuration) setGlobalTime(0);
    setPlaying((p) => !p);
  };

  const seek = (t) => {
    setPlaying(false);
    activeVideoRef.current?.pause();
    setGlobalTime(Math.max(0, Math.min(totalDuration, t)));
  };

  return (
    <div className="grid gap-2">
      <div
        className="relative mx-auto flex w-full max-w-[420px] items-center justify-center overflow-hidden rounded-xl bg-[#0a0a0a]"
        style={{ aspectRatio: platform ? `${platform.w} / ${platform.h}` : "1 / 1" }}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={togglePlay} disabled={!clips.length}
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-foreground disabled:opacity-40">
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </button>
        <input
          type="range" min="0" max={totalDuration || 1} step="0.05" value={Math.min(globalTime, totalDuration || 1)}
          onChange={(e) => seek(Number(e.target.value))}
          disabled={!clips.length}
          className="w-full accent-primary"
        />
        <span className="w-16 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
          {globalTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
        </span>
      </div>
    </div>
  );
}
