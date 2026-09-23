"use client";
/**
 * EmojiPicker.js — a small avatar-emoji grid, shared by every screen that
 * lets someone set an emoji avatar (Settings.js's customer AND artisan
 * profile sections, ArtisanListingManager.js) — extracted so all three
 * pick from the same set and behave identically instead of drifting.
 */
import { useState } from "react";
import { Smile } from "lucide-react";

export const AVATAR_EMOJI = [
  "😀", "😎", "🤓", "🥳", "🦄", "🐱", "🐶", "🦊",
  "🐼", "🚀", "⭐", "🔥", "💪", "🎯", "🏆", "🎨",
  "⚡", "🌈", "☕", "🎸",
];

export function EmojiPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 border-none bg-transparent p-0 text-[12.5px] font-bold text-primary">
        <Smile className="size-3.5" /> {value ? "Change avatar emoji" : "Set an avatar emoji"}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="grid grid-cols-8 gap-1.5">
        {AVATAR_EMOJI.map((e) => (
          <button
            key={e}
            type="button"
            aria-label={e}
            onClick={() => { onChange(e); setOpen(false); }}
            className={`flex size-8 items-center justify-center rounded-lg text-base ${value === e ? "bg-primary/15 ring-1 ring-primary" : ""}`}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        {value ? (
          <button type="button" onClick={() => { onChange(null); setOpen(false); }} className="border-none bg-transparent p-0 text-[11.5px] font-semibold text-muted-foreground">
            Remove
          </button>
        ) : <span />}
        <button type="button" onClick={() => setOpen(false)} className="border-none bg-transparent p-0 text-[11.5px] font-semibold text-muted-foreground">
          Close
        </button>
      </div>
    </div>
  );
}

export default EmojiPicker;
