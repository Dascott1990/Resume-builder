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
 * a full editor" brief. LayerPanel still expects duplicate/front/back
 * handlers; they're no-ops here since ordering/duplicating don't mean
 * anything for a single layer.
 *
 * Layout mirrors GuestMode.js's own showSplit split: tablet/desktop has
 * real room for preview + controls side by side (unchanged grid below).
 * A phone doesn't, so the preview + clip timeline stay the permanent
 * base view and the caption/AI/export controls move into a BottomSheet
 * instead — same "edit here, see it there, never scroll away from the
 * preview to change something" outcome GuestMode's StyleBottomSheet
 * already gives the resume editor, not a second design.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Undo2, Redo2, SlidersHorizontal } from "lucide-react";
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

export function StoryComposer({ accent = DEFAULT_ACCENT }) {
  const { isPhone } = useViewport();
  const [clips, setClipsRaw] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [platformId, setPlatformId] = useState("story");
  const [outputFormat, setOutputFormat] = useState("mp4");
  const [historyTick, setHistoryTick] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);

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

  const ControlsPanel = () => (
    <div className="grid gap-4">
      <AiSuggestPanel onSuggestion={applyCaptionSuggestion} />

      {selectedClip ? (
        selectedCaption ? (
          <LayerPanel
            layer={selectedCaption} onChange={updateCaption} onDelete={removeCaption}
            onDuplicate={() => {}} onFront={() => {}} onBack={() => {}}
          />
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

      <ExportPanel
        clips={clips} platformId={platformId} setPlatformId={setPlatformId}
        outputFormat={outputFormat} setOutputFormat={setOutputFormat} accent={accent}
      />
    </div>
  );

  const PreviewAndTimeline = () => (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <p className="m-0 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">Preview</p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={undo} disabled={!canUndo} title="Undo"
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground disabled:opacity-30 enabled:hover:bg-muted enabled:hover:text-foreground">
            <Undo2 className="size-4" />
          </button>
          <button type="button" onClick={redo} disabled={!canRedo} title="Redo"
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground disabled:opacity-30 enabled:hover:bg-muted enabled:hover:text-foreground">
            <Redo2 className="size-4" />
          </button>
        </div>
      </div>
      <PreviewPlayer
        clips={clips} platform={PLATFORMS[platformId]} accent={accent} selectedIndex={selectedIndex}
        onCaptionLive={updateCaptionLive} onCaptionCommit={updateCaption}
      />
      <ClipTimeline
        clips={clips} selectedIndex={selectedIndex} onSelect={setSelectedIndex}
        onAdd={handleAdd} onRemove={handleRemove} onReorder={handleReorder} onUpdateClip={handleUpdateClip}
      />
    </div>
  );

  if (isPhone) {
    return (
      <div className="grid gap-4">
        <PreviewAndTimeline />
        <Btn variant="gold" onClick={() => setSheetOpen(true)}>
          <SlidersHorizontal className="size-4" /> Edit caption & export
        </Btn>
        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Edit & export">
          <div className="p-4">
            <ControlsPanel />
          </div>
        </BottomSheet>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-[1fr_320px]">
      <PreviewAndTimeline />
      <ControlsPanel />
    </div>
  );
}
