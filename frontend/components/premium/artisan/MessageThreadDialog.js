"use client";
/**
 * MessageThreadDialog.js — the dedicated, chat-only screen behind both
 * sides' "Messages" tab (MyRequestsPane.js mode="messages" and
 * ArtisanDashboard.js's own Messages tab). Deliberately just three
 * things: who you're chatting with (a real name + avatar, not a job-
 * status card), the conversation, and a way to reply — no scheduling, no
 * escrow, no mark-complete/cancel. Those all still live in
 * JobDetailDialog.js, opened from "My requests" instead — one screen for
 * managing the job, one screen for talking to the other person, not one
 * screen trying to be both (see JobDetailDialog.js's own header comment).
 */
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { tintFor, initialsOf } from "../shared/artisanDisplay";
import MessageThread from "../messages/MessageThread";

export default function MessageThreadDialog({
  open, onClose, job, viewerIsArtisan,
  onFetchMessages, onSendMessage, onMarkMessagesRead,
}) {
  if (!job) return null;
  // The OTHER party's name — an artisan sees the customer's name
  // (contact_name), a customer sees the artisan's (artisan_name, falling
  // back to the trade if that's somehow missing — see requests.py's
  // my_requests for where artisan_name comes from).
  const name = viewerIsArtisan ? (job.contact_name || "Customer") : (job.artisan_name || job.trade);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent showCloseButton className="flex h-[80dvh] w-full max-w-[440px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[440px]">
        {/* Who you're chatting with, front and center — a real name and
            avatar, not a job-status header. This is the whole point of
            pulling this out of JobDetailDialog. */}
        <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-3.5">
          <div className={`flex size-9 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-bold ${tintFor(name)}`}>
            {initialsOf(name)}
          </div>
          <div className="min-w-0">
            <p className="m-0 truncate text-[14px] font-bold text-foreground">{name}</p>
            <p className="m-0 truncate text-[11.5px] text-muted-foreground">
              {job.trade}{job.city ? ` · ${job.city}` : ""}
            </p>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-3.5">
          <MessageThread
            jobId={job.id}
            viewerIsArtisan={viewerIsArtisan}
            onFetch={onFetchMessages}
            onSend={onSendMessage}
            onMarkRead={onMarkMessagesRead}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
