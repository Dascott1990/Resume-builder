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
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Search, MapPin, Phone, User, UserPlus, ChevronLeft, X, Star, Hammer, RefreshCw, ClipboardList, Wrench, List, Map as MapIcon } from "lucide-react";
import { apiRequest } from "./shared/api";
import DeleteListingDialog from "./shared/DeleteListingDialog";
import { tintFor, initialsOf, formatPhone, truncateBio, formatDistance } from "./shared/artisanDisplay";
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
import MyRequestsPane from "./artisan/MyRequestsPane";
import { loadFormDraft, saveFormDraft, clearFormDraft } from "@/lib/formDraft";
import ArtisanMapLoader from "./artisan/ArtisanMapLoader";
import { getUnreadCount } from "./messages/api";

const PAGE_SIZE = 20;

// Two personas, not five flat tabs — hiring (Browse, My requests) and
// being an artisan (List yourself, or sign in for the real dashboard) are
// different people with different goals; mixing them in one nav made a
// customer see "List yourself" and an artisan see "My requests," neither
// of which is theirs.
const PERSONAS = [
  { id: "hire", Icon: Search, label: "Hire an artisan" },
  { id: "artisan", Icon: UserPlus, label: "I'm an artisan" },
];
const HIRE_TABS = [
  { id: "browse", Icon: Search, label: "Browse" },
  { id: "requests", Icon: ClipboardList, label: "My requests" },
];

const MY_IDS_KEY = "noviq_my_artisan_ids";
const MY_TOKENS_KEY = "noviq_my_artisan_tokens";
const RATED_IDS_KEY = "noviq_rated_artisan_ids";

const TRADES = TRADES_WITH_ALL;

const SORTS = [
  { id: "newest", label: "Newest" },
  { id: "experience", label: "Most experienced" },
  { id: "distance", label: "Nearest" },
];

