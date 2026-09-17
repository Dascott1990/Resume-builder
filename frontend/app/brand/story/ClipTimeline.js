"use client";
/**
 * ClipTimeline.js — add clips (image/video), reorder by dragging, set
 * per-clip duration (images) or trim in/out (video), delete, select.
 * Reordering uses native HTML5 drag-and-drop — the list is always small
 * (MAX_CLIPS=20 server-side), so no drag library is warranted.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, X, GripVertical, Clock } from "lucide-react";
import { Btn } from "@/components/premium/guest/components/primitives";
import { loadClipFromFile, makeClip, clipLengthSec } from "./clipModel";

function ClipThumb({ clip }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !clip.el) return;
    const ctx = canvas.getContext("2d");
    const draw = () => {
      canvas.width = 96; canvas.height = 96;
      const scale = Math.max(96 / clip.naturalW, 96 / clip.naturalH);
      const w = clip.naturalW * scale, h = clip.naturalH * scale;
      ctx.drawImage(clip.el, (96 - w) / 2, (96 - h) / 2, w, h);
    };
    if (clip.kind === "image") {
      if (clip.el.complete) draw(); else clip.el.onload = draw;
    } else {
      // A freshly-loaded <video> already has its frame at currentTime=0
      // decoded once "loadeddata" fires — no need to seek first.
      if (clip.el.readyState >= 2) draw();
      else clip.el.addEventListener("loadeddata", draw, { once: true });
    }
  }, [clip]);
  return <canvas ref={canvasRef} className="size-16 shrink-0 rounded-lg bg-black object-cover" />;
}

export function ClipTimeline({ clips, selectedIndex, onSelect, onAdd, onRemove, onReorder, onUpdateClip }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const dragIndexRef = useRef(null);

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
          toast.error(`${file.name}: not an image or video.`);
          continue;
        }
        const loaded = await loadClipFromFile(file);
        onAdd(makeClip(loaded));
      }
    } catch (e) {
      toast.error(e.message || "Couldn't read that file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="grid gap-2.5">
      <div className="flex items-center justify-between">
        <p className="m-0 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">Clips</p>
        <Btn small variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={uploading} loading={uploading}>
          <Upload className="size-3.5" /> Add clip
        </Btn>
        <input
          ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {clips.length === 0 ? (
        <p className="m-0 rounded-xl border border-dashed border-border p-4 text-center text-[11.5px] text-muted-foreground">
          Add images or short clips to start your sequence.
        </p>
      ) : (
        // Capped height + its own scroll — with MAX_CLIPS=20 possible
        // (backend/app/api/story.py), an uncapped list would grow the
        // whole page instead of staying a fixed part of "one page, one
        // screen." 5 rows (~72px each) is enough to see what's next
        // without scrolling for a typical hook/feature/CTA sequence.
        <div className="grid max-h-[360px] gap-1.5 overflow-y-auto overscroll-contain pr-0.5">
          {clips.map((clip, i) => (
            <div
              key={clip.id}
              draggable
              onDragStart={() => { dragIndexRef.current = i; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                const from = dragIndexRef.current;
                if (from === null || from === i) return;
                onReorder(from, i);
                dragIndexRef.current = null;
              }}
              onClick={() => onSelect(i)}
              className={`flex items-center gap-2.5 rounded-xl border p-2 cursor-pointer ${selectedIndex === i ? "border-primary/30 bg-primary/[0.04]" : "border-border bg-card"}`}
            >
              <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground/50" />
              <ClipThumb clip={clip} />
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-[11.5px] font-semibold text-foreground">
                  {i + 1}. {clip.kind === "video" ? "Video" : "Image"} · {clipLengthSec(clip).toFixed(1)}s
                </p>
                {clip.kind === "image" ? (
                  <div className="mt-1 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <Clock className="size-3 text-muted-foreground" />
                    <input
                      type="range" min="0.5" max="8" step="0.1" value={clip.durationSec}
                      onChange={(e) => onUpdateClip(i, { durationSec: Number(e.target.value) })}
                      className="w-full accent-primary"
                    />
                  </div>
                ) : (
                  <div className="mt-1 grid grid-cols-2 gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <label className="text-[10px] text-muted-foreground">
                      In {clip.trimIn.toFixed(1)}s
                      <input
                        type="range" min="0" max={clip.naturalDurationSec} step="0.1" value={clip.trimIn}
                        onChange={(e) => onUpdateClip(i, { trimIn: Math.min(Number(e.target.value), clip.trimOut - 0.1) })}
                        className="block w-full accent-primary"
                      />
                    </label>
                    <label className="text-[10px] text-muted-foreground">
                      Out {clip.trimOut.toFixed(1)}s
                      <input
                        type="range" min="0" max={clip.naturalDurationSec} step="0.1" value={clip.trimOut}
                        onChange={(e) => onUpdateClip(i, { trimOut: Math.max(Number(e.target.value), clip.trimIn + 0.1) })}
                        className="block w-full accent-primary"
                      />
                    </label>
                  </div>
                )}
              </div>
              <button
                type="button" onClick={(e) => { e.stopPropagation(); onRemove(i); }}
                title="Remove" className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
