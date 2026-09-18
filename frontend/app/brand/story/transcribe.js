"use client";
/**
 * transcribe.js — speech-to-text for an uploaded video clip, via
 * POST /api/v1/brand/story/transcribe (backend/app/api/story.py, Groq's
 * hosted Whisper). The gap this closes: a video clip used to be edited
 * exactly like a silent image — type a caption, type a script to read
 * aloud — with nothing about what's actually SAID in the clip ever
 * taken into account. This lets the caption start from what the clip's
 * own audio really says, instead of from a blank textarea.
 *
 * Deliberately plain fetch, not apiRequest — a transcription response
 * isn't the {success, data} envelope shape a JSON body always is; it's
 * closer to ExportPanel.js's own reasoning for the same choice.
 */
import { getGuestId } from "@/lib/guestId";
import { getToken } from "@/lib/authToken";

const BASE = process.env.NEXT_PUBLIC_API_URL;

export async function transcribeClip(file) {
  if (!BASE) {
    throw new Error("NEXT_PUBLIC_API_URL is not set — set it in Vercel → Project Settings → Environment Variables to the Render backend URL, then redeploy.");
  }
  const headers = { "X-Guest-Id": getGuestId() };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const formData = new FormData();
  formData.append("clip", file, file.name);

  let res;
  try {
    res = await fetch(`${BASE}/api/v1/brand/story/transcribe`, { method: "POST", headers, body: formData });
  } catch {
    throw new Error("Couldn't reach the transcription service — check your connection and try again.");
  }

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Server returned an unreadable response (HTTP ${res.status}).`);
  }
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Transcription failed (${res.status})`);
  }
  return json.data; // { text, duration, segments: [{ text, start, end }] }
}
