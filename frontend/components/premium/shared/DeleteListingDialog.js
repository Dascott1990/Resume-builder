"use client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

// Shared between ArtisanCard (Artisans.js) and ArtisanProfile.js so the
// confirm-delete copy/behavior can't drift between the two places a listing
// can be removed from.
export default function DeleteListingDialog({ name, open, onOpenChange, onConfirm, trigger }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      {/* stopPropagation here, not on the individual buttons: AlertDialogContent
          renders through a React Portal, so its DOM lives outside the card
          entirely — but React still bubbles the synthetic click event up
          through the *React* tree (where this dialog is nested inside the
          card's JSX), not the DOM tree. Without this, confirming (or even
          cancelling) the delete also re-triggers the card's own onClick and
          opens that artisan's profile right after deleting/cancelling it. */}
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this listing?</AlertDialogTitle>
          <AlertDialogDescription>
            This can't be undone — {name}'s listing will no longer be visible to anyone browsing.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
