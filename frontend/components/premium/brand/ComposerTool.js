"use client";
/**
 * ComposerTool.js — the branding workspace's post composer. Same canvas
 * engine as the old /brand PostComposer (frontend/app/brand/postTemplates.js
 * + LayerPanel.js + AiSuggestPanel.js — all pure rendering/UI with no
 * account concept, reused as-is), trimmed down for the workspace context:
 * one current draft (autosaved to a workspace-scoped localStorage key,
 * not a full multi-post browser — out of scope for this step) instead of
 * PostComposer's saved-drafts switcher.
 *
 * Export does two things on Download: an immediate local download (the
 * canvas IS the export target, drawn at full platform resolution) AND an
 * upload to /api/v1/workspace/compose/export so the PNG is persisted via
 * the storage interface, scoped to this workspace — the download itself
 * never waits on that upload.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { Download, Loader2, Type, Smile, ImagePlus, Undo2, Redo2, SlidersHorizontal, Upload } from "lucide-react";
import { Btn } from "@/components/premium/guest/components/primitives";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/premium/shared/BottomSheet";
import { useViewport } from "@/lib/useViewport";
import {
  loadMarkImage, ensureFontsReady, canvasToPngBlob, downloadBlob, resizeImageToDataUrl,
} from "@/app/brand/assetKit";
import {
  renderPost, PLATFORMS, DEFAULT_ACCENT, SHAPES, INITIAL_LAYOUTS,
  makeTextLayer, makeStickerLayer,
} from "@/app/brand/postTemplates";
import { LayerPanel } from "@/app/brand/LayerPanel";
import { AiSuggestPanel } from "@/app/brand/AiSuggestPanel";
import { workspaceFetch } from "./workspaceApi";

const STICKER_EMOJI = ["✨", "🔥", "🎉", "💪", "🙌", "👀", "✅", "📈", "💼", "🎯", "☕", "⚡", "🚀", "💡", "🏆", "⏳"];

const SHAPE_DEFAULTS = {
  tip: { eyebrow: "Noqeev · Daily tip", headline: "Cut your resume to one page before you cut anything else.", subtext: "A recruiter spends seconds on page two. Say the important thing first." },
  quote: { eyebrow: "", headline: "A gap on your resume isn't the end of the story.", subtext: "— Noqeev" },
  stat: { eyebrow: "Noqeev · By the numbers", headline: "3 minutes", subtext: "The average time it takes to tailor a resume with Noqeev." },
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function draftKey(token) {
  return `noqeev_ws_${token.slice(0, 12)}_compose_draft`;
}
function loadDraft(token) {
  try { return JSON.parse(localStorage.getItem(draftKey(token)) || "null"); } catch { return null; }
}
function saveDraft(token, data) {
  try { localStorage.setItem(draftKey(token), JSON.stringify(data)); } catch { /* best-effort */ }
}

