"use client";
import { Bookmark, MousePointerClick } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TextLink } from "./primitives";
import { BOOKMARKLET_HREF } from "@/lib/bookmarklet";

// ── "Tailor for this Job" bookmarklet ────────────────────────────────────────
// Explains and hands over the draggable bookmarklet link (see
// lib/bookmarklet.js) — skips the copy-paste from a job posting entirely.
export function BookmarkletModal({ open, onClose }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent showCloseButton className="w-full max-w-[420px] gap-0 overflow-hidden p-0 sm:max-w-[420px]">
        <div className="p-[22px]">
          <p className="m-0 mb-1 flex items-center gap-2 font-serif text-xl italic text-foreground">
            <Bookmark className="size-[17px] text-primary" /> Skip the copy-paste
          </p>
          <p className="m-0 mb-5 text-[12.5px] leading-relaxed text-muted-foreground">
            Drag the button below to your bookmarks bar. Next time you're looking at a job
            posting anywhere — LinkedIn, Indeed, a company's own site — click it, and Noviq
            opens with that posting already in place.
          </p>

          <div className="mb-5 flex justify-center rounded-2xl border border-dashed border-border bg-muted p-5">
            {/* A real draggable link, not a button — dragging TO the bookmarks
                bar is the entire mechanism, so this can't be a <button> or
                onClick handler standing in for it. */}
            <a
              href={BOOKMARKLET_HREF}
              onClick={(e) => e.preventDefault()}
              draggable
              className="flex select-none items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-2.5 text-[13.5px] font-bold text-primary [-webkit-tap-highlight-color:transparent]"
            >
              <Bookmark className="size-4" />
              Tailor for this Job
            </a>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-3.5">
            <MousePointerClick className="mt-0.5 size-[15px] shrink-0 text-muted-foreground" />
            <p className="m-0 text-[12px] leading-relaxed text-muted-foreground">
              On a phone, bookmarklets can't be dragged — open this page on a computer once to
              add it, and it'll be there on any device signed into the same browser.
            </p>
          </div>

          <div className="mt-5 flex justify-center">
            <TextLink onClick={onClose}>Got it</TextLink>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
