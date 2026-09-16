"use client";
/**
 * ScreenshotStudio.js — capture a real screen/window (or upload an image),
 * crop it, brush-blur anything that shouldn't be public (a real name, a
 * real email, anything on screen during the capture), wrap it in a frame,
 * stamp the mark/handle, export it sized for whichever platform it's
 * shipping to. Built for turning an actual product screen into something
 * postable without leaving this page.
 *
 * How the blur brush actually works (no image-processing library involved):
 * the source image is drawn twice into two offscreen canvases — sharp and
 * fully blurred (ctx.filter = "blur(...)"). A third offscreen canvas (the
 * "mask") starts empty; painting the brush draws soft white circles onto
 * it. Every redraw composites: mask → clip the blurred copy to only the
 * painted areas (destination-in) → draw that clipped result over the sharp
 * copy. Standard reveal-through-a-mask technique, entirely canvas 2D.
 *
 * Crop is non-destructive — stored as a rectangle in the SOURCE image's
 * own pixel space, dragged out on an always-full-frame working canvas
 * (dimmed outside the selection via a CSS box-shadow spread, not a second
 * canvas). Only applied for real at export time, onto whichever platform
 * canvas is picked, inside whichever frame style is picked.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Upload, Loader2, Download, RotateCcw, Eraser, Crop as CropIcon, Paintbrush } from "lucide-react";
import { Btn } from "@/components/premium/guest/components/primitives";
import { Input } from "@/components/ui/input";
import {
  loadMarkImage, ensureFontsReady, canvasToPngBlob, downloadBlob,
  loadHandle, saveHandle,
} from "./assetKit";
import { paintBrandStamp, PLATFORMS } from "./postTemplates";
import { EmailAssetButton } from "./EmailAssetButton";

const FRAMES = {
  none: { label: "None", description: "Just the cropped shot, full-bleed." },
  card: { label: "Clean card", description: "Rounded corners, soft shadow, brand background." },
  browser: { label: "Browser bar", description: "A fake traffic-light bar on top — reads as a real page." },
};

const BLUR_RADIUS_PX = 28; // strength of the blur itself, not the brush size
const DISPLAY_MAX_W = 640;
const DISPLAY_MAX_H = 420;

function fitWithin(w, h, maxW, maxH) {
  const scale = Math.min(maxW / w, maxH / h, 1);
  return { width: Math.round(w * scale), height: Math.round(h * scale), scale };
}

export function ScreenshotStudio() {
  const [sourceImg, setSourceImg] = useState(null); // HTMLImageElement | null
  const [capturing, setCapturing] = useState(false);
  const [crop, setCrop] = useState(null); // {x,y,w,h} in source pixels
  const [tool, setTool] = useState("crop"); // "crop" | "blur"
  const [brushSize, setBrushSize] = useState(36);
  const [frameId, setFrameId] = useState("card");
  const [platformId, setPlatformId] = useState("square");
  const [handle, setHandle] = useState("");
  const [maskVersion, setMaskVersion] = useState(0); // bump to force a recomposite after a blur stroke
  const [downloading, setDownloading] = useState(false);

  const displayCanvasRef = useRef(null); // what's actually shown
  const sharpCanvasRef = useRef(null);
  const blurredCanvasRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const markImgRef = useRef(null);
  const fileInputRef = useRef(null);

  const dragRef = useRef(null); // { startX, startY } in source-pixel space, while drawing a new crop
  const drawingRef = useRef(false); // true while actively dragging (crop OR blur stroke)
  const maskEverPaintedRef = useRef(false); // skips the extra blur-composite pass until the brush has actually been used once

  useEffect(() => {
    setHandle(loadHandle());
    Promise.all([loadMarkImage(), ensureFontsReady()]).then(([img]) => { markImgRef.current = img; });
  }, []);

  const updateHandle = (v) => { setHandle(v); saveHandle(v); };

  // ── Loading a source image (from either capture or upload) ─────────────
  const setSource = (img) => {
    const sw = img.naturalWidth, sh = img.naturalHeight;
    sharpCanvasRef.current = Object.assign(document.createElement("canvas"), { width: sw, height: sh });
    sharpCanvasRef.current.getContext("2d").drawImage(img, 0, 0);

    blurredCanvasRef.current = Object.assign(document.createElement("canvas"), { width: sw, height: sh });
    const bctx = blurredCanvasRef.current.getContext("2d");
    bctx.filter = `blur(${BLUR_RADIUS_PX}px)`;
    // Drawn 1px oversized-and-shifted-back is unnecessary here — canvas blur
    // already samples from fully within its own bounds correctly for a
    // straight drawImage, no edge-darkening workaround needed at this scale.
    bctx.drawImage(img, 0, 0);

    maskCanvasRef.current = Object.assign(document.createElement("canvas"), { width: sw, height: sh });

    setSourceImg(img);
    setCrop({ x: 0, y: 0, w: sw, h: sh });
    setMaskVersion((v) => v + 1);
  };

  const loadImageFromBlob = (blob) =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });

  const capture = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      toast.error("Screen capture isn't available in this browser — try Upload instead.");
      return;
    }
    setCapturing(true);
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      // One real frame, then the capture stream is released immediately —
      // this is a screenshot, not a recording, and holding a live capture
      // permission open any longer than it takes to grab one frame is
      // exactly the kind of thing that should end the moment it's done.
      await new Promise((r) => requestAnimationFrame(r));
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);
      const blob = await canvasToPngBlob(canvas);
      setSource(await loadImageFromBlob(blob));
    } catch (e) {
      if (e?.name !== "NotAllowedError") toast.error("Could not capture the screen.");
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
      setCapturing(false);
    }
  };

  const handleUpload = async (file) => {
    if (!file || !file.type.startsWith("image/")) { toast.error("Pick an image file."); return; }
    try {
      setSource(await loadImageFromBlob(file));
    } catch {
      toast.error("Could not read that image.");
    }
  };

  const reset = () => {
    setSourceImg(null);
    setCrop(null);
    sharpCanvasRef.current = null;
    blurredCanvasRef.current = null;
    maskCanvasRef.current = null;
  };

  // ── Composite + redraw the visible working canvas: sharp, with the
  // blurred copy revealed only where the mask has been painted. ─────────
  const redraw = () => {
    const canvas = displayCanvasRef.current;
    const sharp = sharpCanvasRef.current;
    if (!canvas || !sharp) return;
    const sw = sharp.width, sh = sharp.height;
    const { width, height, scale } = fitWithin(sw, sh, DISPLAY_MAX_W, DISPLAY_MAX_H);
    canvas.width = sw; canvas.height = sh; // full source resolution — CSS below scales it down for display only
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.dataset.scale = String(scale);

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, sw, sh);
    ctx.drawImage(sharp, 0, 0);

    const maskCanvas = maskCanvasRef.current;
    const blurred = blurredCanvasRef.current;
    // Skip the extra composite pass entirely when nobody's used the blur
    // brush yet — no visible difference, one less offscreen canvas per
    // redraw for the common case.
    if (maskEverPaintedRef.current) {
      const clipped = document.createElement("canvas");
      clipped.width = sw; clipped.height = sh;
      const cctx = clipped.getContext("2d");
      cctx.drawImage(blurred, 0, 0);
      cctx.globalCompositeOperation = "destination-in";
      cctx.drawImage(maskCanvas, 0, 0);
      ctx.drawImage(clipped, 0, 0);
    }
  };

  useEffect(() => { if (sourceImg) redraw(); }, [sourceImg, maskVersion]);

  // ── Pointer handling on the working canvas — crop-drag or blur-paint,
  // depending on which tool is active. Coordinates come in as CSS pixels
  // relative to the canvas element; scale converts to real source pixels. ──
  const pointFromEvent = (e) => {
    const canvas = displayCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    return { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale };
  };

  const paintBlurAt = (x, y) => {
    const maskCtx = maskCanvasRef.current.getContext("2d");
    const scale = displayCanvasRef.current.width / displayCanvasRef.current.getBoundingClientRect().width;
    const r = (brushSize / 2) * scale;
    const grad = maskCtx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    maskCtx.fillStyle = grad;
    maskCtx.beginPath();
    maskCtx.arc(x, y, r, 0, Math.PI * 2);
    maskCtx.fill();
    maskEverPaintedRef.current = true;
  };

  const onPointerDown = (e) => {
    if (!sourceImg) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pointFromEvent(e);
    drawingRef.current = true;
    if (tool === "crop") {
      dragRef.current = p;
      setCrop({ x: p.x, y: p.y, w: 0, h: 0 });
    } else {
      paintBlurAt(p.x, p.y);
      redraw();
    }
  };
  const onPointerMove = (e) => {
    if (!drawingRef.current) return;
    const p = pointFromEvent(e);
    if (tool === "crop" && dragRef.current) {
      const start = dragRef.current;
      const sw = sharpCanvasRef.current.width, sh = sharpCanvasRef.current.height;
      const x0 = Math.max(0, Math.min(start.x, p.x));
      const y0 = Math.max(0, Math.min(start.y, p.y));
      const x1 = Math.min(sw, Math.max(start.x, p.x));
      const y1 = Math.min(sh, Math.max(start.y, p.y));
      setCrop({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    } else if (tool === "blur") {
      paintBlurAt(p.x, p.y);
      redraw();
    }
  };
  const onPointerUp = () => {
    drawingRef.current = false;
    dragRef.current = null;
    if (tool === "crop" && crop && (crop.w < 8 || crop.h < 8)) {
      // A stray click rather than a real drag — treat it as "select everything" instead of a sliver nobody meant to crop to.
      setCrop({ x: 0, y: 0, w: sharpCanvasRef.current.width, h: sharpCanvasRef.current.height });
    }
  };

  const clearBlur = () => {
    const m = maskCanvasRef.current;
    m.getContext("2d").clearRect(0, 0, m.width, m.height);
    maskEverPaintedRef.current = false;
    redraw();
    toast.success("Blur cleared.");
  };

  // ── Final export: recomposite the (sharp+blur-masked) source, crop it,
  // frame it, stamp it, place it inside whichever platform canvas. ───────
  const buildExportCanvas = () => {
    const sw = sharpCanvasRef.current.width, sh = sharpCanvasRef.current.height;
    // Rebuild the full composite fresh (not the display canvas, which is
    // CSS-scaled) so the export always uses true source resolution.
    const full = document.createElement("canvas");
    full.width = sw; full.height = sh;
    const fctx = full.getContext("2d");
    fctx.drawImage(sharpCanvasRef.current, 0, 0);
    if (maskEverPaintedRef.current) {
      const clipped = document.createElement("canvas");
      clipped.width = sw; clipped.height = sh;
      const cctx = clipped.getContext("2d");
      cctx.drawImage(blurredCanvasRef.current, 0, 0);
      cctx.globalCompositeOperation = "destination-in";
      cctx.drawImage(maskCanvasRef.current, 0, 0);
      fctx.drawImage(clipped, 0, 0);
    }

    const c = crop && crop.w > 0 && crop.h > 0 ? crop : { x: 0, y: 0, w: sw, h: sh };

    const platform = PLATFORMS[platformId];
    const out = document.createElement("canvas");
    out.width = platform.w; out.height = platform.h;
    const octx = out.getContext("2d");
    octx.fillStyle = "#0a0a0a";
    octx.fillRect(0, 0, platform.w, platform.h);

    const pad = frameId === "none" ? 0 : platform.w * 0.06;
    const availW = platform.w - pad * 2;
    const availH = platform.h - pad * 2 - (frameId === "browser" ? platform.w * 0.05 : 0);
    const fit = Math.min(availW / c.w, availH / c.h);
    const drawW = c.w * fit, drawH = c.h * fit;
    const drawX = (platform.w - drawW) / 2;
    const barH = frameId === "browser" ? platform.w * 0.05 : 0;
    const drawY = (platform.h - drawH - barH) / 2 + barH;

    if (frameId === "card" || frameId === "browser") {
      octx.save();
      octx.shadowColor = "rgba(0,0,0,0.45)";
      octx.shadowBlur = platform.w * 0.03;
      octx.shadowOffsetY = platform.w * 0.012;
      const radius = platform.w * 0.014;
      roundRectPath(octx, drawX, drawY - barH, drawW, drawH + barH, radius);
      octx.fillStyle = "#1c1912";
      octx.fill();
      octx.restore();

      if (frameId === "browser") {
        ["#f45f54", "#f7bd52", "#33c748"].forEach((color, i) => {
          octx.beginPath();
          octx.arc(drawX + platform.w * 0.02 + i * platform.w * 0.018, drawY - barH / 2, platform.w * 0.006, 0, Math.PI * 2);
          octx.fillStyle = color;
          octx.fill();
        });
      }

      octx.save();
      roundRectPath(octx, drawX, drawY, drawW, drawH, frameId === "browser" ? 0 : radius);
      octx.clip();
      octx.drawImage(full, c.x, c.y, c.w, c.h, drawX, drawY, drawW, drawH);
      octx.restore();
    } else {
      octx.drawImage(full, c.x, c.y, c.w, c.h, drawX, drawY, drawW, drawH);
    }

    if (markImgRef.current) {
      const markSize = platform.w * 0.07;
      paintBrandStamp(octx, markImgRef.current, platform.w - pad - markSize, platform.h - pad - markSize, markSize, handle);
    }
    return out;
  };

  const exportBlob = async () => canvasToPngBlob(buildExportCanvas());
  const exportFilename = () => `noqeev-screenshot-${platformId}.png`;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      downloadBlob(await exportBlob(), exportFilename());
    } catch {
      toast.error("Could not export this image.");
    } finally {
      setDownloading(false);
    }
  };

  if (!sourceImg) {
    return (
      <div className="grid gap-3 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
        <p className="m-0 text-[13.5px] text-muted-foreground">
          Capture a real screen (a browser tab, a window) or upload one you already took.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Btn variant="gold" onClick={capture} disabled={capturing} loading={capturing}>
            <Camera className="size-4" /> {capturing ? "Waiting for permission…" : "Capture screen"}
          </Btn>
          <Btn variant="ghost" onClick={() => fileInputRef.current?.click()}>
            <Upload className="size-4" /> Upload image
          </Btn>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0])} />
        </div>
      </div>
    );
  }

  const boxStyle = crop && sharpCanvasRef.current
    ? (() => {
        const canvas = displayCanvasRef.current;
        if (!canvas) return null;
        const displayScale = parseFloat(canvas.dataset.scale || "1");
        return {
          left: crop.x / displayScale, top: crop.y / displayScale,
          width: crop.w / displayScale, height: crop.h / displayScale,
        };
      })()
    : null;

  return (
    <div className="grid gap-5 sm:grid-cols-[1fr_280px]">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5">
        <div className="relative" style={{ touchAction: "none" }}>
          <canvas
            ref={displayCanvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="block rounded-lg"
            style={{ cursor: tool === "crop" ? "crosshair" : "cell" }}
          />
          {tool === "crop" && boxStyle && (
            <div
              className="pointer-events-none absolute border-2 border-primary"
              style={{ ...boxStyle, boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" }}
            />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setTool("crop")} aria-pressed={tool === "crop"}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-bold ${tool === "crop" ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
            <CropIcon className="size-3.5" /> Crop
          </button>
          <button type="button" onClick={() => setTool("blur")} aria-pressed={tool === "blur"}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-bold ${tool === "blur" ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
            <Paintbrush className="size-3.5" /> Blur
          </button>
          {tool === "blur" && (
            <>
              <input type="range" min="14" max="90" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-24 accent-primary" />
              <button type="button" onClick={clearBlur} title="Clear blur" className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground">
                <Eraser className="size-3.5" />
              </button>
            </>
          )}
          <button type="button" onClick={reset} title="Start over" className="ml-1 flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground">
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        <div>
          <p className="m-0 mb-2 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">Frame</p>
          <div className="grid gap-1.5">
            {Object.entries(FRAMES).map(([id, f]) => (
              <button key={id} type="button" onClick={() => setFrameId(id)} aria-pressed={frameId === id}
                className={`rounded-lg border px-3 py-2 text-left ${frameId === id ? "border-primary/30 bg-primary/10" : "border-border bg-card"}`}>
                <p className={`m-0 text-[12px] font-bold ${frameId === id ? "text-primary" : "text-foreground"}`}>{f.label}</p>
                <p className="m-0 text-[10.5px] text-muted-foreground">{f.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="m-0 mb-2 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">Platform</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(PLATFORMS).map(([id, r]) => (
              <button key={id} type="button" onClick={() => setPlatformId(id)} aria-pressed={platformId === id} title={r.sub}
                className={`rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${platformId === id ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[11.5px] font-bold tracking-wide text-foreground">Your handle (optional watermark)</label>
          <Input value={handle} onChange={(e) => updateHandle(e.target.value)} className="h-10 rounded-[10px] text-[13.5px]" />
        </div>

        <div className="flex gap-2">
          <Btn variant="gold" onClick={handleDownload} disabled={downloading} loading={downloading} className="flex-1">
            <Download className="size-4" /> {downloading ? "Preparing…" : "Download"}
          </Btn>
          <EmailAssetButton getBlob={exportBlob} filename={exportFilename()} label="screenshot" />
        </div>
      </div>
    </div>
  );
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
