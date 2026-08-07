"use client";
/**
 * InterviewChat.js — a short mock-interview practice session, grounded in
 * the job description and the interview talking points Optimize already
 * generated. Entirely stateless server-side (see /resume/interview-chat) —
 * this component owns the whole transcript and just resends it every turn,
 * matching the app's "ephemeral unless you explicitly save it" default.
 */
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, Send, MessageCircle } from "lucide-react";
import { apiRequest } from "../../shared/api";

export function InterviewChat({ open, onClose, jobDescription, interviewTips }) {
  const [messages, setMessages] = useState([]); // [{role, content}]
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);
  const startedRef = useRef(false);

  const ask = async (nextMessages) => {
    setSending(true);
    setError("");
    try {
      const data = await apiRequest("/api/v1/resume/interview-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_description: jobDescription, interview_tips: interviewTips, messages: nextMessages }),
      });
      setMessages([...nextMessages, { role: "assistant", content: data.message }]);
    } catch (e) {
      setError(e.message || "Could not reach the interviewer. Try again.");
    } finally {
      setSending(false);
    }
  };

  // Opens with the AI's first question, not a blank chat — one less thing
  // to have to prompt yourself into.
  useEffect(() => {
    if (open && !startedRef.current) {
      startedRef.current = true;
      ask([]);
    }
    if (!open) {
      // Reset for next time this modal opens, rather than resuming a
      // finished practice session as if it were still going.
      startedRef.current = false;
      setMessages([]);
      setInput("");
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const send = () => {
    const text = input.trim();
    if (!text || sending) return;
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    ask(next);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent showCloseButton className="flex h-[min(88dvh,640px)] w-full max-w-[480px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[480px]">
        <div className="shrink-0 border-b border-border px-[22px] pt-[22px] pb-3.5">
          <p className="m-0 mb-1 flex items-center gap-2 font-serif text-xl italic text-foreground">
            <MessageCircle className="size-[17px] text-primary" /> Practice interview
          </p>
          <p className="m-0 text-[12.5px] text-muted-foreground">
            A quick back-and-forth, grounded in this job posting. Answer like you would for real.
          </p>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[18px] py-4 [-webkit-overflow-scrolling:touch]">
          <div className="flex flex-col gap-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-card px-3.5 py-2.5">
                  <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            {error && (
              <div role="alert" className="border-l-2 border-destructive py-0.5 pl-[11px] text-[12.5px] leading-relaxed text-destructive">
                {error}
              </div>
            )}
          </div>
        </div>

        <div
          className="flex shrink-0 items-end gap-2 border-t border-border bg-popover px-[18px] pt-3"
          style={{ paddingBottom: "max(14px, calc(env(safe-area-inset-bottom) + 8px))" }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={sending ? undefined : "Type your answer…"}
            rows={1}
            disabled={sending}
            className="min-h-[42px] flex-1 resize-none rounded-xl border border-input bg-transparent px-3 py-2.5 text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring"
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            aria-label="Send"
            className="flex size-[42px] shrink-0 items-center justify-center rounded-xl border-none bg-primary text-primary-foreground disabled:opacity-40 [-webkit-tap-highlight-color:transparent]"
          >
            <Send className="size-4" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
