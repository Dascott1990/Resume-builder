"use client";
/**
 * ExportPanel.js — platform + MP4/GIF choice, and the actual export flow:
 * render each captioned clip's transparent overlay PNG client-side (reuse
 * renderPost, skipBackground+skipStamp — see postTemplates.js), then POST
 * everything to POST /api/v1/brand/story/render, which renders
 * synchronously and returns the file directly — no job to poll, no
 * database row anywhere in this flow (see api/story.py's module
 * docstring) — same reasoning as PostComposer's "email this" button
 * never touching the database either. Nothing auto-publishes: export
 * only happens when Download or Email is pressed, and the result is
 * either a local download or an email the user reviews themselves.
 *
 * Download and Email are the same render, two different deliveries —
 * mirroring PostComposer's Download button + EmailAssetButton pair,
 * just built into one panel since both need the exact same multipart
 * payload (re-uploading clips a second time for email would be wasteful).
 */
import { useState } from "react";
import { toast } from "sonner";
import { Download, Mail, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Btn } from "@/components/premium/guest/components/primitives";
import { getGuestId } from "@/lib/guestId";
import { getToken } from "@/lib/authToken";
import { PLATFORMS, renderPost } from "../postTemplates";
import { canvasToPngBlob, downloadBlob } from "../assetKit";
import { clipLengthSec } from "./clipModel";
import { wordTimings } from "./karaoke";

const BASE = process.env.NEXT_PUBLIC_API_URL;
const MAX_GIF_DURATION_SEC = 10; // mirrors backend/app/api/story.py's cap
const LAST_EMAIL_KEY = "noqeev_brand_last_email";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// A generous ceiling on how many per-word overlay frames one caption can
// generate — not a text truncation (the full caption still renders every
// frame, just this many distinct highlight positions), just a bound on
// render time/ffmpeg filter-graph size for an unreasonably long caption.
const MAX_KARAOKE_WORDS = 60;

async function renderCaptionFrame(clip, w, h, accent, activeWordIndex) {
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  renderPost(ctx, w, h, clip.captionLayers, null, accent, "", {}, { skipBackground: true, skipStamp: true, activeWordIndex });
  return canvasToPngBlob(canvas);
}

// One static PNG for a plain caption (unchanged from before); for a
// karaoke caption, one PNG PER WORD (each showing that word boxed in the
// accent colour) plus the [{start,end}] window each frame is visible
// for — backend/app/api/story.py chains them as timed ffmpeg overlays so
// the exported video actually shows the same word-by-word highlight the
// live preview does, not just a static caption.
async function buildCaptionFrames(clip, w, h, accent) {
  const caption = clip.captionLayers?.[0];
  const timings = caption?.karaoke ? wordTimings(caption.text, clipLengthSec(clip)).slice(0, MAX_KARAOKE_WORDS) : [];

  if (!timings.length) {
    return { blobs: [await renderCaptionFrame(clip, w, h, accent, null)], timings: [{ start: 0, end: 99999 }] };
  }
  const blobs = [];
  for (let i = 0; i < timings.length; i++) blobs.push(await renderCaptionFrame(clip, w, h, accent, i));
  return { blobs, timings: timings.map((t) => ({ start: t.start, end: t.end === Infinity ? 99999 : t.end })) };
}

async function buildFormData(clips, platformId, outputFormat, accent) {
  const { w, h } = PLATFORMS[platformId];
  const formData = new FormData();
  const clipSpecs = [];
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    formData.append("clips", clip.file, clip.file.name);
    const hasCaption = clip.captionLayers?.length > 0;
    const narrationText = (clip.narrationText || "").trim() || undefined;
    clipSpecs.push(
      clip.kind === "image"
        ? { kind: "image", duration_sec: clip.durationSec, has_caption: hasCaption, narration_text: narrationText }
        : {
          kind: "video", trim_in: clip.trimIn, trim_out: clip.trimOut, has_caption: hasCaption, narration_text: narrationText,
          keep_original_audio: clip.keepOriginalAudio !== false,
        },
    );
    if (narrationText) {
      Object.assign(clipSpecs[clipSpecs.length - 1], {
        narration_voice: clip.narrationVoice || "neutral",
        narration_rate: clip.narrationRate || 165,
        narration_pitch: clip.narrationPitch ?? 50,
        narration_fit: clip.narrationFit || "extend",
        narration_volume: clip.narrationVolume ?? 1,
        narration_muted: !!clip.narrationMuted,
      });
    }
    if (hasCaption) {
      const { blobs, timings } = await buildCaptionFrames(clip, w, h, accent);
      if (blobs.length === 1) {
        formData.append(`caption_${i}`, blobs[0], `caption_${i}.png`);
      } else {
        formData.append(`caption_frames_${i}`, JSON.stringify(timings));
        blobs.forEach((blob, j) => formData.append(`caption_${i}_${j}`, blob, `caption_${i}_${j}.png`));
      }
    }
  }
  formData.append("spec", JSON.stringify({ platform_id: platformId, output_format: outputFormat, clips: clipSpecs }));
  return formData;
}