export function ComposerTool({ token, accent = DEFAULT_ACCENT }) {
  const { isPhone } = useViewport();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [shapeId, setShapeId] = useState("tip");
  const [platformId, setPlatformId] = useState("square");
  const [layers, setLayersRaw] = useState(() => INITIAL_LAYOUTS.tip(SHAPE_DEFAULTS.tip));
  const [selectedId, setSelectedId] = useState(null);
  const [ready, setReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [gifUrlOpen, setGifUrlOpen] = useState(false);
  const [gifUrl, setGifUrl] = useState("");
  const [gifLoading, setGifLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const markImgRef = useRef(null);
  const stickerImagesRef = useRef({});
  const boxesRef = useRef(new Map());
  const dragRef = useRef(null);
  const dragMovedRef = useRef(false);
  const historyRef = useRef([layers]);
  const historyIndexRef = useRef(0);
  const restoredRef = useRef(false);

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
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  useEffect(() => {
    Promise.all([loadMarkImage(), ensureFontsReady()]).then(([img]) => { markImgRef.current = img; setReady(true); });

    const draft = loadDraft(token);
    if (draft?.layers?.length) {
      setLayersRaw(draft.layers);
      historyRef.current = [draft.layers];
      historyIndexRef.current = 0;
      setHistoryTick((t) => t + 1);
      if (draft.shapeId) setShapeId(draft.shapeId);
      if (draft.platformId) setPlatformId(draft.platformId);
    }
    restoredRef.current = true;
  }, [token]);

  useEffect(() => {
    if (!restoredRef.current) return;
    const timer = setTimeout(() => saveDraft(token, { shapeId, platformId, layers }), 600);
    return () => clearTimeout(timer);
  }, [layers, shapeId, platformId, token]);

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
        el.crossOrigin = "anonymous";
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
  const addUploadedImage = async (file) => {
    if (!file) return;
    setUploadLoading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Couldn't read that image."));
        el.src = dataUrl;
      });
      stickerImagesRef.current = { ...stickerImagesRef.current, [dataUrl]: img };
      const layer = makeStickerLayer({ kind: "image", value: dataUrl, sizeFrac: 0.3 });
      setLayers((ls) => [...ls, layer]);
      setSelectedId(layer.id);
      setStickerPickerOpen(false);
    } catch (e) {
      toast.error(e.message || "Couldn't load that image.");
    } finally {
      setUploadLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
    boxesRef.current = renderPost(ctx, w, h, layers, markImgRef.current, accent, "", stickerImagesRef.current);
  };
  useEffect(() => { if (ready) draw(); }, [ready, layers, platformId, accent]);

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
    if (dragRef.current && dragMovedRef.current) commitLayers(layers);
    dragRef.current = null;
  };

  const exportFilename = () => `noqeev-${shapeId}-${platformId}.png`;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await canvasToPngBlob(canvasRef.current);
      downloadBlob(blob, exportFilename());
      // Persisted via the storage interface, scoped to this workspace —
      // best-effort, never blocks the download the person already got.
      const formData = new FormData();
      formData.append("file", blob, exportFilename());
      formData.append("filename", exportFilename());
      workspaceFetch(token, "/api/v1/workspace/compose/export", { method: "POST", body: formData }).catch(() => {});
    } catch {
      toast.error("Try again.");
    } finally {
      setDownloading(false);
    }
  };

  const platform = PLATFORMS[platformId];
  const selectedLayer = layers.find((l) => l.id === selectedId) || null;

  const canvasBlock = (
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

  const editControls = (
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
          <Btn small variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={uploadLoading} loading={uploadLoading}>
            <Upload className="size-3.5" /> Upload
          </Btn>
          <input
            ref={fileInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => addUploadedImage(e.target.files?.[0])}
          />
        </div>
        {stickerPickerOpen && (
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
          accent={accent}
        />
      ) : (
        <p className="m-0 rounded-xl border border-dashed border-border p-4 text-center text-[11.5px] text-muted-foreground">
          Tap to style
        </p>
      )}
    </div>
  );

  const downloadRow = (
    <Btn variant="gold" onClick={handleDownload} disabled={!ready || downloading} loading={downloading} className="w-full">
      <Download className="size-4" /> {downloading ? "Preparing…" : "Download"}
    </Btn>
  );

  if (isPhone) {
    return (
      <div className="grid gap-4">
        <div className="flex min-w-0 w-full flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5">
          {canvasBlock}
        </div>
        {downloadRow}
        {!sheetOpen && (
          <Btn variant="ghost" onClick={() => setSheetOpen(true)}>
            <SlidersHorizontal className="size-4" /> Edit content & style
          </Btn>
        )}
        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Edit">
          <div className="p-4">
            {editControls}
          </div>
        </BottomSheet>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-[1fr_300px]">
      <div className="sticky top-4 flex min-w-0 w-full flex-col items-center gap-3 self-start rounded-2xl border border-border bg-card p-5">
        {canvasBlock}
      </div>
      <div className="grid gap-4">
        {editControls}
        {downloadRow}
      </div>
    </div>
  );
}
