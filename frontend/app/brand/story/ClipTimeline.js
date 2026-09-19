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
 * Deleting a clip is swipe-to-reveal (swipe the row left, tap the trash
 * icon that appears — the same interaction WhatsApp/Mail-style contact
 * and message lists use), not the plain always-visible "X" button this
 * used to be. On phone, the floating Edit button (StoryComposer.js) is
 * FIXED at a constant screen position, and a clip row's own on-page
 * position depends on how far the page happens to be scrolled — for some
 * scroll position there was always SOME clip row whose right edge (where
 * the old X lived) landed directly under that fixed button. The swipe
 * gesture itself is immune to that: onPointerDown below calls
 * setPointerCapture, so every later event for that same gesture (move,
 * up) is delivered back to the row regardless of what's visually on top
 * of the pointer's position — the same reason this codebase's caption-
 * dragging and scrubber already use pointer capture over plain clicks.
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

const REVEAL_PX = 76; // width of the revealed delete icon's own tap zone
const OPEN_THRESHOLD = REVEAL_PX * 0.4; // drag past this and releasing snaps the row open, not closed
const TAP_SLOP = 8; // px of movement that's still a tap/press, not the start of a swipe

function ClipRow({ clip, index, selectedIndex, onSelect, onReorder, onRemove, onUpdateClip, clipsLength, isOpen, onOpenChange }) {
  const [dragX, setDragX] = useState(isOpen ? -REVEAL_PX : 0);
  const gestureRef = useRef(null); // { startClientX, startClientY, baseX, isSwipe } while a pointer is down

  // Another row opened (or this one was closed by a select/remove
  // elsewhere) — follow that external state, same as any other
  // swipe-to-delete list where only one row stays open at a time.
  useEffect(() => { if (!gestureRef.current) setDragX(isOpen ? -REVEAL_PX : 0); }, [isOpen]);

  const onPointerDown = (e) => {
    // Let a button/input/label handle its own interaction — the up/down
    // reorder buttons and the duration/trim range sliders live inside
    // this same row and need their native pointer behavior intact, not
    // hijacked by the swipe tracking below. (Their own onClick already
    // stops propagation too — this is the belt to that suspenders, since
    // pointerdown/move aren't click events and wouldn't be caught by it.)
    if (e.target.closest("button, input, a, label")) return;
    gestureRef.current = { startClientX: e.clientX, startClientY: e.clientY, baseX: dragX, isSwipe: false };
  };
  const onPointerMove = (e) => {
    const g = gestureRef.current;
    if (!g) return;
    const dx = e.clientX - g.startClientX;
    const dy = e.clientY - g.startClientY;
    if (!g.isSwipe) {
      if (Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP) return; // not enough movement to classify yet
      if (Math.abs(dy) > Math.abs(dx)) { gestureRef.current = null; return; } // a vertical scroll, not a swipe — bail and let the list scroll normally
      g.isSwipe = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setDragX(Math.max(-REVEAL_PX, Math.min(0, g.baseX + dx)));
  };
  const onPointerUp = (e) => {
    const g = gestureRef.current;
    if (!g) return;
    if (g.isSwipe) {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      const opensNow = dragX <= -OPEN_THRESHOLD;
      setDragX(opensNow ? -REVEAL_PX : 0);
      onOpenChange(opensNow);
    } else if (isOpen) {
      onOpenChange(false); // a plain tap while open just closes it, same as tapping any other open swipe row
    } else {
      onSelect();
    }
    gestureRef.current = null;
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* The delete icon — sits underneath at all times, only ever
          visible/tappable through the gap the row's own translateX opens
          up above it. Width tracks the CURRENT drag distance (0 when
          closed) rather than a fixed REVEAL_PX — a selected row's own
          background is intentionally near-transparent (bg-primary/[0.04]
          below), which let a fixed-width backdrop show faintly through
          even while fully closed. Zero width when closed means there's
          nothing back there to show through, regardless of the row's own
          opacity, and it's naturally un-tappable until actually open. */}
      <button
        type="button"
        onClick={() => onRemove()}
        title="Delete clip"
        aria-label="Delete clip"
        className="absolute inset-y-0 right-0 flex items-center justify-center overflow-hidden bg-destructive text-destructive-foreground"
        style={{ width: Math.max(0, -dragX) }}
      >
        <Trash2 className="size-5 shrink-0" />
      </button>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { gestureRef.current = null; setDragX(isOpen ? -REVEAL_PX : 0); }}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: gestureRef.current ? "none" : "transform 200ms ease",
          touchAction: "pan-y", // horizontal swipes are ours to interpret; vertical scroll still passes through untouched
        }}
        className={`relative flex items-center gap-3 rounded-xl border p-3 cursor-pointer ${selectedIndex === index ? "border-primary/30 bg-primary/[0.04]" : "border-border bg-card"}`}
      >
        <div className="flex shrink-0 flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button" onClick={() => index > 0 && onReorder(index, index - 1)} disabled={index === 0} title="Move up"
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground disabled:opacity-30 enabled:hover:bg-muted enabled:hover:text-foreground"
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            type="button" onClick={() => index < clipsLength - 1 && onReorder(index, index + 1)} disabled={index === clipsLength - 1} title="Move down"
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground disabled:opacity-30 enabled:hover:bg-muted enabled:hover:text-foreground"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
        <ClipThumb clip={clip} />
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-[12.5px] font-bold text-foreground">
            {index + 1}. {clip.kind === "video" ? "Video" : "Image"} · {clipLengthSec(clip).toFixed(1)}s
          </p>
          {clip.kind === "image" ? (
            <div className="mt-1 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <Clock className="size-3 text-muted-foreground" />
              <input
                type="range" min="0.5" max="8" step="0.1" value={clip.durationSec}
                onChange={(e) => onUpdateClip(index, { durationSec: Number(e.target.value) })}
                className="w-full accent-primary"
              />
            </div>
          ) : (
            <div className="mt-1 grid grid-cols-2 gap-1.5" onClick={(e) => e.stopPropagation()}>
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

export function ClipTimeline({ clips, selectedIndex, onSelect, onAdd, onRemove, onReorder, onUpdateClip, onAnyOpenChange }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  // Only one row's delete icon revealed at a time — swiping a second row
  // (or selecting/removing a clip) closes whichever one was already
  // open, same as every other swipe-to-delete list.
  const [openIndex, setOpenIndexRaw] = useState(null);
  // onAnyOpenChange is how StoryComposer.js knows to hide its own
  // floating Edit button while a row is revealed — without it, a clip
  // near the bottom of a short list reveals its delete icon directly
  // under that fixed button, same collision class as the old X button
  // (confirmed live: the tap doesn't reach the revealed icon either).
  const setOpenIndex = (next) => { setOpenIndexRaw(next); onAnyOpenChange?.(next !== null); };

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
        //
        // auto-rows-min is load-bearing, not decorative: a CSS grid's
        // default auto-sized rows get COMPRESSED to fit inside a
        // height-constrained + overflow:auto container instead of
        // overflowing it — confirmed live, every row silently shrank
        // from ~100px to ~52px once there were enough clips to exceed
        // 360px, and scrollHeight stayed equal to clientHeight (nothing
        // to scroll, because nothing had actually overflowed — the
        // "separate scroll" this container exists for was never firing).
        // min-content row sizing keeps each row at its natural height and
        // lets the container overflow (and thus actually scroll) instead.
        <div className="grid auto-rows-min max-h-[360px] gap-2.5 overflow-y-auto overscroll-contain pr-0.5">
          {clips.map((clip, i) => (
            <ClipRow
              key={clip.id}
              clip={clip} index={i} clipsLength={clips.length} selectedIndex={selectedIndex}
              onSelect={() => { setOpenIndex(null); onSelect(i); }}
              onReorder={onReorder}
              onRemove={() => { setOpenIndex(null); onRemove(i); }}
              onUpdateClip={onUpdateClip}
              isOpen={openIndex === i}
              onOpenChange={(open) => setOpenIndex(open ? i : null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
