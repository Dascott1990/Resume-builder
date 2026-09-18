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
import { Plus, Undo2, Redo2, SlidersHorizontal, Volume2 } from "lucide-react";
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
import { releaseClip } from "./clipModel";

const MAX_NARRATION_CHARS = 400; // mirrors backend/app/api/story.py's cap

function VoiceOverField({ clip, onChange }) {
  const captionText = clip.captionLayers?.[0]?.text || "";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">
          <Volume2 className="size-3.5" /> Voice-over
        </span>
        {captionText && (
          <button type="button" onClick={() => onChange(captionText)} className="text-[11px] font-semibold text-primary">
            Use caption text
          </button>
        )}
      </div>
      <Textarea
        value={clip.narrationText || ""}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_NARRATION_CHARS))}
        rows={2} placeholder="What should be read aloud for this clip — leave blank for silence"
        className="resize-none rounded-[10px] text-[13px]"
      />
      <p className="m-0 mt-1 text-right text-[10.5px] text-muted-foreground/60">
        {(clip.narrationText || "").length}/{MAX_NARRATION_CHARS}
      </p>
    </div>
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
  const updateNarration = (text) => {
    if (selectedIndex == null) return;
    handleUpdateClip(selectedIndex, { narrationText: text });
  };

  // Caption + Voice only — Export deliberately isn't a third tab here
  // anymore. Create keeps Download/Email as a separate, always-visible
  // action outside its own "Edit content & style" sheet (see
  // PostComposer.js's DownloadRow); Export belongs the same way, not
  // buried behind the same button as content/style editing.
  const ControlsPanel = () => (
    <Tabs value={controlTab} onValueChange={setControlTab} className="gap-3">
      <TabsList className="w-full">
        <TabsTrigger value="caption">Caption</TabsTrigger>
        <TabsTrigger value="voice">Voice</TabsTrigger>
      </TabsList>

      <TabsContent value="caption" className="grid gap-4">
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
          <VoiceOverField clip={selectedClip} onChange={updateNarration} />
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
  const Preview = () => (
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
        <Preview />
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
            <ControlsPanel />
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
          <Preview />
        </div>
        <div className="sticky top-4 grid gap-4 self-start">
          <ControlsPanel />
          {exportPanel}
        </div>
      </div>
      {clipTimeline}
    </div>
  );
}
