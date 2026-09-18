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
import { Plus, Undo2, Redo2, SlidersHorizontal, Volume2, VolumeX, Copy, Captions } from "lucide-react";
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
import { releaseClip, loadClipFromFile } from "./clipModel";
import { transcribeClip } from "./transcribe";
import { saveStoryDraft, loadStoryDraft } from "./draftStore";

const MAX_NARRATION_CHARS = 400; // mirrors backend/app/api/story.py's cap
// Module-scope, not React state — only resets on an actual page load, so
// the "picked up where you left off" toast fires once per visit to the
// site, not once per remount (switching /brand zones away from Story and
// back).
let hasShownStoryDraftToast = false;
const MIN_NARRATION_RATE = 80; // mirrors backend/app/api/story.py's MIN/MAX_NARRATION_RATE
const MAX_NARRATION_RATE = 320;

const VOICE_OPTIONS = [
  { id: "neutral", label: "Neutral" },
  { id: "woman", label: "Woman" },
  { id: "man", label: "Man" },
];
const FIT_OPTIONS = [
  { id: "extend", label: "Extend clip", hint: "Clip holds longer if the voice-over runs past it — speech is never cut off." },
  { id: "cut", label: "Cut to length", hint: "Voice-over stops at the clip's own length, even mid-sentence." },
];

