"use client";
/**
 * ApplyWithAI.js — the "Apply with AI" flow: confirm a career profile once,
 * paste a job application URL, watch the agent fill out the real form,
 * review exactly what it did, then approve the one real submit click.
 *
 * The agent never invents a fact and never submits without this screen's
 * explicit confirm-submit call — see backend/app/agent/tools.py and
 * backend/app/api/apply.py for where those are actually enforced in code.
 * This component is just the window into that; it doesn't re-implement
 * any of the safety logic itself, only displays it.
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  X, Sparkles, Check, Loader2, AlertTriangle, ExternalLink, RefreshCw,
} from "lucide-react";
import { apiRequest } from "./shared/api";
import { Btn } from "./guest/components/primitives";
import { IconTile } from "./shared/IconTile";
import Logo from "./Logo";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

const POLL_MS = 2500;
const ORDER = ["queued", "reading_job", "preparing_resume", "filling_form", "needs_input", "ready_for_review", "submitted"];
const CHECKLIST = [
  { key: "reading_job", label: "Reading the job posting" },
  { key: "preparing_resume", label: "Preparing your resume" },
  { key: "filling_form", label: "Filling out the application" },
  { key: "ready_for_review", label: "Ready for your review" },
];
const TERMINAL_STATUSES = ["submitted", "failed", "cancelled", "expired"];

function stepState(currentStatus, stepKey) {
  const curIdx = ORDER.indexOf(currentStatus === "needs_input" ? "filling_form" : currentStatus);
  const stepIdx = ORDER.indexOf(stepKey);
  if (curIdx > stepIdx) return "done";
  if (curIdx === stepIdx) return "active";
  return "pending";
}

function Field({ label, children }) {
  return (
    <div className="mb-3">
      <span className="mb-1.5 block text-[13px] font-bold tracking-wide text-foreground">{label}</span>
      {children}
    </div>
  );
}

// ── Phase 1: confirm the career profile (the agent's only source of truth) ─
function ProfileForm({ initial, onConfirmed }) {
  const [form, setForm] = useState(() => ({
    full_name: initial?.full_name || "", email: initial?.email || "",
    phone: initial?.phone || "", location: initial?.location || "",
    work_auth_status: initial?.work_authorization?.status || "",
    role: initial?.work_history?.[0]?.role || "", company: initial?.work_history?.[0]?.company || "",
    period: initial?.work_history?.[0]?.period || "", bullets: (initial?.work_history?.[0]?.bullets || []).join("\n"),
    degree: initial?.education?.[0]?.degree || "", school: initial?.education?.[0]?.school || "",
    edu_period: initial?.education?.[0]?.period || "",
    skills: (initial?.skills || []).join(", "),
  }));
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim()) {
      toast.error("Name and email are required.");
      return;
    }
    setSaving(true);
    try {
      const data = await apiRequest("/api/v1/apply/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name, email: form.email, phone: form.phone, location: form.location,
          work_authorization: { status: form.work_auth_status || "unknown" },
          work_history: form.role ? [{ role: form.role, company: form.company, period: form.period, bullets: form.bullets.split("\n").map((b) => b.trim()).filter(Boolean) }] : [],
          education: form.degree ? [{ degree: form.degree, school: form.school, period: form.edu_period }] : [],
          skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
          confirm: true,
        }),
      });
      toast.success("Profile confirmed.");
      onConfirmed(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-lg">
      <div className="mb-5 flex flex-col items-center gap-2 text-center">
        <IconTile icon={Sparkles} size="md" />
        <h1 className="m-0 text-xl font-bold text-foreground">Confirm your career profile</h1>
        <p className="m-0 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          This is the only data the agent is ever allowed to use — it never invents facts about you.
          Review it once here; you can update it any time.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
        <Field label="Full name"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="h-11" /></Field>
        <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-11" /></Field>
        <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-11" /></Field>
        <Field label="Location"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="h-11" /></Field>
      </div>

      <Field label="Work authorization">
        <Select value={form.work_auth_status || "__unset__"} onValueChange={(v) => setForm({ ...form, work_auth_status: v === "__unset__" ? "" : v })}>
          <SelectTrigger className="h-11 w-full"><SelectValue placeholder="Not set" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__unset__">Not set — the agent will ask if needed</SelectItem>
            <SelectItem value="citizen">Citizen</SelectItem>
            <SelectItem value="permanent_resident">Permanent resident</SelectItem>
            <SelectItem value="authorized_no_sponsorship">Authorized to work, no sponsorship needed</SelectItem>
            <SelectItem value="visa_sponsorship_required">Requires visa sponsorship</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
        <Field label="Most recent role"><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="h-11" /></Field>
        <Field label="Company"><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="h-11" /></Field>
        <Field label="Period"><Input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="2021 – 2024" className="h-11" /></Field>
      </div>
      <Field label="What you did there (one per line)">
        <Textarea rows={3} value={form.bullets} onChange={(e) => setForm({ ...form, bullets: e.target.value })} />
      </Field>

      <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
        <Field label="Degree"><Input value={form.degree} onChange={(e) => setForm({ ...form, degree: e.target.value })} className="h-11" /></Field>
        <Field label="School"><Input value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} className="h-11" /></Field>
      </div>
      <Field label="Skills (comma separated)">
        <Input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="Python, React, SQL" className="h-11" />
      </Field>

      <Btn variant="gold" type="submit" disabled={saving} loading={saving} className="mt-1 w-full">
        {saving ? "Saving…" : "Confirm profile"}
      </Btn>
    </form>
  );
}

// ── Phase 2: paste the job URL ──────────────────────────────────────────
function UrlForm({ onStarted }) {
  const [url, setUrl] = useState("");
  const [starting, setStarting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!/^https?:\/\//i.test(url.trim())) {
      toast.error("Enter a valid job application URL.");
      return;
    }
    setStarting(true);
    try {
      const run = await apiRequest("/api/v1/apply/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_url: url.trim() }),
      });
      onStarted(run);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setStarting(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-md">
      <div className="mb-5 flex flex-col items-center gap-2 text-center">
        <IconTile icon={Sparkles} size="md" />
        <h1 className="m-0 text-xl font-bold text-foreground">What do you want Noviq to do?</h1>
        <p className="m-0 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
          Paste the link to a real job application. Noviq fills it out, then stops for you to review before anything is submitted.
        </p>
      </div>
      <Input
        value={url} onChange={(e) => setUrl(e.target.value)}
        placeholder="https://jobs.example.com/apply/123"
        className="h-12 text-center"
        autoFocus
      />
      <Btn variant="gold" type="submit" disabled={starting} loading={starting} className="mt-3 w-full">
        {starting ? "Starting…" : "Start"}
      </Btn>
    </form>
  );
}

// ── Phase 3: live progress ──────────────────────────────────────────────
function ProgressChecklist({ run, onAnswered, onCancelled }) {
  const [answer, setAnswer] = useState("");
  const [answering, setAnswering] = useState(false);
  const pendingQuestion = (run.pending_questions || []).find((q) => !q.answered);

  const submitAnswer = async (e) => {
    e.preventDefault();
    if (!answer.trim()) return;
    setAnswering(true);
    try {
      await apiRequest(`/api/v1/apply/runs/${run.id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: answer.trim() }),
      });
      setAnswer("");
      onAnswered();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAnswering(false);
    }
  };

  const cancel = async () => {
    try {
      await apiRequest(`/api/v1/apply/runs/${run.id}/cancel`, { method: "POST" });
      onCancelled();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const doneCount = CHECKLIST.filter((s) => stepState(run.status, s.key) === "done").length;

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-5 flex flex-col items-center gap-2 text-center">
        <IconTile icon={Sparkles} size="md" />
        <h1 className="m-0 text-lg font-bold text-foreground">Noviq is working…</h1>
      </div>

      <Progress value={(doneCount / CHECKLIST.length) * 100} className="mb-5" />

      <div className="grid gap-2.5">
        {CHECKLIST.map((step) => {
          const state = stepState(run.status, step.key);
          return (
            <div key={step.key} className="flex items-center gap-2.5 text-[13.5px]">
              {state === "done" && <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"><Check className="size-3" /></span>}
              {state === "active" && <Loader2 className="size-5 shrink-0 animate-spin text-primary" />}
              {state === "pending" && <span className="size-5 shrink-0 rounded-full border border-border" />}
              <span className={state === "pending" ? "text-muted-foreground" : "font-medium text-foreground"}>{step.label}</span>
            </div>
          );
        })}
      </div>

      {pendingQuestion && (
        <form onSubmit={submitAnswer} className="mt-5 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="m-0 mb-2 flex items-center gap-1.5 text-[12.5px] font-bold text-primary">
            <AlertTriangle className="size-3.5" /> Noviq needs your input
          </p>
          <p className="m-0 mb-2.5 text-[13.5px] text-foreground">{pendingQuestion.question}</p>
          <Input value={answer} onChange={(e) => setAnswer(e.target.value)} className="h-11" autoFocus />
          <Btn variant="gold" type="submit" small disabled={answering} loading={answering} className="mt-2.5">
            {answering ? "Sending…" : "Answer"}
          </Btn>
        </form>
      )}

      {(run.steps_log || []).length > 0 && (
        <div className="mt-5 max-h-40 overflow-y-auto rounded-xl border border-border bg-card p-3 text-[11.5px] text-muted-foreground">
          {run.steps_log.slice(-8).map((s, i) => (
            <p key={i} className="m-0 truncate py-0.5">{s.ok ? "✓" : "⚠"} {s.result_summary}</p>
          ))}
        </div>
      )}

      <Btn variant="ghost" small onClick={cancel} className="mt-4 w-full">Cancel</Btn>
    </div>
  );
}

// ── Phase 4: review before the real submit ──────────────────────────────
function ReviewScreen({ run, onSubmitted, onCancelled }) {
  const [submitting, setSubmitting] = useState(false);
  const fields = (run.filled_form_snapshot?.elements) || [];
  const unfillable = run.unfillable_fields || [];

  const confirmSubmit = async () => {
    setSubmitting(true);
    try {
      await apiRequest(`/api/v1/apply/runs/${run.id}/confirm-submit`, { method: "POST" });
      onSubmitted();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async () => {
    try {
      await apiRequest(`/api/v1/apply/runs/${run.id}/cancel`, { method: "POST" });
      onCancelled();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="mb-5 flex flex-col items-center gap-2 text-center">
        <IconTile icon={Check} size="md" />
        <h1 className="m-0 text-lg font-bold text-foreground">Ready for your review</h1>
        <p className="m-0 text-[13px] text-muted-foreground">Nothing has been submitted yet. Check everything below.</p>
      </div>

      {unfillable.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
          <p className="m-0 mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold text-amber-500">
            <AlertTriangle className="size-3.5" /> Needs your attention before submitting
          </p>
          {unfillable.map((f, i) => (
            <p key={i} className="m-0 text-[12.5px] text-foreground">• {typeof f === "string" ? f : f.label}</p>
          ))}
        </div>
      )}

      <div className="mb-5 grid gap-1.5 rounded-xl border border-border bg-card p-3.5">
        {fields.length === 0 && <p className="m-0 text-[13px] text-muted-foreground">No fields captured.</p>}
        {fields.map((f, i) => (
          <div key={i} className="flex items-start justify-between gap-3 border-b border-border/60 py-1.5 text-[13px] last:border-0">
            <span className="shrink-0 font-medium text-muted-foreground">{f.label}</span>
            <span className="text-right text-foreground">{f.value}</span>
          </div>
        ))}
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Btn variant="gold" className="w-full">Confirm & Submit</Btn>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit this application?</AlertDialogTitle>
            <AlertDialogDescription>This will submit your real application. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={submitting} onClick={confirmSubmit}>
              {submitting ? "Submitting…" : "Submit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Btn variant="ghost" small onClick={cancel} className="mt-2.5 w-full">Discard instead</Btn>
    </div>
  );
}

// ── Phase 5: terminal states ─────────────────────────────────────────────
function TerminalScreen({ run, onRestart }) {
  const map = {
    submitted: { icon: Check, title: "Application submitted", tone: "text-primary", body: "Noviq submitted the application and added it to your Job Tracker." },
    failed: { icon: AlertTriangle, title: "Couldn't finish this one", tone: "text-destructive", body: run.error_message || "Something went wrong." },
    cancelled: { icon: X, title: "Cancelled", tone: "text-muted-foreground", body: "This run was cancelled." },
    expired: { icon: AlertTriangle, title: "Review window expired", tone: "text-muted-foreground", body: "Nobody confirmed in time, so the session was closed. Nothing was submitted." },
  };
  const meta = map[run.status] || map.failed;
  const Icon = meta.icon;
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3 text-center">
      <IconTile icon={Icon} size="md" />
      <h1 className={`m-0 text-lg font-bold ${meta.tone}`}>{meta.title}</h1>
      <p className="m-0 text-[13.5px] leading-relaxed text-muted-foreground">{meta.body}</p>
      <Btn variant="gold" onClick={onRestart} className="mt-2 w-full">Start another</Btn>
    </div>
  );
}

export default function ApplyWithAI({ onClose }) {
  const [phase, setPhase] = useState("loading"); // loading | profile | url | progress | review | terminal
  const [profile, setProfile] = useState(null);
  const [run, setRun] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    apiRequest("/api/v1/apply/profile")
      .then((data) => {
        setProfile(data);
        setPhase(data && data.confirmed ? "url" : "profile");
      })
      .catch(() => setPhase("profile"));
  }, []);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  const startPolling = (runId) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const data = await apiRequest(`/api/v1/apply/runs/${runId}`);
        setRun(data);
        if (TERMINAL_STATUSES.includes(data.status)) {
          stopPolling();
          setPhase("terminal");
        } else if (data.status === "ready_for_review") {
          stopPolling();
          setPhase("review");
        } else {
          setPhase("progress");
        }
      } catch {
        // transient poll failure — keep trying, next tick may succeed
      }
    }, POLL_MS);
  };

  useEffect(() => () => stopPolling(), []);

  const handleRunStarted = (newRun) => {
    setRun(newRun);
    setPhase("progress");
    startPolling(newRun.id);
  };

  const restart = () => {
    stopPolling();
    setRun(null);
    setPhase("url");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-background font-sans"
    >
      <header
        className="flex shrink-0 items-center justify-between border-b border-border px-5 pb-4"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <Logo size={22} />
        {onClose && (
          <button onClick={onClose} aria-label="Close" className="flex size-10 items-center justify-center rounded-full border border-border bg-muted text-foreground">
            <X className="size-[17px]" />
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-8 sm:px-8">
        {phase === "loading" && (
          <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        )}
        {phase === "profile" && <ProfileForm initial={profile} onConfirmed={(p) => { setProfile(p); setPhase("url"); }} />}
        {phase === "url" && <UrlForm onStarted={handleRunStarted} />}
        {phase === "progress" && run && <ProgressChecklist run={run} onAnswered={() => {}} onCancelled={() => { setPhase("terminal"); }} />}
        {phase === "review" && run && <ReviewScreen run={run} onSubmitted={() => setPhase("terminal")} onCancelled={() => setPhase("terminal")} />}
        {phase === "terminal" && run && <TerminalScreen run={run} onRestart={restart} />}
      </div>
    </motion.div>
  );
}
