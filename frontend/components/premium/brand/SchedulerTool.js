"use client";
/**
 * SchedulerTool.js — the branding workspace's post scheduler: register
 * social handles once, schedule content against them with an AI-
 * suggested time, mark each handle posted by hand. Not an auto-poster —
 * this app has no API integration with any social platform, just a
 * nudge (email + this badge) that clears once every registered handle
 * for a post is manually marked posted.
 *
 * The email side of "due" is driven by an external scheduled ping
 * (backend/app/api/cron.py's /api/v1/cron/due-reminders, called by
 * .github/workflows/scheduler-reminders.yml) — this component only
 * polls the badge/list, it never triggers anything itself.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Plus, Trash2, Check, Loader2, Clock } from "lucide-react";
import { Btn } from "@/components/premium/guest/components/primitives";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { workspaceFetch } from "./workspaceApi";

const PLATFORM_OPTIONS = ["instagram", "tiktok", "x", "facebook", "linkedin", "youtube", "pinterest", "other"];
const PLATFORM_LABELS = {
  instagram: "Instagram", tiktok: "TikTok", x: "X", facebook: "Facebook",
  linkedin: "LinkedIn", youtube: "YouTube", pinterest: "Pinterest", other: "Other",
};
const CONTENT_TYPE_LABELS = { post: "Post", story: "Story" };

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
// datetime-local input wants "YYYY-MM-DDTHH:MM" local time, the backend
// wants "YYYY-MM-DDTHH:MM:SS" UTC — both conversions live here so every
// call site just passes/reads the input's own value.
function toLocalInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToUtcIso(local) {
  // new Date("YYYY-MM-DDTHH:MM") parses as LOCAL time; toISOString() then
  // gives the equivalent UTC instant, sliced to the backend's own
  // "YYYY-MM-DDTHH:MM:SS" shape (no trailing Z — the backend appends
  // that itself on the way back out, see models.py's _iso_utc).
  return new Date(local).toISOString().slice(0, 19);
}

function HandleForm({ token, onAdded }) {
  const [platform, setPlatform] = useState("instagram");
  const [handleName, setHandleName] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!handleName.trim()) { toast.error("Handle name is required."); return; }
    setSaving(true);
    try {
      const data = await workspaceFetch(token, "/api/v1/workspace/handles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, handle_name: handleName.trim(), label: label.trim() || undefined }),
      });
      toast.success("Handle registered.");
      setHandleName(""); setLabel("");
      onAdded(data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Select value={platform} onValueChange={setPlatform}>
        <SelectTrigger className="h-9 w-[130px] rounded-[8px] text-[12.5px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {PLATFORM_OPTIONS.map((p) => <SelectItem key={p} value={p}>{PLATFORM_LABELS[p]}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input value={handleName} onChange={(e) => setHandleName(e.target.value)} placeholder="@handle" className="h-9 w-[130px] rounded-[8px] text-[12.5px]" />
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" className="h-9 w-[150px] rounded-[8px] text-[12.5px]" />
      <Btn small variant="gold" onClick={save} disabled={saving} loading={saving}><Plus className="size-3.5" /> Add</Btn>
    </div>
  );
}

function NewPostForm({ token, handles, workspace, onCreated }) {
  const [open, setOpen] = useState(false);
  const [contentType, setContentType] = useState("post");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [suggestedReasoning, setSuggestedReasoning] = useState("");
  const [notifyEmail, setNotifyEmail] = useState("");
  const [handleIds, setHandleIds] = useState([]);
  const [suggesting, setSuggesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleHandle = (id) => setHandleIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const suggestTime = async () => {
    setSuggesting(true);
    try {
      const data = await workspaceFetch(token, "/api/v1/workspace/scheduled-posts/suggest-time", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_type: contentType, title, caption }),
      });
      setScheduledLocal(toLocalInputValue(data.scheduled_at));
      setSuggestedReasoning(data.reasoning || "");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSuggesting(false);
    }
  };

  const create = async () => {
    if (!title.trim()) { toast.error("Title is required."); return; }
    if (!scheduledLocal) { toast.error("Pick a date/time, or use Suggest."); return; }
    if (!handleIds.length) { toast.error("Pick at least one handle."); return; }
    setSaving(true);
    try {
      await workspaceFetch(token, "/api/v1/workspace/scheduled-posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_type: contentType, title: title.trim(), caption: caption.trim() || undefined,
          scheduled_at: localInputToUtcIso(scheduledLocal), handle_ids: handleIds,
          notify_email: notifyEmail.trim() || undefined,
        }),
      });
      toast.success("Scheduled.");
      setTitle(""); setCaption(""); setScheduledLocal(""); setSuggestedReasoning(""); setHandleIds([]); setOpen(false);
      onCreated();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Btn variant="ghost" onClick={() => setOpen(true)} disabled={!handles.length}>
        <Plus className="size-4" /> {handles.length ? "Schedule a post" : "Add a handle first"}
      </Btn>
    );
  }

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex gap-2">
        {Object.entries(CONTENT_TYPE_LABELS).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setContentType(id)} aria-pressed={contentType === id}
            className={`rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${contentType === id ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
            {label}
          </button>
        ))}
      </div>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="h-9 rounded-[8px] text-[12.5px]" />
      <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption (optional)" rows={2} className="resize-none rounded-[8px] text-[12.5px]" />

      <div>
        <p className="m-0 mb-1.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">Post to</p>
        <div className="flex flex-wrap gap-1.5">
          {handles.map((h) => (
            <button key={h.id} type="button" onClick={() => toggleHandle(h.id)} aria-pressed={handleIds.includes(h.id)}
              className={`rounded-full border px-3 py-1.5 text-[11.5px] font-semibold ${handleIds.includes(h.id) ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground"}`}>
              {PLATFORM_LABELS[h.platform]} — {h.handle_name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-[11px] font-bold text-foreground">When</label>
          <Input type="datetime-local" value={scheduledLocal} onChange={(e) => setScheduledLocal(e.target.value)} className="h-9 rounded-[8px] text-[12.5px]" />
        </div>
        <Btn small variant="ghost" onClick={suggestTime} disabled={suggesting} loading={suggesting}>
          <Sparkles className="size-3.5" /> Suggest time
        </Btn>
      </div>
      {suggestedReasoning && <p className="m-0 text-[11px] text-muted-foreground">{suggestedReasoning}</p>}

      <Input value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)} placeholder={`Reminder email (default: ${workspace?.notify_email || "none set"})`} className="h-9 rounded-[8px] text-[12.5px]" />

      <div className="flex gap-2">
        <Btn variant="gold" className="flex-1" onClick={create} disabled={saving} loading={saving}>Schedule</Btn>
        <Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn>
      </div>
    </div>
  );
}

function PostRow({ post, token, onChanged }) {
  const [busyHandle, setBusyHandle] = useState(null);

  const toggle = async (handleId, posted) => {
    setBusyHandle(handleId);
    try {
      await workspaceFetch(token, `/api/v1/workspace/scheduled-posts/${post.id}/handles/${handleId}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ posted }),
      });
      onChanged();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyHandle(null);
    }
  };

  const overdue = post.status === "scheduled" && new Date(post.scheduled_at) <= new Date();

  return (
    <div className={`rounded-xl border p-3 ${post.status === "completed" ? "border-border bg-card/40" : overdue ? "border-destructive/30 bg-destructive/[0.04]" : "border-border bg-card"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 truncate text-[13px] font-bold text-foreground">{post.title}</p>
          <p className="m-0 text-[11px] text-muted-foreground">
            {CONTENT_TYPE_LABELS[post.content_type]} · {fmtDateTime(post.scheduled_at)}
            {post.status === "completed" && " · Done"}
          </p>
        </div>
        {overdue && <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-[10.5px] font-bold text-destructive">Due</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {post.handles.map((h) => (
          <button key={h.id} type="button" onClick={() => toggle(h.brand_handle_id, !h.posted)} disabled={busyHandle === h.brand_handle_id}
            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${h.posted ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : "border-border bg-transparent text-muted-foreground"}`}>
            {busyHandle === h.brand_handle_id ? <Loader2 className="size-3 animate-spin" /> : h.posted ? <Check className="size-3" /> : null}
            {PLATFORM_LABELS[h.platform] || h.platform} — {h.handle_name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SchedulerTool({ token, workspace }) {
  const [handles, setHandles] = useState([]);
  const [posts, setPosts] = useState([]);
  const [dueCount, setDueCount] = useState(0);
  const [nextUp, setNextUp] = useState(null);
  const [loading, setLoading] = useState(true);

  const reloadAll = async () => {
    try {
      const [h, p, dc, nu] = await Promise.all([
        workspaceFetch(token, "/api/v1/workspace/handles"),
        workspaceFetch(token, "/api/v1/workspace/scheduled-posts"),
        workspaceFetch(token, "/api/v1/workspace/scheduled-posts/due-count"),
        workspaceFetch(token, "/api/v1/workspace/scheduled-posts/next-up"),
      ]);
      setHandles(h); setPosts(p); setDueCount(dc.count); setNextUp(nu);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadAll();
    const interval = setInterval(reloadAll, 5 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const removeHandle = async (id) => {
    try {
      await workspaceFetch(token, `/api/v1/workspace/handles/${id}`, { method: "DELETE" });
      reloadAll();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (loading) {
    return <p className="m-0 flex items-center gap-1.5 text-[12.5px] text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Loading…</p>;
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        {dueCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-1 text-[11px] font-bold text-destructive">
            <Clock className="size-3" /> {dueCount} due
          </span>
        )}
        {nextUp && (
          <span className="text-[11.5px] text-muted-foreground">
            Next up: <span className="font-semibold text-foreground">{nextUp.title}</span> · {fmtDateTime(nextUp.scheduled_at)}
          </span>
        )}
        {!nextUp && dueCount === 0 && <span className="text-[11.5px] text-muted-foreground">Nothing scheduled.</span>}
      </div>

      <div>
        <p className="m-0 mb-2 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">Handles</p>
        {handles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {handles.map((h) => (
              <span key={h.id} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11.5px]">
                {PLATFORM_LABELS[h.platform]} — {h.handle_name}
                <button type="button" onClick={() => removeHandle(h.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
              </span>
            ))}
          </div>
        )}
        <HandleForm token={token} onAdded={reloadAll} />
      </div>

      <div>
        <p className="m-0 mb-2 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 uppercase">Scheduled</p>
        <div className="grid gap-2">
          {posts.map((p) => <PostRow key={p.id} post={p} token={token} onChanged={reloadAll} />)}
        </div>
        <div className="mt-2">
          <NewPostForm token={token} handles={handles} workspace={workspace} onCreated={reloadAll} />
        </div>
      </div>
    </div>
  );
}
