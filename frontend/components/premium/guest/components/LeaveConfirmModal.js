"use client";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Btn } from "./primitives";

// ── Leave-confirmation modal ──────────────────────────────────────────────────
// Shown when the X is tapped while there's actually something on screen to lose.
// Your draft autosaves to this browser as you go, so "Leave" doesn't wipe it —
// but the person has no way of knowing that unless we say so.
export function LeaveConfirmModal({ open, onCancel, onConfirm }) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <AlertDialogContent size="default" className="max-w-[380px] gap-4 p-[22px] text-left">
        <AlertDialogHeader className="text-left sm:place-items-start">
          <AlertDialogTitle className="font-serif text-[19px] font-normal italic">
            Leave Noviq?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[13px] leading-relaxed">
            Your progress is saved on this device — it'll be right here when you come back.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mx-0 mb-0 flex-row gap-2 border-t-0 bg-transparent p-0 sm:justify-start">
          <Btn small variant="gold" onClick={onConfirm}>Leave</Btn>
          <Btn small variant="ghost" onClick={onCancel}>Stay here</Btn>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
