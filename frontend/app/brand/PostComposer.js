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
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Download, Loader2, Sparkles, Type, Smile, ImagePlus, Trash2,
  AlignLeft, AlignCenter, AlignRight, Waves,
} from "lucide-react";
import { Btn } from "@/components/premium/guest/components/primitives";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/components/premium/shared/api";
import {
  loadMarkImage, ensureFontsReady, canvasToPngBlob, downloadBlob,
  loadHandle, saveHandle,
} from "./assetKit";
import {
  renderPost, PLATFORMS, DEFAULT_ACCENT, SHAPES, INITIAL_LAYOUTS,
  FONT_OPTIONS, makeTextLayer, makeStickerLayer,
} from "./postTemplates";
import { EmailAssetButton } from "./EmailAssetButton";

const MOODS = ["Motivational", "Practical", "Celebratory", "Urgent", "Playful"];
const STICKER_EMOJI = ["✨", "🔥", "🎉", "💪", "🙌", "👀", "✅", "📈", "💼", "🎯", "☕", "⚡", "🚀", "💡", "🏆", "⏳"];

// Sample copy for manually picking a shape (distinct from the AI draft
// path, which supplies its own real content) — same defaults the old
// fixed-field composer shipped with.
const SHAPE_DEFAULTS = {
  tip: { eyebrow: "Noqeev · Daily tip", headline: "Cut your resume to one page before you cut anything else.", subtext: "A recruiter spends seconds on page two. Say the important thing first." },
  quote: { eyebrow: "", headline: "A gap on your resume isn't the end of the story.", subtext: "— Noqeev" },
  stat: { eyebrow: "Noqeev · By the numbers", headline: "3 minutes", subtext: "The average time it takes to tailor a resume with Noqeev." },
};