// Deliberately plain fetch, not apiRequest — apiRequest always parses the
// response as JSON, but a successful render here comes back as raw file
// bytes (or, with email_to set, a JSON success message) — two different
// shapes from the one endpoint depending on what was submitted.
async function submitRender(formData) {
  if (!BASE) {
    // Same check apiRequest (shared/api.js) does, and the same reason:
    // no silent localhost fallback, or every visitor's browser would try
    // ITS OWN localhost:5002, where nothing is listening.
    throw new Error("NEXT_PUBLIC_API_URL is not set — set it in Vercel → Project Settings → Environment Variables to the Render backend URL, then redeploy.");
  }
  const headers = { "X-Guest-Id": getGuestId() };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}/api/v1/brand/story/render`, { method: "POST", headers, body: formData });
  } catch {
    // fetch() itself throwing (as opposed to resolving with a non-2xx
    // status) means the request never got a response at all — most
    // likely this render (video encoding + voice-over synthesis, all
    // synchronous inside one request — see backend/app/api/story.py's
    // module docstring) ran long enough that Render's platform-level
    // proxy cut the connection before gunicorn's own --timeout 120 in
    // render.yaml even applied; a raw CORS/DNS failure is possible too,
    // but this is the one that scales with story length/narration and
    // wouldn't reproduce locally (no such proxy in front of a dev
    // server) — matching "works on localhost, fails in production."
    const err = new Error("The render didn't finish in time — try a shorter story, fewer clips, or without voice-over, and try again.");
    err.code = "STORY_RENDER_NETWORK_ERROR";
    throw err;
  }

  if (!res.ok) {
    let message = `Render failed (${res.status})`;
    try { message = (await res.json()).error || message; } catch { /* non-JSON error body */ }
    throw new Error(message);
  }
  return res;
}

export function ExportPanel({ clips, platformId, setPlatformId, outputFormat, setOutputFormat, accent }) {
  const [downloading, setDownloading] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState(() => {
    try { return localStorage.getItem(LAST_EMAIL_KEY) || ""; } catch { return ""; }
  });
  const [emailing, setEmailing] = useState(false);

  const totalDuration = clips.reduce((sum, c) => sum + clipLengthSec(c), 0);
  const gifTooLong = totalDuration > MAX_GIF_DURATION_SEC;

  const handleDownload = async () => {
    if (!clips.length) { toast.error("Add at least one clip first."); return; }
    setDownloading(true);
    try {
      const formData = await buildFormData(clips, platformId, outputFormat, accent);
      const res = await submitRender(formData);
      const blob = await res.blob();
      const ext = outputFormat === "gif" ? "gif" : "mp4";
      downloadBlob(blob, `noqeev-story-${platformId}.${ext}`);
      toast.success("Downloaded.");
    } catch (e) {
      toast.error(e.message || "Try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handleEmail = async () => {
    if (!EMAIL_RE.test(email.trim())) { toast.error("Invalid email."); return; }
    setEmailing(true);
    try {
      const formData = await buildFormData(clips, platformId, outputFormat, accent);
      formData.append("email_to", email.trim());
      const res = await submitRender(formData);
      const data = await res.json();
      try { localStorage.setItem(LAST_EMAIL_KEY, email.trim()); } catch { /* best-effort */ }
      toast.success(data.data?.message || `Sent to ${email.trim()}`);
      setEmailOpen(false);
    } catch (e) {
      toast.error(e.message || "Send failed.");
    } finally {
      setEmailing(false);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 rounded-xl border border-border bg-card p-4">
        <div>
          <p className="m-0 mb-2 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">Platform</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(PLATFORMS).map(([id, p]) => (
              <button key={id} type="button" onClick={() => setPlatformId(id)} aria-pressed={platformId === id} title={p.sub}
                className={`rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${platformId === id ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="m-0 mb-2 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">Format</p>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setOutputFormat("mp4")} aria-pressed={outputFormat === "mp4"}
              className={`rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${outputFormat === "mp4" ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
              MP4
            </button>
            <button
              type="button" onClick={() => !gifTooLong && setOutputFormat("gif")} aria-pressed={outputFormat === "gif"}
              disabled={gifTooLong} title={gifTooLong ? `GIF is limited to ${MAX_GIF_DURATION_SEC}s total` : undefined}
              className={`rounded-full border px-3 py-1.5 text-[11.5px] font-bold disabled:opacity-40 ${outputFormat === "gif" ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
              GIF
            </button>
          </div>
        </div>
      </div>

      {/* Download + Email as their own unwrapped row, not nested inside
          the settings card above — the exact same shape as Create's
          DownloadRow (PostComposer.js), so the three phone-view actions
          (Email, Download, Edit content & style) read as a matching set
          of buttons rather than two of them being tucked behind platform/
          format pills. */}
      <div className="flex gap-2">
        <Btn variant="gold" onClick={handleDownload} disabled={downloading || emailing || !clips.length} loading={downloading} className="flex-1">
          <Download className="size-4" /> {downloading ? "Rendering…" : "Download"}
        </Btn>
        <Btn small variant="ghost" onClick={() => setEmailOpen(true)} disabled={downloading || emailing || !clips.length} aria-label="Email this">
          <Mail className="size-4" />
        </Btn>
      </div>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent showCloseButton className="w-full max-w-[380px] gap-0 p-0 sm:max-w-[380px]">
          <div className="p-5">
            <p className="m-0 mb-3 flex items-center gap-2 text-[14px] font-bold text-foreground">
              <Mail className="size-4 text-primary" /> Email
            </p>
            <Input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" className="h-11 rounded-[10px]" autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleEmail(); }}
            />
            <Btn variant="gold" className="mt-3 w-full" onClick={handleEmail} disabled={emailing} loading={emailing}>
              {emailing ? <Loader2 className="size-4 animate-spin" /> : "Send"}
            </Btn>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
