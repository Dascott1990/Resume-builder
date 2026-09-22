"use client";
/**
 * AdminDashboard.js — the actual admin panel, once app/admin/page.js has
 * already confirmed the caller is a real admin. Eight tabs: a live
 * overview, full manage-and-moderate tables for every model in the app,
 * a Vendors registry of the third-party services this app depends on,
 * and System (live backend/DB/scheduler health + a route+table map
 * introspected from the running app itself, not a hand-kept doc).
 *
 * Artisan listings are the one tab that talks to /api/v1/artisans instead
 * of /api/v1/admin/* — that resource already has full CRUD with no auth of
 * its own (see backend/app/api/admin.py's docstring), so there's nothing
 * admin-specific to add server-side; this tab just reuses it.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Loader2, RefreshCw, Trash2, ShieldCheck, ShieldOff, LogOut, KeyRound,
  Users, FileText, Briefcase, Star, Wrench, LayoutGrid, Pencil, Mail, Plus, X, Sparkles,
  Newspaper, ExternalLink, Server, Database, CheckCircle2, XCircle, ChevronDown, Table2, Activity,
} from "lucide-react";
import { apiRequest } from "@/components/premium/shared/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import Logo from "@/components/premium/Logo";

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// ── Shared table shell — every tab below is "fetch a list, render rows,
// offer a delete (and sometimes other) action per row." One component
// covers the loading/empty/error states so each tab only defines its
// columns and row actions. ──────────────────────────────────────────────
// A wide table just gets cut off on a phone screen — no visible scroll
// affordance, columns silently missing off the right edge. Below `sm`,
// this renders each row as a stacked card (every column as a label:value
// line, the actions column pulled out into its own row at the bottom)
// instead; the real `<table>` only shows at `sm` and up, where there's
// actually room for it.
function AdminTable({ columns, rows, loading, emptyLabel }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (!rows.length) {
    return <p className="m-0 py-16 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  const actionCol = columns.find((c) => c.key === "actions");
  const fieldCols = columns.filter((c) => c.key !== "actions");

  return (
    <>
      <div className="space-y-2.5 sm:hidden">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-border bg-card p-3.5">
            <div className="space-y-2">
              {fieldCols.map((c) => (
                <div key={c.key} className="flex items-start justify-between gap-3 text-[13px]">
                  <span className="shrink-0 pt-px font-medium text-muted-foreground">{c.label}</span>
                  <span className="min-w-0 text-right text-foreground break-words">{c.render ? c.render(row) : (row[c.key] ?? "—")}</span>
                </div>
              ))}
            </div>
            {actionCol && (
              <div className="mt-2.5 flex justify-end border-t border-border/60 pt-2.5">
                {actionCol.render(row)}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-border sm:block">
        <table className="w-full min-w-[640px] border-collapse text-left text-[13.5px]">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {columns.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-3.5 py-2.5 font-semibold text-muted-foreground">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                {columns.map((c) => (
                  <td key={c.key} className="px-3.5 py-2.5 align-middle text-foreground">
                    {c.render ? c.render(row) : (row[c.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Icon className="size-4.5" />
      </div>
      <div>
        <p className="m-0 text-[20px] font-bold leading-none text-foreground">{value}</p>
        <p className="m-0 mt-1 text-[12px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function TabHeader({ title, onRefresh, refreshing, extra }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
      <h2 className="m-0 text-base font-bold text-foreground">{title}</h2>
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

// ── Overview ────────────────────────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest("/api/v1/admin/stats");
      setStats(data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <TabHeader title="Overview" onRefresh={load} refreshing={loading} />
      {loading && !stats ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
      ) : stats ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* No sm:grid-cols-3 — with exactly 8 cards, 3 columns leaves an
              orphaned card alone in the last row on tablet-width screens.
              2 and 4 both divide 8 evenly. */}
          <StatCard icon={Users} label="Total users" value={stats.users} />
          <StatCard icon={ShieldCheck} label="Admins" value={stats.admins} />
          <StatCard icon={Users} label="New users (7d)" value={stats.new_users_7d} />
          <StatCard icon={FileText} label="Saved resumes" value={stats.resumes} />
          <StatCard icon={Wrench} label="Artisan listings" value={stats.artisans} />
          <StatCard icon={Star} label="Reviews" value={stats.reviews} />
          <StatCard icon={Briefcase} label="Applications tracked" value={stats.applications} />
          <StatCard icon={LayoutGrid} label="Pending JD captures" value={stats.pending_job_captures} />
        </div>
      ) : null}
    </div>
  );
}

