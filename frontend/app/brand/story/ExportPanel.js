"use client";
/**
 * ExportPanel.js — platform + MP4/GIF choice, and the actual export flow:
 * render each captioned clip's transparent overlay PNG client-side (reuse
 * renderPost, skipBackground+skipStamp — see postTemplates.js), submit
 * everything to POST /api/v1/brand/story/runs, poll for completion, then
 * download. Nothing auto-publishes — export only happens when this
 * button is pressed, and the result is a local download the user reviews
 * themselves, never posted anywhere on their behalf.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Btn } from "@/components/premium/guest/components/primitives";
import { apiRequest } from "@/components/premium/shared/api";
import { getGuestId } from "@/lib/guestId";
import { PLATFORMS, renderPost } from "../postTemplates";
import { canvasToPngBlob, downloadBlob } from "../assetKit";
import { clipLengthSec } from "./clipModel";

const BASE = process.env.NEXT_PUBLIC_API_URL;
const MAX_GIF_DURATION_SEC = 10; // mirrors backend/app/api/story.py's cap
const POLL_MS = 1500;

async function buildCaptionPng(clip, w, h, accent) {
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  renderPost(ctx, w, h, clip.captionLayers, null, accent, "", {}, { skipBackground: true, skipStamp: true });
  return canvasToPngBlob(canvas);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function ExportPanel({ clips, platformId, setPlatformId, outputFormat, setOutputFormat, accent }) {
  const [exporting, setExporting] = useState(false);
  const [statusLabel, setStatusLabel] = useState("");

  const totalDuration = clips.reduce((sum, c) => sum + clipLengthSec(c), 0);
  const gifTooLong = totalDuration > MAX_GIF_DURATION_SEC;

  const runExport = async () => {
    if (!clips.length) { toast.error("Add at least one clip first."); return; }
    setExporting(true);
    setStatusLabel("Preparing…");
    try {
      const { w, h } = PLATFORMS[platformId];
      const formData = new FormData();

      const clipSpecs = [];
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        formData.append("clips", clip.file, clip.file.name);
        const hasCaption = clip.captionLayers?.length > 0;
        clipSpecs.push(
          clip.kind === "image"
            ? { kind: "image", duration_sec: clip.durationSec, has_caption: hasCaption }
            : { kind: "video", trim_in: clip.trimIn, trim_out: clip.trimOut, has_caption: hasCaption },
        );
        if (hasCaption) {
          const blob = await buildCaptionPng(clip, w, h, accent);
          formData.append(`caption_${i}`, blob, `caption_${i}.png`);
        }
      }
      formData.append("spec", JSON.stringify({ platform_id: platformId, output_format: outputFormat, clips: clipSpecs }));

      setStatusLabel("Uploading…");
      const run = await apiRequest("/api/v1/brand/story/runs", { method: "POST", body: formData });

      setStatusLabel("Rendering…");
      let finished = run;
      while (finished.status === "queued" || finished.status === "rendering") {
        await sleep(POLL_MS);
        finished = await apiRequest(`/api/v1/brand/story/runs/${run.id}`);
      }

      if (finished.status !== "done") {
        toast.error(finished.error_message || "Render failed.");
        return;
      }

      setStatusLabel("Downloading…");
      const res = await fetch(`${BASE}/api/v1/brand/story/runs/${run.id}/download`, {
        headers: { "X-Guest-Id": getGuestId() },
      });
      if (!res.ok) throw new Error("Couldn't download the result.");
      const blob = await res.blob();
      const ext = outputFormat === "gif" ? "gif" : "mp4";
      downloadBlob(blob, `noqeev-story-${platformId}.${ext}`);
      toast.success("Downloaded.");
    } catch (e) {
      toast.error(e.message || "Try again.");
    } finally {
      setExporting(false);
      setStatusLabel("");
    }
  };

  return (
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

      <Btn variant="gold" onClick={runExport} disabled={exporting || !clips.length} loading={exporting}>
        <Download className="size-4" /> {exporting ? (statusLabel || "Working…") : "Export"}
      </Btn>
    </div>
  );
}
