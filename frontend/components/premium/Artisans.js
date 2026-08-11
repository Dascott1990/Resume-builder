"use client";
/**
 * Artisans.js — app/components/premium/Artisans.js
 *
 * "Find an Artisan": a small local directory of tradespeople. Two jobs:
 *   1. Someone hiring finds the right trade fast, trusts what they see,
 *      and calls in one tap.
 *   2. Someone listing themselves is live in under a minute.
 *
 * What changed from the first pass: search + trade filters actually use
 * the backend's ?trade= query param (it existed on the API the whole time —
 * the UI just never called it), cards carry real signal (initials, years
 * badge, tap-to-call) instead of a flat text list, and loading/empty are
 * real states instead of a blank screen.
 */
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Search, MapPin, Phone, User, UserPlus, ChevronLeft, X, Star, Hammer, RefreshCw, ClipboardList, Wrench } from "lucide-react";
import { apiRequest } from "./shared/api";
import DeleteListingDialog from "./shared/DeleteListingDialog";
import { tintFor, initialsOf, formatPhone, truncateBio } from "./shared/artisanDisplay";
import { Btn } from "./guest/components/primitives";
import { IconTile } from "./shared/IconTile";
import ArtisanProfile from "./ArtisanProfile";
import { tapFeedback } from "@/lib/haptics";
import { useViewport } from "@/lib/useViewport";
import { BottomNav } from "./shared/BottomNav";
import { TopTabNav } from "./shared/TopTabNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TRADES_WITH_ALL } from "./shared/trades";
import RequestJobModal from "./artisan/RequestJobModal";
import MyRequestsPane from "./artisan/MyRequestsPane";

const PAGE_SIZE = 20;

const NAV_ITEMS = [
  { id: "browse", Icon: Search, label: "Browse" },
  { id: "requests", Icon: ClipboardList, label: "My requests" },
  { id: "form", Icon: UserPlus, label: "List yourself" },
];

const MY_IDS_KEY = "noviq_my_artisan_ids";
const MY_TOKENS_KEY = "noviq_my_artisan_tokens";
const RATED_IDS_KEY = "noviq_rated_artisan_ids";

const TRADES = TRADES_WITH_ALL;

const SORTS = [
  { id: "newest", label: "Newest" },
  { id: "experience", label: "Most experienced" },
];

const emptyForm = { name: "", trade: "", city: "", phone: "", email: "", years_experience: "", bio: "" };

const getMyIds = () => {
  try { return JSON.parse(localStorage.getItem(MY_IDS_KEY) || "[]"); }
  catch { return []; }
};
const addMyId = (id) => {
  const ids = getMyIds();
  if (!ids.includes(id)) localStorage.setItem(MY_IDS_KEY, JSON.stringify([...ids, id]));
};

// The backend hands back edit_token exactly once, in the create response
// (see backend/app/api/artisans.py) — it's the only thing that proves
// "I'm the one who listed this" for a listing created with no account.
// Without saving it, every PATCH/DELETE this browser later sends for its
// own listing 403s forever; there'd be no way to prove ownership again.
const getMyTokens = () => {
  try { return JSON.parse(localStorage.getItem(MY_TOKENS_KEY) || "{}"); }
  catch { return {}; }
};
const saveMyToken = (id, token) => {
  if (!token) return;
  localStorage.setItem(MY_TOKENS_KEY, JSON.stringify({ ...getMyTokens(), [id]: token }));
};
export const getMyArtisanToken = (id) => getMyTokens()[id];

// A map (not an array like MY_IDS_KEY) because it needs to carry the star
// value too, so a returning visitor sees "you rated this 4 stars" instead
// of just having the widget silently disappear.
export const getRatedIds = () => {
  try { return JSON.parse(localStorage.getItem(RATED_IDS_KEY) || "{}"); }
  catch { return {}; }
};
export const addRatedId = (id, stars) => {
  const map = getRatedIds();
  localStorage.setItem(RATED_IDS_KEY, JSON.stringify({ ...map, [id]: { stars } }));
};

function SearchBar({ value, onChange }) {
  return (
    <div className="relative min-w-0 shrink-0">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by name, trade, or city"
        className="h-10 rounded-lg pl-9"
      />
    </div>
  );
}

