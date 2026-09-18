"use client";
/**
 * StoryTool.js — the branding workspace's phase-one story assembly tool,
 * built on top of ComposerTool's own caption-styling machinery: clips
 * (frontend/app/brand/story/clipModel.js + ClipTimeline.js) and preview
 * (PreviewPlayer.js) are the same pure client-side pieces the earlier
 * server-rendered Story tool used, reused verbatim — nothing here talks
 * to a server until the final export upload. A clip's caption is just a
 * text layer (LayerPanel.js, AiSuggestPanel.js — identical to a post's
 * layer), styled and AI-drafted the exact same way.
 *
 * What's deliberately NOT here, because phase one's whole point is "no
 * task queue, no server render worker": no ffmpeg, no narration/TTS, no
 * multi-track audio, no transitions, no speed changes. Export is
 * straight canvas-capture + MediaRecorder/gif.js (storyClientExport.js),
 * entirely in this tab, then a best-effort upload so the result is
 * persisted via the storage interface — never blocking the download the
 * person already has in hand.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Download, Film, ImageIcon, Gauge } from "lucide-react";
import { Btn } from "@/components/premium/guest/components/primitives";
import { ClipTimeline } from "@/app/brand/story/ClipTimeline";
import { PreviewPlayer } from "@/app/brand/story/PreviewPlayer";
import { LayerPanel } from "@/app/brand/LayerPanel";
import { AiSuggestPanel } from "@/app/brand/AiSuggestPanel";
import { releaseClip, clipLengthSec } from "@/app/brand/story/clipModel";
import { makeTextLayer, DEFAULT_ACCENT, PLATFORMS } from "@/app/brand/postTemplates";
import { downloadBlob } from "@/app/brand/assetKit";
import { recordWebm, recordGif } from "./storyClientExport";
import { workspaceFetch } from "./workspaceApi";

function scoreColor(score) {
  if (score >= 85) return "text-emerald-400 border-emerald-400/30 bg-emerald-400/10";
  if (score >= 60) return "text-amber-400 border-amber-400/30 bg-amber-400/10";
  return "text-red-400 border-red-400/30 bg-red-400/10";
}

export function StoryTool({ token, accent = DEFAULT_ACCENT }) {
  const [clips, setClips] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [platformId, setPlatformId] = useState("story");
  const [exporting, setExporting] = useState(null); // "webm" | "gif" | null
  const [progress, setProgress] = useState(0);
  const [quality, setQuality] = useState(null); // { score, summary, issues } | null
  const [checkingQuality, setCheckingQuality] = useState(false);
  const [seekRequest, setSeekRequest] = useState(null); // { time, nonce } — jumps the preview to an issue's timestamp

  const platform = PLATFORMS[platformId];
  const selectedClip = selectedIndex != null ? clips[selectedIndex] : null;
  const caption = selectedClip?.captionLayers?.[0] || null;

  const addClips = (newOnes) => setClips((cs) => {
    const next = [...cs, ...(Array.isArray(newOnes) ? newOnes : [newOnes])];
    if (selectedIndex == null) setSelectedIndex(cs.length);
    return next;
  });
  const removeClip = (i) => setClips((cs) => {
    releaseClip(cs[i]);
    const next = cs.filter((_, idx) => idx !== i);
    setSelectedIndex((sel) => (sel == null ? null : sel === i ? null : sel > i ? sel - 1 : sel));
    return next;
  });
  const reorder = (from, to) => setClips((cs) => {
    const next = [...cs];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setSelectedIndex((sel) => (sel === from ? to : sel));
    return next;
  });
  const updateClip = (i, patch) => setClips((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const setCaption = (nextLayer) => {
    if (selectedIndex == null) return;
    updateClip(selectedIndex, { captionLayers: nextLayer ? [nextLayer] : [] });
  };
  const addCaption = () => setCaption(makeTextLayer({ text: "Your caption", sizeFrac: 0.045, y: 0.82, highlight: true }));
  const applySuggestion = (data) => setCaption({ ...(caption || makeTextLayer({ sizeFrac: 0.045, y: 0.82, highlight: true })), text: data.headline || data.subtext || "" });

  const exportFilename = (ext) => `noqeev-story-${Date.now()}.${ext}`;

  const persistExport = (blob, ext) => {
    const formData = new FormData();
    const filename = exportFilename(ext);
    formData.append("file", blob, filename);
    formData.append("filename", filename);
    formData.append("kind", "story_export");
    return workspaceFetch(token, "/api/v1/workspace/compose/export", { method: "POST", body: formData }).catch(() => {});
  };

  const runQualityCheck = async () => {
    setCheckingQuality(true);
    try {
      const payload = { clips: clips.map((c) => ({ duration: clipLengthSec(c), caption_text: c.captionLayers?.[0]?.text || "" })) };
      const data = await workspaceFetch(token, "/api/v1/workspace/story/quality-check", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      setQuality(data);
    } catch {
      // Advisory only — a failed check just means no report shows, never blocks the export the person already has.
    } finally {
      setCheckingQuality(false);
    }
  };

  const runExport = async (format) => {
    if (!clips.length) { toast.error("Add at least one clip first."); return; }
    setExporting(format);
    setProgress(0);
    setQuality(null);
    try {
      const blob = format === "webm"
        ? await recordWebm(clips, platform, accent, { onProgress: setProgress })
        : await recordGif(clips, platform, accent, { onProgress: setProgress });
      downloadBlob(blob, exportFilename(format === "webm" ? "webm" : "gif"));
      persistExport(blob, format === "webm" ? "webm" : "gif");
      toast.success(`${format === "webm" ? "Video" : "GIF"} ready.`);
      runQualityCheck(); // advisory, never blocks the download that already happened
    } catch (e) {
      toast.error(e.message || "Export failed — try again.");
    } finally {
      setExporting(null);
      setProgress(0);
    }
  };

  const seekToIssue = (timestamp) => setSeekRequest({ time: timestamp, nonce: Date.now() });

  return (
    <div className="grid gap-5 sm:grid-cols-[1fr_320px]">
      <div className="flex min-w-0 w-full flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {Object.entries(PLATFORMS).map(([id, r]) => (
            <button key={id} type="button" onClick={() => setPlatformId(id)} aria-pressed={platformId === id} title={r.sub}
              className={`rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${platformId === id ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
              {r.label}
            </button>
          ))}
        </div>
        <PreviewPlayer
          clips={clips} platform={platform} accent={accent} selectedIndex={selectedIndex}
          onCaptionLive={setCaption} onCaptionCommit={setCaption} seekRequest={seekRequest}
        />
        <div className="flex w-full gap-2">
          <Btn variant="gold" className="flex-1" onClick={() => runExport("webm")} disabled={!!exporting || !clips.length} loading={exporting === "webm"}>
            <Film className="size-4" /> {exporting === "webm" ? `Rendering… ${progress.toFixed(1)}s` : "Export video (WebM)"}
          </Btn>
          <Btn variant="ghost" className="flex-1" onClick={() => runExport("gif")} disabled={!!exporting || !clips.length} loading={exporting === "gif"}>
            <ImageIcon className="size-4" /> {exporting === "gif" ? `Rendering… ${progress.toFixed(1)}s` : "Export GIF"}
          </Btn>
        </div>
        <p className="m-0 text-center text-[11px] text-muted-foreground">
          Rendered right here in your browser — short clips, straight cuts, no sound.
        </p>

        {checkingQuality && (
          <p className="m-0 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Checking pacing…
          </p>
        )}

        {quality && (
          <div className="w-full rounded-xl border border-border bg-background p-3">
            <div className="mb-2 flex items-center gap-2">
              <Gauge className="size-3.5 text-muted-foreground" />
              <span className={`rounded-full border px-2 py-0.5 font-mono text-[11px] font-bold ${scoreColor(quality.score)}`}>{quality.score}/100</span>
              <span className="text-[11.5px] text-muted-foreground">{quality.summary}</span>
            </div>
            {quality.issues?.length > 0 && (
              <div className="grid gap-1">
                {quality.issues.map((issue, i) => (
                  <button key={i} type="button" onClick={() => seekToIssue(issue.timestamp)}
                    className="flex items-start gap-2 rounded-lg border border-transparent p-1.5 text-left hover:border-border hover:bg-card">
                    <span className="mt-0.5 shrink-0 font-mono text-[10.5px] text-primary">{issue.timestamp.toFixed(1)}s</span>
                    <span className="text-[11.5px] text-muted-foreground">{issue.message}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4">
        <ClipTimeline
          clips={clips} selectedIndex={selectedIndex} onSelect={setSelectedIndex}
          onAdd={addClips} onRemove={removeClip} onReorder={reorder} onUpdateClip={updateClip}
        />

        {selectedClip && (
          <>
            <AiSuggestPanel onSuggestion={applySuggestion} />
            {caption ? (
              <LayerPanel
                layer={caption} onChange={setCaption} onDelete={() => setCaption(null)} accent={accent} showKaraoke
              />
            ) : (
              <Btn variant="ghost" onClick={addCaption}>
                <Sparkles className="size-3.5" /> Add caption
              </Btn>
            )}
          </>
        )}
      </div>
    </div>
  );
}
