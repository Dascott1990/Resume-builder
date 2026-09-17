"use client";
/**
 * PostComposer.js — "create a post": start from a shape (or an AI draft),
 * then make it yours — drag anything anywhere, change its font/size/
 * spacing/alignment, add an emoji or a GIF/image sticker. The same "start
 * from a template, then customize freely" shape real design tools use, not
 * a locked layout and not a blank canvas either.
 *
 * The on-screen <canvas> IS the export target — drawn at full platform
 * resolution and scaled down only via CSS, so what downloads is
 * pixel-identical to what's on screen.
 *
 * Desktop/tablet: unchanged sticky-canvas + side-by-side grid. On phone,
 * that same sticky treatment applied to the WHOLE canvas box was the
 * actual bug worth fixing here — a tall preset (Story/Portrait, 9:16)
 * makes that box nearly the full viewport height, and pinning something
 * that tall pushes Download/Email so far down they read as having
 * vanished, even though nothing was removed. Mirrors StoryComposer.js's
 * phone layout instead: canvas stays the visible base, Download/Email
 * stay immediately reachable right under it, and the longer edit
 * controls (AI draft, Start from, Add, layer styling, Handle) move into
 * a BottomSheet — every single control still here, just relocated.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Download, Loader2, Type, Smile, ImagePlus, Undo2, Redo2, SlidersHorizontal,
} from "lucide-react";
import { Btn } from "@/components/premium/guest/components/primitives";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/premium/shared/BottomSheet";
import { useViewport } from "@/lib/useViewport";
import {
  loadMarkImage, ensureFontsReady, canvasToPngBlob, downloadBlob,
  loadHandle, saveHandle,
} from "./assetKit";
import {
  renderPost, PLATFORMS, DEFAULT_ACCENT, SHAPES, INITIAL_LAYOUTS,
  makeTextLayer, makeStickerLayer,
} from "./postTemplates";
import { EmailAssetButton } from "./EmailAssetButton";
import { LayerPanel } from "./LayerPanel";
import { AiSuggestPanel } from "./AiSuggestPanel";

const STICKER_EMOJI = ["✨", "🔥", "🎉", "💪", "🙌", "👀", "✅", "📈", "💼", "🎯", "☕", "⚡", "🚀", "💡", "🏆", "⏳"];

// Sample copy for manually picking a shape (distinct from the AI draft
// path, which supplies its own real content) — same defaults the old
// fixed-field composer shipped with.
const SHAPE_DEFAULTS = {
  tip: { eyebrow: "Noqeev · Daily tip", headline: "Cut your resume to one page before you cut anything else.", subtext: "A recruiter spends seconds on page two. Say the important thing first." },
  quote: { eyebrow: "", headline: "A gap on your resume isn't the end of the story.", subtext: "— Noqeev" },
  stat: { eyebrow: "Noqeev · By the numbers", headline: "3 minutes", subtext: "The average time it takes to tailor a resume with Noqeev." },
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function PostComposer({ accent = DEFAULT_ACCENT }) {
  const { isPhone } = useViewport();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [shapeId, setShapeId] = useState("tip");
  const [platformId, setPlatformId] = useState("square");
  const [layers, setLayersRaw] = useState(() => INITIAL_LAYOUTS.tip(SHAPE_DEFAULTS.tip));
  const [selectedId, setSelectedId] = useState(null);
  const [handle, setHandle] = useState("");
  const [ready, setReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [gifUrlOpen, setGifUrlOpen] = useState(false);
  const [gifUrl, setGifUrl] = useState("");
  const [gifLoading, setGifLoading] = useState(false);
  const [historyTick, setHistoryTick] = useState(0); // bumped on every undo/redo/commit so the buttons' disabled state re-renders

  const canvasRef = useRef(null);
  const markImgRef = useRef(null);
  const stickerImagesRef = useRef({});
  const boxesRef = useRef(new Map());
  const dragRef = useRef(null);
  const dragMovedRef = useRef(false); // a plain click (no movement) shouldn't push a no-op history step
  // Undo history — snapshots of the whole layers array, not per-field
  // diffs; a post has at most a handful of layers, so this stays cheap
  // and sidesteps ever having to reconcile a diff/patch format.
  const historyRef = useRef([layers]);
  const historyIndexRef = useRef(0);

  // One committed step per discrete action (add/delete/style change/drag
  // finished) — NOT per pointermove or per input tick, so undo reverses
  // "that drag" or "that edit" in one press, the way a real design tool's
  // undo behaves, not fifty tiny steps for one gesture.
  const commitLayers = (updater) => {
    setLayersRaw((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      historyRef.current.push(next);
      if (historyRef.current.length > 50) historyRef.current.shift();
      historyIndexRef.current = historyRef.current.length - 1;
      setHistoryTick((t) => t + 1);
      return next;
    });
  };
  // Live position during an active drag — updates what's on screen without
  // spamming the history stack; the drag's actual history entry is
  // committed once, at pointer-up, with wherever it ended.
  const setLayersLive = (updater) => setLayersRaw(updater);
  const setLayers = commitLayers;

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    setLayersRaw(historyRef.current[historyIndexRef.current]);
    setSelectedId(null);
    setHistoryTick((t) => t + 1);
  }, []);
  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    setLayersRaw(historyRef.current[historyIndexRef.current]);
    setSelectedId(null);
    setHistoryTick((t) => t + 1);
  }, []);
  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      // Skip while typing anywhere (a text field, the handle input, the AI
      // prompt) — Cmd+Z there should undo the text, not a layer edit.
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  useEffect(() => {
    setHandle(loadHandle());
    Promise.all([loadMarkImage(), ensureFontsReady()]).then(([img]) => { markImgRef.current = img; setReady(true); });
  }, []);

  const updateHandle = (v) => { setHandle(v); saveHandle(v); };

  const switchShape = (id) => {
    setShapeId(id);
    setLayers(INITIAL_LAYOUTS[id](SHAPE_DEFAULTS[id]));
    setSelectedId(null);
  };

  const applySuggestion = (data) => {
    const template = INITIAL_LAYOUTS[data.template] ? data.template : "tip";
    setShapeId(template);
    setLayers(INITIAL_LAYOUTS[template]({ eyebrow: data.eyebrow, headline: data.headline, subtext: data.subtext }));
    setSelectedId(null);
  };

  const addText = () => {
    const layer = makeTextLayer({ text: "Your text" });
    setLayers((ls) => [...ls, layer]);
    setSelectedId(layer.id);
    setStickerPickerOpen(false);
  };
  const addEmoji = (emoji) => {
    const layer = makeStickerLayer({ kind: "emoji", value: emoji });
    setLayers((ls) => [...ls, layer]);
    setSelectedId(layer.id);
    setStickerPickerOpen(false);
  };
  const addGif = async () => {
    const url = gifUrl.trim();
    if (!url) return;
    setGifLoading(true);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = "anonymous"; // required so the export canvas isn't tainted by a cross-origin image
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Could not load that link as an image."));
        el.src = url;
      });
      stickerImagesRef.current = { ...stickerImagesRef.current, [url]: img };
      const layer = makeStickerLayer({ kind: "image", value: url, sizeFrac: 0.3 });
      setLayers((ls) => [...ls, layer]);
      setSelectedId(layer.id);
      setGifUrl("");
      setGifUrlOpen(false);
    } catch {
      toast.error("Couldn't load that link.");
    } finally {
      setGifLoading(false);
    }
  };

  const updateLayer = (next) => setLayers((ls) => ls.map((l) => (l.id === next.id ? next : l)));
  const deleteSelected = () => {
    setLayers((ls) => ls.filter((l) => l.id !== selectedId));
    setSelectedId(null);
  };
  const duplicateSelected = () => {
    const src = layers.find((l) => l.id === selectedId);
    if (!src) return;
    const copy = { ...src, id: `${src.id}-copy-${Date.now()}`, x: clamp01(src.x + 0.03), y: clamp01(src.y + 0.03) };
    setLayers((ls) => [...ls, copy]);
    setSelectedId(copy.id);
  };
  // z-order is just array order — later elements draw on top (see
  // postTemplates.js's renderPost, and hitTest above walking the array
  // backwards so the topmost layer wins a click too).
  const sendSelectedToBack = () => {
    setLayers((ls) => {
      const layer = ls.find((l) => l.id === selectedId);
      if (!layer) return ls;
      return [layer, ...ls.filter((l) => l.id !== selectedId)];
    });
  };
  const bringSelectedToFront = () => {
    setLayers((ls) => {
      const layer = ls.find((l) => l.id === selectedId);
      if (!layer) return ls;
      return [...ls.filter((l) => l.id !== selectedId), layer];
    });
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !markImgRef.current) return;
    const { w, h } = PLATFORMS[platformId];
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    boxesRef.current = renderPost(ctx, w, h, layers, markImgRef.current, accent, handle, stickerImagesRef.current);
  };
  useEffect(() => { if (ready) draw(); }, [ready, layers, platformId, accent, handle]);

  // ── Drag-to-reposition — hit-test the last-rendered boxes (topmost
  // layer first), then track the pointer's offset from the layer's own
  // anchor so dragging doesn't "snap" the layer to the cursor's tip. ─────
  const pointFromEvent = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) };
  };
  const hitTest = (px, py) => {
    for (let i = layers.length - 1; i >= 0; i--) {
      const box = boxesRef.current.get(layers[i].id);
      if (box && px >= box.x && px <= box.x + box.w && py >= box.y && py <= box.y + box.h) return layers[i];
    }
    return null;
  };
  const onPointerDown = (e) => {
    const p = pointFromEvent(e);
    const hit = hitTest(p.x, p.y);
    setSelectedId(hit?.id || null);
    if (!hit) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { w, h } = PLATFORMS[platformId];
    dragRef.current = { id: hit.id, dx: p.x / w - hit.x, dy: p.y / h - hit.y };
    dragMovedRef.current = false;
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    const p = pointFromEvent(e);
    const { w, h } = PLATFORMS[platformId];
    const { id, dx, dy } = dragRef.current;
    const nx = clamp01(p.x / w - dx), ny = clamp01(p.y / h - dy);
    dragMovedRef.current = true;
    setLayersLive((ls) => ls.map((l) => (l.id === id ? { ...l, x: nx, y: ny } : l)));
  };
  const onPointerUp = () => {
    // Bake the whole drag into ONE history step, taken here at drag-end —
    // committing per pointermove would make undo reverse a drag one pixel
    // at a time instead of putting the layer back where it started.
    if (dragRef.current && dragMovedRef.current) commitLayers(layers);
    dragRef.current = null;
  };

  const exportBlob = () => canvasToPngBlob(canvasRef.current);
  const exportFilename = () => `noqeev-${shapeId}-${platformId}.png`;
  const handleDownload = async () => {
    setDownloading(true);
    try { downloadBlob(await exportBlob(), exportFilename()); }
    catch { toast.error("Try again."); }
    finally { setDownloading(false); }
  };

  const platform = PLATFORMS[platformId];
  const selectedLayer = layers.find((l) => l.id === selectedId) || null;

  const CanvasBlock = () => (
    <>
      <div className="flex w-full max-w-[560px] items-center justify-end gap-1">
        <button type="button" onClick={undo} disabled={!canUndo} title="Undo"
          className="flex size-11 items-center justify-center rounded-lg text-muted-foreground disabled:opacity-30 enabled:hover:bg-muted enabled:hover:text-foreground">
          <Undo2 className="size-4" />
        </button>
        <button type="button" onClick={redo} disabled={!canRedo} title="Redo"
          className="flex size-11 items-center justify-center rounded-lg text-muted-foreground disabled:opacity-30 enabled:hover:bg-muted enabled:hover:text-foreground">
          <Redo2 className="size-4" />
        </button>
      </div>
      {/* Sized with CSS aspect-ratio, not a JS-computed pixel width — the
          box just fills its container (capped by max-w) and the browser
          works out the height, so a wide shape like Landscape can never
          blow past a narrow screen the way a fixed px width did. Wider
          cap than before (560px, matching the resume preview's own
          "as large as the layout can spare" treatment) — easier to see
          exactly where a drag lands at real editing precision. */}
      <div
        className="relative mx-auto flex w-full max-w-[560px] items-center justify-center overflow-hidden rounded-xl bg-[#0a0a0a] shadow-[0_8px_28px_rgba(0,0,0,0.25)]"
        style={{ aspectRatio: `${platform.w} / ${platform.h}` }}
      >
        {!ready ? (
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        ) : (
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="block h-full w-full"
            style={{ cursor: dragRef.current ? "grabbing" : "grab", touchAction: "none" }}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {Object.entries(PLATFORMS).map(([id, r]) => (
          <button key={id} type="button" onClick={() => setPlatformId(id)} aria-pressed={platformId === id} title={r.sub}
            className={`rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${platformId === id ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
            {r.label}
          </button>
        ))}
      </div>
    </>
  );

  const EditControls = () => (
    <div className="grid gap-4">
      <AiSuggestPanel onSuggestion={applySuggestion} />

      <div>
        <p className="m-0 mb-2 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">Start from</p>
        <div className="grid grid-cols-3 gap-1.5">
          {SHAPES.map((s) => (
            <button key={s.id} type="button" onClick={() => switchShape(s.id)} aria-pressed={shapeId === s.id}
              className={`rounded-lg border px-2 py-2 text-center ${shapeId === s.id ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-card text-foreground"}`}>
              <span className="text-[12px] font-bold">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="m-0 mb-2 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">Add</p>
        <div className="flex flex-wrap gap-1.5">
          <Btn small variant="ghost" onClick={addText}><Type className="size-3.5" /> Text</Btn>
          <Btn small variant="ghost" onClick={() => { setStickerPickerOpen((v) => !v); setGifUrlOpen(false); }}><Smile className="size-3.5" /> Emoji</Btn>
          <Btn small variant="ghost" onClick={() => { setGifUrlOpen((v) => !v); setStickerPickerOpen(false); }}><ImagePlus className="size-3.5" /> GIF / Image</Btn>
        </div>
        {stickerPickerOpen && (
          // 6 columns, not 8 — at a real 44px touch target (down from
          // size-8/32px) 8 columns would overflow this sidebar's width.
          <div className="mt-2 grid grid-cols-6 gap-1.5 rounded-lg border border-border bg-card p-2">
            {STICKER_EMOJI.map((e) => (
              <button key={e} type="button" onClick={() => addEmoji(e)} className="flex size-11 items-center justify-center rounded-md text-lg hover:bg-muted">{e}</button>
            ))}
          </div>
        )}
        {gifUrlOpen && (
          <div className="mt-2 flex gap-1.5">
            <Input value={gifUrl} onChange={(e) => setGifUrl(e.target.value)} placeholder="Image/GIF link" className="h-9 rounded-[8px] text-[12.5px]" onKeyDown={(e) => { if (e.key === "Enter") addGif(); }} />
            <Btn small variant="gold" onClick={addGif} disabled={gifLoading} loading={gifLoading}>Add</Btn>
          </div>
        )}
      </div>

      {selectedLayer ? (
        <LayerPanel
          layer={selectedLayer} onChange={updateLayer} onDelete={deleteSelected}
          onDuplicate={duplicateSelected} onFront={bringSelectedToFront} onBack={sendSelectedToBack}
        />
      ) : (
        <p className="m-0 rounded-xl border border-dashed border-border p-4 text-center text-[11.5px] text-muted-foreground">
          Tap to style
        </p>
      )}

      <div>
        <label className="mb-1.5 block text-[11.5px] font-bold tracking-wide text-foreground">Handle</label>
        <Input value={handle} onChange={(e) => updateHandle(e.target.value)} className="h-10 rounded-[10px] text-[13.5px]" />
      </div>
    </div>
  );

  const DownloadRow = () => (
    <div className="flex gap-2">
      <Btn variant="gold" onClick={handleDownload} disabled={!ready || downloading} loading={downloading} className="flex-1">
        <Download className="size-4" /> {downloading ? "Preparing…" : "Download"}
      </Btn>
      <EmailAssetButton getBlob={exportBlob} filename={exportFilename()} label={shapeId} />
    </div>
  );

  if (isPhone) {
    return (
      <div className="grid gap-4">
        {/* Canvas as the base view, NOT sticky here — a tall preset
            (Story/Portrait) can make this box nearly the full viewport
            height on a phone, and pinning something that tall is what
            pushed Download/Email out of easy reach in the first place. */}
        <div className="flex min-w-0 w-full flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5">
          <CanvasBlock />
        </div>
        <DownloadRow />
        <Btn variant="ghost" onClick={() => setSheetOpen(true)}>
          <SlidersHorizontal className="size-4" /> Edit content & style
        </Btn>
        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Edit">
          <div className="p-4">
            <EditControls />
          </div>
        </BottomSheet>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-[1fr_300px]">
      {/* Sticky, not a plain grid item — without this, scrolling down
          into the controls sidebar carries the canvas out of view along
          with it, so a style change made down there has nothing on
          screen to actually show its result until scrolling back up.
          self-start is required alongside sticky: a grid item stretches
          to its row's full height by default, which would make this
          element as tall as its sibling and leave no room to visibly
          "stick" as the page scrolls past it. */}
      <div className="sticky top-4 flex min-w-0 w-full flex-col items-center gap-3 self-start rounded-2xl border border-border bg-card p-5">
        <CanvasBlock />
      </div>

      <div className="grid gap-4">
        <EditControls />
        <DownloadRow />
      </div>
    </div>
  );
}
