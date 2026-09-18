"use client";
/**
 * postTemplates.js — the layer-rendering engine behind /brand's "Create a
 * post" composer. A post is an array of layers (text or sticker), each
 * independently positioned, fonted, sized, and spaced — not three fixed
 * text slots in a fixed spot. Picking a "shape" (Tip/Quote/Stat) just seeds
 * a starting layer set via INITIAL_LAYOUTS; everything about it is then
 * freely draggable and restyled, the same "start from a template, then
 * make it yours" shape every real design tool (Canva, Instagram's own
 * Stories editor) actually uses — not a from-scratch blank canvas, and not
 * a locked template either.
 *
 * Coordinates are stored as FRACTIONS of the canvas (0-1), not pixels — a
 * layer dragged on a Square canvas lands in the same relative spot after
 * switching to Story, instead of jumping to a pixel position that no
 * longer means anything once the canvas size changes.
 */
import { wrapText, fillTrackedText } from "./assetKit";

const INK = "#f5f0e6";
const MUTED = "#a89b7e";
const BG = "#0a0a0a";

// ── Fonts — five real, distinct registers, picked for being genuinely
// common in this exact category (social/quote/statement graphics), not
// house taste: a clean default sans, a bold geometric sans (what most
// Canva-style templates default to), a bold condensed impact face (the
// standard for punchy statement text), a handwritten script, and a
// classic serif for an editorial/quote feel. ─────────────────────────────
export const FONT_STACKS = {
  sans: '"Helvetica Neue", Arial, sans-serif',
  display: '"Unbounded", "Helvetica Neue", sans-serif',
  geometric: '"Poppins", "Helvetica Neue", sans-serif',
  impact: '"Bebas Neue", "Helvetica Neue", sans-serif',
  script: '"Caveat", cursive',
  serif: 'Georgia, "Times New Roman", serif',
};
export const FONT_OPTIONS = [
  { id: "sans", label: "Clean" },
  { id: "geometric", label: "Modern" },
  { id: "display", label: "Bold" },
  { id: "impact", label: "Impact" },
  { id: "script", label: "Script" },
  { id: "serif", label: "Serif" },
];

