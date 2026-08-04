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
import { Search, MapPin, Phone, User, ChevronLeft, X, Star, Hammer } from "lucide-react";
import { apiRequest } from "./shared/api";
import DeleteListingDialog from "./shared/DeleteListingDialog";
import { tintFor, initialsOf, formatPhone, truncateBio } from "./shared/artisanDisplay";
import { Btn } from "./guest/components/primitives";
import ArtisanProfile from "./ArtisanProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MY_IDS_KEY = "noviq_my_artisan_ids";
const RATED_IDS_KEY = "noviq_rated_artisan_ids";

const TRADES = ["All", "Carpenter", "Electrician", "Handyman", "HVAC", "Landscaper",
  "Mason", "Mover", "Painter", "Plumber", "Roofer"];

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
        Be the first — listings take under a minute and go live immediately.
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

export default function Artisans({ onClose }) {
  const [tab, setTab] = useState("browse");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myIds, setMyIds] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");
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
      const qs = activeTrade && activeTrade !== "All" ? `?trade=${encodeURIComponent(activeTrade)}` : "";
      const data = await apiRequest(`/api/v1/artisans${qs}`);
      setList(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(trade); }, [trade]);

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
    setError(null);
    try {
      await apiRequest(`/api/v1/artisans/${id}`, { method: "DELETE" });
      await load(trade);
    } catch (e) {
      setError(e.message);
    }
  };

  const polish = async () => {
    setError(null);
    setPolishing(true);
    try {
      const data = await apiRequest("/api/v1/artisans/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trade: form.trade, years_experience: form.years_experience, notes: form.bio }),
      });
      setForm((f) => ({ ...f, bio: data.bio }));
    } catch (e) {
      setError(e.message);
    } finally {
      setPolishing(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setNotice("");
    if (!form.name || !form.trade || !form.phone) {
      setError("Name, trade, and phone are required.");
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        await apiRequest(`/api/v1/artisans/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        setNotice("Listing updated.");
      } else {
        const data = await apiRequest("/api/v1/artisans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        addMyId(data.id);
        setMyIds(getMyIds());
        setNotice("You're listed.");
      }
      setForm(emptyForm);
      setEditingId(null);
      setTab("browse");
      await load(trade);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (viewingArtisan) {
    return (
      <ArtisanProfile
        artisan={viewingArtisan}
        isMine={myIds.includes(viewingArtisan.id)}
        onBack={() => setViewingArtisan(null)}
        onEdit={(a) => { setViewingArtisan(null); startEdit(a); }}
        onDelete={async (id) => { await remove(id); setViewingArtisan(null); }}
        myRating={ratedIds[viewingArtisan.id]?.stars ?? null}
        onRated={(id, stars) => {
          addRatedId(id, stars);
          setRatedIds((r) => ({ ...r, [id]: { stars } }));
        }}
        onRatingUpdate={(patch) => {
          setViewingArtisan((a) => ({ ...a, ...patch }));
          setList((l) => l.map((x) => (x.id === viewingArtisan.id ? { ...x, ...patch } : x)));
        }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col gap-3.5 overflow-hidden bg-background p-5 text-foreground">
      <div className="flex shrink-0 items-center justify-between">
        <p className="m-0 flex items-center gap-2 font-serif text-[17px] italic text-foreground">
          <Hammer className="size-4 text-primary" /> Find an Artisan
        </p>
        {onClose && (
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X className="size-5" />
          </Button>
        )}
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          if (v === "form") startCreate();
          else { setTab(v); setError(null); }
        }}
        className="shrink-0 gap-2"
      >
        <TabsList className="w-full">
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="form">List yourself</TabsTrigger>
        </TabsList>
      </Tabs>

      {error && (
        <Alert variant="destructive" className="shrink-0">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && !error && <div className="shrink-0 text-[13px] text-primary">{notice}</div>}

      {tab === "browse" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
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
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-3 overflow-y-auto">
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
        </form>
      )}
    </div>
  );
}