function TradeChips({ active, onSelect }) {
  return (
    <ToggleGroup
      type="single"
      value={active}
      onValueChange={(v) => v && onSelect(v)}
      className="w-full justify-start gap-1.5 overflow-x-auto [scrollbar-width:none]"
    >
      {TRADES.map((t) => (
        <ToggleGroupItem
          key={t}
          value={t}
          className="shrink-0 rounded-full border border-border bg-transparent px-3 text-[12.5px] font-semibold text-muted-foreground data-[state=on]:border-primary/30 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
        >
          {t}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function ArtisanCard({ a, isMine, onOpen, onEdit, onDelete }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const tint = tintFor(a.name || "?");
  return (
    <motion.div whileTap={{ scale: 0.97 }}>
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpen(a)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(a); } }}
      className="cursor-pointer gap-0 overflow-hidden py-0"
    >
      <div className="flex items-start justify-between gap-2 p-3.5 pb-3">
        <div className="flex min-w-0 gap-3">
          <div className={`flex size-[42px] shrink-0 items-center justify-center rounded-full border font-mono text-sm font-bold ${tint}`}>
            {initialsOf(a.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14.5px] font-bold text-foreground">{a.name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-primary">{a.trade}</span>
              {a.years_experience != null && (
                <Badge variant="outline" className="rounded border-dashed font-mono text-[10.5px] text-muted-foreground">
                  {a.years_experience}+ YRS
                </Badge>
              )}
              {a.rating_count > 0 && (
                <Badge variant="outline" className="gap-1 rounded border-dashed font-mono text-[10.5px] text-muted-foreground">
                  <Star className="fill-primary text-primary" />
                  {a.rating_avg.toFixed(1)} · {a.rating_count}
                </Badge>
              )}
            </div>
            {a.city && (
              <div className="mt-1 flex items-center gap-1">
                <MapPin className="size-[11px] text-muted-foreground" />
                <span className="text-[12.5px] text-muted-foreground">{a.city}</span>
              </div>
            )}
          </div>
        </div>
        {isMine && (
          <div className="flex shrink-0 flex-col gap-1.5">
            <Btn small icon="Pencil" aria-label="Edit listing"
              onClick={(e) => { e.stopPropagation(); onEdit(a); }}>
              <span className="sr-only">Edit</span>
            </Btn>
            <DeleteListingDialog
              name={a.name}
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              onConfirm={() => onDelete(a.id)}
              trigger={
                <Btn small variant="danger" icon="Trash2" aria-label="Delete listing"
                  onClick={(e) => e.stopPropagation()}>
                  <span className="sr-only">Delete</span>
                </Btn>
              }
            />
          </div>
        )}
      </div>
      {a.bio && (
        <p className="mx-3.5 mb-3.5 text-[13px] leading-relaxed text-foreground">
          {truncateBio(a.bio)}
        </p>
      )}
      <a
        href={`tel:${a.phone}`}
        onClick={(e) => e.stopPropagation()}
        className="mx-3.5 mb-3.5 flex items-center justify-center gap-1.5 rounded-md border border-primary/25 bg-primary/10 py-2.5 text-[12.5px] font-bold text-primary no-underline"
      >
        <Phone className="size-3.5" />
        {formatPhone(a.phone)}
      </a>
    </Card>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <Card className="p-3.5">
      <div className="flex gap-3">
        <Skeleton className="size-[42px] shrink-0 rounded-full" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-[13px] w-[55%]" />
          <Skeleton className="h-[11px] w-[35%]" />
        </div>
      </div>
    </Card>
  );
}

function EmptyState({ trade, onListYourself }) {
  return (
    <div className="grid justify-items-center gap-2.5 px-5 py-10 text-center">
      <div className="flex size-11 items-center justify-center rounded-full border border-border bg-card">
        <User className="size-[18px] text-muted-foreground" />
      </div>
      <p className="m-0 text-sm font-bold text-foreground">
        {trade && trade !== "All" ? `No ${trade}s listed yet` : "No artisans yet"}
      </p>
      <p className="m-0 max-w-[240px] text-[12.5px] leading-relaxed text-muted-foreground">
        Be the first — listings go live in under a minute.
      </p>
      <Btn small variant="ghost" icon="Plus" onClick={onListYourself}>
        List yourself
      </Btn>
    </div>
  );
}

// Matches guest/components/primitives.js's Field exactly (label scale,
// tracking, required-asterisk, hint text, 52px rounded-[10px] inputs) —
// only real difference is a `type` prop, needed here for tel/email/number
// keyboards that the guest Field doesn't need to support.
function Field({ label, required, hint, value, onChange, placeholder, type = "text", multiline, rows = 3 }) {
  return (
    <div className="mb-3.5">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[13.5px] font-bold tracking-wide text-foreground">
          {label}{required && <span className="text-primary"> *</span>}
        </span>
        {hint && <span className="text-xs text-muted-foreground/60">{hint}</span>}
      </div>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="min-h-[52px] resize-y rounded-[10px] text-base"
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={type}
          className="h-[52px] rounded-[10px] text-base"
        />
      )}
    </div>
  );
}

export default function Artisans({ onClose, onOpenArtisanDashboard }) {
  const { isDesktop } = useViewport();
  const [tab, setTab] = useState("browse");
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestModalTrade, setRequestModalTrade] = useState(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [myIds, setMyIds] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [viewingArtisan, setViewingArtisan] = useState(null); // an artisan object, or null
  const [ratedIds, setRatedIds] = useState({});

  const [query, setQuery] = useState("");
  const [trade, setTrade] = useState("All");
  const [sort, setSort] = useState("newest");

  useEffect(() => { setMyIds(getMyIds()); setRatedIds(getRatedIds()); }, []);

  const load = async (activeTrade) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (activeTrade && activeTrade !== "All") qs.set("trade", activeTrade);
      const data = await apiRequest(`/api/v1/artisans?${qs}`);
      setList(data);
      // apiRequest unwraps straight to the data array (no envelope-level
      // pagination metadata reaches here — see the backend route's own
      // comment) — a full page back means there's probably another one.
      setHasMore(data.length === PAGE_SIZE);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(trade); }, [trade]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(list.length) });
      if (trade && trade !== "All") qs.set("trade", trade);
      const data = await apiRequest(`/api/v1/artisans?${qs}`);
      setList((l) => [...l, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const visibleList = useMemo(() => {
    let items = list;
    const q = query.trim().toLowerCase();
    if (q) {
      items = items.filter((a) =>
        a.name?.toLowerCase().includes(q) ||
        a.trade?.toLowerCase().includes(q) ||
        a.city?.toLowerCase().includes(q));
    }
    if (sort === "experience") {
      items = [...items].sort((a, b) => (b.years_experience || 0) - (a.years_experience || 0));
    }
    return items;
  }, [list, query, sort]);

  const startEdit = (a) => {
    setEditingId(a.id);
    setForm({
      name: a.name, trade: a.trade, city: a.city || "", phone: a.phone,
      email: a.email || "", years_experience: a.years_experience || "", bio: a.bio || "",
    });
    setTab("form");
  };

  const startCreate = () => { setEditingId(null); setForm(emptyForm); setError(null); setTab("form"); };

  const remove = async (id) => {
    try {
      await apiRequest(`/api/v1/artisans/${id}`, {
        method: "DELETE",
        headers: { "X-Edit-Token": getMyArtisanToken(id) || "" },
      });
      tapFeedback();
      toast.success("Listing removed");
      await load(trade);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const polish = async () => {
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

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    // Synchronous client-side validation stays inline (right next to the
    // fields it's about) rather than becoming a toast — no network call
    // happened yet, so there's nothing "transient" about it.
    if (!form.name || !form.trade || !form.phone) {
      setError("Name, trade, and phone are required.");
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        await apiRequest(`/api/v1/artisans/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "X-Edit-Token": getMyArtisanToken(editingId) || "" },
          body: JSON.stringify(form),
        });
        toast.success("Listing updated.");
      } else {
        const data = await apiRequest("/api/v1/artisans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        addMyId(data.id);
        saveMyToken(data.id, data.edit_token);
        setMyIds(getMyIds());
        toast.success("You're listed.");
      }
      setForm(emptyForm);
      setEditingId(null);
      setTab("browse");
      await load(trade);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onNavChange = (v) => {
    if (v === "form") startCreate();
    else { setTab(v); setError(null); }
  };

  const errorBanner = error && (
    <Alert variant="destructive" className="shrink-0">
      <AlertDescription className="flex items-center justify-between gap-2">
        <span>{error}</span>
        {tab === "browse" && (
          <button
            type="button"
            onClick={() => load(trade)}
            className="flex shrink-0 items-center gap-1 border-none bg-transparent p-0 text-xs font-bold text-destructive underline-offset-2 hover:underline"
          >
            <RefreshCw className="size-3" /> Try again
          </button>
        )}
      </AlertDescription>
    </Alert>
  );

  const browsePane = (
    <motion.div key="browse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex min-h-0 flex-1 flex-col gap-3">
      <button
        type="button"
        onClick={() => { setRequestModalTrade(trade !== "All" ? trade : null); setRequestModalOpen(true); }}
        className="flex shrink-0 items-center justify-between gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3.5 py-3 text-left"
      >
        <span className="text-[13px] font-bold text-primary">Need something done? Post a job request</span>
        <ClipboardList className="size-4 shrink-0 text-primary" />
      </button>

      <SearchBar value={query} onChange={setQuery} />

      <TradeChips active={trade} onSelect={setTrade} />

      <div className="flex shrink-0 items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60">
          {loading ? "LOADING…" : `${visibleList.length} LISTING${visibleList.length === 1 ? "" : "S"}`}
        </span>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="h-auto border-none bg-transparent px-0 text-[11.5px] font-semibold text-muted-foreground shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {SORTS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2.5 overflow-y-auto pb-1">
        {loading && <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>}
        {!loading && visibleList.length === 0 && (
          <EmptyState trade={trade} onListYourself={startCreate} />
        )}
        {!loading && visibleList.map((a) => (
          <ArtisanCard key={a.id} a={a} isMine={myIds.includes(a.id)}
            onOpen={setViewingArtisan} onEdit={startEdit} onDelete={remove} />
        ))}
        {/* Only offered once the current filter/search is otherwise exhausted —
            "Load more" fetches the next page from the backend; it's deliberately
            not auto-triggered on scroll (a button is simpler and avoids scroll-jank
            risk for what's currently a small dataset). */}
        {!loading && hasMore && !query && (
          <Btn small variant="ghost" onClick={loadMore} loading={loadingMore} className="justify-self-center">
            {loadingMore ? "Loading…" : "Load more"}
          </Btn>
        )}
      </div>
    </motion.div>
  );

  const formPane = (
    <motion.form key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onSubmit={submit} className="grid gap-3 overflow-y-auto">
      {editingId && (
        <button
          type="button"
          onClick={() => { setEditingId(null); setForm(emptyForm); setTab("browse"); }}
          className="flex items-center gap-1 justify-self-start border-none bg-transparent p-0 text-xs text-muted-foreground"
        >
          <ChevronLeft className="size-3" /> Cancel edit
        </button>
      )}

      <Field label="Name" required placeholder="Full name" value={form.name}
        onChange={(v) => setForm({ ...form, name: v })} />
      <Field label="Trade" required placeholder="e.g. Electrician" value={form.trade}
        onChange={(v) => setForm({ ...form, trade: v })} />
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="City" hint="optional" placeholder="City" value={form.city}
          onChange={(v) => setForm({ ...form, city: v })} />
        <Field label="Years experience" type="number" min="0" placeholder="0"
          value={form.years_experience}
          onChange={(v) => setForm({ ...form, years_experience: v })} />
      </div>
      <Field label="Phone" required type="tel" placeholder="(xxx) xxx-xxxx" value={form.phone}
        onChange={(v) => setForm({ ...form, phone: v })} />
      <Field label="Email" hint="optional" type="email" placeholder="you@example.com" value={form.email}
        onChange={(v) => setForm({ ...form, email: v })} />

      <Field label="Bio" hint="AI can polish this" multiline rows={3}
        placeholder="Rough notes about your work — AI can turn this into a polished bio"
        value={form.bio} onChange={(v) => setForm({ ...form, bio: v })} />
      <Btn small variant="ghost" icon="Sparkles" type="button" className="-mt-2.5 mb-1 justify-self-start"
        disabled={polishing || !form.trade} loading={polishing} onClick={polish}>
        {polishing ? "Polishing…" : "Polish with AI"}
      </Btn>

      <Btn variant="gold" type="submit" disabled={submitting} loading={submitting}>
        {submitting ? "Saving…" : editingId ? "Save changes" : "List me"}
      </Btn>
    </motion.form>
  );

  const profileProps = viewingArtisan && {
    artisan: viewingArtisan,
    isMine: myIds.includes(viewingArtisan.id),
    onBack: () => setViewingArtisan(null),
    onEdit: (a) => { setViewingArtisan(null); startEdit(a); },
    onDelete: async (id) => { await remove(id); setViewingArtisan(null); },
    myRating: ratedIds[viewingArtisan.id]?.stars ?? null,
    onRated: (id, stars) => {
      addRatedId(id, stars);
      setRatedIds((r) => ({ ...r, [id]: { stars } }));
    },
    onRatingUpdate: (patch) => {
      setViewingArtisan((a) => ({ ...a, ...patch }));
      setList((l) => l.map((x) => (x.id === viewingArtisan.id ? { ...x, ...patch } : x)));
    },
  };

  const header = (
    <div
      className="flex shrink-0 items-center justify-between px-5 pb-3.5"
      style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
    >
      <div className="flex items-center gap-3">
        <IconTile icon={Hammer} size="sm" />
        <p className="m-0 font-serif text-[17px] italic text-foreground">Find an Artisan</p>
      </div>
      <div className="flex items-center gap-1">
        {onOpenArtisanDashboard && (
          <Button variant="ghost" size="icon" aria-label="Artisan sign in" onClick={onOpenArtisanDashboard} title="Artisan sign in">
            <Wrench className="size-[17px]" />
          </Button>
        )}
        {onClose && (
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X className="size-5" />
          </Button>
        )}
      </div>
    </div>
  );

  const requestsPane = (
    <motion.div key="requests" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex min-h-0 flex-1 flex-col gap-3">
      <button
        type="button"
        onClick={() => { setRequestModalTrade(null); setRequestModalOpen(true); }}
        className="flex shrink-0 items-center justify-between gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3.5 py-3 text-left"
      >
        <span className="text-[13px] font-bold text-primary">Post a new job request</span>
        <ClipboardList className="size-4 shrink-0 text-primary" />
      </button>
      <MyRequestsPane />
    </motion.div>
  );

  // ── Desktop (≥1024px): persistent master-detail split, mirroring
  // GuestMode's w-[380px] left panel + flex-1 right pane. Both the list and
  // the selected artisan's profile stay simultaneously visible — selecting
  // a card fills the right pane instead of replacing the whole screen.
  if (isDesktop) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
        {header}
        <TopTabNav items={NAV_ITEMS} active={tab} onChange={onNavChange} />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex w-[380px] shrink-0 flex-col gap-3.5 overflow-hidden border-r border-border p-5">
            {errorBanner}
            <AnimatePresence mode="wait">{tab === "browse" ? browsePane : tab === "requests" ? requestsPane : formPane}</AnimatePresence>
          </div>
          <div className="min-w-0 flex-1 overflow-y-auto">
            {viewingArtisan ? (
              <ArtisanProfile key={viewingArtisan.id} {...profileProps} />
            ) : (
              <div className="grid h-full justify-items-center content-center gap-2.5 px-5 text-center">
                <div className="flex size-11 items-center justify-center rounded-full border border-border bg-card">
                  <User className="size-[18px] text-muted-foreground" />
                </div>
                <p className="m-0 text-sm font-bold text-foreground">Select an artisan to view their profile</p>
                <p className="m-0 max-w-[280px] text-[12.5px] leading-relaxed text-muted-foreground">
                  Select a listing to see their full profile.
                </p>
              </div>
            )}
          </div>
        </div>
        <RequestJobModal
          open={requestModalOpen}
          onClose={() => setRequestModalOpen(false)}
          defaultTrade={requestModalTrade}
        />
      </div>
    );
  }

  // ── Phone/tablet (<1024px): single-pane flow with a floating bottom nav,
  // matching MobileNav's pattern. Selecting a card does a full-screen swap
  // to the profile view (standard mobile drill-down navigation).
  return (
    <AnimatePresence mode="wait">
      {viewingArtisan ? (
        <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="h-full">
          <ArtisanProfile {...profileProps} />
        </motion.div>
      ) : (
        <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="flex h-full flex-col overflow-hidden bg-background text-foreground">
          {header}
          <div
            className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5"
            style={{ paddingBottom: "calc(86px + env(safe-area-inset-bottom, 0px))" }}
          >
            {errorBanner}
            <AnimatePresence mode="wait">{tab === "browse" ? browsePane : tab === "requests" ? requestsPane : formPane}</AnimatePresence>
          </div>
          <BottomNav items={NAV_ITEMS} active={tab} onChange={onNavChange} />
        </motion.div>
      )}
      <RequestJobModal
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        defaultTrade={requestModalTrade}
      />
    </AnimatePresence>
  );
}
