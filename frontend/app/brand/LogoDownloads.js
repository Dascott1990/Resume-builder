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
import { Download, Share2, Loader2 } from "lucide-react";
import { Btn } from "@/components/premium/guest/components/primitives";
import {
  loadMarkImage, ensureFontsReady, markOnlySvg, fillTrackedText,
  canvasToPngBlob, downloadBlob, shareOrDownloadBlob,
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

const ASSETS = [
  {
    id: "icon",
    label: "App icon",
    spec: "PNG · 1024×1024 · transparent",
    hint: "Anywhere a square icon is needed on its own background.",
    build: buildIconPng,
    filename: "noqeev-icon.png",
    preview: "transparent",
  },
  {
    id: "avatar",
    label: "Social avatar",
    spec: "PNG · 1000×1000 · filled",
    hint: "Ready to upload as-is — a profile photo, no transparency surprises.",
    build: buildAvatarPng,
    filename: "noqeev-avatar.png",
    preview: "filled",
    shareable: true,
  },
  {
    id: "lockup",
    label: "Full lockup",
    spec: "PNG · 1600×500 · filled",
    hint: "Mark + wordmark together — a banner, a signature, a post's letterhead.",
    build: buildLockupPng,
    filename: "noqeev-lockup.png",
    preview: "lockup",
  },
  {
    id: "vector",
    label: "Vector mark",
    spec: "SVG · transparent",
    hint: "For anyone doing real design work with it — infinitely scalable.",
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
      toast.error("Could not generate this file — try again.");
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    setBusy("share");
    try {
      const blob = await getBlob();
      const result = await shareOrDownloadBlob(blob, asset.filename, "Noqeev");
      if (result === "downloaded") toast.info("Sharing isn't available here — downloaded instead.");
    } catch {
      toast.error("Could not generate this file — try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-3.5">
      <PreviewSwatch kind={asset.preview} />
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[13.5px] font-bold text-foreground">{asset.label}</p>
        <p className="m-0 font-mono text-[10.5px] text-muted-foreground/70">{asset.spec}</p>
        <p className="m-0 mt-1 text-[12px] leading-snug text-muted-foreground">{asset.hint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {asset.shareable && (
          <Btn small variant="ghost" onClick={handleShare} disabled={!!busy}>
            {busy === "share" ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
          </Btn>
        )}
        <Btn small variant="gold" onClick={handleDownload} disabled={!!busy}>
          {busy === "download" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        </Btn>
      </div>
    </div>
  );
}

export function LogoDownloads() {
  return (
    <div className="grid gap-2.5">
      {ASSETS.map((a) => <AssetRow key={a.id} asset={a} />)}
    </div>
  );
}
