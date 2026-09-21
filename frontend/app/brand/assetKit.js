"use client";
/**
 * assetKit.js — shared machinery behind /brand's "Download & share" and
 * "Create a post" sections. Everything here draws from Logo.js's own
 * MARK_PATH/MARK_STROKE (never a hand-copied duplicate of the mark), so a
 * future change to the mark's geometry updates every exported asset this
 * page can produce without anyone needing to remember to touch this file.
 *
 * Two real gotchas this file exists to solve once, in one place, instead
 * of at every call site:
 *
 * 1. An SVG rendered into an <img> and drawn to <canvas> is an ISOLATED
 *    rendering context — it can't see this page's own stylesheets or the
 *    Google Fonts <link> in layout.js, so any <text> inside that SVG
 *    silently falls back to a generic font, not Unbounded. Text (the
 *    wordmark, a post's headline/quote) is therefore never drawn as SVG
 *    text — it's always drawn straight onto the canvas with ctx.fillText,
 *    which DOES use whatever fonts this page has already loaded.
 * 2. A webfont referenced by ctx.font before the browser has actually
 *    finished loading it silently draws in a fallback font on the very
 *    first paint. ensureFontsReady() waits on document.fonts for the
 *    specific families/weights this file draws with before anything is
 *    exported, so a download triggered the instant the page mounts still
 *    comes out in the right typeface.
 */
import { MARK_PATH, MARK_STROKE } from "@/components/premium/Logo";

const GOLD_STOPS = `
  <stop offset="0%" stop-color="#F6E6B3" />
  <stop offset="38%" stop-color="#f59e0b" />
  <stop offset="100%" stop-color="#5C4419" />
`;