function VoiceOverField({ clip, onPatch, onApplyToAll }) {
  const captionText = clip.captionLayers?.[0]?.text || "";
  const voice = clip.narrationVoice || "neutral";
  const rate = clip.narrationRate || 165;
  const pitch = clip.narrationPitch ?? 50;
  const fit = clip.narrationFit || "extend";
  const volume = clip.narrationVolume ?? 1;
  const muted = !!clip.narrationMuted;

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">
          <Volume2 className="size-3.5" /> Voice-over
        </span>
        <div className="flex items-center gap-3">
          {captionText && (
            <button type="button" onClick={() => onPatch({ narrationText: captionText })} className="text-[11px] font-semibold text-primary">
              Use caption text
            </button>
          )}
          {/* Silences without losing the typed script or any other
              setting here — flip it back on and everything (voice,
              speed, tone, volume) is exactly as it was. */}
          <button type="button" onClick={() => onPatch({ narrationMuted: !muted })} aria-pressed={muted} title={muted ? "Unmute" : "Mute"}
            className={`flex size-8 items-center justify-center rounded-full ${muted ? "bg-destructive/10 text-destructive" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
        </div>
      </div>
      <Textarea
        value={clip.narrationText || ""}
        onChange={(e) => onPatch({ narrationText: e.target.value.slice(0, MAX_NARRATION_CHARS) })}
        rows={2} placeholder="What should be read aloud for this clip — leave blank for silence"
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
        <button type="button" onClick={() => onPatch({ keepOriginalAudio: clip.keepOriginalAudio === false })}
          aria-pressed={clip.keepOriginalAudio !== false}
          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-[11.5px] font-bold ${clip.keepOriginalAudio !== false ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
          Keep this clip's original sound
          <span className="font-mono text-[10px] font-normal">{clip.keepOriginalAudio !== false ? "On" : "Off"}</span>
        </button>
      )}

      {/* Dimmed and inert while muted — nothing here does anything
          audible right now, and greying it out says so at a glance
          instead of leaving every control looking live when it isn't. */}
      <div className={`grid gap-3 ${muted ? "pointer-events-none opacity-40" : ""}`}>
        <div>
          <p className="m-0 mb-1.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">Voice</p>
          <div className="flex flex-wrap gap-1.5">
            {VOICE_OPTIONS.map((v) => (
              <button key={v.id} type="button" onClick={() => onPatch({ narrationVoice: v.id })} aria-pressed={voice === v.id}
                className={`rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${voice === v.id ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-foreground">
              Speed <span className="block font-mono text-[9.5px] font-normal text-muted-foreground">{rate <= 130 ? "Slow" : rate >= 210 ? "Fast" : "Normal"}</span>
            </label>
            <input type="range" min={MIN_NARRATION_RATE} max={MAX_NARRATION_RATE} step="5" value={rate}
              onChange={(e) => onPatch({ narrationRate: Number(e.target.value) })} className="w-full accent-primary" />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-foreground">
              Tone <span className="block font-mono text-[9.5px] font-normal text-muted-foreground">{pitch <= 33 ? "Low" : pitch >= 66 ? "High" : "Mid"}</span>
            </label>
            <input type="range" min="0" max="99" step="1" value={pitch}
              onChange={(e) => onPatch({ narrationPitch: Number(e.target.value) })} className="w-full accent-primary" />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-foreground">
              Volume <span className="block font-mono text-[9.5px] font-normal text-muted-foreground">{Math.round(volume * 100)}%</span>
            </label>
            <input type="range" min="0" max="2" step="0.05" value={volume}
              onChange={(e) => onPatch({ narrationVolume: Number(e.target.value) })} className="w-full accent-primary" />
          </div>
        </div>

        <div>
          <p className="m-0 mb-1.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">If it runs long</p>
          <div className="flex flex-wrap gap-1.5">
            {FIT_OPTIONS.map((f) => (
              <button key={f.id} type="button" onClick={() => onPatch({ narrationFit: f.id })} aria-pressed={fit === f.id} title={f.hint}
                className={`rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${fit === f.id ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
                {f.label}
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
          <Copy className="size-3.5" /> Apply voice, speed, tone & volume to all clips
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
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      const result = await transcribeClip(clip.file);
      if (!result.text) {
        toast.error("Couldn't make out any speech in this clip.");
        return;
      }
      onTranscribed(result);
      toast.success("Caption filled in from the clip's own audio.");
    } catch (e) {
      toast.error(e.message || "Transcription failed.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Btn small variant="ghost" onClick={run} disabled={loading} loading={loading}>
      <Captions className="size-3.5" /> Transcribe this clip's speech
    </Btn>
  );
}

export function StoryComposer({ accent = DEFAULT_ACCENT }) {
  const { isPhone } = useViewport();
  const [clips, setClipsRaw] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [platformId, setPlatformId] = useState("story");
  const [outputFormat, setOutputFormat] = useState("mp4");
  const [historyTick, setHistoryTick] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [controlTab, setControlTab] = useState("caption");

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

  // Restore whatever was in progress last time, once, on mount — a
  // refresh (or just coming back later) used to lose every clip, caption,
  // and voice-over with nothing to show for it. draftStore.js keeps the
  // actual uploaded File objects in IndexedDB (not just JSON), so this
  // rebuilds the same clip elements loadClipFromFile would from a fresh
  // upload — object URLs and <img>/<video> elements don't survive a
  // reload themselves, everything else about the clip does.
  const restoredRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const draft = await loadStoryDraft();
      if (cancelled || !draft?.clips?.length) { restoredRef.current = true; return; }
      try {
        const restored = await Promise.all(draft.clips.map(async (saved) => {
          const loaded = await loadClipFromFile(saved.file);
          return {
            ...loaded, id: saved.id, durationSec: saved.durationSec, trimIn: saved.trimIn,
            trimOut: saved.trimOut, captionLayers: saved.captionLayers || [], narrationText: saved.narrationText || "",
            narrationVoice: saved.narrationVoice || "neutral", narrationRate: saved.narrationRate || 165,
            narrationPitch: saved.narrationPitch ?? 50, narrationFit: saved.narrationFit || "extend",
            narrationVolume: saved.narrationVolume ?? 1, narrationMuted: !!saved.narrationMuted,
            keepOriginalAudio: saved.keepOriginalAudio !== false,
          };
        }));
        if (cancelled) return;
        setClipsRaw(restored);
        historyRef.current = [restored];
        historyIndexRef.current = 0;
        setHistoryTick((t) => t + 1);
        setSelectedIndex(0);
        if (draft.platformId) setPlatformId(draft.platformId);
        if (draft.outputFormat) setOutputFormat(draft.outputFormat);
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
          toast.success(`Picked up where you left off — ${restored.length} clip${restored.length === 1 ? "" : "s"} restored.`);
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
  // until the restore effect above has run once, so a still-loading
  // draft is never overwritten with the empty state a fresh mount starts
  // from.
  useEffect(() => {
    if (!restoredRef.current) return;
    const timer = setTimeout(() => {
      saveStoryDraft({
        platformId, outputFormat,
        clips: clips.map((c) => ({
          id: c.id, kind: c.kind, file: c.file, naturalW: c.naturalW, naturalH: c.naturalH,
          naturalDurationSec: c.naturalDurationSec, durationSec: c.durationSec, trimIn: c.trimIn,
          trimOut: c.trimOut, captionLayers: c.captionLayers, narrationText: c.narrationText,
          narrationVoice: c.narrationVoice, narrationRate: c.narrationRate,
          narrationPitch: c.narrationPitch, narrationFit: c.narrationFit,
          narrationVolume: c.narrationVolume, narrationMuted: c.narrationMuted,
          keepOriginalAudio: c.keepOriginalAudio,
        })),
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [clips, platformId, outputFormat]);

  const handleAdd = (clip) => {
    setClips((cs) => [...cs, clip]);
    setSelectedIndex(clips.length); // select the newly-added clip (index before this add)
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
    const layer = makeTextLayer({ text: "Your caption" });
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
    if (selectedIndex == null) { toast.error("Select a clip first."); return; }
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
    toast.success(`Applied to all ${clips.length} clips.`);
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
        <TabsTrigger value="caption">Caption</TabsTrigger>
        <TabsTrigger value="voice">Voice</TabsTrigger>
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
              <Plus className="size-4" /> Add a caption to this clip
            </Btn>
          )
        ) : (
          <p className="m-0 rounded-xl border border-dashed border-border p-4 text-center text-[11.5px] text-muted-foreground">
            Select a clip to caption it
          </p>
        )}
      </TabsContent>

      <TabsContent value="voice">
        {selectedClip ? (
          <VoiceOverField clip={selectedClip} onPatch={updateNarration} onApplyToAll={clips.length > 1 ? applyVoiceSettingsToAll : null} />
        ) : (
          <p className="m-0 rounded-xl border border-dashed border-border p-4 text-center text-[11.5px] text-muted-foreground">
            Select a clip to add a voice-over
          </p>
        )}
      </TabsContent>
    </Tabs>
  );

  const exportPanel = (
    <ExportPanel
      clips={clips} platformId={platformId} setPlatformId={setPlatformId}
      outputFormat={outputFormat} setOutputFormat={setOutputFormat} accent={accent}
    />
  );

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
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <p className="m-0 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">Preview</p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={undo} disabled={!canUndo} title="Undo"
            className="flex size-11 items-center justify-center rounded-lg text-muted-foreground disabled:opacity-30 enabled:hover:bg-muted enabled:hover:text-foreground">
            <Undo2 className="size-4" />
          </button>
          <button type="button" onClick={redo} disabled={!canRedo} title="Redo"
            className="flex size-11 items-center justify-center rounded-lg text-muted-foreground disabled:opacity-30 enabled:hover:bg-muted enabled:hover:text-foreground">
            <Redo2 className="size-4" />
          </button>
        </div>
      </div>
      <PreviewPlayer
        clips={clips} platform={PLATFORMS[platformId]} accent={accent} selectedIndex={selectedIndex}
        onCaptionLive={updateCaptionLive} onCaptionCommit={updateCaption} compact={isPhone}
      />
    </div>
  );

  const clipTimeline = (
    <ClipTimeline
      clips={clips} selectedIndex={selectedIndex} onSelect={setSelectedIndex}
      onAdd={handleAdd} onRemove={handleRemove} onReorder={handleReorder} onUpdateClip={handleUpdateClip}
    />
  );

  if (isPhone) {
    return (
      <div className="grid gap-4">
        {/* NOT sticky on phone — same reason Create's CanvasBlock isn't
            sticky in its own phone branch (PostComposer.js): a portrait
            preset (Story/Reel, 9:16) makes this box nearly the full
            viewport height on its own, and pinning something that tall
            is exactly what made Download/Email/Edit unreachable below
            it. Flowing normally lets the page scroll past it like any
            other block. */}
        {preview}
        {/* Directly under the preview's play/pause row — same position
            Create's canvas → Download/Email → Edit sequence uses
            (PostComposer.js) — not further down the page past the clip
            list, so the three action buttons read together as one group
            right where the preview controls leave off. */}
        {exportPanel}
        {/* Hidden while the sheet itself is open — its own "Done" button
            (BottomSheet.js) is the way back, so having this trigger still
            sitting there too is a redundant second way to do the same
            thing while the sheet already covers it. */}
        {!sheetOpen && (
          <Btn variant="gold" onClick={() => setSheetOpen(true)}>
            <SlidersHorizontal className="size-4" /> Edit content & style
          </Btn>
        )}
        {clipTimeline}
        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Edit">
          <div className="p-4">
            {controlsPanel}
          </div>
        </BottomSheet>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
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
        </div>
      </div>
      {clipTimeline}
    </div>
  );
}
