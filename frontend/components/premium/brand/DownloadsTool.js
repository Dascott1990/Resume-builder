"use client";
/**
 * DownloadsTool.js — the branding workspace's "Download & share" panel.
 * Four formats, each rendered server-side on demand from one cached
 * source (backend/app/api/brand_workspace.py's /downloads/<fmt>, backed
 * by app/utils/logo_render.py) — never a pre-made static file. The
 * preview <img> tags hit the same route directly with the token as a
 * query param (auth.py's get_workspace() accepts either the header or
 * ?token=, and a plain <img> can't attach a custom header) — the actual
 * download/share button fetches the bytes itself so downloadBlob/
 * shareOrDownloadBlob get a real Blob to hand off.
 */
import { useState } from "react";
import { Download, Share2, Loader2 } from "lucide-react";
import { workspaceFetch } from "./workspaceApi";
import { downloadBlob, shareOrDownloadBlob } from "@/app/brand/assetKit";

const BASE = process.env.NEXT_PUBLIC_API_URL;

const FORMATS = [
  { id: "icon", label: "App icon", detail: "1024×1024 PNG", filename: "noqeev-app-icon.png" },
  { id: "avatar", label: "Social avatar", detail: "1000×1000 PNG, circular-crop safe", filename: "noqeev-social-avatar.png" },
  { id: "lockup", label: "Full lockup", detail: "1600×500 PNG, transparent", filename: "noqeev-lockup.png" },
  { id: "svg", label: "Vector mark", detail: "Raw SVG", filename: "noqeev-mark.svg" },
];

export function DownloadsTool({ token }) {
  const [busy, setBusy] = useState(null); // format id currently downloading/sharing, or null
  const [error, setError] = useState("");

  async function getBlob(fmt) {
    const res = await workspaceFetch(token, `/api/v1/workspace/downloads/${fmt}`);
    return res.blob();
  }

  async function handleDownload(format) {
    setError("");
    setBusy(format.id);
    try {
      const blob = await getBlob(format.id);
      downloadBlob(blob, format.filename);
    } catch (e) {
      setError(e.message || "Couldn't generate that file.");
    } finally {
      setBusy(null);
    }
  }

  async function handleShare(format) {
    setError("");
    setBusy(`${format.id}-share`);
    try {
      const blob = await getBlob(format.id);
      await shareOrDownloadBlob(blob, format.filename, "Our brand mark");
    } catch (e) {
      setError(e.message || "Couldn't generate that file.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="m-0 text-[12.5px] text-destructive">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        {FORMATS.map((format) => (
          <div key={format.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card/40 p-3">
            <div className="flex h-20 items-center justify-center rounded-lg bg-[#17181c]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${BASE}/api/v1/workspace/downloads/${format.id}?token=${encodeURIComponent(token)}`}
                alt={format.label}
                className="max-h-16 max-w-[90%] object-contain"
              />
            </div>
            <div>
              <p className="m-0 text-[13px] font-medium text-foreground">{format.label}</p>
              <p className="m-0 text-[11.5px] text-muted-foreground">{format.detail}</p>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => handleDownload(format)}
                disabled={busy === format.id}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-background px-2 py-1.5 text-[12px] font-medium text-foreground transition hover:bg-accent disabled:opacity-60"
              >
                {busy === format.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Download
              </button>
              <button
                type="button"
                onClick={() => handleShare(format)}
                disabled={busy === `${format.id}-share`}
                aria-label={`Share ${format.label}`}
                className="flex items-center justify-center rounded-lg border border-border bg-background px-2 py-1.5 text-foreground transition hover:bg-accent disabled:opacity-60"
              >
                {busy === `${format.id}-share` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
