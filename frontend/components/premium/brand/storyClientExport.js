"use client";
/**
 * storyClientExport.js — phase-one story export, entirely client-side:
 * canvas frame capture + MediaRecorder for WebM, canvas frame capture +
 * gif.js for GIF. No task queue, no server render worker — the whole
 * render happens in this tab, once, in real time, exactly the way
 * PreviewPlayer.js already plays the sequence back for "preview before
 * export." runSequence() below is that same draw-the-active-clip-each-
 * frame loop (clipStarts/locate/drawContain/caption-overlay math mirrors
 * PreviewPlayer.js line for line) run headlessly on an offscreen canvas,
 * once, start to finish, with a callback on every frame instead of
 * user-facing playback controls.
 *
 * Straight cuts only (no transitions), silent (no audio track) — the
 * same phase-one boundary the story tool's clip model itself keeps to.
 */
import { renderPost } from "@/app/brand/postTemplates";
import { ensureFontsReady } from "@/app/brand/assetKit";
import { clipLengthSec } from "@/app/brand/story/clipModel";

function clipStarts(clips) {
  let t = 0;
  return clips.map((c) => { const start = t; t += clipLengthSec(c); return start; });
}

function drawContain(ctx, el, naturalW, naturalH, w, h) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  if (!naturalW || !naturalH) return;
  const scale = Math.min(w / naturalW, h / naturalH);
  const dw = naturalW * scale, dh = naturalH * scale;
  ctx.drawImage(el, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

/** Plays the whole clip sequence once, in real time, onto `canvas`,
 * calling onFrame(canvas, elapsedSec) after every drawn frame. Resolves
 * once the last clip finishes. */
export async function runSequence(clips, platform, accent, canvas, { onFrame } = {}) {
  canvas.width = platform.w;
  canvas.height = platform.h;
  const ctx = canvas.getContext("2d");
  const starts = clipStarts(clips);
  const total = starts.length ? starts[starts.length - 1] + clipLengthSec(clips[clips.length - 1]) : 0;
  if (!total) return;

  await ensureFontsReady();

  const locate = (t) => {
    let index = starts.findIndex((s, i) => t < s + clipLengthSec(clips[i]));
    if (index === -1) index = clips.length - 1;
    return { index, local: Math.max(0, t - starts[index]) };
  };

  const draw = (t) => {
    const { index, local } = locate(Math.min(t, total - 0.001));
    const clip = clips[index];
    if (clip.kind === "video") {
      const target = clip.trimIn + local;
      if (Math.abs(clip.el.currentTime - target) > 0.12) clip.el.currentTime = target;
    }
    drawContain(ctx, clip.el, clip.naturalW, clip.naturalH, platform.w, platform.h);
    if (clip.captionLayers?.length) {
      renderPost(ctx, platform.w, platform.h, clip.captionLayers, null, accent, "", {}, { skipBackground: true, skipStamp: true });
    }
  };

  let activeVideo = null;
  const setActiveClip = async (clip) => {
    activeVideo?.pause();
    if (clip.kind === "video") {
      clip.el.currentTime = clip.trimIn;
      await clip.el.play();
      activeVideo = clip.el;
    } else {
      activeVideo = null;
    }
  };

  await setActiveClip(clips[locate(0).index]);
  draw(0);
  onFrame?.(canvas, 0);

  await new Promise((resolve) => {
    let last = performance.now();
    let t = 0;
    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      const before = locate(t).index;
      t += dt;
      if (t >= total) {
        draw(total - 0.001);
        onFrame?.(canvas, total);
        activeVideo?.pause();
        resolve();
        return;
      }
      const after = locate(t).index;
      if (after !== before) setActiveClip(clips[after]);
      draw(t);
      onFrame?.(canvas, t);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export async function recordWebm(clips, platform, accent, { onProgress } = {}) {
  const canvas = document.createElement("canvas");
  const stream = canvas.captureStream(30);
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise((resolve) => { recorder.onstop = resolve; });

  recorder.start();
  await runSequence(clips, platform, accent, canvas, {
    onFrame: (_, t) => onProgress?.(t),
  });
  recorder.stop();
  await stopped;
  return new Blob(chunks, { type: "video/webm" });
}

export async function recordGif(clips, platform, accent, { onProgress, maxWidth = 480 } = {}) {
  const { default: GIF } = await import("gif.js");
  const scale = Math.min(1, maxWidth / platform.w);
  const gw = Math.max(1, Math.round(platform.w * scale));
  const gh = Math.max(1, Math.round(platform.h * scale));
  const gif = new GIF({ workers: 2, quality: 10, width: gw, height: gh, workerScript: "/gif.worker.js" });

  const gifCanvas = document.createElement("canvas");
  gifCanvas.width = gw; gifCanvas.height = gh;
  const gifCtx = gifCanvas.getContext("2d");

  const mainCanvas = document.createElement("canvas");
  const CAPTURE_INTERVAL = 0.1; // 10fps — keeps file size/encode time reasonable
  let lastCapture = -Infinity;

  await runSequence(clips, platform, accent, mainCanvas, {
    onFrame: (canvas, t) => {
      onProgress?.(t);
      if (t - lastCapture < CAPTURE_INTERVAL) return;
      lastCapture = t;
      gifCtx.drawImage(canvas, 0, 0, gw, gh);
      gif.addFrame(gifCtx, { copy: true, delay: CAPTURE_INTERVAL * 1000 });
    },
  });

  return new Promise((resolve, reject) => {
    gif.on("finished", (blob) => resolve(blob));
    gif.on("abort", () => reject(new Error("GIF export was aborted.")));
    gif.render();
  });
}
