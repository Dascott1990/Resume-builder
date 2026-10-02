"use client";
/**
 * DownloadCapModal.js — shown when the server (see backend/app/models.py's
 * GuestDownloadCount) reports a guest has used all 3 free downloads. Unlike
 * SignupNudgeModal.js's soft "Maybe later" prompt, this is a hard stop: no
 * action here grants another download, it only routes to Sign up or Log
 * in — the resume itself stays fully visible/editable behind the dialog,
 * only the download buttons are blocked until an account exists.
 */
import { Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function DownloadCapModal({ open, onClose, onRequireAuth }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Lock className="size-5" />
          </div>
          <DialogTitle>You&apos;ve used your 3 free downloads</DialogTitle>
          <DialogDescription>
            Sign up to keep going — and we&apos;ll save what you&apos;ve already
            typed as your profile, so you never have to enter it again.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Button onClick={() => onRequireAuth("signup")} className="w-full">
            Create free account
          </Button>
          <button
            type="button"
            onClick={() => onRequireAuth("login")}
            className="w-full cursor-pointer border-none bg-transparent p-0 py-1 text-center text-[13px] font-semibold text-muted-foreground [-webkit-tap-highlight-color:transparent] hover:text-foreground"
          >
            Already have an account? Log in
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
