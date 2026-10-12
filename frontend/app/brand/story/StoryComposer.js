"use client";
/**
 * StoryComposer.js — /brand's "Story" tool: sequence clips, caption them
 * (reusing PostComposer's exact LayerPanel + AiSuggestPanel), preview the
 * whole thing, then export to MP4/GIF via the server render pipeline
 * (see backend/app/api/story.py). Mirrors PostComposer.js's own shape —
 * same ref-based commit-vs-live undo/redo pattern, just over a `clips`
 * array instead of `layers`.
 *
 * Each clip carries at most ONE caption text layer for phase one — no
 * per-layer selection UI within a caption, matching the "scoped tool, not
 * a full editor" brief. LayerPanel's onDuplicate/onFront/onBack are left
 * unset here (not no-ops — genuinely absent), so its header shows just
 * the label and Delete instead of three buttons with nothing to do.
 *
 * Controls are split into three compact tabs (Caption / Voice / Export)
 * instead of stacking AiSuggestPanel + the caption editor + the voice-
 * over field + ExportPanel all in one column — that stack ran taller
 * than a normal viewport, forcing a scroll just to reach Export. Only
 * one tab's content is on screen at a time now, each short enough to
 * fit without scrolling on its own.
 *
 * Layout mirrors GuestMode.js's own showSplit split: tablet/desktop has
 * real room for preview + controls side by side (unchanged grid below).
 * A phone doesn't, so the preview + clip timeline stay the permanent
 * base view and the tabbed controls move into a BottomSheet instead —
 * same "edit here, see it there, never scroll away from the preview to
 * change something" outcome GuestMode's StyleBottomSheet already gives
 * the resume editor, not a second design.
 *
 * The preview player itself (not the whole preview+timeline block) is
 * the sticky element, on both the phone and desktop/tablet layouts —
 * ClipTimeline can grow tall enough on its own (up to MAX_CLIPS=20
 * clips) that stickying the combined block would still let the actual
 * player scroll out of view underneath a long clip list.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { Plus, Undo2, Redo2, Pencil, Volume2, VolumeX, Copy, Captions, FilePlus2, ListVideo, Trash2, FileVideo, CheckCircle2, AlertTriangle, Play, Pause, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Btn } from "@/components/premium/guest/components/primitives";
import { BottomSheet } from "@/components/premium/shared/BottomSheet";
import { useViewport } from "@/lib/useViewport";
import { PLATFORMS, DEFAULT_ACCENT, makeTextLayer } from "../postTemplates";
import { LayerPanel } from "../LayerPanel";
import { AiSuggestPanel } from "../AiSuggestPanel";
import { ClipTimeline } from "./ClipTimeline";
import { PreviewPlayer } from "./PreviewPlayer";
import { ExportPanel } from "./ExportPanel";
import { releaseClip, loadClipFromFile, makeClip, clipLengthSec } from "./clipModel";
import { transcribeClip } from "./transcribe";
import { getNarrationPreview } from "./narrationPreview";
import { drawClipThumbnail } from "./clipThumbnail";
import {
  saveStoryDraft, loadStoryDraft, deleteStoryDraft, listStoryDrafts,
  getActiveStoryId, setActiveStoryId, newStoryId, migrateLegacyDraft,
} from "./draftStore";

const MAX_NARRATION_CHARS = 400; // mirrors backend/app/api/story.py's cap
// Module-scope, not React state — only resets on an actual page load, so
// the "picked up where you left off" toast fires once per visit to the
// site, not once per remount (switching /brand zones away from Story and
// back).
let hasShownStoryDraftToast = false;
const MIN_NARRATION_RATE = 80; // mirrors backend/app/api/story.py's MIN/MAX_NARRATION_RATE
const MAX_NARRATION_RATE = 320;
const VOICE_OPTIONS = ["neutral", "woman", "man"];
const FIT_OPTIONS = ["extend", "cut"];

// A friendly default name for a brand-new story — not required to be
// unique, the switcher also shows when it was last touched and how many
// clips it has, which is enough to tell same-day stories apart.
const makeStoryName = () => `Story — ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

// The plain-data subset of a clip that's actually worth persisting —
// object URLs and <img>/<video> elements don't survive a reload and get
// rebuilt fresh by hydrateClips below, not saved themselves.
const snapshotClip = (c) => ({
  id: c.id, kind: c.kind, file: c.file, naturalW: c.naturalW, naturalH: c.naturalH,
  naturalDurationSec: c.naturalDurationSec, durationSec: c.durationSec, trimIn: c.trimIn,
  trimOut: c.trimOut, captionLayers: c.captionLayers, narrationText: c.narrationText,
  narrationVoice: c.narrationVoice, narrationRate: c.narrationRate,
  narrationPitch: c.narrationPitch, narrationFit: c.narrationFit,
  narrationVolume: c.narrationVolume, narrationMuted: c.narrationMuted,
  keepOriginalAudio: c.keepOriginalAudio, originalAudioVolume: c.originalAudioVolume,
});

// Rebuilds real clip objects (object URL + <img>/<video> element, via
// the same loadClipFromFile a fresh upload goes through) from a saved
// draft's plain-data snapshot — shared by the initial-mount restore, My
// Stories switching, and reverting after a delete.
async function hydrateClips(savedClips) {
  return Promise.all((savedClips || []).map(async (saved) => {
    const loaded = await loadClipFromFile(saved.file);
    return {
      ...loaded, id: saved.id, durationSec: saved.durationSec, trimIn: saved.trimIn,
      trimOut: saved.trimOut, captionLayers: saved.captionLayers || [], narrationText: saved.narrationText || "",
      narrationVoice: saved.narrationVoice || "neutral", narrationRate: saved.narrationRate || 165,
      narrationPitch: saved.narrationPitch ?? 50, narrationFit: saved.narrationFit || "extend",
      narrationVolume: saved.narrationVolume ?? 1, narrationMuted: !!saved.narrationMuted,
      keepOriginalAudio: saved.keepOriginalAudio !== false, originalAudioVolume: saved.originalAudioVolume ?? 1,
    };
  }));
}

function relativeTime(ts, t) {
  if (!ts) return "";
  const diffMin = Math.round((Date.now() - ts) / 60000);
  if (diffMin < 1) return t("brandStory.justNow");
  if (diffMin < 60) return t("brandStory.minutesAgo", { n: diffMin });
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return t("brandStory.hoursAgo", { n: diffHr });
  return t("common.daysAgo", { n: Math.round(diffHr / 24) });
}

// Same 0-100 scale as the resume side's ATS score — a warning, never a
// gate: "Needs review" still downloads/emails exactly like "Ready to
// post" does. The verdict/score/issues themselves are computed server-
// side (backend/app/utils/video_quality.py) against the ACTUAL rendered
// file, not what the editor was told to do.
const SEVERITY_STYLE = {
  critical: "border-destructive/30 bg-destructive/[0.05] text-destructive",
  moderate: "border-warning/30 bg-warning/[0.06] text-warning",
  minor: "border-border bg-transparent text-muted-foreground",
};

function formatTimestamp(t) {
  const total = Math.max(0, Math.round(t));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Which clip a global (whole-story) timestamp falls in — the same
// cumulative-duration walk PreviewPlayer.js's own internal clipStarts
// does, just exposed here so clicking an issue can also select the
// right clip, not only seek the preview to the right second.
function clipIndexAtTime(clips, t) {
  let cursor = 0;
  for (let i = 0; i < clips.length; i++) {
    const len = clipLengthSec(clips[i]);
    if (t < cursor + len || i === clips.length - 1) return i;
    cursor += len;
  }
  return 0;
}

function QualityReportPanel({ report, onSeekTo }) {
  const { t } = useLanguage();
  if (!report) return null;
  const { score, verdict, issues } = report;
  const ready = verdict === "ready";
  const severityLabel = (s) => t(`brandStory.severity.${s}`) || s;
  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">{t("brandStory.qualityCheck")}</span>
        <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-bold ${ready ? "border-success/30 bg-success/[0.08] text-success" : "border-warning/30 bg-warning/[0.08] text-warning"}`}>
          {ready ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
          {score}/100 — {ready ? t("brandStory.readyToPost") : t("brandStory.needsReview")}
        </div>
      </div>
      {issues.length === 0 ? (
        <p className="m-0 text-[11.5px] text-muted-foreground">{t("brandStory.nothingToFlag")}</p>
      ) : (
        <div className="grid gap-1.5">
          {issues.map((issue, i) => (
            <button key={i} type="button" onClick={() => onSeekTo(issue.timestamp)}
              className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-left ${SEVERITY_STYLE[issue.severity] || SEVERITY_STYLE.minor}`}>
              <span className="mt-0.5 shrink-0 rounded-full border border-current/30 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase">
                {severityLabel(issue.severity)}
              </span>
              <span className="min-w-0 flex-1 text-[11.5px] leading-snug text-foreground">{issue.message}</span>
              <span className="shrink-0 font-mono text-[10.5px] font-bold">{formatTimestamp(issue.timestamp)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function VoiceOverField({ clip, onPatch, onApplyToAll }) {
  const { t } = useLanguage();
  const captionText = clip.captionLayers?.[0]?.text || "";
  const voice = clip.narrationVoice || "neutral";
  const rate = clip.narrationRate || 165;
  const pitch = clip.narrationPitch ?? 50;
  const fit = clip.narrationFit || "extend";
  const volume = clip.narrationVolume ?? 1;
  const muted = !!clip.narrationMuted;

  // Lets someone hear how each voice option actually sounds — reading
  // THIS clip's own typed script, at its own speed/tone, so the preview
  // matches what would really render — before committing to it, instead
  // of only finding out after switching narrationVoice and re-listening
  // to the whole clip. { voiceId, status } rather than two separate
  // booleans: only one voice can ever be mid-preview at a time (one
  // shared <audio> element below), so there's only ever one true state to
  // track, not "is neutral loading" AND "is woman loading" independently.
  const previewAudioRef = useRef(null);
  const [preview, setPreview] = useState({ voiceId: null, status: null }); // status: "loading" | "playing"

  useEffect(() => {
    const audio = new Audio();
    previewAudioRef.current = audio;
    const onEnded = () => setPreview({ voiceId: null, status: null });
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.pause();
      audio.removeEventListener("ended", onEnded);
      previewAudioRef.current = null;
    };
  }, []);

  // Switching to a different clip (or its script changing under a preview
  // that's already playing) shouldn't leave a stale preview quietly
  // playing on screen for a clip you've since moved on from.
  useEffect(() => {
    previewAudioRef.current?.pause();
    setPreview({ voiceId: null, status: null });
  }, [clip.id]);

  const previewVoice = async (voiceId) => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (preview.voiceId === voiceId) { // tap the same voice again — stop, don't restart
      audio.pause();
      audio.currentTime = 0;
      setPreview({ voiceId: null, status: null });
      return;
    }
    audio.pause();
    setPreview({ voiceId, status: "loading" });
    try {
      const entry = await getNarrationPreview({
        text: (clip.narrationText || "").trim() || t("brandStory.voicePreviewSampleText"),
        voice: voiceId, rate, pitch,
      });
      if (!entry) throw new Error("no preview entry");
      audio.src = entry.url;
      await audio.play();
      setPreview({ voiceId, status: "playing" });
    } catch {
      toast.error(t("brandStory.couldntPreviewVoice"));
      setPreview({ voiceId: null, status: null });
    }
  };

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">
          <Volume2 className="size-3.5" /> {t("brandStory.voiceOver")}
        </span>
        <div className="flex items-center gap-3">
          {captionText && (
            <button type="button" onClick={() => onPatch({ narrationText: captionText })} className="text-[11px] font-semibold text-primary">
              {t("brandStory.useCaptionText")}
            </button>
          )}
          {/* Silences without losing the typed script or any other
              setting here — flip it back on and everything (voice,
              speed, tone, volume) is exactly as it was. */}
          <button type="button" onClick={() => onPatch({ narrationMuted: !muted })} aria-pressed={muted} title={muted ? t("brandStory.unmute") : t("brandStory.mute")}
            className={`flex size-8 items-center justify-center rounded-full ${muted ? "bg-destructive/10 text-destructive" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
        </div>
      </div>
      <Textarea
        value={clip.narrationText || ""}
        onChange={(e) => onPatch({ narrationText: e.target.value.slice(0, MAX_NARRATION_CHARS) })}
        rows={2} placeholder={t("brandStory.narrationPlaceholder")}
        className="resize-none rounded-[10px] text-[13px]"
      />
      <p className="m-0 -mt-2 text-right text-[10.5px] text-muted-foreground/60">
        {(clip.narrationText || "").length}/{MAX_NARRATION_CHARS}
      </p>

      {/* Only for an uploaded video — an image never has its own sound.
          On by default: a talking-head or ambient clip's real audio is
          kept and mixed with any voice-over, not silently replaced by
          it. Independent of Mute above (that only affects the
          voice-over), so it's never dimmed alongside those controls. */}
      {clip.kind === "video" && (
        <div className="grid gap-2">
          <button type="button" onClick={() => onPatch({ keepOriginalAudio: clip.keepOriginalAudio === false })}
            aria-pressed={clip.keepOriginalAudio !== false}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-[11.5px] font-bold ${clip.keepOriginalAudio !== false ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
            {t("brandStory.keepOriginalSound")}
            <span className="font-mono text-[10px] font-normal">{clip.keepOriginalAudio !== false ? t("brandStory.on") : t("brandStory.off")}</span>
          </button>
          {/* Same 0-200% range and gain as the voice-over's own Volume
              slider — dimmed the same way while the toggle above is Off. */}
          <div className={clip.keepOriginalAudio === false ? "pointer-events-none opacity-40" : ""}>
            <label className="mb-1.5 block text-[11px] font-bold text-foreground">
              {t("brandStory.originalSoundVolume")} <span className="font-mono text-[9.5px] font-normal text-muted-foreground">{Math.round((clip.originalAudioVolume ?? 1) * 100)}%</span>
            </label>
            <input type="range" min="0" max="2" step="0.05" value={clip.originalAudioVolume ?? 1}
              onChange={(e) => onPatch({ originalAudioVolume: Number(e.target.value) })} className="w-full accent-primary" />
          </div>
        </div>
      )}

      {/* Dimmed and inert while muted — nothing here does anything
          audible right now, and greying it out says so at a glance
          instead of leaving every control looking live when it isn't. */}
      <div className={`grid gap-3 ${muted ? "pointer-events-none opacity-40" : ""}`}>
        <div>
          <p className="m-0 mb-1.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">{t("brandStory.voice")}</p>
          {/* Two separate hit targets per option, not one button — tapping
              the label SELECTS the voice for this clip (unchanged
              behavior); the small play icon PREVIEWS it without touching
              the selection, so trying out Woman or Man doesn't commit to
              either until you actually tap its label. */}
          <div className="flex flex-wrap gap-1.5">
            {VOICE_OPTIONS.map((id) => {
              const selected = voice === id;
              const isThis = preview.voiceId === id;
              const voiceLabel = t(`brandStory.voiceOption.${id}`);
              return (
                <div key={id}
                  className={`flex items-center gap-0.5 rounded-full border py-1 pr-1 pl-3 ${selected ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
                  <button type="button" onClick={() => onPatch({ narrationVoice: id })} aria-pressed={selected} className="text-[11.5px] font-bold">
                    {voiceLabel}
                  </button>
                  <button type="button" onClick={() => previewVoice(id)}
                    title={isThis && preview.status === "playing" ? t("brandStory.stopPreviewingVoice", { voice: voiceLabel.toLowerCase() }) : t("brandStory.previewVoice", { voice: voiceLabel.toLowerCase() })}
                    className="flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-white/10">
                    {isThis && preview.status === "loading" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : isThis && preview.status === "playing" ? (
                      <Pause className="size-3 fill-current" />
                    ) : (
                      <Play className="size-3 fill-current" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-foreground">
              {t("brandStory.speed")} <span className="block font-mono text-[9.5px] font-normal text-muted-foreground">{rate <= 130 ? t("brandStory.slow") : rate >= 210 ? t("brandStory.fast") : t("brandStory.normal")}</span>
            </label>
            <input type="range" min={MIN_NARRATION_RATE} max={MAX_NARRATION_RATE} step="5" value={rate}
              onChange={(e) => onPatch({ narrationRate: Number(e.target.value) })} className="w-full accent-primary" />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-foreground">
              {t("brandStory.tone")} <span className="block font-mono text-[9.5px] font-normal text-muted-foreground">{pitch <= 33 ? t("brandStory.low") : pitch >= 66 ? t("brandStory.high") : t("brandStory.mid")}</span>
            </label>
            <input type="range" min="0" max="99" step="1" value={pitch}
              onChange={(e) => onPatch({ narrationPitch: Number(e.target.value) })} className="w-full accent-primary" />
          </div>
          <div>
            {/* "Voice volume", not bare "Volume" — this card already has
                a second, unrelated volume slider above (the clip's own
                original sound), and two sliders both just labeled
                "Volume" read as duplicates of each other at a glance
                instead of the two genuinely different things they are. */}
            <label className="mb-1.5 block text-[11px] font-bold text-foreground">
              {t("brandStory.voiceVolume")} <span className="block font-mono text-[9.5px] font-normal text-muted-foreground">{Math.round(volume * 100)}%</span>
            </label>
            <input type="range" min="0" max="2" step="0.05" value={volume}
              onChange={(e) => onPatch({ narrationVolume: Number(e.target.value) })} className="w-full accent-primary" />
          </div>
        </div>

        <div>
          <p className="m-0 mb-1.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">{t("brandStory.ifItRunsLong")}</p>
          <div className="flex flex-wrap gap-1.5">
            {FIT_OPTIONS.map((id) => (
              <button key={id} type="button" onClick={() => onPatch({ narrationFit: id })} aria-pressed={fit === id} title={t(`brandStory.fitHint.${id}`)}
                className={`rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${fit === id ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
                {t(`brandStory.fitLabel.${id}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Voice/speed/tone/volume/fit only — narrationText is each clip's own
          spoken words, copying that would overwrite every clip's script
          with this one's. Only shown once there's more than one clip to
          actually apply it to. */}
      {onApplyToAll && (
        <button type="button" onClick={onApplyToAll}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-[11.5px] font-bold text-muted-foreground hover:border-primary/30 hover:text-primary">
          <Copy className="size-3.5" /> {t("brandStory.applyVoiceSettingsToAll")}
        </button>
      )}
    </div>
  );
}

// Only meaningful for an uploaded video (an image has no audio to
// transcribe) — turns what's actually SAID in the clip into its caption,
// instead of starting from a blank textarea and retyping it by ear. A
// manual button, not automatic-on-upload: transcription is a real network
// call (Groq's hosted Whisper — see backend/app/api/story.py), and
// silently firing one per upload isn't something to spend without asking.
function TranscribeButton({ clip, onTranscribed }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      const result = await transcribeClip(clip.file);
      if (!result.text) {
        toast.error(t("brandStory.noSpeechDetected"));
        return;
      }
      onTranscribed(result);
      toast.success(t("brandStory.captionFilledFromAudio"));
    } catch {
      toast.error(t("brandStory.transcriptionFailed"));
    } finally {
      setLoading(false);
    }
  };
  return (
    <Btn small variant="ghost" onClick={run} disabled={loading} loading={loading}>
      <Captions className="size-3.5" /> {t("brandStory.transcribeThisClip")}
    </Btn>
  );
}

// Lets someone move between clips FROM INSIDE the Edit sheet — without
// this, captioning several clips in a row meant Done -> tap the next clip
// in the timeline (behind the sheet) -> reopen Edit, every single time.
// Lives at the top of the sheet, above the Caption/Voice tabs, so it
// applies regardless of which tab is open. The thumbnail (same
// drawClipThumbnail ClipTimeline.js's own ClipThumb and PreviewPlayer.js's
// FilmstripThumb already use) answers "which clip am I even on" at a
// glance — with several similar-looking clips, "Clip 3 of 6" alone isn't
// always enough to be sure.
function EditClipNav({ clips, selectedIndex, onSelect }) {
  const { t } = useLanguage();
  const index = selectedIndex ?? 0;
  const clip = clips[index];
  const canvasRef = useRef(null);
  useEffect(() => { if (clip) drawClipThumbnail(clip, canvasRef.current, 72, 72); }, [clip]);

  if (!clips.length) return null;
  const navBtnClass = "flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground disabled:opacity-30 enabled:hover:bg-muted enabled:hover:text-foreground";
  return (
    <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-card p-2">
      <button type="button" onClick={() => onSelect(Math.max(0, index - 1))} disabled={index <= 0} title={t("brandStory.previousClip")} className={navBtnClass}>
        <ChevronLeft className="size-4" />
      </button>
      <canvas ref={canvasRef} className="size-9 shrink-0 rounded-md bg-muted object-cover" />
      <span className="min-w-0 flex-1 text-center text-[12px] font-bold text-foreground">
        {t("brandStory.clipNumber", { n: index + 1 })} <span className="font-normal text-muted-foreground">{t("brandStory.ofTotalClips", { n: clips.length })}</span>
      </span>
      <button type="button" onClick={() => onSelect(Math.min(clips.length - 1, index + 1))} disabled={index >= clips.length - 1} title={t("brandStory.nextClip")} className={navBtnClass}>
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

export function StoryComposer({ accent = DEFAULT_ACCENT }) {
  const { t } = useLanguage();
  const { isPhone } = useViewport();
  const [clips, setClipsRaw] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [platformId, setPlatformId] = useState("story");
  const [outputFormat, setOutputFormat] = useState("mp4");
  // "cut" (straight concat, unchanged default) or "fade" (a short
  // crossfade at every clip boundary — see backend/app/api/story.py's
  // _crossfade_join for how "smooth" actually gets built).
  const [transition, setTransition] = useState("cut");
  const [historyTick, setHistoryTick] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Whether a clip row's delete icon is currently swiped open
  // (ClipTimeline.js) — the floating Edit button below hides while this
  // is true, since it's fixed at a constant screen position a clip row
  // can scroll directly underneath, blocking the exact icon a swipe just
  // revealed. See openEditSheet's own comment for the same class of
  // problem this session already fixed for the sheet's own height.
  const [clipSwipeOpen, setClipSwipeOpen] = useState(false);
  // How tall the Edit sheet is allowed to be, measured fresh every time it
  // opens (see openEditSheet below) — null until then, which falls back to
  // BottomSheet's own default cap.
  const [sheetMaxHeight, setSheetMaxHeight] = useState(null);
  const previewBlockRef = useRef(null);
  const [controlTab, setControlTab] = useState("caption");
  // Which saved draft (draftStore.js) is currently open, and its own
  // display name — null until the mount effect below resolves which
  // story should be active. storiesOpen/storiesList back the "My
  // Stories" switcher sheet; switching is a separate concept from
  // sheetOpen (Caption/Voice editing) above.
  const [storyId, setStoryId] = useState(null);
  const [storyName, setStoryName] = useState(null);
  const [storiesOpen, setStoriesOpen] = useState(false);
  const [storiesList, setStoriesList] = useState([]);
  // The automated post-render quality check (backend/app/utils/
  // video_quality.py) and the "jump the preview to this exact second"
  // request an issue's timestamp triggers — see QualityReportPanel above.
  const [qualityReport, setQualityReport] = useState(null);
  const [seekRequest, setSeekRequest] = useState(null);

  const historyRef = useRef([[]]);
  const historyIndexRef = useRef(0);

  const commitClips = (updater) => {
    setClipsRaw((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      historyRef.current.push(next);
      if (historyRef.current.length > 50) historyRef.current.shift();
      historyIndexRef.current = historyRef.current.length - 1;
      setHistoryTick((t) => t + 1);
      return next;
    });
  };
  const setClips = commitClips;

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    setClipsRaw(historyRef.current[historyIndexRef.current]);
    setHistoryTick((t) => t + 1);
  }, []);
  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    setClipsRaw(historyRef.current[historyIndexRef.current]);
    setHistoryTick((t) => t + 1);
  }, []);
  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  // A quality report describes a SPECIFIC rendered file — if the story
  // gets edited after seeing one (a caption fixed, a clip reordered),
  // the old report no longer describes what's actually there anymore
  // and shouldn't keep being shown as if it still does. Doesn't fire
  // just from setQualityReport itself (that doesn't touch clips), only
  // from an actual edit.
  useEffect(() => { setQualityReport(null); }, [clips]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  // Clips carry object URLs that must be revoked eventually — release
  // every one still held when the tool itself unmounts.
  useEffect(() => () => { clips.forEach(releaseClip); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Which draft is active, resolved once on mount — a refresh (or just
  // coming back later) used to lose every clip, caption, and voice-over
  // with nothing to show for it. draftStore.js keeps the actual uploaded
  // File objects in IndexedDB (not just JSON), so hydrateClips rebuilds
  // the same clip elements loadClipFromFile would from a fresh upload —
  // object URLs and <img>/<video> elements don't survive a reload
  // themselves, everything else about the clip does. First-ever visit
  // (or an old pre-multi-draft single slot) gets a real id via
  // migrateLegacyDraft/newStoryId instead of staying storyId === null.
  const restoredRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let id = getActiveStoryId();
      if (!id) {
        id = (await migrateLegacyDraft()) || newStoryId();
        setActiveStoryId(id);
      }
      if (cancelled) return;
      setStoryId(id);

      const draft = await loadStoryDraft(id);
      if (cancelled) return;
      setStoryName(draft?.name || makeStoryName());
      if (!draft?.clips?.length) { restoredRef.current = true; return; }
      try {
        const restored = await hydrateClips(draft.clips);
        if (cancelled) return;
        setClipsRaw(restored);
        historyRef.current = [restored];
        historyIndexRef.current = 0;
        setHistoryTick((t) => t + 1);
        setSelectedIndex(0);
        if (draft.platformId) setPlatformId(draft.platformId);
        if (draft.outputFormat) setOutputFormat(draft.outputFormat);
        if (draft.transition) setTransition(draft.transition);
        // Restoring itself has to run every mount — switching to another
        // /brand zone and back unmounts this component (page.js only
        // renders it while zone === "story"), wiping its React state, so
        // re-loading the draft is what makes coming straight back to
        // Story still show your clips. The toast is a one-time "in case
        // you just refreshed" notice, though — showing it on every single
        // tab switch back to Story was the actual bug (10 visits, 10
        // toasts). hasShownStoryDraftToast is a plain module variable,
        // not React state, so it only resets on an actual page load.
        if (!hasShownStoryDraftToast) {
          toast.success(t(restored.length === 1 ? "brandStory.restoredOne" : "brandStory.restoredOther", { n: restored.length }));
          hasShownStoryDraftToast = true;
        }
      } catch {
        // A corrupt/unreadable draft is discarded, not shown as an error —
        // this is a convenience restore, never something that should block
        // starting fresh.
      } finally {
        restoredRef.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosaves after every settled change (debounced so a dragged slider
  // or fast typing doesn't write on every intermediate value) — not on
  // an explicit "save" action, because losing progress by forgetting to
  // press one is exactly the failure this exists to prevent. Skipped
  // until the restore effect above has resolved storyId, so a
  // still-loading draft is never overwritten with the empty state a
  // fresh mount starts from, and saved under THIS story's own id — not
  // a single fixed slot — so switching away never clobbers another
  // draft's save.
  useEffect(() => {
    if (!restoredRef.current || !storyId) return;
    const timer = setTimeout(() => {
      saveStoryDraft(storyId, { name: storyName, platformId, outputFormat, transition, clips: clips.map(snapshotClip) });
    }, 600);
    return () => clearTimeout(timer);
  }, [clips, platformId, outputFormat, transition, storyId, storyName]);

  // Resets every piece of story-specific state to blank, without
  // touching storage — the shared tail of New Story, switching to
  // another draft, and deleting the one currently open.
  const resetComposerState = (nextId, nextName, restoredClips = [], nextPlatformId = "story", nextOutputFormat = "mp4", nextTransition = "cut") => {
    clips.forEach(releaseClip);
    setActiveStoryId(nextId);
    setStoryId(nextId);
    setStoryName(nextName);
    setClipsRaw(restoredClips);
    historyRef.current = [restoredClips];
    historyIndexRef.current = 0;
    setHistoryTick((t) => t + 1);
    setSelectedIndex(restoredClips.length ? 0 : null);
    setPlatformId(nextPlatformId);
    setOutputFormat(nextOutputFormat);
    setTransition(nextTransition);
  };

  // Saves whatever's open right now under its OWN id immediately (not
  // waiting on the debounced autosave above) — used right before
  // switching away from it, so nothing from it can be lost in the gap.
  const persistCurrentStory = () => {
    if (!storyId) return Promise.resolve();
    return saveStoryDraft(storyId, { name: storyName, platformId, outputFormat, transition, clips: clips.map(snapshotClip) });
  };

  const startNewStory = async () => {
    await persistCurrentStory();
    resetComposerState(newStoryId(), makeStoryName());
    toast.success(t("brandStory.startedNewStory"));
  };

  const refreshStoriesList = async () => setStoriesList(await listStoryDrafts());

  const openStoriesPanel = async () => {
    await refreshStoriesList();
    setStoriesOpen(true);
  };

  const switchToStory = async (id) => {
    if (id === storyId) { setStoriesOpen(false); return; }
    await persistCurrentStory();
    const draft = await loadStoryDraft(id);
    const name = draft?.name || t("brandStory.untitledStory");
    const restored = draft?.clips?.length ? await hydrateClips(draft.clips) : [];
    resetComposerState(id, name, restored, draft?.platformId || "story", draft?.outputFormat || "mp4", draft?.transition || "cut");
    setStoriesOpen(false);
    toast.success(t("brandStory.switchedToStory", { name }));
  };

  const deleteStory = async (id, e) => {
    e.stopPropagation();
    await deleteStoryDraft(id);
    if (id === storyId) resetComposerState(newStoryId(), makeStoryName());
    await refreshStoriesList();
    toast.success(t("brandStory.deleted"));
  };

  const handleAdd = (clip) => {
    setClips((cs) => [...cs, clip]);
    setSelectedIndex(clips.length); // select the newly-added clip (index before this add)
  };
  // Uploading lives here, not in ClipTimeline.js — the trigger sits in
  // this component's own top header now (beside My Stories), same
  // reasoning as the Edit button: the thing you reach for belongs at the
  // top, not buried past the preview where you'd have to scroll to find
  // it. handleFiles itself is unchanged from what used to live in
  // ClipTimeline.js, just relocated alongside its own trigger.
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
          toast.error(t("brandStory.notImageOrVideo", { name: file.name }));
          continue;
        }
        const loaded = await loadClipFromFile(file);
        handleAdd(makeClip(loaded));
      }
    } catch {
      toast.error(t("brandStory.couldntReadFile"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  const handleRemove = (index) => {
    const removed = clips[index];
    setClips((cs) => cs.filter((_, i) => i !== index));
    releaseClip(removed);
    setSelectedIndex(null);
  };
  const handleReorder = (from, to) => {
    setClips((cs) => {
      const next = [...cs];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setSelectedIndex(to);
  };
  const handleUpdateClip = (index, patch) => {
    setClips((cs) => cs.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const selectedClip = selectedIndex != null ? clips[selectedIndex] : null;
  const selectedCaption = selectedClip?.captionLayers?.[0] || null;

  const addCaption = () => {
    if (selectedIndex == null) return;
    const layer = makeTextLayer({ text: t("brandStory.yourCaption") });
    setClips((cs) => cs.map((c, i) => (i === selectedIndex ? { ...c, captionLayers: [layer] } : c)));
  };
  const updateCaption = (nextLayer) => {
    if (selectedIndex == null) return;
    setClips((cs) => cs.map((c, i) => (i === selectedIndex ? { ...c, captionLayers: [nextLayer] } : c)));
  };
  // Live position updates during an active canvas drag — updates what's
  // on screen without pushing a new undo entry per pointermove; the
  // drag's one history entry is committed at pointer-up via updateCaption
  // (see PreviewPlayer.js's onPointerUp), same split PostComposer.js's
  // own setLayersLive/commitLayers already uses for its layer drags.
  const updateCaptionLive = (nextLayer) => {
    if (selectedIndex == null) return;
    setClipsRaw((cs) => cs.map((c, i) => (i === selectedIndex ? { ...c, captionLayers: [nextLayer] } : c)));
  };
  const removeCaption = () => {
    if (selectedIndex == null) return;
    setClips((cs) => cs.map((c, i) => (i === selectedIndex ? { ...c, captionLayers: [] } : c)));
  };
  const applyCaptionSuggestion = (data) => {
    if (selectedIndex == null) { toast.error(t("brandStory.selectClipFirst")); return; }
    const text = data.headline || data.subtext || data.eyebrow || "";
    if (!text) return;
    const layer = makeTextLayer({ text });
    setClips((cs) => cs.map((c, i) => (i === selectedIndex ? { ...c, captionLayers: [layer] } : c)));
  };
  // Not narrationText — narration is TTS reading typed text aloud, and
  // the clip's own original voice is already kept in the render (see
  // backend/app/api/story.py's keep_original_audio) — layering a
  // synthetic voice reading back what the real speaker just said would
  // just be two voices saying the same thing at once.
  const applyTranscript = (result) => {
    if (selectedIndex == null) return;
    const layer = makeTextLayer({ text: result.text });
    setClips((cs) => cs.map((c, i) => (i === selectedIndex ? { ...c, captionLayers: [layer] } : c)));
  };
  const updateNarration = (patch) => {
    if (selectedIndex == null) return;
    handleUpdateClip(selectedIndex, patch);
  };
  // A quality-report issue is one click from here to actually looking at
  // it — select the clip it's in (so the caption/voice controls line up
  // with it too, not just the preview frame) and seek the preview
  // straight to that exact second.
  const seekPreviewTo = (t) => {
    setSelectedIndex(clipIndexAtTime(clips, t));
    setSeekRequest({ time: t, nonce: Date.now() });
  };
  // Opens the Edit sheet sized to whatever room is ACTUALLY left below the
  // preview, measured live, instead of trusting BottomSheet's own default
  // 64vh cap to happen to clear it — that default was tuned against Guest
  // Mode's shorter preview, and Story's own (taller, ~38vh) preview plus
  // its header rows leaves less than 36vh of screen below it. rect.bottom
  // is viewport-relative, so + window.scrollY turns it into a fixed
  // document position — correct regardless of scroll position at the
  // moment this is called, no need to wait for the scroll-to-top below to
  // actually finish animating before computing it. Floors at 280px so an
  // unusually tall preview on a short device never squeezes the sheet
  // down to something too cramped to actually use.
  const openEditSheet = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    const rect = previewBlockRef.current?.getBoundingClientRect();
    if (rect) {
      const previewBottomInDocument = rect.bottom + window.scrollY;
      setSheetMaxHeight(Math.max(280, window.innerHeight - previewBottomInDocument - 12));
    }
    setSheetOpen(true);
  };
  // Voice/speed/tone/volume/fit only, not narrationText or narrationMuted
  // — the words spoken are per-clip content, and muting is a per-clip
  // decision (silencing clip 1 doesn't mean every other clip should go
  // silent too); "I picked man voice, fast, loud, cut to length" is the
  // STYLE choice someone reasonably wants consistent across every clip
  // without re-picking it clip by clip.
  const applyVoiceSettingsToAll = () => {
    if (selectedIndex == null) return;
    const src = clips[selectedIndex];
    setClips((cs) => cs.map((c) => ({
      ...c,
      narrationVoice: src.narrationVoice, narrationRate: src.narrationRate,
      narrationPitch: src.narrationPitch, narrationFit: src.narrationFit,
      narrationVolume: src.narrationVolume,
    })));
    toast.success(t("brandStory.appliedToAllClips", { n: clips.length }));
  };

  // Caption + Voice only — Export deliberately isn't a third tab here
  // anymore. Create keeps Download/Email as a separate, always-visible
  // action outside its own "Edit content & style" sheet (see
  // PostComposer.js's DownloadRow); Export belongs the same way, not
  // buried behind the same button as content/style editing.
  //
  // Plain JSX value, NOT a `() => (...)` component defined in here — that
  // was the actual bug behind "the caption input loses focus after every
  // character": a function declared inside this component's own body is a
  // brand-new function reference every render, so <ControlsPanel /> was a
  // different component TYPE to React on every keystroke, and it fully
  // unmounted/remounted the Tabs/Textarea underneath instead of just
  // re-rendering them — which drops focus and forces a re-click before
  // the next character. A plain JSX variable has no separate identity to
  // break; it's just part of this render, so React diffs it normally.
  const controlsPanel = (
    <Tabs value={controlTab} onValueChange={setControlTab} className="gap-3">
      <TabsList className="w-full">
        <TabsTrigger value="caption">{t("brandStory.captionTab")}</TabsTrigger>
        <TabsTrigger value="voice">{t("brandStory.voice")}</TabsTrigger>
      </TabsList>

      <TabsContent value="caption" className="grid gap-4">
        {selectedClip?.kind === "video" && (
          <TranscribeButton clip={selectedClip} onTranscribed={applyTranscript} />
        )}
        <AiSuggestPanel onSuggestion={applyCaptionSuggestion} />
        {selectedClip ? (
          selectedCaption ? (
            <LayerPanel layer={selectedCaption} onChange={updateCaption} onDelete={removeCaption} accent={accent} showKaraoke />
          ) : (
            <Btn variant="ghost" onClick={addCaption}>
              <Plus className="size-4" /> {t("brandStory.addCaptionToClip")}
            </Btn>
          )
        ) : (
          <p className="m-0 rounded-xl border border-dashed border-border p-4 text-center text-[11.5px] text-muted-foreground">
            {t("brandStory.selectClipToCaption")}
          </p>
        )}
      </TabsContent>

      <TabsContent value="voice">
        {selectedClip ? (
          <VoiceOverField clip={selectedClip} onPatch={updateNarration} onApplyToAll={clips.length > 1 ? applyVoiceSettingsToAll : null} />
        ) : (
          <p className="m-0 rounded-xl border border-dashed border-border p-4 text-center text-[11.5px] text-muted-foreground">
            {t("brandStory.selectClipToVoiceOver")}
          </p>
        )}
      </TabsContent>
    </Tabs>
  );

  const exportPanel = (
    <ExportPanel
      clips={clips} platformId={platformId} setPlatformId={setPlatformId}
      outputFormat={outputFormat} setOutputFormat={setOutputFormat}
      transition={transition} setTransition={setTransition} accent={accent}
      onQualityReport={setQualityReport}
    />
  );

  const qualityReportPanel = <QualityReportPanel report={qualityReport} onSeekTo={seekPreviewTo} />;

  // Just the player + its header — deliberately NOT bundled with
  // ClipTimeline in the same box. Create's own sticky canvas (see
  // PostComposer.js) is the direct grid child with nothing wrapping it;
  // nesting the sticky element one level inside a shared container with
  // the clip list was the actual bug here — this now matches that exact
  // shape, with ClipTimeline placed as its own row instead.
  //
  // Plain JSX value, not a component defined in here — same reasoning as
  // controlsPanel above.
  const preview = (
    <div ref={previewBlockRef} className="grid gap-2">
      <div className="flex items-center justify-between">
        <p className="m-0 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">{t("brandStory.preview")}</p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={undo} disabled={!canUndo} title={t("brandStory.undo")}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground disabled:opacity-30 enabled:hover:bg-muted enabled:hover:text-foreground">
            <Undo2 className="size-4" />
          </button>
          <button type="button" onClick={redo} disabled={!canRedo} title={t("brandStory.redo")}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground disabled:opacity-30 enabled:hover:bg-muted enabled:hover:text-foreground">
            <Redo2 className="size-4" />
          </button>
        </div>
      </div>
      <PreviewPlayer
        clips={clips} platform={PLATFORMS[platformId]} accent={accent} selectedIndex={selectedIndex}
        onCaptionLive={updateCaptionLive} onCaptionCommit={updateCaption} compact={isPhone}
        seekRequest={seekRequest}
      />
    </div>
  );

  const clipTimeline = (
    <ClipTimeline
      clips={clips} selectedIndex={selectedIndex} onSelect={setSelectedIndex}
      onRemove={handleRemove} onReorder={handleReorder} onUpdateClip={handleUpdateClip}
      onAnyOpenChange={setClipSwipeOpen}
    />
  );

  // This story's name + New Story/My Stories — the one thing that has
  // to sit above everything else regardless of phone/desktop layout, so
  // it's always reachable without first having to find or finish
  // whatever's currently open.
  const storyHeader = (
    <div className="flex items-center justify-between gap-2">
      <p className="m-0 min-w-0 truncate text-[13px] font-bold text-foreground">{storyName || t("brandStory.story")}</p>
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Add clip lives here now, not down by the clip list — easier to
            find/reach than scrolling past the preview to get to it.
            Starting it icon-only (matching PostComposer.js's own Edit
            button) still overflowed the header on a narrow phone with
            "My Stories" + "New" both full icon+label — confirmed live
            (header measured 367.77px wide against a 342px budget). "My
            Stories" is the more load-bearing action of the two (it's how
            you get back to a DIFFERENT story at all, vs. New which just
            starts a blank one), so New gives up its label instead. */}
        <button
          type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} title={t("brandStory.addClip")} aria-label={t("brandStory.addClip")}
          className="flex size-11 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground disabled:opacity-30 enabled:hover:bg-muted enabled:hover:text-foreground"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        </button>
        <input
          ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Btn small variant="ghost" onClick={openStoriesPanel}>
          <ListVideo className="size-3.5" /> {t("brandStory.myStories")}
        </Btn>
        <button
          type="button" onClick={startNewStory} title={t("brandStory.newStory")} aria-label={t("brandStory.newStory")}
          className="flex size-11 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground enabled:hover:bg-muted enabled:hover:text-foreground"
        >
          <FilePlus2 className="size-4" />
        </button>
      </div>
    </div>
  );

  const storiesPanel = (
    <BottomSheet open={storiesOpen} onClose={() => setStoriesOpen(false)} title={t("brandStory.myStories")}>
      <div className="grid gap-2 p-4">
        {storiesList.length === 0 ? (
          <p className="m-0 rounded-xl border border-dashed border-border p-4 text-center text-[11.5px] text-muted-foreground">
            {t("brandStory.noOtherSavedStories")}
          </p>
        ) : (
          storiesList.map((s) => (
            // A <div role="button">, not a real <button> — it wraps
            // another real <button> (Delete) below, and nesting
            // interactive elements inside a <button> is invalid HTML
            // that browsers "fix" unpredictably (the nested tag doesn't
            // reliably stay a distinct clickable target).
            <div key={s.id} role="button" tabIndex={0} onClick={() => switchToStory(s.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); switchToStory(s.id); } }}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-left ${s.id === storyId ? "border-primary/30 bg-primary/[0.04]" : "border-border bg-card"}`}>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <FileVideo className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-[13px] font-bold text-foreground">
                  {s.name || t("brandStory.untitledStory")}{s.id === storyId ? ` ${t("brandStory.current")}` : ""}
                </p>
                <p className="m-0 text-[11px] text-muted-foreground">
                  {t(s.clipCount === 1 ? "brandStory.clipCountOne" : "brandStory.clipCountOther", { n: s.clipCount })} · {relativeTime(s.updatedAt, t)}
                </p>
              </div>
              <button type="button" onClick={(e) => deleteStory(s.id, e)} title={t("common.delete")}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </BottomSheet>
  );

  if (isPhone) {
    return (
      <div className="grid gap-3">
        {storyHeader}
        {/* NOT sticky on phone — same reason Create's CanvasBlock isn't
            sticky in its own phone branch (PostComposer.js): a portrait
            preset (Story/Reel, 9:16) makes this box nearly the full
            viewport height on its own, and pinning something that tall
            is exactly what made Download/Email/Edit unreachable below
            it. Flowing normally lets the page scroll past it like any
            other block. */}
        {preview}
        {exportPanel}
        {qualityReportPanel}
        {clipTimeline}
        {/* A FIXED floating button, not an in-flow one — an in-flow trigger
            scrolls along with the page, so reaching it meant scrolling all
            the way down past the clip list, at which point it landed right
            behind the fixed BottomNav and was invisible until you scrolled
            past that too. Pinned just above the nav instead, it's on screen
            at a glance from anywhere in the tool, which is the actual point
            of "edit here, see it there" — the trigger itself shouldn't need
            hunting for. Hidden while the sheet is open (its own "Done"
            button, BottomSheet.js, is the way back) so there's never a
            redundant second way to do the same thing on screen at once —
            and hidden while a clip row's delete icon is swiped open, so
            that icon always has clear space to be tapped in, regardless
            of which clip row it happens to be (see clipSwipeOpen above). */}
        {!sheetOpen && !clipSwipeOpen && (
          <button
            type="button"
            onClick={openEditSheet}
            aria-label={t("brandStory.editContentStyle")}
            title={t("brandStory.editContentStyle")}
            className="fixed right-4 z-40 flex size-14 items-center justify-center rounded-full border border-white/[0.14] bg-primary text-primary-foreground shadow-[0_14px_36px_rgba(0,0,0,0.45),0_1px_0_rgba(255,255,255,0.15)_inset] [-webkit-tap-highlight-color:transparent] active:scale-95"
            style={{ bottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}
          >
            <Pencil className="size-5" />
          </button>
        )}
        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={t("common.edit")} maxHeightPx={sheetMaxHeight}>
          <div className="p-4">
            <EditClipNav clips={clips} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
            {controlsPanel}
          </div>
        </BottomSheet>
        {storiesPanel}
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {storyHeader}
      <div className="grid items-start gap-5 sm:grid-cols-[1fr_320px]">
        {/* Sticky as the direct grid child, same shape as PostComposer's
            own canvas column — pinned in view exactly like Create's,
            while ClipTimeline (below, outside this row entirely) and
            whichever tab is being edited scroll normally. */}
        <div className="sticky top-4 self-start">
          {preview}
        </div>
        <div className="sticky top-4 grid gap-4 self-start">
          {controlsPanel}
          {exportPanel}
          {qualityReportPanel}
        </div>
      </div>
      {clipTimeline}
      {storiesPanel}
    </div>
  );
}
