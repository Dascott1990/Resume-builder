"use client";
/**
 * BroadcastTab.js — "Communication" in the admin sidebar: compose one
 * message, pick an audience (customers / everyone), see
 * exactly how many real people it'll reach BEFORE sending, confirm, then
 * watch it actually go out. Kept as its own file rather than one more
 * inline function in the already-1700-line AdminDashboard.js — a bulk
 * email tool is a genuinely different kind of admin action (it reaches
 * outside the app, to real inboxes, irreversibly) from the CRUD tables
 * everything else there manages.
 *
 * Local TabHeader/StatusChip here intentionally mirror AdminDashboard.js's
 * own (same classes, not imported — neither is exported from that file)
 * so this tab reads as part of the same panel, not a bolted-on one-off.
 *
 * Recipient count and the send itself are two separate calls on purpose:
 * GET /admin/broadcasts/recipients so the confirm dialog can say "this
 * reaches 214 people," not just "this will send," before the one action
 * on this whole panel that can't be undone.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, Megaphone, Users, Send, CheckCircle2, XCircle, Clock } from "lucide-react";
import { apiRequest } from "@/components/premium/shared/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

const AUDIENCES = [
  { id: "customers", label: "Customers" },
  { id: "everyone", label: "Everyone" },
];

const SUBJECT_MAX = 200;
const BODY_MAX = 5000;
const POLL_MS = 1500;

function TabHeader({ title, onRefresh, refreshing, extra }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
      <h2 className="m-0 text-[18px] font-bold text-foreground">{title}</h2>
      <div className="flex items-center gap-2">
        {extra}
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing} title="Refresh">
          <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>
    </div>
  );
}

const CHIP_TONES = {
  good: "bg-success/10 text-success",
  neutral: "bg-muted text-muted-foreground",
  warning: "bg-warning/10 text-warning",
  bad: "bg-destructive/10 text-destructive",
};
function StatusChip({ tone = "neutral", children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${CHIP_TONES[tone] || CHIP_TONES.neutral}`}>
      {children}
    </span>
  );
}

function timeAgo(iso) {
  if (!iso) return "";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function BroadcastTab() {
  const [audience, setAudience] = useState("customers");
  const [recipientCount, setRecipientCount] = useState(null); // null = loading
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeBroadcast, setActiveBroadcast] = useState(null); // the one currently sending/just sent, for the progress card
  const [history, setHistory] = useState(null); // null = loading
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    setRecipientCount(null);
    apiRequest(`/api/v1/admin/broadcasts/recipients?audience=${audience}`)
      .then((d) => setRecipientCount(d.count))
      .catch(() => setRecipientCount(0));
  }, [audience]);

  const loadHistory = () => {
    setHistoryLoading(true);
    apiRequest("/api/v1/admin/broadcasts")
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  };
  useEffect(() => { loadHistory(); }, []);

  // Polls the one broadcast just sent while it's still working through the
  // list — same "check back every so often" shape as every other live-
  // progress poll in this app, just here instead of a 4s message thread.
  // Depends on id/status specifically, not the whole activeBroadcast
  // object — that object gets a new reference on every tick (sent_count
  // ticking up), which would otherwise tear down and restart this
  // interval every single poll instead of running on a stable cadence.
  const activeId = activeBroadcast?.id;
  const activeStatus = activeBroadcast?.status;
  useEffect(() => {
    if (!activeId || activeStatus !== "sending") return;
    const interval = setInterval(() => {
      apiRequest(`/api/v1/admin/broadcasts/${activeId}`)
        .then((b) => {
          setActiveBroadcast(b);
          if (b.status !== "sending") loadHistory();
        })
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [activeId, activeStatus]);

  const canSend = subject.trim() && body.trim() && recipientCount > 0;

  const send = async () => {
    setSending(true);
    try {
      const created = await apiRequest("/api/v1/admin/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience, subject: subject.trim(), body: body.trim() }),
      });
      setActiveBroadcast(created);
      setConfirmOpen(false);
      setSubject("");
      setBody("");
      toast.success(`Sending to ${created.recipient_count} ${created.recipient_count === 1 ? "person" : "people"}…`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <TabHeader title="Broadcast" onRefresh={loadHistory} refreshing={historyLoading} />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* ── Compose ── */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center gap-2 text-[13px] font-bold text-foreground">
            <Megaphone className="size-4 text-primary" /> Compose
          </div>

          <div className="mb-3.5 space-y-1.5">
            <Label htmlFor="broadcast-audience">Audience</Label>
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger id="broadcast-audience">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUDIENCES.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="m-0 flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Users className="size-3.5" />
              {recipientCount === null ? "Counting recipients…" : `${recipientCount.toLocaleString()} ${recipientCount === 1 ? "person" : "people"} will receive this`}
            </p>
          </div>

          <div className="mb-3.5 space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="broadcast-subject">Subject</Label>
              <span className="text-[11px] text-muted-foreground">{subject.length}/{SUBJECT_MAX}</span>
            </div>
            <Input
              id="broadcast-subject" value={subject} maxLength={SUBJECT_MAX}
              onChange={(e) => setSubject(e.target.value)} placeholder="What's this about?"
            />
          </div>

          <div className="mb-4 space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="broadcast-body">Message</Label>
              <span className="text-[11px] text-muted-foreground">{body.length}/{BODY_MAX}</span>
            </div>
            <Textarea
              id="broadcast-body" value={body} maxLength={BODY_MAX} rows={8}
              onChange={(e) => setBody(e.target.value)} placeholder="Write the message — plain text, we'll format it into an email."
            />
          </div>

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button disabled={!canSend}>
                <Send className="size-3.5" /> Send{recipientCount > 0 ? ` to ${recipientCount.toLocaleString()}` : ""}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Send this to {recipientCount?.toLocaleString()} {recipientCount === 1 ? "person" : "people"}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This emails every {AUDIENCES.find((a) => a.id === audience)?.label.toLowerCase()} right now — it can't be recalled once it's sent.
                  Subject: <strong className="text-foreground">{subject}</strong>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={send} disabled={sending}>
                  {sending ? <Loader2 className="size-3.5 animate-spin" /> : "Send it"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* ── Live progress for whatever was just sent ── */}
        {activeBroadcast && (
          <div className="h-fit rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[13px] font-bold text-foreground">Sending now</span>
              {activeBroadcast.status === "sending" ? (
                <StatusChip tone="warning"><Clock className="size-3" /> Sending</StatusChip>
              ) : (
                <StatusChip tone="good"><CheckCircle2 className="size-3" /> Done</StatusChip>
              )}
            </div>
            <p className="m-0 mb-2 truncate text-[13px] font-semibold text-foreground">{activeBroadcast.subject}</p>
            <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${activeBroadcast.recipient_count ? ((activeBroadcast.sent_count + activeBroadcast.failed_count) / activeBroadcast.recipient_count) * 100 : 0}%` }}
              />
            </div>
            <p className="m-0 text-[12px] text-muted-foreground">
              {activeBroadcast.sent_count} sent
              {activeBroadcast.failed_count > 0 && `, ${activeBroadcast.failed_count} failed`}
              {" "}of {activeBroadcast.recipient_count}
            </p>
          </div>
        )}
      </div>

      {/* ── History ── */}
      <div className="mt-6">
        <p className="m-0 mb-2.5 font-mono text-[10.5px] font-bold tracking-[0.12em] text-muted-foreground/60 uppercase">Sent before</p>
        {history === null ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
        ) : history.length === 0 ? (
          <p className="m-0 rounded-xl border border-dashed border-border p-4 text-center text-[13px] text-muted-foreground">Nothing sent yet.</p>
        ) : (
          <div className="grid gap-2">
            {history.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="m-0 truncate text-[13px] font-bold text-foreground">{b.subject}</p>
                    <StatusChip tone="neutral">{b.audience}</StatusChip>
                    {b.status === "sending" ? (
                      <StatusChip tone="warning"><Clock className="size-3" /> Sending</StatusChip>
                    ) : b.failed_count > 0 ? (
                      <StatusChip tone="warning"><XCircle className="size-3" /> {b.failed_count} failed</StatusChip>
                    ) : (
                      <StatusChip tone="good"><CheckCircle2 className="size-3" /> Done</StatusChip>
                    )}
                  </div>
                  <p className="m-0 mt-1 text-[11.5px] text-muted-foreground">
                    {b.sent_count}/{b.recipient_count} delivered · by {b.sent_by_email} · {timeAgo(b.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
