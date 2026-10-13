"use client";
/**
 * JobTracker.js — track where you've applied, status, and notes. Scoped
 * anonymously by guest_id (or by account, once signed in) exactly like
 * Saved resumes — same backend pattern, see backend/app/api/applications.py.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  X, RefreshCw, ClipboardList, FileText, Clock, ExternalLink,
  Calendar, AlertTriangle, Sparkles, Copy, Plus, Download, ChevronRight,
  Home, Briefcase, CircleUser,
} from "lucide-react";
import { apiRequest } from "./shared/api";
import { apiListSaved } from "./guest/api";
import { getGuestId } from "@/lib/guestId";
import { getToken } from "@/lib/authToken";
import { loadFormDraft, saveFormDraft, clearFormDraft } from "@/lib/formDraft";
import { Btn } from "./guest/components/primitives";
import { IconTile } from "./shared/IconTile";
import { tapFeedback } from "@/lib/haptics";
import Logo from "./Logo";
import { NavRail } from "./shared/NavRail";
import { MobileFloatingNav } from "./shared/MobileFloatingNav";
import { NotificationsDialog } from "./shared/NotificationsDialog";
import { useAuth } from "@/lib/useAuth";
import { useViewport } from "@/lib/useViewport";
import { useUnreadNotifications } from "@/lib/useUnreadNotifications";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/lib/i18n";

const statuses = (t) => [
  { id: "saved", label: t("status.saved"), className: "border-border text-muted-foreground" },
  { id: "applied", label: t("status.applied"), className: "border-border text-muted-foreground" },
  { id: "interview", label: t("status.interview"), className: "border-primary/30 bg-primary/10 text-primary" },
  { id: "offer", label: t("status.offer"), className: "border-success/30 bg-success/10 text-success" },
  { id: "rejected", label: t("status.rejected"), className: "border-destructive/30 bg-destructive/10 text-destructive" },
];
const statusMeta = (id, STATUSES) => STATUSES.find((s) => s.id === id) || STATUSES[0];

const EMPTY_FORM = {
  company: "", role: "", status: "applied", date_applied: "", notes: "", resume_id: "",
  contact_name: "", contact_email: "", contact_phone: "", interview_date: "",
};
// Same class of bug as the resume editors — a 6-field form (including
// free-text notes) with no persistence at all was silently wiped on a
// refresh (see formDraft.js).
const JOB_FORM_DRAFT_KEY = "resumeBuilder:jobTrackerDraft:v1";

// Same set/order/icons as Dashboard.js's and JobsBoard.js's own copies
// (each screen keeps its own — see those files' comments on why this
// isn't shared) — this one was missing entirely, which meant the mobile
// bottom nav bar silently didn't exist on this one screen: no way back
// to Home/Jobs/Profile except the header's own X button, every other
// screen in the app has it.
const mobileNavItems = (t) => [
  { id: "home", Icon: Home, label: t("navItem.home") },
  { id: "jobsboard", Icon: Briefcase, label: t("navItem.jobs") },
  { id: "jobtracker", Icon: ClipboardList, label: t("navItem.applications") },
  { id: "profile", Icon: CircleUser, label: t("navItem.profile") },
];

// Plain YYYY-MM-DD string -> local Date at midnight, same free-text
// convention date_applied/interview_date already use. Returns null for
// anything that doesn't parse rather than throwing — these fields are
// free text, not every entry is guaranteed well-formed.
function parseLocalDate(str) {
  if (!str) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}
function daysFromToday(date) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(date); target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

// Per-status defaults — real, concrete, stage-appropriate tasks, not a
// generic "do stuff" list. Only ever used to SEED a row that has no
// checklist yet (see ensureChecklist) — never overwrites one someone's
// already started customizing.
const DEFAULT_CHECKLIST_KEYS = {
  saved: ["checklistReviewJd", "checklistTailorResume"],
  applied: ["checklistReviewJd", "checklistTailorResume", "checklistSubmit"],
  interview: ["checklistResearch", "checklistPrepQuestions", "checklistThankYou"],
  offer: ["checklistReviewOffer", "checklistNegotiate", "checklistRespond"],
  rejected: ["checklistReflect"],
};
function defaultChecklist(t, status) {
  const keys = DEFAULT_CHECKLIST_KEYS[status] || DEFAULT_CHECKLIST_KEYS.applied;
  return keys.map((key, i) => ({ id: `${key}-${i}`, label: t(`jobTracker.${key}`), done: false }));
}

function followUpTemplates(t, app) {
  const vars = { company: app.company, role: app.role };
  return [
    { id: "checkin", label: t("jobTracker.templateCheckinLabel"), body: t("jobTracker.templateCheckinBody", vars) },
    { id: "thanks", label: t("jobTracker.templateThanksLabel"), body: t("jobTracker.templateThanksBody", vars) },
  ];
}

// Reappears once per calendar day, not once per reload — a dismiss
// should last the rest of today, not get undone by the next page visit.
const DAILY_PROMPT_KEY = "noqeev_jobtracker_daily_prompt_dismissed";

// Seeds via onEnsure the first time it mounts with no checklist yet —
// app.checklist is null until then, [] once cleared on purpose, and the
// effect's dependency on app.checklist (not just app.id) means it only
// fires that once, never re-fires once a real array exists.
function ChecklistSection({ app, t, onEnsure, onToggle, onAdd }) {
  const [draft, setDraft] = useState("");
  useEffect(() => { if (app.checklist == null) onEnsure(); }, [app.checklist]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onAdd(draft);
    setDraft("");
  };

  return (
    <div className="mt-2.5 rounded-lg border border-border bg-muted/30 p-2.5">
      <div className="grid gap-1.5">
        {(app.checklist || []).map((item) => (
          <label key={item.id} className="flex items-center gap-2 text-[12.5px] [-webkit-tap-highlight-color:transparent]">
            <input type="checkbox" checked={!!item.done} onChange={() => onToggle(item.id)} className="size-[15px] shrink-0 accent-primary" />
            <span className={item.done ? "text-muted-foreground line-through" : "text-foreground"}>{item.label}</span>
          </label>
        ))}
      </div>
      <form onSubmit={submit} className="mt-2 flex items-center gap-1.5">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("jobTracker.checklistPlaceholder")}
          className="h-8 min-w-0 flex-1 rounded-[7px] border border-border bg-background px-2.5 text-[12px] text-foreground outline-none focus:border-foreground" />
        <button type="submit" aria-label={t("jobTracker.addItem")} className="flex size-8 shrink-0 items-center justify-center rounded-[7px] border border-dashed border-border text-muted-foreground hover:border-foreground hover:text-foreground [-webkit-tap-highlight-color:transparent]">
          <Plus className="size-3.5" />
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-3">
      <span className="mb-1.5 block text-[13px] font-bold tracking-wide text-foreground">{label}</span>
      {children}
    </div>
  );
}

export default function JobTracker({ onClose, onNavigate }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { isDesktop } = useViewport();
  const unread = useUnreadNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const STATUSES = statuses(t);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Interview Week timeline: clicking a chip scrolls to + briefly
  // highlights that application's card below, instead of opening a
  // second, competing detail view for data already on screen.
  const cardRefs = useRef({});
  const [highlightId, setHighlightId] = useState(null);
  const [templateAppId, setTemplateAppId] = useState(null);
  const [expandedChecklist, setExpandedChecklist] = useState(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [feedUrl, setFeedUrl] = useState(null);
  const [dailyPromptDismissed, setDailyPromptDismissed] = useState(() => {
    try { return localStorage.getItem(DAILY_PROMPT_KEY) === new Date().toDateString(); } catch { return false; }
  });
  // Read once, synchronously, before first render — same pattern as
  // GuestMode.js's own draftAtMount.
  const jobDraftAtMount = useRef(loadFormDraft(JOB_FORM_DRAFT_KEY)).current;
  const hasJobDraftContent = jobDraftAtMount?.editingId
    || Object.entries(jobDraftAtMount?.form || {}).some(([k, v]) => k !== "status" && String(v || "").trim());
  const [formOpen, setFormOpen] = useState(() => !!hasJobDraftContent);
  const [editingId, setEditingId] = useState(() => jobDraftAtMount?.editingId ?? null);
  const [form, setForm] = useState(() => jobDraftAtMount?.form || EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  // For the optional "which resume did you send" picker — same list
  // Dashboard's "Recent resumes" already fetches, loaded independently
  // here since this screen can be opened without ever visiting Dashboard.
  const [savedResumes, setSavedResumes] = useState([]);

  // Debounced, same 300ms shape as Settings.js's own profile draft.
  const jobDraftSaveTimer = useRef(null);
  useEffect(() => {
    clearTimeout(jobDraftSaveTimer.current);
    jobDraftSaveTimer.current = setTimeout(() => {
      saveFormDraft(JOB_FORM_DRAFT_KEY, { form, editingId });
    }, 300);
    return () => clearTimeout(jobDraftSaveTimer.current);
  }, [form, editingId]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest("/api/v1/applications");
      setItems(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); apiListSaved().then(setSavedResumes); }, []);

  const resumeLabel = (id) => {
    const r = savedResumes.find((r) => r.id === id);
    return r ? `${r.name || t("jobTracker.untitled")} (${r.role || t("jobTracker.noRole")})` : null;
  };

  // Next 7 days of interview_date, soonest first — the "Interview Week"
  // timeline. Computed client-side from the same list already fetched,
  // no second endpoint.
  const upcomingInterviews = useMemo(() => {
    return items
      .map((a) => ({ a, date: parseLocalDate(a.interview_date) }))
      .filter(({ date }) => date && daysFromToday(date) >= 0 && daysFromToday(date) <= 7)
      .sort((x, y) => x.date - y.date);
  }, [items]);

  // No activity (created or status-changed) in 3+ days — only meaningful
  // once there's at least one application to go quiet on.
  const dailyPromptVisible = useMemo(() => {
    if (dailyPromptDismissed || items.length === 0) return false;
    const mostRecent = items.reduce((max, a) => {
      const t2 = new Date(a.status_changed_at || a.updated_at || a.created_at).getTime();
      return Number.isNaN(t2) ? max : Math.max(max, t2);
    }, 0);
    return mostRecent > 0 && (Date.now() - mostRecent) / 86400000 >= 3;
  }, [items, dailyPromptDismissed]);

  const dismissDailyPrompt = () => {
    setDailyPromptDismissed(true);
    try { localStorage.setItem(DAILY_PROMPT_KEY, new Date().toDateString()); } catch { /* best-effort */ }
  };

  const scrollToCard = (id) => {
    cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(id);
    setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 1800);
  };

  // ensureChecklist seeds the per-status default the FIRST time a card
  // with no checklist yet is expanded — never overwrites one that
  // already exists, including an empty array someone cleared on purpose.
  const ensureChecklist = async (a) => {
    if (a.checklist != null) return;
    const seeded = defaultChecklist(t, a.status);
    setItems((list) => list.map((x) => (x.id === a.id ? { ...x, checklist: seeded } : x)));
    try {
      await apiRequest(`/api/v1/applications/${a.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: seeded }),
      });
    } catch { /* local state already updated; next load() will reconcile */ }
  };

  const toggleChecklistItem = async (a, itemId) => {
    const next = (a.checklist || []).map((it) => (it.id === itemId ? { ...it, done: !it.done } : it));
    setItems((list) => list.map((x) => (x.id === a.id ? { ...x, checklist: next } : x)));
    try {
      await apiRequest(`/api/v1/applications/${a.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: next }),
      });
    } catch (e) {
      toast.error(e.message);
    }
  };

  const addChecklistItem = async (a, label) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const next = [...(a.checklist || []), { id: `custom-${Date.now()}`, label: trimmed, done: false }];
    setItems((list) => list.map((x) => (x.id === a.id ? { ...x, checklist: next } : x)));
    try {
      await apiRequest(`/api/v1/applications/${a.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: next }),
      });
    } catch (e) {
      toast.error(e.message);
    }
  };

  const copyTemplate = async (body) => {
    try {
      await navigator.clipboard.writeText(body);
      toast.success(t("jobTracker.copied"));
    } catch {
      toast.error(t("jobTracker.copyFailed"));
    }
  };

  // Not apiRequest — that helper always parses the response as JSON, and
  // this endpoint returns a raw .ics file. Same auth headers it would send,
  // just handled as a blob instead.
  const downloadIcs = async (a) => {
    try {
      const headers = { "X-Guest-Id": getGuestId() };
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/applications/${a.id}/calendar.ics`, { headers });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `interview-${a.company.replace(/[^a-z0-9]+/gi, "-")}.ics`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("jobTracker.calendarDownloadFailed"));
    }
  };

  const openCalendarDialog = async () => {
    setCalendarDialogOpen(true);
    if (feedUrl) return;
    try {
      const data = await apiRequest("/api/v1/applications/calendar-token");
      setFeedUrl(data.feed_url);
    } catch (e) {
      toast.error(e.message);
      setCalendarDialogOpen(false);
    }
  };

  const templateApp = items.find((a) => a.id === templateAppId) || null;

  const startAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setFormOpen(true); };
  const startEdit = (a) => {
    setEditingId(a.id);
    setForm({
      company: a.company, role: a.role, status: a.status,
      date_applied: a.date_applied || "", notes: a.notes || "", resume_id: a.resume_id || "",
      contact_name: a.contact_name || "", contact_email: a.contact_email || "",
      contact_phone: a.contact_phone || "", interview_date: a.interview_date || "",
    });
    setFormOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.company.trim() || !form.role.trim()) {
      toast.error(t("jobTracker.companyRoleRequired"));
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        await apiRequest(`/api/v1/applications/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        toast.success(t("jobTracker.updated"));
      } else {
        await apiRequest("/api/v1/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        toast.success(t("jobTracker.added"));
      }
      setFormOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      clearFormDraft(JOB_FORM_DRAFT_KEY);
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id) => {
    setConfirmRemoveId(null);
    try {
      await apiRequest(`/api/v1/applications/${id}`, { method: "DELETE" });
      tapFeedback();
      toast.success(t("jobTracker.removed"));
      setItems((l) => l.filter((x) => x.id !== id));
    } catch (e) {
      toast.error(e.message);
    }
  };

  // Same shape as JobsBoard.js's own `go` — guards against re-navigating
  // to this same screen when its own NavRail item is clicked while
  // already here.
  const go = (id, opts) => {
    if (id === "jobtracker") return;
    onNavigate?.(id, opts);
  };

  const body = (
    <>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconTile icon={ClipboardList} size="sm" />
          <div>
            <h1 className="m-0 text-xl font-bold text-foreground">{t("jobTracker.title")}</h1>
          </div>
        </div>
        {!formOpen && (
          <Btn small icon="Plus" onClick={startAdd}>{t("jobTracker.add")}</Btn>
        )}
      </div>

      {dailyPromptVisible && (
        <div className="mb-4 flex flex-wrap items-start gap-x-2.5 gap-y-1.5 rounded-xl border border-primary/25 bg-primary/10 px-3.5 py-2.5">
          <Sparkles className="mt-0.5 size-[15px] shrink-0 text-primary" />
          <span className="min-w-[140px] flex-1 text-[12.5px] font-semibold text-foreground">{t("jobTracker.dailyPromptMessage")}</span>
          <div className="ml-auto flex shrink-0 items-center gap-2.5 pl-[23px] sm:pl-0">
            <button type="button" onClick={() => go("jobsboard")} className="shrink-0 border-none bg-transparent p-0 text-[12px] font-bold whitespace-nowrap text-primary underline-offset-2 hover:underline">
              {t("jobTracker.viewJobsBoard")}
            </button>
            <button type="button" onClick={dismissDailyPrompt} aria-label={t("guestMode.dismiss")} className="shrink-0 border-none bg-transparent p-0.5 text-muted-foreground/60">
              <X className="size-[13px]" />
            </button>
          </div>
        </div>
      )}

      {upcomingInterviews.length > 0 && (
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="m-0 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] text-muted-foreground/70 uppercase">
              <Calendar className="size-3.5" /> {t("jobTracker.interviewWeek")}
            </p>
            {user && (
              <button type="button" onClick={openCalendarDialog}
                className="shrink-0 border-none bg-transparent p-0 text-[11px] font-bold whitespace-nowrap text-primary underline-offset-2 hover:underline">
                {t("jobTracker.subscribeCalendar")}
              </button>
            )}
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {upcomingInterviews.map(({ a, date }) => {
              const dd = daysFromToday(date);
              const dayLabel = dd === 0 ? t("jobTracker.todayLabel") : dd === 1 ? t("jobTracker.tomorrowLabel") : date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
              return (
                <button key={a.id} type="button" onClick={() => scrollToCard(a.id)}
                  className="flex shrink-0 flex-col items-start gap-0.5 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-left [-webkit-tap-highlight-color:transparent] hover:bg-primary/10">
                  <span className="text-[10.5px] font-bold text-primary">{dayLabel}</span>
                  <span className="max-w-[140px] truncate text-[12.5px] font-bold text-foreground">{a.company}</span>
                  <span className="max-w-[140px] truncate text-[11px] text-muted-foreground">{a.role}</span>
                  {a.resume_id && (
                    <span className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-primary/80">
                      <FileText className="size-[10px] shrink-0" /> {t("jobTracker.resumeLinked")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <AnimatePresence>
        {formOpen && (
          <motion.form
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            onSubmit={submit} className="mb-5 overflow-hidden rounded-2xl border border-border bg-card p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">{editingId ? t("jobTracker.editApplication") : t("jobTracker.newApplication")}</span>
              <button type="button" onClick={() => { setFormOpen(false); setForm(EMPTY_FORM); setEditingId(null); clearFormDraft(JOB_FORM_DRAFT_KEY); }} aria-label={t("common.cancel")}
                className="border-none bg-transparent p-0.5 text-muted-foreground/60">
                <X className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
              <Field label={t("jobTracker.company")}>
                <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Acme Corp" className="h-11" />
              </Field>
              <Field label={t("jobTracker.role")}>
                <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Software Engineer" className="h-11" />
              </Field>
              <Field label={t("jobTracker.status")}>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("jobTracker.dateApplied")}>
                <Input type="date" value={form.date_applied} onChange={(e) => setForm({ ...form, date_applied: e.target.value })} className="h-11" />
              </Field>
              <Field label={t("jobTracker.interviewDate")}>
                <Input type="date" value={form.interview_date} onChange={(e) => setForm({ ...form, interview_date: e.target.value })} className="h-11" />
              </Field>
              <Field label={t("jobTracker.contactName")}>
                <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} placeholder="Jordan Lee" className="h-11" />
              </Field>
              <Field label={t("jobTracker.contactEmail")}>
                <Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder="jordan@acme.com" className="h-11" />
              </Field>
              <Field label={t("jobTracker.contactPhone")}>
                <Input type="tel" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="(555) 555-0100" className="h-11" />
              </Field>
            </div>
            {/* Full-width, not a third item in the 2-col grid above — a
                fifth field there would sit alone in the left column with
                an empty gap beside it on desktop. */}
            <Field label={t("jobTracker.resumeUsed")}>
              <Select
                value={form.resume_id || "__none__"}
                onValueChange={(v) => setForm({ ...form, resume_id: v === "__none__" ? "" : v })}
              >
                <SelectTrigger className="h-11 w-full"><SelectValue placeholder={t("jobTracker.none")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("jobTracker.none")}</SelectItem>
                  {savedResumes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name || t("jobTracker.untitled")} ({r.role || t("jobTracker.noRole")})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("jobTracker.notes")}>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </Field>

            <Btn variant="gold" type="submit" small disabled={submitting} loading={submitting}>
              {submitting ? t("jobTracker.saving") : editingId ? t("jobTracker.saveChanges") : t("jobTracker.addApplication")}
            </Btn>
          </motion.form>
        )}
      </AnimatePresence>

      {error && (
        <div role="alert" className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[12.5px] text-destructive">
          <span>{error}</span>
          <button type="button" onClick={load} className="flex shrink-0 items-center gap-1 border-none bg-transparent p-0 text-xs font-bold underline-offset-2 hover:underline">
            <RefreshCw className="size-3" /> {t("jobTracker.tryAgain")}
          </button>
        </div>
      )}

      <div className="grid gap-2.5">
        {loading && [0, 1, 2].map((i) => (
          <Card key={i} className="p-3.5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </Card>
        ))}

        {!loading && items.length === 0 && !error && (
          <div className="grid justify-items-center gap-2.5 px-5 py-10 text-center">
            <div className="flex size-11 items-center justify-center rounded-full border border-border bg-card">
              <ClipboardList className="size-[18px] text-muted-foreground" />
            </div>
            <p className="m-0 text-sm font-bold text-foreground">{t("jobTracker.noApplicationsYet")}</p>
            <Btn small variant="ghost" icon="Plus" onClick={startAdd}>{t("jobTracker.add")}</Btn>
          </div>
        )}

        {!loading && items.map((a) => {
          const meta = statusMeta(a.status, STATUSES);
          const resumeUsed = a.resume_id ? resumeLabel(a.resume_id) : null;
          const interviewDate = parseLocalDate(a.interview_date);
          const dd = interviewDate ? daysFromToday(interviewDate) : null;
          const prepCountdown = dd === 0 ? "today" : dd === 1 ? "tomorrow" : null;
          const checklistOpen = expandedChecklist === a.id;
          return (
            // Plain div wrapper carries the ref — Card itself is a plain
            // function component (not forwardRef-wrapped), so React 18
            // would silently drop a ref passed straight to it.
            <div key={a.id} ref={(el) => { cardRefs.current[a.id] = el; }}>
            <Card className={`p-3.5 transition-shadow ${highlightId === a.id ? "ring-2 ring-primary" : ""}`}>
              {prepCountdown && (
                <div className="mb-2.5 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-2">
                  <Clock className="size-[13px] shrink-0 text-primary" />
                  <span className="text-[12px] font-bold text-primary">
                    {prepCountdown === "today" ? t("jobTracker.interviewToday") : t("jobTracker.interviewTomorrow")}
                  </span>
                </div>
              )}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="m-0 truncate text-[14px] font-bold text-foreground">{a.role}</p>
                  <p className="m-0 text-[12.5px] text-muted-foreground">{a.company}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant="outline" className={`rounded-full ${meta.className}`}>{meta.label}</Badge>
                  {a.interview_date && (
                    <span className="flex items-center gap-1 text-[10.5px] font-bold text-primary">
                      <Clock className="size-3" /> {t("jobTracker.interviewDate")}: {a.interview_date}
                    </span>
                  )}
                  {a.interview_date && (
                    <button type="button" onClick={() => downloadIcs(a)}
                      className="flex items-center gap-1 border-none bg-transparent p-0 text-[10.5px] font-bold whitespace-nowrap text-muted-foreground underline-offset-2 hover:text-primary hover:underline">
                      <Download className="size-3" /> {t("jobTracker.addToCalendar")}
                    </button>
                  )}
                </div>
              </div>
              {(a.date_applied || a.notes || resumeUsed || a.contact_name || a.contact_email || a.contact_phone || a.source_url) && (
                <div className="mt-2 border-t border-border pt-2">
                  {a.date_applied && <p className="m-0 font-mono text-[10.5px] text-muted-foreground/70">{t("jobTracker.appliedOn", { date: a.date_applied })}</p>}
                  {a.source_url && (
                    <a href={a.source_url} target="_blank" rel="noopener noreferrer"
                      className="m-0 mt-1 flex items-center gap-1 text-[11.5px] text-primary hover:underline">
                      <ExternalLink className="size-3 shrink-0" /> <span className="min-w-0 truncate">{t("jobTracker.viewPosting")}</span>
                    </a>
                  )}
                  {(a.contact_name || a.contact_email || a.contact_phone) && (
                    <p className="m-0 mt-1 text-[11.5px] text-muted-foreground">
                      {[a.contact_name, a.contact_email, a.contact_phone].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {resumeUsed && (
                    <p className="m-0 mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                      <FileText className="size-3 shrink-0" /> <span className="min-w-0 truncate">{resumeUsed}</span>
                    </p>
                  )}
                  {a.notes && <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-foreground">{a.notes}</p>}
                </div>
              )}

              {a.is_stale && (
                <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-2">
                  <AlertTriangle className="size-[13px] shrink-0 text-warning" />
                  <span className="flex-1 text-[11.5px] font-semibold text-foreground">{t("jobTracker.staleAlert")}</span>
                  <button type="button" onClick={() => setTemplateAppId(a.id)}
                    className="shrink-0 border-none bg-transparent p-0 text-[11.5px] font-bold whitespace-nowrap text-primary underline-offset-2 hover:underline">
                    {t("jobTracker.sendFollowUp")}
                  </button>
                </div>
              )}

              {/* The toggle now sits directly against the content it
                  controls, not off in the Edit/Remove action row below —
                  it used to sit BETWEEN those two, which put a frequent,
                  constructive action right next to a destructive one (and
                  the toggle rendered after the section it opened, which
                  reads backwards — a disclosure control belongs right
                  above what it discloses). */}
              <button type="button" onClick={() => { setExpandedChecklist(checklistOpen ? null : a.id); if (!checklistOpen) ensureChecklist(a); }}
                className="mt-2.5 flex w-full items-center gap-1.5 border-none bg-transparent p-0 text-left [-webkit-tap-highlight-color:transparent]">
                <ClipboardList className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="text-[13px] font-bold text-foreground">{t("jobTracker.checklist")}</span>
                {a.checklist?.length > 0 && (
                  <span className="font-mono text-[11px] text-muted-foreground">{a.checklist.filter((it) => it.done).length}/{a.checklist.length}</span>
                )}
                <ChevronRight className={`ml-auto size-4 shrink-0 text-muted-foreground/50 transition-transform ${checklistOpen ? "rotate-90" : ""}`} />
              </button>
              {checklistOpen && (
                <ChecklistSection
                  app={a} t={t}
                  onEnsure={() => ensureChecklist(a)}
                  onToggle={(itemId) => toggleChecklistItem(a, itemId)}
                  onAdd={(label) => addChecklistItem(a, label)}
                />
              )}

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Btn small variant="ghost" icon="Pencil" onClick={() => startEdit(a)}>{t("jobTracker.edit")}</Btn>
                <Btn small variant="danger" icon="Trash2" onClick={() => setConfirmRemoveId(a.id)}>{t("jobTracker.remove")}</Btn>
              </div>
            </Card>
            </div>
          );
        })}
      </div>

      <Dialog open={!!templateApp} onOpenChange={(v) => !v && setTemplateAppId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("jobTracker.followUpTemplates")}</DialogTitle>
          </DialogHeader>
          {templateApp && (
            <div className="grid gap-3">
              {followUpTemplates(t, templateApp).map((tpl) => (
                <div key={tpl.id} className="rounded-xl border border-border p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[12.5px] font-bold text-foreground">{tpl.label}</span>
                    <button type="button" onClick={() => copyTemplate(tpl.body)}
                      className="flex items-center gap-1 border-none bg-transparent p-0 text-[11.5px] font-bold text-primary [-webkit-tap-highlight-color:transparent]">
                      <Copy className="size-3" /> {t("jobTracker.copy")}
                    </button>
                  </div>
                  <p className="m-0 text-[12.5px] leading-relaxed whitespace-pre-wrap text-muted-foreground">{tpl.body}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={calendarDialogOpen} onOpenChange={(v) => !v && setCalendarDialogOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("jobTracker.subscribeCalendar")}</DialogTitle>
          </DialogHeader>
          <div className="grid min-w-0 gap-3">
            <p className="m-0 text-[12.5px] leading-relaxed text-muted-foreground">{t("jobTracker.subscribeCalendarHint")}</p>
            {feedUrl ? (
              <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-muted/40 p-2.5">
                <code className="min-w-0 flex-1 truncate text-[11.5px] text-foreground">{feedUrl}</code>
                <button type="button" onClick={() => copyTemplate(feedUrl)}
                  className="flex shrink-0 items-center gap-1 border-none bg-transparent p-0 text-[11.5px] font-bold whitespace-nowrap text-primary [-webkit-tap-highlight-color:transparent]">
                  <Copy className="size-3" /> {t("jobTracker.copyLink")}
                </button>
              </div>
            ) : (
              <Skeleton className="h-10 w-full rounded-xl" />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmRemoveId} onOpenChange={(o) => !o && setConfirmRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("jobTracker.removeConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const a = items.find((x) => x.id === confirmRemoveId);
                return a ? t("jobTracker.removeConfirmDescription", { role: a.role, company: a.company }) : "";
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => remove(confirmRemoveId)}>{t("jobTracker.remove")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (isDesktop) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex bg-background font-sans text-foreground">
        <NavRail active="jobtracker" user={user} onNavigate={go} onNotifClick={() => setNotifOpen(true)} />
        <main className="relative min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-8 py-8">
            {body}
          </div>
        </main>
        <NotificationsDialog open={notifOpen} onClose={() => setNotifOpen(false)} items={unread.items} onOpenItem={() => { setNotifOpen(false); go("apply"); }} />
      </motion.div>
    );
  }

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
          <button onClick={onClose} aria-label={t("common.close")} className="flex size-10 items-center justify-center rounded-full border border-border bg-muted text-foreground">
            <X className="size-[17px]" />
          </button>
        )}
      </header>

      {/* Same gap as Dashboard's own content column had — max-w-2xl was
          sized for mobile and never got a desktop-specific widen, leaving
          real dead space next to a list-of-cards screen that actually
          benefits from the extra room. */}
      <div
        className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-5 py-6 sm:px-8 lg:max-w-4xl"
        style={{ paddingBottom: "calc(110px + env(safe-area-inset-bottom, 0px))" }}
      >
        {body}
      </div>

      <MobileFloatingNav
        items={mobileNavItems(t)}
        active="jobtracker"
        onChange={(id) => go(id)}
        onCreate={() => go("resume", { quickBuild: true })}
      />
    </motion.div>
  );
}
