"use client";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Btn } from "../primitives";

export function SettingsTab({ saved, onResetStyle, onClearAll }) {
  return (
    <div className="p-4">
      <p className="m-0 mb-4 font-serif text-[17px] italic text-foreground">
        Settings
      </p>

      <div className="mb-4 border-b border-border pb-4">
        <p className="m-0 mb-0.5 text-[13px] font-semibold text-foreground">Style defaults</p>
        <p className="m-0 mb-2.5 text-xs leading-relaxed text-muted-foreground">
          Reset font, size, spacing and accent back to Calibri, 11pt, navy.
        </p>
        <Btn small variant="ghost" icon="RefreshCw" onClick={onResetStyle}>
          Reset style
        </Btn>
      </div>

      <div className="mb-4 border-b border-border pb-4">
        <p className="m-0 mb-0.5 text-[13px] font-semibold text-foreground">Saved resumes</p>
        <p className="m-0 mb-2.5 text-xs leading-relaxed text-muted-foreground">
          {saved.length > 0
            ? `${saved.length} resume${saved.length !== 1 ? "s" : ""} stored on the server.`
            : "Nothing saved yet."}
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Btn small variant="danger" icon="Trash2" disabled={saved.length === 0}>
              Clear all saved resumes
            </Btn>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete all {saved.length} saved resumes?</AlertDialogTitle>
              <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={onClearAll}>Yes, delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <p className="m-0 text-[11.5px] text-muted-foreground/60">
        Noviq · Guest Mode<br />
        Generation runs on your own Groq-backed API — nothing is stored beyond what you see in "Saved."
      </p>
    </div>
  );
}
