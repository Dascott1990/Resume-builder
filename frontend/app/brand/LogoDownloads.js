"use client";
/**
 * LogoDownloads.js — export the mark as real files: a transparent icon, a
 * ready-to-upload social avatar (solid background — most platforms fill
 * transparency with white or black themselves, so this one's baked in on
 * purpose), a horizontal lockup for banners/headers, and the raw vector.
 * Every raster is drawn from the same cached mark image (see assetKit.js)
 * at real export resolution, not a scaled-up screenshot of the on-page
 * preview.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Download, Share2, Loader2, Check } from "lucide-react";
import { Btn } from "@/components/premium/guest/components/primitives";
import {
  loadMarkImage, ensureFontsReady, markOnlySvg, fillTrackedText, trackedTextWidth,
  canvasToPngBlob, downloadBlob, shareOrDownloadBlob, shareOrDownloadBlobs,
} from "./assetKit";

async function buildIconPng() {
  const img = await loadMarkImage();
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  canvas.getContext("2d").drawImage(img, 0, 0, size, size);
  return canvasToPngBlob(canvas);
}

async function buildAvatarPng() {
  const img = await loadMarkImage();
  const size = 1000;
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, size, size);
  // Extra inset beyond the icon's own baked-in padding — most social
  // platforms crop a profile photo to a circle, so content needs to clear
  // that circle's edges, not just the square's.
  const inset = size * 0.16;
  ctx.drawImage(img, inset, inset, size - inset * 2, size - inset * 2);
  return canvasToPngBlob(canvas);
}

async function buildLockupPng() {
  const [img] = await Promise.all([loadMarkImage(), ensureFontsReady()]);
  const w = 1600, h = 500;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, w, h);
  const markSize = h * 0.56;
  const markY = (h - markSize) / 2;
  const markX = h * 0.46;
  ctx.drawImage(img, markX, markY, markSize, markSize);
  ctx.fillStyle = "#f5f0e6";
  ctx.font = '800 108px Unbounded, "Helvetica Neue", Arial, sans-serif';
  ctx.textBaseline = "middle";
  fillTrackedText(ctx, "NOQEEV", markX + markSize + 48, h / 2 + 6, 4);
  return canvasToPngBlob(canvas);
}

// Mark + wordmark, centered, scaled to fit inside contentMaxWidth — NOT
// the full canvas width. That distinction matters most for YouTube's
// banner (see buildYoutubeBanner): only a centered "safe area" survives
// the crop every device applies, so the logo is sized to fit THAT, never
// the full upload canvas. Same core buildLockupPng above already used,
// generalized to a fixed content width instead of a % margin, and reused
// across every platform preset below instead of copy-pasted four times.
async function buildBannerPng(width, height, contentMaxWidth) {
  const [img] = await Promise.all([loadMarkImage(), ensureFontsReady()]);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, width, height);

  const text = "NOQEEV";
  let iconSize = height * 0.6;
  let gap = iconSize * 0.36;
  let fontSize = iconSize * 0.72;
  const fontString = (size) => `800 ${size}px Unbounded, "Helvetica Neue", Arial, sans-serif`;

  ctx.font = fontString(fontSize);
  let textWidth = trackedTextWidth(ctx, text, fontSize * 0.037);
  let contentWidth = iconSize + gap + textWidth;

  if (contentWidth > contentMaxWidth) {
    const scale = contentMaxWidth / contentWidth;
    iconSize *= scale; gap *= scale; fontSize *= scale;
    ctx.font = fontString(fontSize);
    textWidth = trackedTextWidth(ctx, text, fontSize * 0.037);
    contentWidth = iconSize + gap + textWidth;
  }

  const startX = (width - contentWidth) / 2;
  const midY = height / 2;
  ctx.drawImage(img, startX, midY - iconSize / 2, iconSize, iconSize);
  ctx.fillStyle = "#f5f0e6";
  ctx.textBaseline = "middle";
  fillTrackedText(ctx, text, startX + iconSize + gap, midY + fontSize * 0.02, fontSize * 0.037);
  return canvasToPngBlob(canvas);
}

const BANNER_ASSETS = [
  {
    id: "youtube-banner",
    label: "YouTube banner",
    spec: "PNG · 2560×1440 · safe-area aware",
    // Only the centered ~1546x423 "safe area" is guaranteed visible on
    // every device (desktop shows the full image; mobile/TV crop the
    // sides) — sized to comfortably fit inside that, not the full canvas.
    build: () => buildBannerPng(2560, 1440, 1546 * 0.8),
    filename: "noqeev-youtube-banner.png",
  },
  {
    id: "x-header",
    label: "X header",
    spec: "PNG · 1500×500",
    build: () => buildBannerPng(1500, 500, 1500 * 0.84),
    filename: "noqeev-x-header.png",
  },
  {
    id: "linkedin-banner",
    label: "LinkedIn banner",
    spec: "PNG · 1584×396",
    build: () => buildBannerPng(1584, 396, 1584 * 0.84),
    filename: "noqeev-linkedin-banner.png",
  },
  {
    id: "facebook-cover",
    label: "Facebook cover",
    spec: "PNG · 820×312",
    build: () => buildBannerPng(820, 312, 820 * 0.84),
    filename: "noqeev-facebook-cover.png",
  },
];

const ASSETS = [
  {
    id: "icon",
    label: "App icon",
    spec: "PNG · 1024×1024 · transparent",
    build: buildIconPng,
    filename: "noqeev-icon.png",
    preview: "transparent",
  },
  {
    id: "avatar",
    label: "Social avatar",
    spec: "PNG · 1000×1000 · filled",
    build: buildAvatarPng,
    filename: "noqeev-avatar.png",
    preview: "filled",
    shareable: true,
  },
  {
    id: "lockup",
    label: "Full lockup",
    spec: "PNG · 1600×500 · filled",
    build: buildLockupPng,
    filename: "noqeev-lockup.png",
    preview: "lockup",
  },
  {
    id: "vector",
    label: "Vector mark",
    spec: "SVG · transparent",
    build: null,
    filename: "noqeev-mark.svg",
    preview: "transparent",
  },
];

function PreviewSwatch({ kind }) {
  if (kind === "lockup") {
    return (
      <div className="flex h-14 w-24 items-center justify-center gap-1.5 rounded-lg bg-[#0a0a0a] px-2">
        <svg viewBox="0 0 100 100" width="20" height="20">
          <defs><linearGradient id="pv-l" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F6E6B3" /><stop offset="38%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#5C4419" /></linearGradient></defs>
          <path d="M 22 68 L 22 16 L 74 16 L 74 68 L 88 86 L 97 8" fill="none" stroke="url(#pv-l)" strokeWidth="14" strokeLinecap="butt" strokeLinejoin="round" />
        </svg>
        <span style={{ fontFamily: "var(--font-wordmark)" }} className="text-[9px] font-extrabold tracking-[0.03em] text-[#f5f0e6]">NOQEEV</span>
      </div>
    );
  }
  const transparentBg = {
    backgroundImage:
      "linear-gradient(45deg, #00000022 25%, transparent 25%), linear-gradient(-45deg, #00000022 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #00000022 75%), linear-gradient(-45deg, transparent 75%, #00000022 75%)",
    backgroundSize: "12px 12px",
    backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0px",
  };
  return (
    <div
      className={`flex size-14 items-center justify-center rounded-lg ${kind === "filled" ? "" : "border border-border"}`}
      style={kind === "filled" ? { background: "#0a0a0a" } : transparentBg}
    >
      <svg viewBox="0 0 100 100" width="30" height="30">
        <defs><linearGradient id={`pv-${kind}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F6E6B3" /><stop offset="38%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#5C4419" /></linearGradient></defs>
        <path d="M 22 68 L 22 16 L 74 16 L 74 68 L 88 86 L 97 8" fill="none" stroke={`url(#pv-${kind})`} strokeWidth="14" strokeLinecap="butt" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function AssetRow({ asset }) {
  const [busy, setBusy] = useState(null); // "download" | "share" | null

  const getBlob = async () => {
    if (asset.build) return asset.build();
    return new Blob([markOnlySvg()], { type: "image/svg+xml;charset=utf-8" });
  };

  const handleDownload = async () => {
    setBusy("download");
    try {
      const blob = await getBlob();
      downloadBlob(blob, asset.filename);
    } catch {
      toast.error("Try again.");
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    setBusy("share");
    try {
      const blob = await getBlob();
      const result = await shareOrDownloadBlob(blob, asset.filename, "Noqeev");
      if (result === "downloaded") toast.info("Downloaded.");
    } catch {
      toast.error("Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="glass-surface flex items-center gap-4 rounded-xl p-3.5">
      <PreviewSwatch kind={asset.preview} />
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[13.5px] font-bold text-foreground">{asset.label}</p>
        <p className="m-0 font-mono text-[10.5px] text-muted-foreground/70">{asset.spec}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {asset.shareable && (
          <Btn small variant="ghost" onClick={handleShare} disabled={!!busy}>
            {busy === "share" ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
          </Btn>
        )}
        <Btn small variant="ghost" onClick={handleDownload} disabled={!!busy}>
          {busy === "download" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        </Btn>
      </div>
    </div>
  );
}

// Same multi-select shape PostComposer.js's own Download/Share flow
// already uses (a Set of selected ids, a toggleable checkmark card per
// option, one "Download (N)" action) — picking a platform here is a
// selection, not a one-shot trigger, so posting to three platforms takes
// one download pass instead of three separate clicks.
function PlatformPicker() {
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);

  const toggle = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDownloadSelected = async () => {
    if (!selectedIds.size) return;
    setDownloading(true);
    try {
      // Staggered, not fired all at once — rapid concurrent downloads can
      // trip a browser's own popup/multi-download guard, which silently
      // drops everything after the first (same reasoning PostComposer's
      // own multi-select download uses).
      let i = 0;
      for (const id of selectedIds) {
        const asset = BANNER_ASSETS.find((a) => a.id === id);
        const blob = await asset.build();
        downloadBlob(blob, asset.filename);
        i += 1;
        if (i < selectedIds.size) await new Promise((r) => setTimeout(r, 350));
      }
      toast.success(selectedIds.size === 1 ? "Downloaded." : `Downloaded ${selectedIds.size} banners.`);
    } catch {
      toast.error("Try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handleShareSelected = async () => {
    if (!selectedIds.size) return;
    setSharing(true);
    try {
      const items = [];
      for (const id of selectedIds) {
        const asset = BANNER_ASSETS.find((a) => a.id === id);
        const blob = await asset.build();
        items.push({ blob, filename: asset.filename });
      }
      const result = await shareOrDownloadBlobs(items, "Our brand banners");
      if (result === "downloaded") toast.info("Sharing wasn't available here — downloaded instead.");
    } catch {
      toast.error("Try again.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="grid gap-2.5">
      <div>
        <p className="m-0 text-[13.5px] font-bold text-foreground">Which platforms are you posting to?</p>
        <p className="m-0 text-[11px] text-muted-foreground/70">Pick any or all, then download.</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {BANNER_ASSETS.map((a) => {
          const selected = selectedIds.has(a.id);
          return (
            <button
              key={a.id} type="button" onClick={() => toggle(a.id)} aria-pressed={selected}
              className={`relative flex flex-col items-center gap-1.5 rounded-xl p-3 text-center ${selected ? "border border-primary bg-primary/5" : "glass-surface"}`}
            >
              <div className={`absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background/80"}`}>
                {selected && <Check className="size-3" strokeWidth={3} />}
              </div>
              <div className="flex h-10 w-16 items-center justify-center rounded-md bg-[#0a0a0a]">
                <svg viewBox="0 0 100 100" width="16" height="16">
                  <defs><linearGradient id={`pv-${a.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F6E6B3" /><stop offset="38%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#5C4419" /></linearGradient></defs>
                  <path d="M 22 68 L 22 16 L 74 16 L 74 68 L 88 86 L 97 8" fill="none" stroke={`url(#pv-${a.id})`} strokeWidth="14" strokeLinecap="butt" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="m-0 text-[11.5px] font-bold text-foreground">{a.label.replace(" banner", "").replace(" header", "").replace(" cover", "")}</p>
              <p className="m-0 font-mono text-[9px] text-muted-foreground/70">{a.spec.split(" · ")[1]}</p>
            </button>
          );
        })}
      </div>
      <div className="flex gap-1.5">
        <Btn
          variant="gold" className="flex-1" onClick={handleDownloadSelected}
          disabled={!selectedIds.size || downloading || sharing} loading={downloading}
        >
          <Download className="size-4" />
          {downloading ? "…" : selectedIds.size ? `Download (${selectedIds.size})` : "Select at least one"}
        </Btn>
        <Btn small variant="ghost" onClick={handleShareSelected} disabled={!selectedIds.size || downloading || sharing} loading={sharing} aria-label="Share selected banners">
          <Share2 className="size-4" />
        </Btn>
      </div>
    </div>
  );
}

export function LogoDownloads() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-2.5">
        {ASSETS.map((a) => <AssetRow key={a.id} asset={a} />)}
      </div>
      <PlatformPicker />
    </div>
  );
}