// The mark alone, transparent background, generous baked-in padding (~14%)
// so every consumer below can just drawImage() it into a box at any size
// with no per-call padding math of its own. Exported directly too — the
// "download vector" button hands this raw markup straight to a .svg file,
// no canvas round-trip needed for that one.
export function markOnlySvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">${GOLD_STOPS}</linearGradient></defs>
    <svg x="14" y="14" width="72" height="72" viewBox="0 0 100 100">
      <path d="${MARK_PATH}" fill="none" stroke="url(#g)" stroke-width="${MARK_STROKE}" stroke-linecap="butt" stroke-linejoin="round" />
    </svg>
  </svg>`;
}

let _markImagePromise = null;
// Cached — every export on this page draws the same mark image, no reason
// to re-decode the SVG-to-<img> per button click.
export function loadMarkImage() {
  if (_markImagePromise) return _markImagePromise;
  _markImagePromise = new Promise((resolve, reject) => {
    const blob = new Blob([markOnlySvg()], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
  return _markImagePromise;
}

const FONT_SPECS = [
  '800 40px Unbounded',
  '700 40px Unbounded',
  '800 40px "Helvetica Neue"',
  '700 40px "Helvetica Neue"',
  'italic 500 40px Georgia',
  '800 40px Poppins',
  '400 40px "Bebas Neue"',
  '700 40px Caveat',
  '400 40px Anton',
  '700 40px Oswald',
  '800 40px Montserrat',
  '700 40px "Space Mono"',
  '700 40px "Baloo 2"',
  '400 40px "Permanent Marker"',
  '800 40px "Playfair Display"',
];
export async function ensureFontsReady() {
  try {
    await Promise.all(FONT_SPECS.map((spec) => document.fonts.load(spec)));
    await document.fonts.ready;
  } catch {
    // Best-effort — a font that never finishes loading just means that one
    // export falls back to the platform default rather than failing outright.
  }
}

// Canvas has no native word-wrap — this is the one every export below needs.
export function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word;
    if (ctx.measureText(attempt).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = attempt;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Manual letter-spacing rather than the CSS-only ctx.letterSpacing (patchy
// browser support as of this writing) — draws one character at a time so
// tracked wordmark/eyebrow text looks identical everywhere this runs.
export function fillTrackedText(ctx, text, x, y, trackingPx, align = "left") {
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + trackingPx * Math.max(0, text.length - 1);
  let cursor = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  [...text].forEach((ch, i) => {
    ctx.fillText(ch, cursor, y);
    cursor += widths[i] + trackingPx;
  });
  ctx.textAlign = prevAlign;
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not export image"))), "image/png");
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Native share sheet on mobile (and some desktop browsers) when a real
// file can be shared; download is always the fallback, never a dead end.
export async function shareOrDownloadBlob(blob, filename, shareText) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: shareText, title: "Noqeev" });
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "cancelled"; // person backed out of the share sheet — not an error
      // Any other failure (permissions, an unsupported file type on this
      // particular platform) — fall through to a plain download instead.
    }
  }
  downloadBlob(blob, filename);
  return "downloaded";
}

// Plural version — one share-sheet invocation for several files at once
// (e.g. "share the posts I selected"), same fallback shape: any file
// canShare rejects, or a platform that doesn't support multi-file share
// at all, falls back to downloading each one individually rather than
// silently dropping the rest.
export async function shareOrDownloadBlobs(items, shareText) {
  const files = items.map(({ blob, filename }) => new File([blob], filename, { type: blob.type }));
  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files, text: shareText, title: "Noqeev" });
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "cancelled";
    }
  }
  items.forEach(({ blob, filename }) => downloadBlob(blob, filename));
  return "downloaded";
}

// ── Small persisted bits — same plain try/catch localStorage pattern as
// lib/guestId.js and friends elsewhere in this app, just scoped to this
// page. Neither is account data; both are purely "remember what I set
// last time on this device." ───────────────────────────────────────────
const HANDLE_KEY = "noqeev_brand_handle";
export function loadHandle() {
  try { return localStorage.getItem(HANDLE_KEY) || ""; } catch { return ""; }
}
export function saveHandle(handle) {
  try { localStorage.setItem(HANDLE_KEY, handle); } catch { /* best-effort */ }
}

// A small rolling memory of recent AI-generated text (suggest-post
// headlines, suggest-captions captions) — sent back to the backend as
// `avoid` on every AI call (see api/brand.py's _avoid_block) so
// "generate again" can't just hand back the same post/caption. Nothing
// server-side remembers past requests between calls, so this client-side
// history is the only thing that actually makes repeats avoidable.
// Capped and FIFO — old entries age out as new ones get generated, never
// close to threatening localStorage's quota.
const AI_HISTORY_KEY = "noqeev_ai_history";
const AI_HISTORY_MAX = 20;
export function loadAiHistory() {
  try { return JSON.parse(localStorage.getItem(AI_HISTORY_KEY) || "[]"); } catch { return []; }
}
export function pushAiHistory(...items) {
  try {
    const next = [...loadAiHistory(), ...items.filter(Boolean)].slice(-AI_HISTORY_MAX);
    localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(next));
  } catch { /* best-effort */ }
}

// The signature theme is deliberately keyed by calendar month ("2026-03")
// rather than stored bare — reopening this page in a new month should
// surface the "generate this month's theme" prompt again instead of
// silently carrying January's accent into March forever.
const THEME_KEY = "noqeev_brand_signature_theme";
export function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
export function loadSignatureTheme() {
  try {
    const raw = JSON.parse(localStorage.getItem(THEME_KEY) || "null");
    if (raw?.monthKey === currentMonthKey()) return raw;
    return null; // a stored theme from a previous month is stale, not wrong — just not "this month's" anymore
  } catch {
    return null;
  }
}
export function saveSignatureTheme(theme) {
  try { localStorage.setItem(THEME_KEY, JSON.stringify({ ...theme, monthKey: currentMonthKey() })); } catch { /* best-effort */ }
}

// Which destination (Assets/Create/Capture/Reference) and which Reference
// sections were left open — restored on the next visit so returning here
// picks up exactly where someone left off instead of a fresh scroll from
// the top. Assets is the default landing spot — grabbing a logo file is
// the single most common reason to open this page.
const UI_STATE_KEY = "noqeev_brand_ui_state";
const ZONES = ["assets", "create", "story", "capture", "reference"];
const DEFAULT_UI_STATE = {
  zone: "assets",
  openSections: { reference: ["mark"] },
};
export function loadBrandUiState() {
  try {
    const raw = JSON.parse(localStorage.getItem(UI_STATE_KEY) || "null");
    // Guards against a stale shape from before the Tools zone split into
    // Assets/Create/Capture (e.g. zone: "tools") — fall back rather than
    // land on a destination that no longer exists.
    if (raw && ZONES.includes(raw.zone) && raw.openSections) return raw;
    return DEFAULT_UI_STATE;
  } catch {
    return DEFAULT_UI_STATE;
  }
}
export function saveBrandUiState(state) {
  try { localStorage.setItem(UI_STATE_KEY, JSON.stringify(state)); } catch { /* best-effort */ }
}

// Every in-progress post is its own saved draft, not one single slot —
// PostComposer.js's "New Post" saves whatever's currently open and
// starts a blank one, "My Posts" lists every saved draft to switch back
// to. Plain JSON in localStorage, not IndexedDB: layers stay plain data
// even with an uploaded sticker/background image (resizeImageToDataUrl
// below turns an upload into an inline data: URL string, not a File
// object), so there's never a Blob to store — the same reason Story's
// clips needed IndexedDB (draftStore.js) never applies here.
const POST_DRAFTS_KEY = "noqeev_brand_post_drafts"; // { [id]: {id, name, updatedAt, shapeId, platformId, layers} }
const POST_ACTIVE_KEY = "noqeev_brand_post_active_id";
const LEGACY_POST_DRAFT_KEY = "noqeev_brand_post_draft"; // pre-multi-draft single slot, migrated below

function loadAllPostDrafts() {
  try { return JSON.parse(localStorage.getItem(POST_DRAFTS_KEY) || "{}"); } catch { return {}; }
}
function saveAllPostDrafts(all) {
  try { localStorage.setItem(POST_DRAFTS_KEY, JSON.stringify(all)); } catch { /* best-effort */ }
}

export function newPostId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `post_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
export function savePostDraft(id, data) {
  const all = loadAllPostDrafts();
  all[id] = { ...data, id, updatedAt: Date.now() };
  saveAllPostDrafts(all);
}
export function loadPostDraft(id) {
  return loadAllPostDrafts()[id] || null;
}
export function deletePostDraft(id) {
  const all = loadAllPostDrafts();
  delete all[id];
  saveAllPostDrafts(all);
}
export function listPostDrafts() {
  return Object.values(loadAllPostDrafts())
    .map((d) => ({ id: d.id, name: d.name || "Untitled post", updatedAt: d.updatedAt || 0, layerCount: d.layers?.length || 0 }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
export function getActivePostId() {
  try { return localStorage.getItem(POST_ACTIVE_KEY); } catch { return null; }
}
export function setActivePostId(id) {
  try { localStorage.setItem(POST_ACTIVE_KEY, id); } catch { /* best-effort */ }
}
// One-time upgrade for anyone who already had a draft saved under the
// old single-slot scheme before "New Post"/"My Posts" existed.
export function migrateLegacyPostDraft() {
  try {
    const raw = localStorage.getItem(LEGACY_POST_DRAFT_KEY);
    if (!raw) return null;
    const legacy = JSON.parse(raw);
    if (!legacy?.layers?.length) { localStorage.removeItem(LEGACY_POST_DRAFT_KEY); return null; }
    const id = newPostId();
    savePostDraft(id, { ...legacy, name: "My post" });
    localStorage.removeItem(LEGACY_POST_DRAFT_KEY);
    return id;
  } catch {
    return null;
  }
}

// An uploaded sticker/background image, turned into an inline data: URL
// (not a File/object URL) so it stays plain JSON and survives a
// localStorage round-trip — capped at maxDim on its longest side so one
// upload can't blow through localStorage's ~5-10MB total quota on its
// own. PNG, not JPEG: a sticker is as likely to need real transparency
// (a logo, a cutout) as not, and getting that wrong silently loses it.
export function resizeImageToDataUrl(file, maxDim = 800) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read that image.")); };
    img.src = url;
  });
}
