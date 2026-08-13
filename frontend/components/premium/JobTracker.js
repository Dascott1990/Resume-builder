"use client";
/**
 * JobTracker.js — track where you've applied, status, and notes. Scoped
 * anonymously by guest_id (or by account, once signed in) exactly like
 * Saved resumes — same backend pattern, see backend/app/api/applications.py.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { X, RefreshCw, ClipboardList, FileText, Clock } from "lucide-react";
import { apiRequest } from "./shared/api";
import { apiListSaved } from "./guest/api";
import { loadFormDraft, saveFormDraft, clearFormDraft } from "@/lib/formDraft";
import { Btn } from "./guest/components/primitives";
import { IconTile } from "./shared/IconTile";
import { tapFeedback } from "@/lib/haptics";
import Logo from "./Logo";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const STATUSES = [
  { id: "applied", label: "Applied", className: "border-border text-muted-foreground" },
  { id: "interview", label: "Interview", className: "border-primary/30 bg-primary/10 text-primary" },
  { id: "offer", label: "Offer", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" },
  { id: "rejected", label: "Rejected", className: "border-destructive/30 bg-destructive/10 text-destructive" },
];
const statusMeta = (id) => STATUSES.find((s) => s.id === id) || STATUSES[0];

const EMPTY_FORM = { company: "", role: "", status: "applied", date_applied: "", notes: "", resume_id: "" };
// Same class of bug as the resume editors and the artisan listing form —
// a 6-field form (including free-text notes) with no persistence at all
// was silently wiped on a refresh (see myResumeDraft.js/formDraft.js).
const JOB_FORM_DRAFT_KEY = "resumeBuilder:jobTrackerDraft:v1";

function Field({ label, children }) {
  return (
    <div className="mb-3">
      <span className="mb-1.5 block text-[13px] font-bold tracking-wide text-foreground">{label}</span>
      {children}
    </div>
  );
}

export default function JobTracker({ onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Read once, synchronously, before first render — same pattern as
  // GuestMode.js's own draftAtMount / myResumeDraft.js / Artisans.js.
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

  // Debounced, same 300ms shape as myResumeDraft.js/Artisans.js.
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
    return r ? `${r.name || "Untitled"} — ${r.role || "—"}` : null;
  };

  const startAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setFormOpen(true); };
  const startEdit = (a) => {
    setEditingId(a.id);
    setForm({
      company: a.company, role: a.role, status: a.status,
      date_applied: a.date_applied || "", notes: a.notes || "", resume_id: a.resume_id || "",
    });
    setFormOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.company.trim() || !form.role.trim()) {
      toast.error("Company and role are required.");
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
        toast.success("Updated.");
      } else {
        await apiRequest("/api/v1/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        toast.success("Application added.");
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
    try {
      await apiRequest(`/api/v1/applications/${id}`, { method: "DELETE" });
      tapFeedback();
      toast.success("Removed.");
      setItems((l) => l.filter((x) => x.id !== id));
    } catch (e) {
      toast.error(e.message);
    }
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

      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-5 py-6 sm:px-8">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconTile icon={ClipboardList} size="sm" />
            <div>
              <h1 className="m-0 text-xl font-bold text-foreground">Job Tracker</h1>
              <p className="m-0 mt-0.5 text-[13px] text-muted-foreground">Where you've applied, and where things stand.</p>
            </div>
          </div>
          {!formOpen && (
            <Btn small icon="Plus" onClick={startAdd}>Add</Btn>
          )}
        </div>

        <AnimatePresence>
          {formOpen && (
            <motion.form
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              onSubmit={submit} className="mb-5 overflow-hidden rounded-2xl border border-border bg-card p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">{editingId ? "Edit application" : "New application"}</span>
                <button type="button" onClick={() => { setFormOpen(false); setForm(EMPTY_FORM); setEditingId(null); clearFormDraft(JOB_FORM_DRAFT_KEY); }} aria-label="Cancel"
                  className="border-none bg-transparent p-0.5 text-muted-foreground/60">
                  <X className="size-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
                <Field label="Company">
                  <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Acme Corp" className="h-11" />
                </Field>
                <Field label="Role">
                  <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Software Engineer" className="h-11" />
                </Field>
                <Field label="Status">
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Date applied">
                  <Input type="date" value={form.date_applied} onChange={(e) => setForm({ ...form, date_applied: e.target.value })} className="h-11" />
                </Field>
              </div>
              {/* Full-width, not a third item in the 2-col grid above — a
                  fifth field there would sit alone in the left column with
                  an empty gap beside it on desktop. */}
              <Field label="Resume used">
                <Select
                  value={form.resume_id || "__none__"}
                  onValueChange={(v) => setForm({ ...form, resume_id: v === "__none__" ? "" : v })}
                >
                  <SelectTrigger className="h-11 w-full"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {savedResumes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name || "Untitled"} — {r.role || "—"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Notes">
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Referral, interview prep, follow-up date…" rows={2} />
              </Field>

              <Btn variant="gold" type="submit" small disabled={submitting} loading={submitting}>
                {submitting ? "Saving…" : editingId ? "Save changes" : "Add application"}
              </Btn>
            </motion.form>
          )}
        </AnimatePresence>

        {error && (
          <div role="alert" className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[12.5px] text-destructive">
            <span>{error}</span>
            <button type="button" onClick={load} className="flex shrink-0 items-center gap-1 border-none bg-transparent p-0 text-xs font-bold underline-offset-2 hover:underline">
              <RefreshCw className="size-3" /> Try again
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
              <p className="m-0 text-sm font-bold text-foreground">No applications yet</p>
              <p className="m-0 max-w-[260px] text-[12.5px] leading-relaxed text-muted-foreground">
                Add the jobs you've applied to and track them here.
              </p>
              <Btn small variant="ghost" icon="Plus" onClick={startAdd}>Add your first</Btn>
            </div>
          )}

          {!loading && items.map((a) => {
            const meta = statusMeta(a.status);
            const resumeUsed = a.resume_id ? resumeLabel(a.resume_id) : null;
            return (
              <Card key={a.id} className="p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="m-0 truncate text-[14px] font-bold text-foreground">{a.role}</p>
                    <p className="m-0 text-[12.5px] text-muted-foreground">{a.company}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant="outline" className={`rounded-full ${meta.className}`}>{meta.label}</Badge>
                    {a.needs_followup && (
                      <span className="flex items-center gap-1 text-[10.5px] font-bold text-primary">
                        <Clock className="size-3" /> Follow up?
                      </span>
                    )}
                  </div>
                </div>
                {(a.date_applied || a.notes || resumeUsed) && (
                  <div className="mt-2 border-t border-border pt-2">
                    {a.date_applied && <p className="m-0 font-mono text-[10.5px] text-muted-foreground/70">Applied {a.date_applied}</p>}
                    {resumeUsed && (
                      <p className="m-0 mt-1 flex items-center gap-1 text-[11.5px] text-muted-foreground">
                        <FileText className="size-3 shrink-0" /> <span className="truncate">{resumeUsed}</span>
                      </p>
                    )}
                    {a.notes && <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-foreground">{a.notes}</p>}
                  </div>
                )}
                <div className="mt-2.5 flex gap-1.5">
                  <Btn small variant="ghost" icon="Pencil" onClick={() => startEdit(a)}>Edit</Btn>
                  <Btn small variant="danger" icon="Trash2" onClick={() => remove(a.id)}>Remove</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
