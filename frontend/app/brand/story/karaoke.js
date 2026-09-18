/**
 * karaoke.js — word-by-word timing for a caption, so it can highlight
 * one word at a time as the clip plays (the CapCut/TikTok-style
 * "auto-caption" look), both live in PreviewPlayer.js and baked into
 * the actual exported video by ExportPanel.js + backend/app/api/story.py.
 *
 * There's no real speech-to-text/forced-alignment here — the caption's
 * own words are distributed across the clip's total displayed duration,
 * weighted by word length (a longer word gets more time than "a" or
 * "I"), which is the same approximation most caption tools fall back to
 * when timing isn't derived from an actual audio waveform. Good enough
 * to read as "the caption is keeping pace with the clip," not meant to
 * frame-match real speech.
 */

// A floor per word so a run of short words ("a", "to", "is") doesn't
// flash by faster than a reader can track.
const MIN_WEIGHT = 3;

/** [{ word, start, end }], seconds, relative to the clip's own start
 * (0 = clip start). The last word's `end` is Infinity — deliberately
 * open-ended, because the actual rendered clip can run LONGER than
 * `totalDurationSec` when narration audio needs more time than the
 * clip's set duration (see story.py's own duration = max(duration_sec,
 * narration_duration) / trim_out extension) — an open last window means
 * the final word just stays highlighted through that overrun instead of
 * the caption going dark before the clip actually ends. */
export function wordTimings(text, totalDurationSec) {
  const words = (text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length || !(totalDurationSec > 0)) return [];
  const weights = words.map((w) => Math.max(w.length, MIN_WEIGHT));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let t = 0;
  return words.map((word, i) => {
    const start = t;
    t += (weights[i] / totalWeight) * totalDurationSec;
    return { word, start, end: i === words.length - 1 ? Infinity : t };
  });
}

/** Index into `timings` active at `localTimeSec`, or -1 before the first
 * word / once the text is empty. */
export function activeWordIndex(timings, localTimeSec) {
  if (!timings.length) return -1;
  for (let i = 0; i < timings.length; i++) {
    if (localTimeSec < timings[i].end) return i;
  }
  return timings.length - 1;
}