const emptyForm = { name: "", trade: "", city: "", phone: "", email: "", years_experience: "", bio: "" };
// A 7-field listing form (including free-text bio) with no persistence
// at all was lost outright on a refresh — same class of bug as the
// resume editors, fixed the same way (see myResumeDraft.js).
const ARTISAN_FORM_DRAFT_KEY = "resumeBuilder:artisanListingDraft:v1";

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
      // "Classic glass card" — a frosted, translucent surface rather than
      // the flat opaque default, reusing this app's own existing frosted-
      // sheet recipe (BottomNav, ArtisanProfile's contact sheet) instead of
      // inventing a new one: border/shadow opacity are tuned off `foreground`
      // (not a literal white), so this reads correctly in both the light and
      // dark themes — a bare white border would vanish on light mode's
      // near-white card background. supports-backdrop-filter degrades to a
      // near-opaque fill on browsers without blur support, same guard the
      // sticky contact sheet already uses.
      className="cursor-pointer gap-0 overflow-hidden rounded-2xl border border-foreground/10 bg-card/95 py-0 ring-0 shadow-[0_8px_28px_rgba(0,0,0,0.10)] backdrop-blur-xl transition-colors duration-200 supports-backdrop-filter:bg-card/75 hover:border-foreground/20 dark:shadow-[0_10px_36px_rgba(0,0,0,0.4),0_1px_0_rgba(255,255,255,0.06)_inset] dark:hover:border-white/25"
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
              {/* Only the positive signal shows here — a muted "not
                  accepting" badge on every unavailable card in a long list
                  would be noise; the full status (available or off) shows
                  once you open the profile either way. Same "sonar" pulse
                  language as ArtisanDashboard.js's own status card, just
                  scaled down to badge size — a ring expanding off the dot,
                  the dot itself breathing, and a lightning emoji giving it
                  a little life without needing a screen's worth of room. */}
              {a.has_account && a.is_available && (
                <Badge variant="outline" className="gap-1 rounded-full border-[var(--success,#22c55e)]/30 bg-[var(--success,#22c55e)]/10 pl-1.5 text-[10px] font-bold text-[var(--success,#22c55e)]">
                  <span className="relative flex size-[7px] shrink-0 items-center justify-center">
                    <motion.span
                      aria-hidden="true"
                      initial={{ scale: 1, opacity: 0.6 }}
                      animate={{ scale: 2.4, opacity: 0 }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                      className="absolute inset-0 rounded-full bg-[var(--success,#22c55e)]"
                    />
                    <motion.span
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                      className="relative size-[5px] rounded-full bg-[var(--success,#22c55e)]"
                    />
                  </span>
                  <motion.span
                    aria-hidden="true"
                    animate={{ rotate: [0, -14, 12, -8, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.8, ease: "easeInOut" }}
                    className="leading-none"
                  >
                    ⚡
                  </motion.span>
                  Available
                </Badge>
              )}
            </div>
            {a.city && (
              <div className="mt-1 flex items-center gap-1">
                <MapPin className="size-[11px] text-muted-foreground" />
                <span className="text-[12.5px] text-muted-foreground">{a.city}</span>
                {a.distance_km != null && (
                  <span className="text-[12.5px] text-muted-foreground/60">· {formatDistance(a.distance_km)}</span>
                )}
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
  // Read once, synchronously, before first render — same pattern as
  // GuestMode.js's own draftAtMount / myResumeDraft.js.
  const artisanDraftAtMount = useRef(loadFormDraft(ARTISAN_FORM_DRAFT_KEY)).current;
  // Restoring the "artisan" persona only when there's an actual in-progress
  // form to show for it (some field actually filled in, or mid-edit of an
  // existing listing) — otherwise every returning visitor would get
  // dropped onto "List yourself" instead of Browse for no reason, since
  // the saved draft object always exists once anyone's ever typed
  // anything here, empty or not.
  const hasDraftContent = artisanDraftAtMount?.editingId || Object.values(artisanDraftAtMount?.form || {}).some((v) => String(v || "").trim());
  const [persona, setPersona] = useState(() => (hasDraftContent ? "artisan" : "hire")); // "hire" | "artisan"
  const [tab, setTab] = useState("browse"); // sub-tab within the "hire" persona: "browse" | "requests"
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [myIds, setMyIds] = useState([]);
  const [form, setForm] = useState(() => artisanDraftAtMount?.form || emptyForm);
  const [editingId, setEditingId] = useState(() => artisanDraftAtMount?.editingId ?? null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [viewingArtisan, setViewingArtisan] = useState(null); // an artisan object, or null
  const [ratedIds, setRatedIds] = useState({});

  const [query, setQuery] = useState("");
  const [trade, setTrade] = useState("All");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState("list"); // "list" | "map" — Browse-pane-local
  // Only ever set once geolocation actually succeeds — picking "Nearest"
  // in the sort dropdown is what triggers the browser's permission prompt
  // (see the effect below), not a separate toggle, so there's exactly one
  // control for this instead of two that can disagree with each other.
  const [nearMe, setNearMe] = useState(null); // { lat, lng } | null
  const [unread, setUnread] = useState(0);

  useEffect(() => { setMyIds(getMyIds()); setRatedIds(getRatedIds()); }, []);

  // Debounced, same 300ms shape as myResumeDraft.js/useGuestDraft.js — an
  // empty/reset form still gets saved (harmless, just overwrites the old
  // draft with the same empty shape), which is what makes the explicit
  // clearFormDraft calls after a successful submit actually matter instead
  // of racing this effect back in.
  const artisanDraftSaveTimer = useRef(null);
  useEffect(() => {
    clearTimeout(artisanDraftSaveTimer.current);
    artisanDraftSaveTimer.current = setTimeout(() => {
      saveFormDraft(ARTISAN_FORM_DRAFT_KEY, { form, editingId });
    }, 300);
    return () => clearTimeout(artisanDraftSaveTimer.current);
  }, [form, editingId]);

  // Unread-message badge on "My requests" — a slower, separate poll from
  // an open thread's own 4s cadence (see MessageThread.js): this only
  // needs to feel current, not live, while no specific thread is open.
  useEffect(() => {
    let cancelled = false;
    const poll = () => getUnreadCount().then((d) => !cancelled && setUnread(d.count)).catch(() => {});
    poll();
    const interval = setInterval(poll, 25000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (sort !== "distance" || nearMe) return;
    if (!navigator.geolocation) {
      toast.error("Location isn't available in this browser.");
      setSort("newest");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setNearMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { toast.error("Couldn't get your location — check your browser's permission settings."); setSort("newest"); },
      { timeout: 10000 }
    );
  }, [sort, nearMe]);

  const load = async (activeTrade, near) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (activeTrade && activeTrade !== "All") qs.set("trade", activeTrade);
      if (near) { qs.set("near_lat", String(near.lat)); qs.set("near_lng", String(near.lng)); qs.set("radius_km", "50"); }
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
  useEffect(() => { load(trade, sort === "distance" ? nearMe : null); }, [trade, sort === "distance" ? nearMe : null]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(list.length) });
      if (trade && trade !== "All") qs.set("trade", trade);
      if (sort === "distance" && nearMe) { qs.set("near_lat", String(nearMe.lat)); qs.set("near_lng", String(nearMe.lng)); qs.set("radius_km", "50"); }
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
    setPersona("artisan");
  };

  const startCreate = () => { setEditingId(null); setForm(emptyForm); setError(null); setPersona("artisan"); };

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
      clearFormDraft(ARTISAN_FORM_DRAFT_KEY);
      setPersona("hire");
      setTab("browse");
      await load(trade);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onNavChange = (v) => { setTab(v); setError(null); };

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
      <SearchBar value={query} onChange={setQuery} />

      <TradeChips active={trade} onSelect={setTrade} />

      <div className="flex shrink-0 items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60">
          <ClipboardList className="size-3" />
          {loading ? "LOADING…" : `${visibleList.length} LISTING${visibleList.length === 1 ? "" : "S"}`}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v)} className="gap-1">
            <ToggleGroupItem value="list" aria-label="List view" className="size-7 rounded-md p-0 data-[state=on]:bg-primary/10 data-[state=on]:text-primary">
              <List className="size-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="map" aria-label="Map view" className="size-7 rounded-md p-0 data-[state=on]:bg-primary/10 data-[state=on]:text-primary">
              <MapIcon className="size-3.5" />
            </ToggleGroupItem>
          </ToggleGroup>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="h-auto border-none bg-transparent px-0 text-[11.5px] font-semibold text-muted-foreground shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {SORTS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {view === "map" ? (
        <div className="min-h-0 flex-1">
          {loading ? (
            <Skeleton className="h-full w-full rounded-lg" />
          ) : (
            <ArtisanMapLoader
              artisans={visibleList}
              nearMe={sort === "distance" ? nearMe : null}
              onOpenArtisan={setViewingArtisan}
              hasMore={hasMore && !query}
              onLoadMore={loadMore}
              loadingMore={loadingMore}
            />
          )}
        </div>
      ) : (
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
      )}
    </motion.div>
  );

  const formPane = (
    <motion.form key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onSubmit={submit} className="grid gap-3 overflow-y-auto">
      {editingId && (
        <button
          type="button"
          onClick={() => { setEditingId(null); setForm(emptyForm); setPersona("hire"); setTab("browse"); }}
          className="flex items-center gap-1 justify-self-start border-none bg-transparent p-0 text-xs text-muted-foreground"
        >
          <ChevronLeft className="size-3" /> Cancel edit
        </button>
      )}

      <div className="mb-1 flex items-center gap-3">
        <IconTile icon={Hammer} size="sm" />
        <div>
          <p className="m-0 font-serif text-[17px] italic text-foreground">
            {editingId ? "Edit your listing" : "List yourself"}
          </p>
          <p className="m-0 text-[12px] text-muted-foreground">
            {editingId ? "Changes go live immediately." : "Live in under a minute — no account required."}
          </p>
        </div>
      </div>

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
    editToken: getMyArtisanToken(viewingArtisan.id),
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
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5">
        <ClipboardList className="size-3.5 shrink-0 text-muted-foreground/60" />
        <p className="m-0 text-[12.5px] leading-relaxed text-muted-foreground">
          To request an artisan, open their profile from Browse and tap "Request."
        </p>
      </div>
      <MyRequestsPane />
    </motion.div>
  );

  const hireTabs = HIRE_TABS.map((t) => t.id === "requests" ? { ...t, badge: unread } : t);

  const artisanPane = (
    <motion.div key="artisan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      {onOpenArtisanDashboard && (
        <button
          type="button"
          onClick={onOpenArtisanDashboard}
          className="flex shrink-0 items-center justify-between gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3.5 py-3 text-left"
        >
          <span className="text-[13px] font-bold text-primary">Already listed? Sign in to receive job requests</span>
          <Wrench className="size-4 shrink-0 text-primary" />
        </button>
      )}
      {formPane}
    </motion.div>
  );

  const personaSwitch = (
    <div className="flex shrink-0 justify-center px-5 pb-3">
      <ToggleGroup
        type="single"
        value={persona}
        onValueChange={(v) => v && setPersona(v)}
        className="gap-1.5"
      >
        {PERSONAS.map((p) => (
          <ToggleGroupItem
            key={p.id}
            value={p.id}
            className="gap-1.5 rounded-full border border-border bg-transparent px-4 text-[12.5px] font-semibold text-muted-foreground data-[state=on]:border-primary/30 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
          >
            <p.Icon className="size-3.5" />
            {p.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );

  // ── Desktop (≥1024px): persistent master-detail split, mirroring
  // GuestMode's w-[380px] left panel + flex-1 right pane. Both the list and
  // the selected artisan's profile stay simultaneously visible — selecting
  // a card fills the right pane instead of replacing the whole screen.
  if (isDesktop) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
        {header}
        {personaSwitch}
        {persona === "hire" && <TopTabNav items={hireTabs} active={tab} onChange={onNavChange} />}
        {persona === "artisan" ? (
          // Full-width, single column — there's no list-to-select-from
          // concept here, so the browse persona's right-pane placeholder
          // ("Select an artisan to view their profile") doesn't apply and
          // would just be a confusing non-sequitur next to a listing form.
          <div className="mx-auto w-full max-w-[480px] flex-1 overflow-y-auto p-5">
            {errorBanner}
            {artisanPane}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div className="flex w-[380px] shrink-0 flex-col gap-3.5 overflow-hidden border-r border-border p-5">
              {errorBanner}
              <AnimatePresence mode="wait">
                {tab === "browse" ? browsePane : requestsPane}
              </AnimatePresence>
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
        )}
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
          {personaSwitch}
          <div
            className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5"
            // BottomNav's real footprint is ~80px (12px offset + ~66px bar) —
            // 86px left only a 6px buffer, the thinnest margin in the app
            // (Dashboard.js uses 96px, GuestMode.js uses 116px). Matched to
            // Dashboard.js's own value here for consistency.
            style={{ paddingBottom: persona === "hire" ? "calc(96px + env(safe-area-inset-bottom, 0px))" : "env(safe-area-inset-bottom, 0px)" }}
          >
            {errorBanner}
            <AnimatePresence mode="wait">
              {persona === "artisan" ? artisanPane : tab === "browse" ? browsePane : requestsPane}
            </AnimatePresence>
          </div>
          {persona === "hire" && <BottomNav items={hireTabs} active={tab} onChange={onNavChange} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
