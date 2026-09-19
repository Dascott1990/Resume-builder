"use client";
/**
 * ClipTimeline.js — add clips (image/video), reorder, set per-clip
 * duration (images) or trim in/out (video), delete, select.
 *
 * Reordering is a pair of up/down buttons, not native HTML5 drag-and-
 * drop — draggable + dragstart/dragover/drop never fire from a touch
 * interaction on any mobile browser (iOS Safari, Android Chrome, none
 * of them), so a drag handle would have made reordering silently
 * impossible on every phone/tablet this tool needs to work on. Buttons
 * work identically everywhere — mouse, touch, and keyboard.
 *
 * Deleting a clip is swipe-to-delete, not the plain always-visible "X"
 * button this used to be. That wasn't just a style choice: on phone, the
 * floating Edit button (StoryComposer.js) is FIXED at a constant screen
 * position, and a clip row's own on-page position depends on how far the
 * page happens to be scrolled — for some scroll position there's always
 * SOME clip row whose right edge (where a plain tap target would live)
 * lands directly under that fixed button. Confirmed live: elementFromPoint
 * at the old X button's exact center returned the Edit button, not the X
 * — the tap never reached it. A plain onClick is judged solely by
 * whatever's topmost AT THE MOMENT the click fires, so it's inherently
 * vulnerable to that. A pointer-captured swipe isn't: once onPointerDown
 * below calls setPointerCapture, every later event for that same gesture
 * (move, up) is delivered back to the row that started it, regardless of
 * what's visually on top of the pointer's current position when it ends
 * — the same reason this codebase's caption-dragging and scrubber already
 * use pointer capture instead of plain click handlers.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, ChevronUp, ChevronDown, Clock, Trash2 } from "lucide-react";
import { Btn } from "@/components/premium/guest/components/primitives";
import { loadClipFromFile, makeClip, clipLengthSec } from "./clipModel";
import { drawClipThumbnail } from "./clipThumbnail";

function ClipThumb({ clip }) {
  const canvasRef = useRef(null);
  useEffect(() => { drawClipThumbnail(clip, canvasRef.current, 96, 96); }, [clip]);
  return <canvas ref={canvasRef} className="size-16 shrink-0 rounded-lg bg-black object-cover" />;
}

// Delete commits on RELEASE past this drag distance — there's
// deliberately no intermediate "revealed, now tap the trash icon to
// confirm" step. An earlier version worked that way, and it turned out
// to just move the FAB-collision problem rather than fix it: the
// revealed button was a plain, statically-positioned tap target at the
// row's right edge — the exact same screen real estate the floating Edit
// button occupies — so it was just as blockable as the old X button was.
// Committing directly on release means the ENTIRE delete action, start
// to finish, happens inside the one pointer-captured gesture that proved
// immune to that (see this file's header comment) — nothing left over
// that needs a second, separate tap to land correctly.
const DELETE_PX = 140;
const TAP_SLOP = 8; // px of movement that's still a tap/press, not the start of a swipe

function ClipRow({ clip, index, clips, selectedIndex, onSelect, onReorder, onRemove, onUpdateClip }) {
  const [dragX, setDragX] = useState(0);
  const gestureRef = useRef(null); // { startClientX, startClientY, isSwipe } while a pointer is down

  const onPointerDown = (e) => {
    // Let a button/input/label/anchor handle its own interaction — the
    // up/down reorder buttons and the duration/trim range sliders live
    // inside this same row and need their native pointer behavior intact,
    // not hijacked by the swipe tracking below.
    if (e.target.closest("button, input, a, label")) return;
    gestureRef.current = { startClientX: e.clientX, startClientY: e.clientY, isSwipe: false };
  };
  const onPointerMove = (e) => {
    const g = gestureRef.current;
    if (!g) return;
    const dx = e.clientX - g.startClientX;
    const dy = e.clientY - g.startClientY;
    if (!g.isSwipe) {
      if (Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP) return; // not enough movement to classify yet
      if (Math.abs(dy) > Math.abs(dx)) { gestureRef.current = null; return; } // a vertical scroll, not a swipe — bail and let the page/list scroll normally
      g.isSwipe = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setDragX(Math.max(-DELETE_PX, Math.min(0, dx)));
  };
  const onPointerUp = (e) => {
    const g = gestureRef.current;
    if (!g) return;
    if (g.isSwipe) {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      if (dragX <= -DELETE_PX) { onRemove(); return; } // still mid-animation-out; no need to reset dragX, this row is gone
      setDragX(0);
    } else {
      onSelect();
    }
    gestureRef.current = null;
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Red backdrop, revealed underneath as the row's own translateX
          opens a gap above it — purely visual feedback for how close the
          drag is to committing, not itself a tap target (see the DELETE_PX
          comment above for why). */}
      <div aria-hidden="true" className="absolute inset-0 flex items-center justify-end bg-destructive pr-6 text-destructive-foreground">
        <Trash2 className="size-5" />
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { gestureRef.current = null; setDragX(0); }}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: gestureRef.current ? "none" : "transform 200ms ease",
          touchAction: "pan-y", // horizontal swipes are ours to interpret; vertical scroll still passes through untouched
        }}
        className={`relative flex cursor-pointer items-center gap-2 rounded-xl border bg-card p-2 ${selectedIndex === index ? "border-primary/30 bg-primary/[0.04]" : "border-border"}`}
      >
        <div className="flex shrink-0 flex-col gap-0.5" onPointerDown={(e) => e.stopPropagation()}>
          <button
            type="button" onClick={() => index > 0 && onReorder(index, index - 1)} disabled={index === 0} title="Move up"
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground disabled:opacity-30 enabled:hover:bg-muted enabled:hover:text-foreground"
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            type="button" onClick={() => index < clips.length - 1 && onReorder(index, index + 1)} disabled={index === clips.length - 1} title="Move down"
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground disabled:opacity-30 enabled:hover:bg-muted enabled:hover:text-foreground"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
        <ClipThumb clip={clip} />
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-[11.5px] font-semibold text-foreground">
            {index + 1}. {clip.kind === "video" ? "Video" : "Image"} · {clipLengthSec(clip).toFixed(1)}s
          </p>
          {clip.kind === "image" ? (
            <div className="mt-1 flex items-center gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
              <Clock className="size-3 text-muted-foreground" />
              <input
                type="range" min="0.5" max="8" step="0.1" value={clip.durationSec}
                onChange={(e) => onUpdateClip(index, { durationSec: Number(e.target.value) })}
                className="w-full accent-primary"
              />
            </div>
          ) : (
            <div className="mt-1 grid grid-cols-2 gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
              <label className="text-[10px] text-muted-foreground">
                In {clip.trimIn.toFixed(1)}s
                <input
                  type="range" min="0" max={clip.naturalDurationSec} step="0.1" value={clip.trimIn}
                  onChange={(e) => onUpdateClip(index, { trimIn: Math.min(Number(e.target.value), clip.trimOut - 0.1) })}
                  className="block w-full accent-primary"
                />
              </label>
              <label className="text-[10px] text-muted-foreground">
                Out {clip.trimOut.toFixed(1)}s
                <input
                  type="range" min="0" max={clip.naturalDurationSec} step="0.1" value={clip.trimOut}
                  onChange={(e) => onUpdateClip(index, { trimOut: Math.max(Number(e.target.value), clip.trimIn + 0.1) })}
                  className="block w-full accent-primary"
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ClipTimeline({ clips, selectedIndex, onSelect, onAdd, onRemove, onReorder, onUpdateClip }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

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
            <ClipRow
              key={clip.id}
              clip={clip} index={i} clips={clips} selectedIndex={selectedIndex}
              onSelect={() => onSelect(i)} onReorder={onReorder} onRemove={() => onRemove(i)} onUpdateClip={onUpdateClip}
            />
          ))}
        </div>
      )}
    </div>
  );
}