function hexToHsl(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}
function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to255 = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${to255(r)}${to255(g)}${to255(b)}`;
}
function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function deriveAccent(primaryHex) {
  const [h, s] = hexToHsl(primaryHex);
  return {
    primary: primaryHex,
    bright: hslToHex(h, Math.max(s * 0.5, 0.35), 0.86),
    deep: hslToHex(h, Math.min(s * 1.1, 1), 0.19),
  };
}
export const DEFAULT_ACCENT = deriveAccent("#f59e0b");

export const newId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `l${Date.now()}${Math.random().toString(36).slice(2)}`);

// ── Layer factories ──────────────────────────────────────────────────────
export function makeTextLayer(overrides = {}) {
  return {
    id: newId(), type: "text",
    text: "Your text",
    font: "sans", weight: 700, italic: false,
    sizeFrac: 0.04, spacingFrac: 0.001, lineHeightMult: 1.25,
    align: "center", color: "ink", gradientFill: false, bounce: false, highlight: false, karaoke: false,
    x: 0.5, y: 0.46, maxWidthFrac: 0.8,
    ...overrides,
  };
}
export function makeStickerLayer(overrides = {}) {
  return {
    id: newId(), type: "sticker",
    kind: "emoji", value: "✨",
    x: 0.5, y: 0.5, sizeFrac: 0.14,
    ...overrides,
  };
}

// ── Starting layouts — seed a layer array from AI-suggestion-shaped
// fields ({eyebrow, headline, subtext}); everything below is just a
// starting point, freely draggable/restyled afterward. ──────────────────
export const INITIAL_LAYOUTS = {
  tip: ({ eyebrow, headline, subtext }) => [
    makeTextLayer({ text: eyebrow || "", role: "eyebrow", font: "sans", weight: 700, sizeFrac: 0.023, spacingFrac: 0.0035, align: "left", color: "accent", x: 0.09, y: 0.28, maxWidthFrac: 0.82 }),
    makeTextLayer({ text: headline || "", role: "headline", font: "sans", weight: 800, sizeFrac: 0.06, align: "left", color: "ink", x: 0.09, y: 0.36, maxWidthFrac: 0.82 }),
    makeTextLayer({ text: subtext || "", role: "subtext", font: "sans", weight: 400, sizeFrac: 0.027, align: "left", color: "muted", x: 0.09, y: 0.6, maxWidthFrac: 0.82 }),
  ],
  quote: ({ headline, subtext }) => [
    makeTextLayer({ text: `"${headline || ""}"`, role: "headline", font: "serif", italic: true, weight: 500, sizeFrac: 0.062, align: "center", color: "ink", x: 0.5, y: 0.36, maxWidthFrac: 0.78 }),
    makeTextLayer({ text: subtext || "— Noqeev", role: "subtext", font: "sans", weight: 700, sizeFrac: 0.022, align: "center", color: "muted", x: 0.5, y: 0.58, maxWidthFrac: 0.7 }),
  ],
  // The headline here can wrap to 2 lines at this size for anything longer
  // than a single short word (e.g. "3 minutes") — eyebrow/caption sit far
  // enough away (0.22 / 0.72) to clear a 2-line wrap without overlapping;
  // a genuinely one-word stat just leaves a bit more open space, which
  // reads as intentional breathing room rather than a mistake.
  stat: ({ eyebrow, headline, subtext }) => [
    makeTextLayer({ text: eyebrow || "", role: "eyebrow", font: "sans", weight: 700, sizeFrac: 0.023, spacingFrac: 0.0035, align: "center", color: "accent", x: 0.5, y: 0.22, maxWidthFrac: 0.82 }),
    makeTextLayer({ text: headline || "", role: "headline", font: "display", weight: 800, sizeFrac: 0.12, align: "center", color: "accent", gradientFill: true, x: 0.5, y: 0.32, maxWidthFrac: 0.85 }),
    makeTextLayer({ text: subtext || "", role: "subtext", font: "sans", weight: 400, sizeFrac: 0.026, align: "center", color: "muted", x: 0.5, y: 0.72, maxWidthFrac: 0.72 }),
  ],
};
export const SHAPES = [
  { id: "tip", label: "Tip", description: "Eyebrow, headline, supporting line." },
  { id: "quote", label: "Quote", description: "A short line in the brand's own voice." },
  { id: "stat", label: "Stat", description: "One number, made the whole point." },
];

// ── Rendering ─────────────────────────────────────────────────────────────
function paintBase(ctx, w, h) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);
}
function paintGlow(ctx, w, h, cx, cy, radius, accent, strength = 0.2) {
  const [r, g, b] = hexToRgb(accent.primary);
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  glow.addColorStop(0, `rgba(${r},${g},${b},${strength})`);
  glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

// A wave baseline — the one animation-flavored ask this file can actually
// deliver in a still image: each character rides a gentle sine offset
// instead of sitting on a flat line. Real, simple, and the same trick
// "bouncy" party/kids-brand text has always used long before anyone
// called it a GIF.
function fillBounceText(ctx, text, x, y, trackingPx, align, sizePx) {
  const amplitude = sizePx * 0.12;
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + trackingPx * Math.max(0, chars.length - 1);
  let cursor = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  chars.forEach((ch, i) => {
    ctx.fillText(ch, cursor, y + Math.sin(i * 0.9) * amplitude);
    cursor += widths[i] + trackingPx;
  });
  ctx.textAlign = prevAlign;
}

function resolveColor(colorKey, accent) {
  if (colorKey === "accent") return accent.primary;
  if (colorKey === "muted") return MUTED;
  if (colorKey === "white") return "#ffffff";
  if (colorKey === "black") return "#0a0a0a";
  return INK;
}

/** Draws one text layer and returns its bounding box in PIXEL space, for
 * hit-testing drags/selection against. layer.x/y is the TOP anchor of the
 * text block (left/center/right per layer.align), not its baseline. */
function drawTextLayer(ctx, w, h, layer, accent) {
  // Text size/tracking scale off the SHORTER side, not always the
  // width — a wide-but-short canvas (Landscape, 1600x900) would
  // otherwise size every layer off its 1600px width with only 900px of
  // height to fit it in, blowing headlines up far past what the format
  // can actually hold. Square/Portrait/Story/Pin are all already
  // width<=height, so min(w,h) === w there and this changes nothing for
  // them — it only corrects the one format where w > h.
  const sizeBasis = Math.min(w, h);
  const sizePx = layer.sizeFrac * sizeBasis;
  const trackingPx = layer.spacingFrac * sizeBasis;
  const lineHeightPx = sizePx * layer.lineHeightMult;
  const maxWidthPx = layer.maxWidthFrac * w;
  const weight = layer.weight || 700;
  const style = layer.italic ? "italic " : "";
  ctx.font = `${style}${weight} ${sizePx}px ${FONT_STACKS[layer.font] || FONT_STACKS.sans}`;
  ctx.textBaseline = "alphabetic";

  const lines = layer.text ? wrapText(ctx, layer.text, maxWidthPx) : [];
  const anchorXPx = layer.x * w;
  const topYPx = layer.y * h;

  // Measured up front (not inside the draw loop below) so the highlight
  // box — drawn BEHIND the text — already knows the block's real
  // dimensions instead of guessing at them before any line is measured.
  const widestLine = lines.length ? Math.max(...lines.map((line) => ctx.measureText(line).width)) : 0;
  const blockW = Math.min(maxWidthPx, widestLine) || sizePx * 2;
  const blockH = Math.max(lines.length, 1) * lineHeightPx;
  const boxX = layer.align === "center" ? anchorXPx - blockW / 2 : layer.align === "right" ? anchorXPx - blockW : anchorXPx;

  // The IG Story / WhatsApp status "caption chip" look — a solid block
  // behind the whole text, not per-line — so captions stay legible over
  // any video frame regardless of what's underneath.
  if (layer.highlight && lines.length) {
    const padX = sizePx * 0.34, padY = sizePx * 0.22;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    const rx = boxX - padX, ry = topYPx - padY, rw = blockW + padX * 2, rh = blockH + padY * 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(rx, ry, rw, rh, sizePx * 0.16);
    else ctx.rect(rx, ry, rw, rh);
    ctx.fill();
    ctx.restore();
  }

  if (layer.gradientFill) {
    const gradient = ctx.createLinearGradient(0, topYPx, 0, topYPx + blockH);
    gradient.addColorStop(0, accent.bright);
    gradient.addColorStop(0.38, accent.primary);
    gradient.addColorStop(1, accent.deep);
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = resolveColor(layer.color, accent);
  }

  let lineY = topYPx + sizePx * 0.85;
  lines.forEach((line) => {
    ctx.font = `${style}${weight} ${sizePx}px ${FONT_STACKS[layer.font] || FONT_STACKS.sans}`;
    if (layer.bounce) fillBounceText(ctx, line, anchorXPx, lineY, trackingPx, layer.align, sizePx);
    else fillTrackedText(ctx, line, anchorXPx, lineY, trackingPx, layer.align);
    lineY += lineHeightPx;
  });

  return { x: boxX, y: topYPx, w: blockW, h: blockH };
}

function measureWordWidth(ctx, word, trackingPx) {
  const widths = [...word].map((ch) => ctx.measureText(ch).width);
  return widths.reduce((a, b) => a + b, 0) + trackingPx * Math.max(0, word.length - 1);
}

/** The CapCut/TikTok "auto-caption" look — same text layer as
 * drawTextLayer, but laid out WORD by word (not line by line) so
 * `activeIndex` (see karaoke.js's activeWordIndex) can be boxed in the
 * accent colour while every other word stays in the layer's normal
 * colour. Returns the same bbox shape as drawTextLayer, for identical
 * drag hit-testing whichever renderer actually drew this layer. */
function drawKaraokeTextLayer(ctx, w, h, layer, accent, activeIndex) {
  const sizeBasis = Math.min(w, h); // see drawTextLayer's own comment on this
  const sizePx = layer.sizeFrac * sizeBasis;
  const trackingPx = layer.spacingFrac * sizeBasis;
  const lineHeightPx = sizePx * layer.lineHeightMult;
  const maxWidthPx = layer.maxWidthFrac * w;
  const weight = layer.weight || 700;
  const style = layer.italic ? "italic " : "";
  ctx.font = `${style}${weight} ${sizePx}px ${FONT_STACKS[layer.font] || FONT_STACKS.sans}`;
  ctx.textBaseline = "alphabetic";

  const words = (layer.text || "").trim().split(/\s+/).filter(Boolean);
  const spaceWidth = ctx.measureText(" ").width + trackingPx;
  const anchorXPx = layer.x * w;
  const topYPx = layer.y * h;

  // Word-wrap into lines while keeping each word's own measured width —
  // drawTextLayer only needs whole-line widths, but positioning (and
  // boxing) one word at a time needs to know where each one starts.
  const lines = [];
  let current = [];
  let currentWidth = 0;
  words.forEach((word) => {
    const wordW = measureWordWidth(ctx, word, trackingPx);
    const attemptWidth = current.length ? currentWidth + spaceWidth + wordW : wordW;
    if (attemptWidth > maxWidthPx && current.length) {
      lines.push({ words: current, width: currentWidth });
      current = [{ word, width: wordW }];
      currentWidth = wordW;
    } else {
      current.push({ word, width: wordW });
      currentWidth = attemptWidth;
    }
  });
  if (current.length) lines.push({ words: current, width: currentWidth });

  const blockW = Math.min(maxWidthPx, lines.length ? Math.max(...lines.map((l) => l.width)) : 0) || sizePx * 2;
  const blockH = Math.max(lines.length, 1) * lineHeightPx;
  const boxX = layer.align === "center" ? anchorXPx - blockW / 2 : layer.align === "right" ? anchorXPx - blockW : anchorXPx;

  if (layer.highlight && lines.length) {
    const padX = sizePx * 0.34, padY = sizePx * 0.22;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    const rx = boxX - padX, ry = topYPx - padY, rw = blockW + padX * 2, rh = blockH + padY * 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(rx, ry, rw, rh, sizePx * 0.16);
    else ctx.rect(rx, ry, rw, rh);
    ctx.fill();
    ctx.restore();
  }

  let globalIndex = 0;
  let lineY = topYPx + sizePx * 0.85;
  lines.forEach((line) => {
    let cursor = layer.align === "center" ? anchorXPx - line.width / 2 : layer.align === "right" ? anchorXPx - line.width : anchorXPx;
    line.words.forEach(({ word, width }) => {
      const isActive = globalIndex === activeIndex;
      if (isActive) {
        const padX = sizePx * 0.16, padY = sizePx * 0.14;
        ctx.save();
        ctx.fillStyle = accent.primary;
        const rx = cursor - padX, ry = lineY - sizePx * 0.78 - padY, rw = width + padX * 2, rh = sizePx + padY * 2;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(rx, ry, rw, rh, sizePx * 0.14);
        else ctx.rect(rx, ry, rw, rh);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = isActive ? "#ffffff" : resolveColor(layer.color, accent);
      fillTrackedText(ctx, word, cursor, lineY, trackingPx, "left");
      cursor += width + spaceWidth;
      globalIndex++;
    });
    lineY += lineHeightPx;
  });

  return { x: boxX, y: topYPx, w: blockW, h: blockH };
}

function drawStickerLayer(ctx, w, h, images, layer) {
  const sizePx = layer.sizeFrac * Math.min(w, h); // see drawTextLayer's own comment on this
  const cx = layer.x * w, cy = layer.y * h;
  if (layer.kind === "emoji") {
    ctx.font = `${sizePx}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(layer.value, cx, cy);
    ctx.textAlign = "left";
  } else {
    const img = images?.[layer.value];
    if (img?.complete && img.naturalWidth) {
      ctx.drawImage(img, cx - sizePx / 2, cy - sizePx / 2, sizePx, sizePx);
    }
  }
  return { x: cx - sizePx / 2, y: cy - sizePx / 2, w: sizePx, h: sizePx };
}

