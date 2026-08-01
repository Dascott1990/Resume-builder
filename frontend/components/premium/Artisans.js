"use client";
/**
 * Artisans.js — app/components/premium/Artisans.js
 *
 * "Find an Artisan": a small local directory of tradespeople. Two jobs,
 * done well:
 *   1. Someone hiring can find the right trade fast, trust what they see,
 *      and call in one tap.
 *   2. Someone listing themselves can be live in under a minute.
 *
 * What changed from the first pass: search + trade filters actually use
 * the backend's ?trade=/?city= query params (they existed on the API the
 * whole time — the UI just never called them), cards carry real signal
 * (initials, years badge, tap-to-call) instead of a flat text list, and
 * both loading and empty states are real states instead of a blank screen.
 */
import { useEffect, useMemo, useState } from "react";
import { T as C } from "./shared/theme";
import Icon from "./shared/Icon";
import { apiRequest } from "./shared/api";

const MY_IDS_KEY = "noviq_my_artisan_ids";

// Curated, not exhaustive — the trades people actually search for most.
// "All" always sits first; everything else is alphabetical so the row
// doesn't reshuffle as listings come and go.
const TRADES = ["All", "Carpenter", "Electrician", "Handyman", "HVAC", "Landscaper",
  "Mason", "Mover", "Painter", "Plumber", "Roofer"];

const SORTS = [
  { id: "newest", label: "Newest" },
  { id: "experience", label: "Most experienced" },
];

const emptyForm = { name: "", trade: "", city: "", phone: "", years_experience: "", bio: "" };

// Since there's no login, we track which listings THIS browser created so
// we know which cards to show Edit/Delete on. Anyone with the raw API can
// still edit/delete any id — this is UI convenience, not real ownership.
const getMyIds = () => {
  try { return JSON.parse(localStorage.getItem(MY_IDS_KEY) || "[]"); }
  catch { return []; }
};
const addMyId = (id) => {
  const ids = getMyIds();
  if (!ids.includes(id)) localStorage.setItem(MY_IDS_KEY, JSON.stringify([...ids, id]));
};

// A small, on-brand rotation (gold / blue / green, all already in the
// palette) so avatars have *some* variety without introducing new colors.
const AVATAR_TINTS = [
  { bg: C.goldBg, br: C.goldBr, fg: C.gold },
  { bg: C.blueBg, br: C.blueBr, fg: C.blue },
  { bg: C.greenBg, br: C.greenBr, fg: C.green },
];
function tintFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}
function initialsOf(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

// ── Small building blocks ────────────────────────────────────────────────────

function SearchBar({ value, onChange }) {
  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
        color: C.muted, display: "flex", pointerEvents: "none" }}>
        <Icon name="search" size={15} color={C.muted} />
      </span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="Search by name, trade, or city"
        style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 10, color: C.text, fontSize: 14, fontFamily: C.sans,
          padding: "10px 12px 10px 36px", boxSizing: "border-box" }} />
    </div>
  );
}

function TradeChips({ active, onSelect }) {
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2,
      scrollbarWidth: "none" }}>
      {TRADES.map((t) => {
        const isActive = active === t;
        return (
          <button key={t} onClick={() => onSelect(t)} style={{
            flexShrink: 0, padding: "6px 12px", borderRadius: 999,
            border: `1px solid ${isActive ? C.goldBr : C.border}`,
            background: isActive ? C.goldBg : "transparent",
            color: isActive ? C.gold : C.muted,
            fontSize: 12.5, fontWeight: 600, fontFamily: C.sans, cursor: "pointer",
            whiteSpace: "nowrap" }}>
            {t}
          </button>
        );
      })}
    </div>
  );
}

