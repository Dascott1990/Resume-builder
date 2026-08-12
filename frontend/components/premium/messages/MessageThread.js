"use client";
/**
 * MessageThread.js — the chat UI for one job, slotted into
 * JobDetailDialog.js for accepted/completed jobs. Deliberately API-agnostic
 * (takes onFetch/onSend/onMarkRead callbacks) — the same component renders
 * for both the customer (MyRequestsPane.js, plain apiRequest) and the
 * artisan (ArtisanDashboard.js, X-Artisan-Token) sides; only the wiring
 * differs, same pattern SchedulingRow.js already uses.
 *
 * Polls every 4s while mounted — see the marketplace plan's stack-decision
 * table for why polling instead of WebSockets. Stops on unmount.
 */
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Btn } from "../guest/components/primitives";

const POLL_MS = 4000;

export default function MessageThread({ jobId, viewerIsArtisan, onFetch, onSend, onMarkRead }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const lastIdRef = useRef(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    lastIdRef.current = 0;
    setMessages([]);

    const poll = async () => {
      try {
        const fresh = await onFetch(jobId, lastIdRef.current);
        if (cancelled || !fresh?.length) return;
        lastIdRef.current = fresh[fresh.length - 1].id;
        setMessages((m) => [...m, ...fresh]);
      } catch {
        // Transient — the next poll tries again. A single dropped poll
        // isn't worth surfacing as an error in a thread that's already open.
      }
    };

    poll();
    onMarkRead?.(jobId);
    const interval = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [jobId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const msg = await onSend(jobId, body);
      setMessages((m) => [...m, msg]);
      lastIdRef.current = msg.id;
      setDraft("");
    } catch {
      // Draft stays put on failure — nothing typed is lost.
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={scrollRef}
        className="flex max-h-[220px] flex-col gap-1.5 overflow-y-auto rounded-lg border border-border bg-card/50 p-2.5 [-webkit-overflow-scrolling:touch]"
      >
        {messages.length === 0 && (
          <p className="m-0 py-3 text-center text-[12px] text-muted-foreground">No messages yet — say hello.</p>
        )}
        {messages.map((m) => {
          const mine = (m.sender_type === "artisan") === viewerIsArtisan;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-xl px-2.5 py-1.5 text-[12.5px] leading-relaxed break-words ${
                  mine ? "bg-primary text-primary-foreground" : "border border-border bg-background text-foreground"
                }`}
              >
                {m.body}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Type a message…"
          maxLength={2000}
          className="h-9 flex-1 rounded-[8px] border border-input bg-transparent px-2.5 text-[12.5px] text-foreground"
        />
        <Btn small variant="gold" disabled={!draft.trim() || sending} loading={sending} onClick={send}>
          <Send className="size-3.5" />
        </Btn>
      </div>
    </div>
  );
}