function EditEmailDialog({ user, open, onOpenChange, onSaved }) {
  const [email, setEmail] = useState(user?.email || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setEmail(user?.email || ""); }, [user]);

  const save = async () => {
    setSaving(true);
    try {
      await apiRequest(`/api/v1/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      toast.success("Email updated.");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit email</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="edit-email">Email address</Label>
          <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Users ───────────────────────────────────────────────────────────────
function UsersTab({ selfId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  const load = useCallback(async (search) => {
    setLoading(true);
    try {
      const qs = search ? `?q=${encodeURIComponent(search)}` : "";
      const data = await apiRequest(`/api/v1/admin/users${qs}`);
      setUsers(data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(""); }, [load]);

  const toggleAdmin = async (user) => {
    if (user.id === selfId && user.is_admin) {
      toast.error("You can't remove your own admin access.");
      return;
    }
    setBusyId(user.id);
    try {
      await apiRequest(`/api/v1/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_admin: !user.is_admin }),
      });
      toast.success(user.is_admin ? "Admin access removed." : "Promoted to admin.");
      load(q);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const toggleVerified = async (user) => {
    setBusyId(user.id);
    try {
      await apiRequest(`/api/v1/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_verified: !user.email_verified }),
      });
      toast.success("Updated.");
      load(q);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (user) => {
    if (user.id === selfId) {
      toast.error("You can't delete your own account.");
      return;
    }
    if (!window.confirm(`Delete ${user.email}? This also deletes their saved resumes and applications.`)) return;
    setBusyId(user.id);
    try {
      await apiRequest(`/api/v1/admin/users/${user.id}`, { method: "DELETE" });
      toast.success("User deleted.");
      load(q);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  // Goes through the exact same email-token flow a locked-out user would
  // use themselves (see backend/app/api/admin.py's file docblock) — the
  // admin panel triggers it, it never sees or sets anyone's password.
  const sendPasswordReset = async (user) => {
    setBusyId(user.id);
    try {
      await apiRequest("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      toast.success(`Password reset link sent to ${user.email}.`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <TabHeader
        title="Users"
        onRefresh={() => load(q)}
        refreshing={loading}
        extra={
          <form onSubmit={(e) => { e.preventDefault(); load(q); }} className="flex items-center gap-1.5">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email…" className="h-8 w-28 text-[13px] sm:w-40" />
          </form>
        }
      />
      {editingUser && (
        <EditEmailDialog
          user={editingUser}
          open={!!editingUser}
          onOpenChange={(o) => !o && setEditingUser(null)}
          onSaved={() => load(q)}
        />
      )}
      <AdminTable
        loading={loading}
        emptyLabel="No users found."
        rows={users}
        columns={[
          {
            key: "email", label: "Email",
            render: (u) => (
              <button onClick={() => setEditingUser(u)} className="flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-left text-foreground hover:underline">
                {u.email}
                <Pencil className="size-3 text-muted-foreground" />
              </button>
            ),
          },
          {
            key: "email_verified", label: "Verified",
            render: (u) => (
              <button onClick={() => toggleVerified(u)} disabled={busyId === u.id} className="cursor-pointer border-none bg-transparent p-0">
                <Badge variant={u.email_verified ? "default" : "outline"}>{u.email_verified ? "Verified" : "Unverified"}</Badge>
              </button>
            ),
          },
          {
            key: "is_admin", label: "Role",
            render: (u) => <Badge variant={u.is_admin ? "default" : "outline"}>{u.is_admin ? "Admin" : "User"}</Badge>,
          },
          { key: "created_at", label: "Joined", render: (u) => fmtDate(u.created_at) },
          {
            key: "actions", label: "",
            render: (u) => (
              <div className="flex items-center justify-end gap-1.5">
                <Button size="icon-sm" variant="ghost" title="Send password reset email" disabled={busyId === u.id} onClick={() => sendPasswordReset(u)}>
                  <Mail className="size-3.5" />
                </Button>
                <Button size="icon-sm" variant="ghost" title={u.is_admin ? "Remove admin" : "Make admin"} disabled={busyId === u.id} onClick={() => toggleAdmin(u)}>
                  {u.is_admin ? <ShieldOff className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
                </Button>
                <Button size="icon-sm" variant="ghost" title="Delete user" disabled={busyId === u.id} onClick={() => remove(u)}>
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

// ── Generic "list + delete" tab factory — Resumes, Applications, Reviews
// all follow the exact same shape (fetch, table, per-row delete), so one
// function builds all three instead of copy-pasting the same component
// three times. ──────────────────────────────────────────────────────────
function useAdminList(endpoint) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest(endpoint);
      setRows(data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => { load(); }, [load]);

  const remove = async (id, confirmMsg) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusyId(id);
    try {
      await apiRequest(`${endpoint}/${id}`, { method: "DELETE" });
      toast.success("Deleted.");
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return { rows, loading, busyId, load, remove };
}

// ── The resume editor — the one place in the admin panel that edits the
// actual AI-generated document, not just the Media row's metadata around
// it. Built around the fixed shape every resume in this app actually has
// (contact + summary/skills/experience/education sections — see the
// PROMPT_TEMPLATE constants in backend/app/api/resume.py); a section this
// resume doesn't have is simply skipped rather than fabricated. ──────────
function getSection(resume, id) {
  return resume.sections?.find((s) => s.id === id);
}
function withSection(resume, id, patch) {
  return {
    ...resume,
    sections: resume.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  };
}
const linesToArray = (text) => text.split("\n").map((l) => l.trim()).filter(Boolean);

function JobEditor({ job, onChange, onRemove }) {
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="grid flex-1 grid-cols-2 gap-2">
          <Input placeholder="Role" value={job.role || ""} onChange={(e) => onChange({ ...job, role: e.target.value })} />
          <Input placeholder="Company" value={job.company || ""} onChange={(e) => onChange({ ...job, company: e.target.value })} />
          <Input placeholder="Period" value={job.period || ""} onChange={(e) => onChange({ ...job, period: e.target.value })} />
          <Input placeholder="Location" value={job.location || ""} onChange={(e) => onChange({ ...job, location: e.target.value })} />
        </div>
        <Button type="button" size="icon-sm" variant="ghost" onClick={onRemove}><X className="size-3.5" /></Button>
      </div>
      <Textarea
        placeholder="One bullet per line"
        rows={3}
        value={(job.bullets || []).join("\n")}
        onChange={(e) => onChange({ ...job, bullets: linesToArray(e.target.value) })}
      />
    </div>
  );
}

function DegreeEditor({ degree, onChange, onRemove }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border p-3">
      <div className="grid flex-1 grid-cols-2 gap-2">
        <Input placeholder="Degree" value={degree.degree || ""} onChange={(e) => onChange({ ...degree, degree: e.target.value })} />
        <Input placeholder="School" value={degree.school || ""} onChange={(e) => onChange({ ...degree, school: e.target.value })} />
        <Input placeholder="Location" value={degree.location || ""} onChange={(e) => onChange({ ...degree, location: e.target.value })} />
        <Input placeholder="Period" value={degree.period || ""} onChange={(e) => onChange({ ...degree, period: e.target.value })} />
      </div>
      <Button type="button" size="icon-sm" variant="ghost" onClick={onRemove}><X className="size-3.5" /></Button>
    </div>
  );
}

function ResumeEditorDialog({ mediaId, open, onOpenChange, onSaved }) {
  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [polishing, setPolishing] = useState(false);

  useEffect(() => {
    if (!open || !mediaId) return;
    setLoading(true);
    apiRequest(`/api/v1/admin/resumes/${mediaId}`)
      .then((data) => setResume(data.resume))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [open, mediaId]);

  // AI-rewrites the summary paragraph — same Claude-then-Groq fallback
  // /api/v1/resume already uses (see backend/app/api/admin.py's
  // polish-summary route), just scoped to this one field instead of
  // regenerating the whole resume.
  const polishSummary = async () => {
    setPolishing(true);
    try {
      const data = await apiRequest("/api/v1/admin/resumes/polish-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: resume.contact.title, summary: getSection(resume, "summary")?.content }),
      });
      setResume((r) => withSection(r, "summary", { content: data.summary }));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setPolishing(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiRequest(`/api/v1/admin/resumes/${mediaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume }),
      });
      toast.success("Resume updated.");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const summary = resume && getSection(resume, "summary");
  const skills = resume && getSection(resume, "skills");
  const experience = resume && getSection(resume, "experience");
  const education = resume && getSection(resume, "education");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Edit resume</DialogTitle></DialogHeader>

        {loading || !resume ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-5">
            <div>
              <h3 className="m-0 mb-2 text-[13px] font-semibold text-muted-foreground">Contact</h3>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Name" value={resume.contact.name || ""} onChange={(e) => setResume({ ...resume, contact: { ...resume.contact, name: e.target.value } })} />
                <Input placeholder="Title" value={resume.contact.title || ""} onChange={(e) => setResume({ ...resume, contact: { ...resume.contact, title: e.target.value } })} />
                <Input placeholder="Email" value={resume.contact.email || ""} onChange={(e) => setResume({ ...resume, contact: { ...resume.contact, email: e.target.value } })} />
                <Input placeholder="Phone" value={resume.contact.phone || ""} onChange={(e) => setResume({ ...resume, contact: { ...resume.contact, phone: e.target.value } })} />
                <Input placeholder="Location" className="col-span-2" value={resume.contact.location || ""} onChange={(e) => setResume({ ...resume, contact: { ...resume.contact, location: e.target.value } })} />
              </div>
            </div>

            {summary && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="m-0 text-[13px] font-semibold text-muted-foreground">Summary</h3>
                  <Button type="button" size="sm" variant="outline" disabled={polishing} onClick={polishSummary}>
                    {polishing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                    AI polish
                  </Button>
                </div>
                <Textarea rows={3} value={summary.content || ""} onChange={(e) => setResume(withSection(resume, "summary", { content: e.target.value }))} />
              </div>
            )}

            {skills && (
              <div>
                <h3 className="m-0 mb-2 text-[13px] font-semibold text-muted-foreground">Skills (one per line)</h3>
                <Textarea rows={4} value={(skills.items || []).join("\n")} onChange={(e) => setResume(withSection(resume, "skills", { items: linesToArray(e.target.value) }))} />
              </div>
            )}

            {experience && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="m-0 text-[13px] font-semibold text-muted-foreground">Experience</h3>
                  <Button
                    type="button" size="sm" variant="outline"
                    onClick={() => setResume(withSection(resume, "experience", { jobs: [...(experience.jobs || []), { role: "", company: "", period: "", location: "", bullets: [] }] }))}
                  >
                    <Plus className="size-3.5" /> Add job
                  </Button>
                </div>
                <div className="space-y-2">
                  {(experience.jobs || []).map((job, i) => (
                    <JobEditor
                      key={i}
                      job={job}
                      onChange={(next) => {
                        const jobs = [...experience.jobs];
                        jobs[i] = next;
                        setResume(withSection(resume, "experience", { jobs }));
                      }}
                      onRemove={() => setResume(withSection(resume, "experience", { jobs: experience.jobs.filter((_, j) => j !== i) }))}
                    />
                  ))}
                </div>
              </div>
            )}

            {education && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="m-0 text-[13px] font-semibold text-muted-foreground">Education</h3>
                  <Button
                    type="button" size="sm" variant="outline"
                    onClick={() => setResume(withSection(resume, "education", { degrees: [...(education.degrees || []), { degree: "", school: "", location: "", period: "" }] }))}
                  >
                    <Plus className="size-3.5" /> Add degree
                  </Button>
                </div>
                <div className="space-y-2">
                  {(education.degrees || []).map((degree, i) => (
                    <DegreeEditor
                      key={i}
                      degree={degree}
                      onChange={(next) => {
                        const degrees = [...education.degrees];
                        degrees[i] = next;
                        setResume(withSection(resume, "education", { degrees }));
                      }}
                      onRemove={() => setResume(withSection(resume, "education", { degrees: education.degrees.filter((_, j) => j !== i) }))}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || loading}>{saving ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResumesTab() {
  const { rows, loading, busyId, load, remove } = useAdminList("/api/v1/admin/resumes");
  const [editingId, setEditingId] = useState(null);
  return (
    <div>
      <TabHeader title="Saved resumes" onRefresh={load} refreshing={loading} />
      {editingId && (
        <ResumeEditorDialog mediaId={editingId} open={!!editingId} onOpenChange={(o) => !o && setEditingId(null)} onSaved={load} />
      )}
      <AdminTable
        loading={loading}
        emptyLabel="No saved resumes."
        rows={rows}
        columns={[
          { key: "filename", label: "Filename" },
          { key: "owner", label: "Owner" },
          { key: "media_type", label: "Type" },
          { key: "created_at", label: "Saved", render: (r) => fmtDate(r.created_at) },
          {
            key: "actions", label: "",
            render: (r) => (
              <div className="flex justify-end gap-1.5">
                <Button size="icon-sm" variant="ghost" onClick={() => setEditingId(r.id)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button size="icon-sm" variant="ghost" disabled={busyId === r.id} onClick={() => remove(r.id, `Delete "${r.filename}"?`)}>
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

const APPLICATION_STATUSES = ["applied", "interview", "offer", "rejected"];

function EditApplicationDialog({ application, open, onOpenChange, onSaved }) {
  const [form, setForm] = useState(application);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(application); }, [application]);
  if (!form) return null;

  const save = async () => {
    setSaving(true);
    try {
      await apiRequest(`/api/v1/admin/applications/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: form.company, role: form.role, status: form.status,
          date_applied: form.date_applied, notes: form.notes,
        }),
      });
      toast.success("Application updated.");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit application</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {APPLICATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date applied</Label>
              <Input type="date" value={form.date_applied || ""} onChange={(e) => setForm({ ...form, date_applied: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={3} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApplicationsTab() {
  const { rows, loading, busyId, load, remove } = useAdminList("/api/v1/admin/applications");
  const [editing, setEditing] = useState(null);
  return (
    <div>
      <TabHeader title="Job applications" onRefresh={load} refreshing={loading} />
      {editing && (
        <EditApplicationDialog
          application={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          onSaved={load}
        />
      )}
      <AdminTable
        loading={loading}
        emptyLabel="No applications tracked yet."
        rows={rows}
        columns={[
          { key: "company", label: "Company" },
          { key: "role", label: "Role" },
          { key: "status", label: "Status", render: (a) => <Badge variant="outline">{a.status}</Badge> },
          { key: "owner", label: "Owner" },
          { key: "created_at", label: "Added", render: (a) => fmtDate(a.created_at) },
          {
            key: "actions", label: "",
            render: (a) => (
              <div className="flex justify-end gap-1.5">
                <Button size="icon-sm" variant="ghost" onClick={() => setEditing(a)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button size="icon-sm" variant="ghost" disabled={busyId === a.id} onClick={() => remove(a.id, `Delete this application to ${a.company}?`)}>
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

function ReviewsTab() {
  const { rows, loading, busyId, load, remove } = useAdminList("/api/v1/admin/reviews");
  return (
    <div>
      <TabHeader title="Artisan reviews" onRefresh={load} refreshing={loading} />
      <AdminTable
        loading={loading}
        emptyLabel="No reviews yet."
        rows={rows}
        columns={[
          { key: "artisan_name", label: "Artisan" },
          { key: "stars", label: "Stars", render: (r) => "★".repeat(r.stars) },
          { key: "comment", label: "Comment", render: (r) => r.comment || "—" },
          { key: "created_at", label: "Posted", render: (r) => fmtDate(r.created_at) },
          {
            key: "actions", label: "",
            render: (r) => (
              <div className="flex justify-end">
                <Button size="icon-sm" variant="ghost" disabled={busyId === r.id} onClick={() => remove(r.id, "Delete this review?")}>
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

function EditArtisanDialog({ artisan, open, onOpenChange, onSaved }) {
  const [form, setForm] = useState(artisan);
  const [saving, setSaving] = useState(false);
  const [polishing, setPolishing] = useState(false);

  useEffect(() => { setForm(artisan); }, [artisan]);
  if (!form) return null;

  // The exact same AI polish the public "List yourself" form already uses
  // (see backend/app/api/artisans.py's /polish) — rough notes in, a
  // professional bio out. No admin-specific endpoint needed, this one was
  // already open (the whole point of self-listing with no account).
  const polishBio = async () => {
    setPolishing(true);
    try {
      const data = await apiRequest("/api/v1/artisans/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trade: form.trade, years_experience: form.years_experience, notes: form.bio }),
      });
      setForm((f) => ({ ...f, bio: data.bio }));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setPolishing(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      // Admins bypass the per-listing edit_token check server-side (see
      // _authorize_edit in backend/app/api/artisans.py) — no token needed
      // here, the admin JWT already attached by apiRequest is enough.
      await apiRequest(`/api/v1/artisans/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, trade: form.trade, city: form.city, phone: form.phone,
          email: form.email, bio: form.bio, years_experience: form.years_experience,
        }),
      });
      toast.success("Listing updated.");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit listing</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Trade</Label><Input value={form.trade || ""} onChange={(e) => setForm({ ...form, trade: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>City</Label><Input value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Years experience</Label><Input type="number" value={form.years_experience ?? ""} onChange={(e) => setForm({ ...form, years_experience: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Bio</Label>
              <Button type="button" size="sm" variant="outline" disabled={polishing} onClick={polishBio}>
                {polishing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                AI polish
              </Button>
            </div>
            <Textarea rows={3} value={form.bio || ""} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Artisans — talks to the existing public /api/v1/artisans CRUD, not a
// new admin-scoped endpoint (see file docblock). ───────────────────────
function ArtisansTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest("/api/v1/artisans?limit=100");
      setRows(data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (a) => {
    if (!window.confirm(`Remove ${a.name}'s listing?`)) return;
    setBusyId(a.id);
    try {
      await apiRequest(`/api/v1/artisans/${a.id}`, { method: "DELETE" });
      toast.success("Listing removed.");
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <TabHeader title="Artisan directory" onRefresh={load} refreshing={loading} />
      {editing && (
        <EditArtisanDialog artisan={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} onSaved={load} />
      )}
      <AdminTable
        loading={loading}
        emptyLabel="No artisan listings."
        rows={rows}
        columns={[
          { key: "name", label: "Name" },
          { key: "trade", label: "Trade" },
          { key: "city", label: "City" },
          {
            key: "rating_avg", label: "Rating",
            render: (a) => (a.rating_count ? `${a.rating_avg?.toFixed(1)} (${a.rating_count})` : "—"),
          },
          {
            key: "actions", label: "",
            render: (a) => (
              <div className="flex justify-end gap-1.5">
                <Button size="icon-sm" variant="ghost" onClick={() => setEditing(a)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button size="icon-sm" variant="ghost" disabled={busyId === a.id} onClick={() => remove(a)}>
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

// ── Vendors — the third-party services registry (backend/app/api/
// admin.py's /vendors routes). "Detected" rows came from real env-var
// presence at boot (see backend/app/utils/vendors.py's CATALOG) — the
// badge is the only thing distinguishing them from a row an admin typed
// in by hand; both edit and delete the same way after that. ────────────
const VENDOR_CATEGORIES = ["hosting", "database", "ai", "payments", "email", "push", "monitoring", "other"];
const CATEGORY_LABELS = {
  hosting: "Hosting", database: "Database", ai: "AI", payments: "Payments",
  email: "Email", push: "Push", monitoring: "Monitoring", other: "Other",
};

function FreeBadge({ isFree }) {
  if (isFree === true) return <Badge variant="secondary">Free</Badge>;
  if (isFree === false) return <Badge variant="outline">Paid</Badge>;
  return <Badge variant="ghost">Unknown</Badge>;
}

function VendorNewsDialog({ vendor, open, onOpenChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !vendor) return;
    setLoading(true);
    apiRequest(`/api/v1/admin/vendors/${vendor.id}/news`)
      .then(setItems)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [open, vendor]);

  if (!vendor) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{vendor.name}</DialogTitle></DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <p className="m-0 py-8 text-center text-sm text-muted-foreground">No updates yet.</p>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {items.map((i) => (
              <a key={i.id} href={i.url} target="_blank" rel="noreferrer"
                className="block rounded-lg border border-border p-2.5 text-[13px] font-medium text-foreground no-underline hover:border-primary/40">
                {i.title}
                <span className="mt-1 block text-[11px] font-normal text-muted-foreground">{fmtDate(i.published_at || i.fetched_at)}</span>
              </a>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function VendorFormDialog({ vendor, open, onOpenChange, onSaved }) {
  const isNew = !vendor?.id;
  const [form, setForm] = useState(vendor || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(vendor || {}); }, [vendor]);

  const save = async () => {
    if (!form.name?.trim()) { toast.error("Name is required."); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), category: form.category || "other",
        plan: form.plan || "", is_free: form.is_free ?? null,
        monthly_cost: form.monthly_cost === "" || form.monthly_cost == null ? null : Number(form.monthly_cost),
        console_url: form.console_url || "", status_feed_url: form.status_feed_url || "",
        notes: form.notes || "",
      };
      if (isNew) {
        await apiRequest("/api/v1/admin/vendors", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        toast.success("Vendor added.");
      } else {
        await apiRequest(`/api/v1/admin/vendors/${vendor.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        toast.success("Vendor updated.");
      }
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isNew ? "Add vendor" : "Edit vendor"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category || "other"} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VENDOR_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Plan</Label><Input value={form.plan || ""} onChange={(e) => setForm({ ...form, plan: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Free?</Label>
              <Select
                value={form.is_free === true ? "free" : form.is_free === false ? "paid" : "unknown"}
                onValueChange={(v) => setForm({ ...form, is_free: v === "free" ? true : v === "paid" ? false : null })}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Monthly cost (USD)</Label><Input type="number" value={form.monthly_cost ?? ""} onChange={(e) => setForm({ ...form, monthly_cost: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Console URL</Label><Input value={form.console_url || ""} onChange={(e) => setForm({ ...form, console_url: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Status feed URL (RSS/Atom, optional)</Label>
            <Input value={form.status_feed_url || ""} onChange={(e) => setForm({ ...form, status_feed_url: e.target.value })} />
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const JOB_LABELS = {
  task_reminders: "Task reminders", world_feed: "World feed", vendor_news: "Vendor news",
  seo_snapshot: "SEO snapshot",
};

function timeAgo(iso) {
  if (!iso) return "never";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatusPill({ ok, okLabel, badLabel }) {
  return (
    <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold ${ok ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive"}`}>
      {ok ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
      {ok ? okLabel : badLabel}
    </span>
  );
}

// Collapsed by default — a flat dump of 148 routes or 25 tables isn't
// "clean," a summary count with an expand-to-see affordance is.
function CollapsibleGroup({ title, count, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button" onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] font-semibold"
      >
        <span>{title}</span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {count} <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && <div className="border-t border-border p-3">{children}</div>}
    </div>
  );
}

function SystemTab() {
  const [health, setHealth] = useState(null);
  const [structure, setStructure] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiRequest("/api/v1/admin/health"),
      apiRequest("/api/v1/admin/structure"),
    ]).then(([h, s]) => { setHealth(h); setStructure(s); })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  return (
    <div>
      <TabHeader title="System" onRefresh={load} refreshing={loading} />

      {health && (
        <div className="mb-6 grid gap-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
            <Activity className="size-3.5" /> Health
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusPill ok={health.backend === "ok"} okLabel="Backend up" badLabel="Backend down" />
            <StatusPill ok={health.database === "ok"} okLabel="Database up" badLabel="Database down" />
            <Button variant="outline" size="sm" asChild>
              <a href={health.links.render} target="_blank" rel="noreferrer"><Server className="size-3.5" /> Render <ExternalLink className="size-3" /></a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={health.links.sentry} target="_blank" rel="noreferrer"><Database className="size-3.5" /> Sentry <ExternalLink className="size-3" /></a>
            </Button>
          </div>

          <div className="grid gap-1.5">
            <p className="m-0 text-[11px] font-semibold text-muted-foreground">Background jobs</p>
            {health.jobs.length === 0 ? (
              <p className="m-0 text-[12.5px] text-muted-foreground">No jobs have run yet.</p>
            ) : (
              health.jobs.map((j) => (
                <div key={j.job_name} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
                  <div className="min-w-0">
                    <p className="m-0 truncate text-[12.5px] font-bold text-foreground">{JOB_LABELS[j.job_name] || j.job_name}</p>
                    <p className="m-0 text-[11px] text-muted-foreground">
                      Last ran {timeAgo(j.last_run_at)}{j.last_duration_ms != null ? ` · ${j.last_duration_ms}ms` : ""}
                      {j.last_status === "error" && j.last_error ? ` · ${j.last_error.slice(0, 80)}` : ""}
                    </p>
                  </div>
                  <StatusPill ok={j.last_status === "ok"} okLabel="OK" badLabel="Error" />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {structure && (
        <div className="grid gap-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
            <LayoutGrid className="size-3.5" /> Structure
            <span className="font-normal normal-case">— live from the running app, not a hand-kept doc</span>
          </div>

          <div className="grid gap-1.5">
            <p className="m-0 text-[11px] font-semibold text-muted-foreground">
              API blueprints ({structure.blueprints.reduce((n, b) => n + b.routes.length, 0)} routes)
            </p>
            {structure.blueprints.map((b) => (
              <CollapsibleGroup key={b.name} title={b.name} count={`${b.routes.length} routes`}>
                <div className="grid gap-1">
                  {b.routes.map((r) => (
                    <div key={r.path + r.methods.join()} className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="w-14 shrink-0 font-bold text-primary-text">{r.methods.join("/")}</span>
                      <span className="truncate text-muted-foreground">{r.path}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleGroup>
            ))}
          </div>

          <div className="grid gap-1.5">
            <p className="m-0 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <Table2 className="size-3.5" /> Database tables ({structure.tables.length})
            </p>
            {structure.tables.map((t) => (
              <CollapsibleGroup key={t.name} title={t.name} count={`${t.columns.length} cols`}>
                <div className="grid gap-1">
                  {t.columns.map((c) => (
                    <div key={c.name} className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="text-foreground">{c.name}</span>
                      <span className="text-muted-foreground">{c.type}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleGroup>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VendorsTab() {
  const { rows, loading, busyId, load, remove } = useAdminList("/api/v1/admin/vendors");
  const [editing, setEditing] = useState(null); // {} for "new", a row for "edit"
  const [newsFor, setNewsFor] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const resync = async () => {
    setSyncing(true);
    try {
      const data = await apiRequest("/api/v1/admin/vendors/sync", { method: "POST" });
      toast.success(data.added ? `Found ${data.added} newly-configured service(s).` : "Nothing new detected.");
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <TabHeader
        title="Vendors"
        onRefresh={load}
        refreshing={loading}
        extra={
          <>
            <Button variant="outline" size="sm" onClick={resync} disabled={syncing} title="Re-scan for newly-configured services">
              <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Re-scan</span>
            </Button>
            <Button size="sm" onClick={() => setEditing({})}>
              <Plus className="size-3.5" /> Add vendor
            </Button>
          </>
        }
      />
      {editing && (
        <VendorFormDialog vendor={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} onSaved={load} />
      )}
      <VendorNewsDialog vendor={newsFor} open={!!newsFor} onOpenChange={(o) => !o && setNewsFor(null)} />
      <AdminTable
        loading={loading}
        emptyLabel="No vendors yet."
        rows={rows}
        columns={[
          {
            key: "name", label: "Service",
            render: (v) => (
              <div className="flex items-center gap-1.5">
                <span className="font-semibold">{v.name}</span>
                {v.auto_detected && <Badge variant="secondary" className="text-[10px]">Detected</Badge>}
              </div>
            ),
          },
          { key: "category", label: "Category", render: (v) => CATEGORY_LABELS[v.category] || v.category },
          { key: "plan", label: "Plan", render: (v) => v.plan || "—" },
          { key: "is_free", label: "Free?", render: (v) => <FreeBadge isFree={v.is_free} /> },
          { key: "monthly_cost", label: "Cost/mo", render: (v) => (v.monthly_cost != null ? `$${v.monthly_cost}` : "—") },
          {
            key: "actions", label: "",
            render: (v) => (
              <div className="flex justify-end gap-1.5">
                {v.status_feed_url && (
                  <Button size="icon-sm" variant="ghost" onClick={() => setNewsFor(v)} title="Recent updates">
                    <Newspaper className="size-3.5" />
                  </Button>
                )}
                {v.console_url && (
                  <Button size="icon-sm" variant="ghost" asChild title="Open console">
                    <a href={v.console_url} target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" /></a>
                  </Button>
                )}
                <Button size="icon-sm" variant="ghost" onClick={() => setEditing(v)} title="Edit">
                  <Pencil className="size-3.5" />
                </Button>
                <Button size="icon-sm" variant="ghost" disabled={busyId === v.id} onClick={() => remove(v.id, `Remove ${v.name}?`)} title="Delete">
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

// Reuses the exact same forgot-password flow the public site already has
// (rate-limited, single-use, time-limited token — see backend/app/api/
// auth.py) rather than a separate "change password" endpoint. Surfaced
// here so someone who just signed in with a temporary/generated password
// (see how ADMIN_BOOTSTRAP_EMAIL accounts get created) doesn't have to
// leave the admin panel and go hunt for the public login page to reset it.
function ChangePasswordButton({ email }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      await apiRequest("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
      toast.success(`Password reset link sent to ${email}.`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return <span className="text-[12px] whitespace-nowrap text-muted-foreground">Sent</span>;
  }
  return (
    <Button variant="outline" size="sm" onClick={send} disabled={sending} title="Change password">
      {sending ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />}
      <span className="hidden sm:inline">Change password</span>
    </Button>
  );
}

export function AdminDashboard({ adminUser, onSignOut }) {
  return (
    // Fixed shell, not a scrolling page — matches every other screen in
    // the app (see GuestMode.js's own `absolute inset-0 ... overflow-hidden`
    // outer div): the header and tab bar stay put, only the content below
    // them scrolls. Without this the whole page — header included —
    // scrolled as one long document, which reads as everything drifting
    // around rather than a stable app shell.
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-3 sm:gap-3 sm:px-8 sm:py-3.5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Logo size={22} />
          <span className="hidden text-[13px] font-semibold text-muted-foreground sm:inline">Admin</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <span className="hidden text-[13px] text-muted-foreground sm:inline">{adminUser?.email}</span>
          {/* /brand has zero functional connection to admin (no shared
              auth, no shared backend — see api/brand.py's module
              docstring) — this is a plain navigation link, nothing more.
              Without it, /brand's whole toolkit (Create, Story, etc.) had
              no discoverable path from anywhere in the app at all, only
              reachable by typing the URL from memory or a bookmark. */}
          <Button variant="outline" size="sm" asChild title="Post composer, story assembly, and other brand tools">
            <Link href="/brand">
              <Sparkles className="size-3.5" />
              <span className="hidden sm:inline">Brand kit</span>
            </Link>
          </Button>
          <ChangePasswordButton email={adminUser?.email} />
          <Button variant="outline" size="sm" onClick={onSignOut} title="Sign out">
            <LogOut className="size-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <Tabs defaultValue="overview" className="flex flex-1 flex-col overflow-hidden">
        <div className="shrink-0 overflow-x-auto border-b border-border px-3 sm:px-8">
          <TabsList className="my-2 w-max">
            <TabsTrigger value="overview" className="shrink-0">Overview</TabsTrigger>
            <TabsTrigger value="users" className="shrink-0">Users</TabsTrigger>
            <TabsTrigger value="resumes" className="shrink-0">Resumes</TabsTrigger>
            <TabsTrigger value="applications" className="shrink-0">Applications</TabsTrigger>
            <TabsTrigger value="reviews" className="shrink-0">Reviews</TabsTrigger>
            <TabsTrigger value="artisans" className="shrink-0">Artisans</TabsTrigger>
            <TabsTrigger value="vendors" className="shrink-0">Vendors</TabsTrigger>
            <TabsTrigger value="system" className="shrink-0">System</TabsTrigger>
          </TabsList>
        </div>

        <main className="flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
          <div className="mx-auto max-w-6xl px-3 py-5 sm:px-8 sm:py-6">
            <TabsContent value="overview"><OverviewTab /></TabsContent>
            <TabsContent value="users"><UsersTab selfId={adminUser?.id} /></TabsContent>
            <TabsContent value="resumes"><ResumesTab /></TabsContent>
            <TabsContent value="applications"><ApplicationsTab /></TabsContent>
            <TabsContent value="reviews"><ReviewsTab /></TabsContent>
            <TabsContent value="artisans"><ArtisansTab /></TabsContent>
            <TabsContent value="vendors"><VendorsTab /></TabsContent>
            <TabsContent value="system"><SystemTab /></TabsContent>
          </div>
        </main>
      </Tabs>
    </div>
  );
}
