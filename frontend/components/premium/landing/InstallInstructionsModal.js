"use client";
import { Share, Download } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

// ── iOS install instructions ──────────────────────────────────────────────────
// Safari has no programmatic install prompt at all — this is the only path
// on iOS, shown in place of the native browser prompt Chrome/Edge/Android get.
export function InstallInstructionsModal({ open, onClose }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent showCloseButton className="w-full max-w-[380px] gap-0 overflow-hidden p-0 sm:max-w-[380px]">
        <div className="p-[22px] text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full border border-primary/25 bg-primary/10">
            <Download className="size-6 text-primary" />
          </div>
          <p className="m-0 mb-1 font-serif text-xl italic text-foreground">Add to Home Screen</p>
          <p className="m-0 mb-5 text-[12.5px] leading-relaxed text-muted-foreground">
            Safari doesn't let apps trigger this directly — two taps and it's done.
          </p>
          <div className="flex flex-col gap-2 text-left">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[12px] font-bold text-primary">1</span>
              <span className="flex items-center gap-1.5 text-[13px] text-foreground">
                Tap the Share icon <Share className="size-3.5 text-muted-foreground" />
              </span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[12px] font-bold text-primary">2</span>
              <span className="text-[13px] text-foreground">Scroll down, tap "Add to Home Screen"</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
