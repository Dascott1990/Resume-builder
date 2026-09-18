/**
 * clipModel.js — loading a clip (image or video) file into browser
 * objects, and the plain-data shape a "clip" is in the story-assembly
 * timeline. No React here, just data + the object-URL lifecycle.
 *
 * loadClipFromFile mirrors ScreenshotStudio.js's loadImageFromBlob
 * (URL.createObjectURL -> load -> resolve, revoke on load/error), just
 * branching on video/* vs image/* since a clip can be either.
 */
import { newId } from "../postTemplates";

export function loadClipFromFile(file) {
  const isVideo = file.type.startsWith("video/");
  const objectUrl = URL.createObjectURL(file);

  if (isVideo) {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.onloadedmetadata = () => {
        resolve({
          kind: "video", file, objectUrl, el: video,
          naturalDurationSec: video.duration, naturalW: video.videoWidth, naturalH: video.videoHeight,
        });
      };
      video.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Couldn't read that video.")); };
      video.src = objectUrl;
    });
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ kind: "image", file, objectUrl, el: img, naturalW: img.naturalWidth, naturalH: img.naturalHeight });
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Couldn't read that image.")); };
    img.src = objectUrl;
  });
}

const DEFAULT_IMAGE_DURATION_SEC = 2.5;

export function makeClip(loaded) {
  return {
    id: newId(),
    kind: loaded.kind,
    file: loaded.file,
    objectUrl: loaded.objectUrl,
    el: loaded.el,
    naturalW: loaded.naturalW,
    naturalH: loaded.naturalH,
    // Images: how long to hold the frame. Videos: the trim window,
    // clamped to what's actually there.
    durationSec: loaded.kind === "image" ? DEFAULT_IMAGE_DURATION_SEC : undefined,
    trimIn: loaded.kind === "video" ? 0 : undefined,
    trimOut: loaded.kind === "video" ? loaded.naturalDurationSec : undefined,
    naturalDurationSec: loaded.naturalDurationSec,
    captionLayers: [],
    // Read aloud via server-side TTS at render time (see backend/app/api/
    // story.py) — empty by default (opt-in per clip), never auto-filled
    // from the caption text on its own; the UI offers a one-tap "Use
    // caption text" action for that instead, so a clip can be captioned,
    // narrated, or both without one silently overwriting the other.
    narrationText: "",
    // Voice/tone/speed/fit — all espeak-ng flags server-side (see
    // backend/app/api/story.py's NARRATION_VOICES etc.), defaults
    // matching what espeak-ng itself defaults to so an untouched clip
    // sounds exactly like it did before these controls existed.
    narrationVoice: "neutral", // "neutral" | "woman" | "man"
    narrationRate: 165, // words per minute — 80 (slow) to 320 (fast)
    narrationPitch: 50, // 0 (low) to 99 (high)
    narrationFit: "extend", // "extend" the clip to fit the voice-over, or "cut" the voice-over short at the clip's own length
  };
}

export function clipLengthSec(clip) {
  return clip.kind === "image" ? clip.durationSec : Math.max(0, clip.trimOut - clip.trimIn);
}

export function releaseClip(clip) {
  URL.revokeObjectURL(clip.objectUrl);
}
