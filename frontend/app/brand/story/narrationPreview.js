"use client";
/**
 * narrationPreview.js — fetches a clip's narration as real audio from
 * backend/app/api/story.py's /narration-preview (the exact same espeak-ng
 * call /render makes internally, just returned directly instead of
 * getting muxed into a full ffmpeg render) so PreviewPlayer.js can
 * actually play the voice-over live, instead of it only existing once a
 * story's been rendered and downloaded/sent.
 *
 * (text, voice, rate, pitch) always produces identical audio — espeak-ng
 * has no randomness — so this caches by that content key, not by clip id:
 * two clips with the same script/voice/speed/tone share one fetch, and
 * reverting a slider back to a value already heard never re-hits the
 * network.
 */
const BASE = process.env.NEXT_PUBLIC_API_URL;
const _cache = new Map(); // contentKey -> Promise<{url, duration}>

export function narrationContentKey({ text, voice, rate, pitch }) {
  return `${voice}|${rate}|${pitch}|${text}`;
}

async function synthesize({ text, voice, rate, pitch }) {
  if (!BASE) throw new Error("NEXT_PUBLIC_API_URL is not set.");
  let res;
  try {
    res = await fetch(`${BASE}/api/v1/brand/story/narration-preview`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice, rate, pitch }),
    });
  } catch {
    throw new Error("Can't reach Noqeev's servers right now.");
  }
  if (!res.ok) {
    let message = `Narration preview failed (${res.status})`;
    try { const json = await res.json(); message = json.error || message; } catch { /* non-JSON error body */ }
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const duration = await new Promise((resolve) => {
    const probe = new Audio();
    probe.preload = "metadata";
    probe.onloadedmetadata = () => resolve(probe.duration || 0);
    probe.onerror = () => resolve(0);
    probe.src = url;
  });
  return { url, duration };
}

/** Returns a Promise<{url, duration} | null> — null for empty text (nothing
 * to synthesize). Failures are NOT cached, so a transient network error
 * gets retried on the next call instead of wedging that content forever. */
export function getNarrationPreview({ text, voice, rate, pitch }) {
  const trimmed = (text || "").trim();
  if (!trimmed) return Promise.resolve(null);
  const key = narrationContentKey({ text: trimmed, voice, rate, pitch });
  if (!_cache.has(key)) {
    _cache.set(
      key,
      synthesize({ text: trimmed, voice, rate, pitch }).catch((e) => {
        _cache.delete(key);
        throw e;
      }),
    );
  }
  return _cache.get(key);
}