/** Renders the full post (background, ambient glow, every layer in order,
 * brand stamp) and returns a Map<layerId, bbox> in pixel space so the
 * composer can hit-test drags without re-measuring anything itself. */
export function renderPost(ctx, w, h, layers, markImg, accent, handle, stickerImages, opts = {}) {
  // opts lets a caller composite ONLY the layers — no background/glow, no
  // brand stamp — onto an already-transparent (or already-painted-with-
  // something-else) canvas. Used by the story-assembly tool's live
  // preview (layers drawn on top of a video/image frame already on the
  // canvas) and its caption-PNG export (layers drawn on a blank
  // transparent canvas, so the result composites correctly via ffmpeg's
  // overlay filter). Every existing call site passes no 9th argument, so
  // both default to false and this is a no-op change for them.
  const { skipBackground = false, skipStamp = false, activeWordIndex } = opts;
  if (!skipBackground) {
    paintBase(ctx, w, h);
    paintGlow(ctx, w, h, w * 0.82, h * 0.14, w * 0.6, accent);
  }

  const boxes = new Map();
  for (const layer of layers) {
    if (layer.type !== "text") { boxes.set(layer.id, drawStickerLayer(ctx, w, h, stickerImages, layer)); continue; }
    boxes.set(
      layer.id,
      layer.karaoke && activeWordIndex != null
        ? drawKaraokeTextLayer(ctx, w, h, layer, accent, activeWordIndex)
        : drawTextLayer(ctx, w, h, layer, accent),
    );
  }

  if (markImg && !skipStamp) {
    const stampBasis = Math.min(w, h); // see drawTextLayer's own comment on this
    const markSize = stampBasis * 0.09;
    const pad = stampBasis * 0.06;
    paintBrandStamp(ctx, markImg, w - pad - markSize, h - pad - markSize - (handle ? markSize * 0.34 : 0), markSize, handle);
  }
  return boxes;
}