function timeOfDay(hour) {
  if (hour < 5) return "late night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function AiSuggestPanel({ onSuggestion }) {
  const [mood, setMood] = useState("Motivational");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState(null);

  useEffect(() => {
    const now = new Date();
    setContext({
      time_of_day: timeOfDay(now.getHours()),
      day_of_week: now.toLocaleDateString(undefined, { weekday: "long" }),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }, []);

  const suggest = async () => {
    setLoading(true);
    try {
      const data = await apiRequest("/api/v1/brand/suggest-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood: mood.toLowerCase(), ...context }),
      });
      onSuggestion(data);
    } catch (e) {
      toast.error(e.message || "Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
      <div className="mb-2.5 flex items-center gap-1.5">
        <Sparkles className="size-3.5 text-primary" />
        <span className="font-mono text-[10.5px] font-bold tracking-[0.1em] text-primary uppercase">AI draft</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {MOODS.map((m) => (
          <button key={m} type="button" onClick={() => setMood(m)} aria-pressed={mood === m}
            className={`rounded-full border px-3 py-1 text-[11.5px] font-semibold ${mood === m ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
            {m}
          </button>
        ))}
      </div>
      <Btn small variant="gold" onClick={suggest} disabled={loading || !context} loading={loading}>
        {loading ? "…" : "Suggest"}
      </Btn>
    </div>
  );
}

function LayerPanel({ layer, onChange, onDelete }) {
  if (!layer) return null;
  const set = (patch) => onChange({ ...layer, ...patch });

  if (layer.type === "sticker") {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">Sticker</span>
          <button type="button" onClick={onDelete} aria-label="Delete" className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
        </div>
        <label className="mb-1.5 block text-[11.5px] font-bold text-foreground">Size</label>
        <input type="range" min="0.05" max="0.35" step="0.01" value={layer.sizeFrac} onChange={(e) => set({ sizeFrac: Number(e.target.value) })} className="w-full accent-primary" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">Text</span>
        <button type="button" onClick={onDelete} aria-label="Delete" className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
      </div>
      <Textarea value={layer.text} onChange={(e) => set({ text: e.target.value })} rows={2} className="mb-3 resize-none rounded-[10px] text-[13px]" />

      <label className="mb-1.5 block text-[11px] font-bold text-foreground">Font</label>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FONT_OPTIONS.map((f) => (
          <button key={f.id} type="button" onClick={() => set({ font: f.id })} aria-pressed={layer.font === f.id}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${layer.font === f.id ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[11px] font-bold text-foreground">Size</label>
          <input type="range" min="0.015" max="0.2" step="0.005" value={layer.sizeFrac} onChange={(e) => set({ sizeFrac: Number(e.target.value) })} className="w-full accent-primary" />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-bold text-foreground">Spacing</label>
          <input type="range" min="0" max="0.012" step="0.0005" value={layer.spacingFrac} onChange={(e) => set({ spacingFrac: Number(e.target.value) })} className="w-full accent-primary" />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {[["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]].map(([id, Icon]) => (
            <button key={id} type="button" onClick={() => set({ align: id })} aria-pressed={layer.align === id}
              className={`flex size-8 items-center justify-center rounded-lg border ${layer.align === id ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
              <Icon className="size-3.5" />
            </button>
          ))}
        </div>
        <button type="button" onClick={() => set({ bounce: !layer.bounce })} aria-pressed={layer.bounce}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${layer.bounce ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
          <Waves className="size-3.5" /> Bounce
        </button>
      </div>
    </div>
  );
}

export function PostComposer({ accent = DEFAULT_ACCENT }) {
  const [shapeId, setShapeId] = useState("tip");
  const [platformId, setPlatformId] = useState("square");
  const [layers, setLayers] = useState(() => INITIAL_LAYOUTS.tip(SHAPE_DEFAULTS.tip));
  const [selectedId, setSelectedId] = useState(null);
  const [handle, setHandle] = useState("");
  const [ready, setReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [gifUrlOpen, setGifUrlOpen] = useState(false);
  const [gifUrl, setGifUrl] = useState("");
  const [gifLoading, setGifLoading] = useState(false);

  const canvasRef = useRef(null);
  const markImgRef = useRef(null);
  const stickerImagesRef = useRef({});
  const boxesRef = useRef(new Map());
  const dragRef = useRef(null);

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
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    const p = pointFromEvent(e);
    const { w, h } = PLATFORMS[platformId];
    const { id, dx, dy } = dragRef.current;
    const nx = clamp01(p.x / w - dx), ny = clamp01(p.y / h - dy);
    setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, x: nx, y: ny } : l)));
  };
  const onPointerUp = () => { dragRef.current = null; };

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

  return (
    <div className="grid gap-5 sm:grid-cols-[1fr_300px]">
      <div className="flex min-w-0 w-full flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5">
        {/* Sized with CSS aspect-ratio, not a JS-computed pixel width — the
            box just fills its container (capped by max-w) and the browser
            works out the height, so a wide shape like Landscape can never
            blow past a narrow screen the way a fixed px width did. */}
        <div
          className="relative mx-auto flex w-full max-w-[380px] items-center justify-center overflow-hidden rounded-xl bg-[#0a0a0a] shadow-[0_8px_28px_rgba(0,0,0,0.25)]"
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
      </div>

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
            <div className="mt-2 grid grid-cols-8 gap-1 rounded-lg border border-border bg-card p-2">
              {STICKER_EMOJI.map((e) => (
                <button key={e} type="button" onClick={() => addEmoji(e)} className="flex size-8 items-center justify-center rounded-md text-base hover:bg-muted">{e}</button>
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
          <LayerPanel layer={selectedLayer} onChange={updateLayer} onDelete={deleteSelected} />
        ) : (
          <p className="m-0 rounded-xl border border-dashed border-border p-4 text-center text-[11.5px] text-muted-foreground">
            Tap to style
          </p>
        )}

        <div>
          <label className="mb-1.5 block text-[11.5px] font-bold tracking-wide text-foreground">Handle</label>
          <Input value={handle} onChange={(e) => updateHandle(e.target.value)} className="h-10 rounded-[10px] text-[13.5px]" />
        </div>

        <div className="flex gap-2">
          <Btn variant="gold" onClick={handleDownload} disabled={!ready || downloading} loading={downloading} className="flex-1">
            <Download className="size-4" /> {downloading ? "Preparing…" : "Download"}
          </Btn>
          <EmailAssetButton getBlob={exportBlob} filename={exportFilename()} label={shapeId} />
        </div>
      </div>
    </div>
  );
}