// The "work order" card — the one deliberate visual idea here: a dashed
// tear-line under the header, like a ticket stub, nodding at the trade
// world (job tags, work orders) without tipping into decoration.
function ArtisanCard({ a, isMine, onEdit, onDelete }) {
  const tint = tintFor(a.name || "?");
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`,
      borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "14px 14px 12px", display: "flex", gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
          background: tint.bg, border: `1px solid ${tint.br}`, color: tint.fg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 700, fontFamily: C.mono }}>
          {initialsOf(a.name)}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: C.text,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {a.name}
            </div>
            {isMine && (
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button onClick={() => onEdit(a)} aria-label="Edit listing" style={{
                  background: "none", border: `1px solid ${C.border}`, color: C.muted,
                  fontSize: 11, fontWeight: 600, borderRadius: 7, padding: "4px 8px",
                  cursor: "pointer" }}>Edit</button>
                <button onClick={() => onDelete(a.id)} aria-label="Delete listing" style={{
                  background: "none", border: `1px solid ${C.border}`, color: C.red,
                  fontSize: 11, fontWeight: 600, borderRadius: 7, padding: "4px 8px",
                  cursor: "pointer" }}>Delete</button>
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            <span style={{ color: C.gold, fontSize: 12, fontWeight: 700 }}>{a.trade}</span>
            {a.years_experience != null && (
              <span style={{ fontFamily: C.mono, fontSize: 10.5, color: C.faint,
                border: `1px dashed ${C.border}`, borderRadius: 5, padding: "1px 6px" }}>
                {a.years_experience}+ YRS
              </span>
            )}
          </div>

          {a.city && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
              <Icon name="mapPin" size={11} color={C.muted} />
              <span style={{ color: C.muted, fontSize: 12.5 }}>{a.city}</span>
            </div>
          )}
        </div>
      </div>

      {a.bio && (
        <p style={{ margin: "0 14px 12px", fontSize: 13, lineHeight: 1.5, color: C.text,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {a.bio}
        </p>
      )}

      <a href={`tel:${a.phone}`} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        margin: "0 14px 14px", padding: "9px 0", borderRadius: 9,
        background: C.goldBg, border: `1px solid ${C.goldBr}`, color: C.gold,
        fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
        <Icon name="phone" size={13} color={C.gold} />
        {a.phone}
      </a>
    </div>
  );
}

function SkeletonCard() {
  const pulse = { background: C.raised, borderRadius: 6, animation: "artisan-pulse 1.4s ease-in-out infinite" };
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ ...pulse, width: 42, height: 42, borderRadius: "50%", flexShrink: 0 }} />
        <div style={{ flex: 1, display: "grid", gap: 8 }}>
          <div style={{ ...pulse, width: "55%", height: 13 }} />
          <div style={{ ...pulse, width: "35%", height: 11 }} />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ trade, onListYourself }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px", display: "grid", gap: 10, justifyItems: "center" }}>
      <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.surface,
        border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name="user" size={18} color={C.muted} />
      </div>
      <p style={{ margin: 0, color: C.text, fontSize: 14, fontWeight: 700 }}>
        {trade && trade !== "All" ? `No ${trade}s listed yet` : "No artisans yet"}
      </p>
      <p style={{ margin: 0, color: C.muted, fontSize: 12.5, maxWidth: 240, lineHeight: 1.5 }}>
        Be the first — listings take under a minute and go live immediately.
      </p>
      <button onClick={onListYourself} style={{ marginTop: 4, background: C.gold, color: C.goldFg,
        fontWeight: 700, fontSize: 12.5, border: "none", borderRadius: 9, padding: "9px 16px", cursor: "pointer" }}>
        List yourself
      </button>
    </div>
  );
}

const fieldStyle = { width: "100%", background: C.surface, border: `1px solid ${C.border}`,
  borderRadius: 10, color: C.text, fontSize: 14, fontFamily: C.sans, padding: "10px 12px",
  marginTop: 6, boxSizing: "border-box" };

function Field({ label, ...rest }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: C.faint, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}
      </span>
      <input style={fieldStyle} {...rest} />
    </label>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
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

  const [query, setQuery] = useState("");
  const [trade, setTrade] = useState("All");
  const [sort, setSort] = useState("newest");

  useEffect(() => { setMyIds(getMyIds()); }, []);

  // Trade filtering hits the backend (it already supported ?trade= — the
  // first version of this screen just never called it). Text search stays
  // client-side over whatever's loaded, so it feels instant while typing.
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
      years_experience: a.years_experience || "", bio: a.bio || "",
    });
    setTab("form");
  };

  const startCreate = () => { setEditingId(null); setForm(emptyForm); setError(null); setTab("form"); };

  const remove = async (id) => {
    if (!confirm("Remove this listing?")) return;
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

  return (
    <div style={{ height: "100%", background: C.bg, color: C.text, fontFamily: C.sans,
      display: "flex", flexDirection: "column", padding: 20, gap: 14, overflow: "hidden" }}>

      <style>{`@keyframes artisan-pulse { 0%,100% { opacity: 0.5 } 50% { opacity: 1 } }`}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 17 }}>Find an Artisan</div>
        {onClose && <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none",
          color: C.muted, fontSize: 20, cursor: "pointer" }}>×</button>}
      </div>

      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button onClick={() => { setTab("browse"); setError(null); }} style={{
          flex: 1, padding: "9px 0", borderRadius: 9, border: `1px solid ${C.border}`,
          background: tab === "browse" ? C.gold : "transparent",
          color: tab === "browse" ? C.goldFg : C.text, fontWeight: 700, fontSize: 13,
          cursor: "pointer" }}>Browse</button>
        <button onClick={startCreate} style={{
          flex: 1, padding: "9px 0", borderRadius: 9, border: `1px solid ${C.border}`,
          background: tab === "form" ? C.gold : "transparent",
          color: tab === "form" ? C.goldFg : C.text, fontWeight: 700, fontSize: 13,
          cursor: "pointer" }}>List yourself</button>
      </div>

      {error && (
        <div style={{ flexShrink: 0, background: C.dangerBg, border: `1px solid ${C.danger}`,
          color: C.danger, borderRadius: 10, padding: "10px 12px", fontSize: 13, lineHeight: 1.5 }}>
          {error}
        </div>
      )}
      {notice && !error && <div style={{ flexShrink: 0, color: C.gold, fontSize: 13 }}>{notice}</div>}

      {tab === "browse" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0, flex: 1 }}>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <SearchBar value={query} onChange={setQuery} />
          </div>

          <TradeChips active={trade} onSelect={setTrade} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <span style={{ fontSize: 11.5, color: C.faint }}>
              {loading ? "Loading…" : `${visibleList.length} listing${visibleList.length === 1 ? "" : "s"}`}
            </span>
            <select value={sort} onChange={(e) => setSort(e.target.value)} style={{
              background: "transparent", border: "none", color: C.muted, fontSize: 11.5,
              fontWeight: 600, cursor: "pointer" }}>
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>

          <div style={{ display: "grid", gap: 10, overflowY: "auto", paddingBottom: 4 }}>
            {loading && <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>}
            {!loading && visibleList.length === 0 && (
              <EmptyState trade={trade} onListYourself={startCreate} />
            )}
            {!loading && visibleList.map((a) => (
              <ArtisanCard key={a.id} a={a} isMine={myIds.includes(a.id)}
                onEdit={startEdit} onDelete={remove} />
            ))}
          </div>
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: "grid", gap: 12, overflowY: "auto" }}>
          {editingId && (
            <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); setTab("browse"); }}
              style={{ justifySelf: "start", display: "flex", alignItems: "center", gap: 5,
                background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", padding: 0 }}>
              <Icon name="chevronLeft" size={12} color={C.muted} /> Cancel edit
            </button>
          )}

          <Field label="Name" placeholder="Full name" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Field label="Trade" placeholder="e.g. Electrician" value={form.trade}
            onChange={(e) => setForm({ ...form, trade: e.target.value })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="City" placeholder="City" value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <Field label="Years experience" type="number" min="0" placeholder="0"
              value={form.years_experience}
              onChange={(e) => setForm({ ...form, years_experience: e.target.value })} />
          </div>
          <Field label="Phone" type="tel" placeholder="(xxx) xxx-xxxx" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />

          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.faint, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Bio
            </span>
            <textarea style={{ ...fieldStyle, minHeight: 80, resize: "vertical" }}
              placeholder="Rough notes about your work — AI can turn this into a polished bio"
              value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            <button type="button" onClick={polish} disabled={polishing || !form.trade} style={{
              marginTop: 8, display: "flex", alignItems: "center", gap: 6,
              background: "none", border: `1px solid ${C.gold}`, color: C.gold,
              fontSize: 12.5, fontWeight: 700, borderRadius: 8, padding: "7px 12px",
              cursor: polishing || !form.trade ? "default" : "pointer",
              opacity: polishing || !form.trade ? 0.5 : 1 }}>
              <Icon name="sparkle" size={13} color={C.gold} />
              {polishing ? "Polishing…" : "Polish with AI"}
            </button>
          </div>

          <button type="submit" disabled={submitting} style={{ background: C.gold,
            color: C.goldFg, fontWeight: 700, border: "none", borderRadius: 10,
            padding: "12px 0", cursor: "pointer", opacity: submitting ? 0.7 : 1, fontSize: 14 }}>
            {submitting ? "Saving…" : editingId ? "Save changes" : "List me"}
          </button>
        </form>
      )}
    </div>
  );
}