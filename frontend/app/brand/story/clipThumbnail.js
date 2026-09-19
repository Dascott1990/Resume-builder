"use client";
/**
 * clipThumbnail.js — the one "draw this clip's own frame into a canvas,
 * cover-cropped" implementation, shared by ClipTimeline.js's ClipThumb
 * (96x96, the reorder-list icon) and PreviewPlayer.js's filmstrip
 * scrubber thumbnails (proportional width, fixed height) — same source
 * element (clip.el, already loaded once by clipModel.js's
 * loadClipFromFile), same "wait for the image/video to actually have a
 * decoded frame before drawing" readiness check, just parameterized by
 * target size instead of two independent copies of this logic drifting
 * apart over time.
 */
export function drawClipThumbnail(clip, canvas, w, h) {
  if (!canvas || !clip?.el) return;
  canvas.width = w;
  canvas.height = h;
  const draw = () => {
    const ctx = canvas.getContext("2d");
    const naturalW = clip.naturalW || w;
    const naturalH = clip.naturalH || h;
    // Cover, not contain — a thumbnail fills its box completely, no
    // letterbox bars, matching every reference video trimmer's own strip.
    const scale = Math.max(w / naturalW, h / naturalH);
    const dw = naturalW * scale, dh = naturalH * scale;
    ctx.drawImage(clip.el, (w - dw) / 2, (h - dh) / 2, dw, dh);
  };
  if (clip.kind === "image") {
    if (clip.el.complete) draw(); else clip.el.onload = draw;
  } else if (clip.el.readyState >= 2) {
    // A freshly-loaded <video> already has its frame at currentTime=0
    // decoded once "loadeddata" fires — no need to seek first.
    draw();
  } else {
    clip.el.addEventListener("loadeddata", draw, { once: true });
  }
}