// The watermark + handle stamp — also used standalone by ScreenshotStudio.js,
// which doesn't go through renderPost's layer loop at all.
export function paintBrandStamp(ctx, markImg, x, y, size, handle) {
  ctx.drawImage(markImg, x, y, size, size);
  if (handle?.trim()) {
    ctx.fillStyle = MUTED;
    ctx.font = `700 ${size * 0.26}px ${FONT_STACKS.sans}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(handle.trim(), x + size / 2, y + size + size * 0.34);
    ctx.textAlign = "left";
  }
}

// ── Real platform export sizes, grouped by the handful of DISTINCT
// aspect ratios the whole social landscape actually reduces to. ──────────
export const PLATFORMS = {
  square: { label: "Square", sub: "Instagram · Facebook · X · Reddit · LinkedIn", w: 1080, h: 1080 },
  portrait: { label: "Portrait", sub: "Instagram feed (4:5) · LinkedIn", w: 1080, h: 1350 },
  story: { label: "Story", sub: "IG/FB Story · TikTok · Reels · Shorts", w: 1080, h: 1920 },
  landscape: { label: "Landscape", sub: "X card · LinkedIn/FB link · YouTube thumb", w: 1600, h: 900 },
  pin: { label: "Pin", sub: "Pinterest (2:3)", w: 1000, h: 1500 },
};
