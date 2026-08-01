"use client";
import { useEffect, useState } from "react";

const C = { bg:"#0B0D14", panel:"#15171D", border:"rgba(255,255,255,0.10)",
  text:"#F5F2EA", muted:"#A6ABB4", gold:"#C9A24E", goldFg:"#1A1710",
  danger:"#E78A8A", dangerBg:"rgba(231,138,138,0.10)",
  sans:"'Helvetica Neue',Arial,sans-serif" };
const API = process.env.NEXT_PUBLIC_API_URL || "";
const MY_IDS_KEY = "noviq_my_artisan_ids";
const input = { width:"100%", background:"#0F1117", border:`1px solid ${C.border}`,
  borderRadius:10, color:C.text, fontSize:14, padding:"10px 12px", marginTop:6 };
const btnGhost = { background:"none", border:`1px solid ${C.border}`, color:C.text,
  fontSize:12.5, fontWeight:600, borderRadius:8, padding:"6px 10px", cursor:"pointer" };

async function apiCall(path, options) {
  if (!API) throw new Error(
    "NEXT_PUBLIC_API_URL is not set. Add it to frontend/.env.local and restart `npm run dev`."
  );
  let res;
  try {
    res = await fetch(`${API}${path}`, options);
  } catch {
    throw new Error(`Couldn't reach the backend at ${API}. Is it running?`);
  }
  let body;
  try {
    body = await res.json();
  } catch {
    throw new Error(`Backend responded with ${res.status} but not valid JSON.`);
  }
  if (!res.ok || body.success === false) {
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return body;
}

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

const emptyForm = { name:"", trade:"", city:"", phone:"", years_experience:"", bio:"" };

export default function Artisans({ onClose }) {
  const [tab, setTab] = useState("browse");
  const [list, setList] = useState([]);
  const [myIds, setMyIds] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [polishing, setPolishing] = useState(false);

  useEffect(() => { setMyIds(getMyIds()); }, []);

  const load = async () => {
    setError(null);
    try {
      const body = await apiCall("/api/v1/artisans");
      setList(body.data);
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => { load(); }, []);

  const startEdit = (a) => {
    setEditingId(a.id);
    setForm({
      name: a.name, trade: a.trade, city: a.city || "", phone: a.phone,
      years_experience: a.years_experience || "", bio: a.bio || "",
    });
    setTab("form");
  };

  const startCreate = () => { setEditingId(null); setForm(emptyForm); setTab("form"); };

  const remove = async (id) => {
    if (!confirm("Remove this listing?")) return;
    setError(null);
    try {
      await apiCall(`/api/v1/artisans/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const polish = async () => {
    setError(null);
    setPolishing(true);
    try {
      const body = await apiCall("/api/v1/artisans/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trade: form.trade, years_experience: form.years_experience, notes: form.bio,
        }),
      });
      setForm((f) => ({ ...f, bio: body.data.bio }));
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
    // years_experience comes out of the <input> as a string (or "" if blank).
    // Send it as a real number (or null) so it matches the Integer column in
    // Postgres — sending "" there throws a 500 in production even though
    // SQLite quietly accepts it locally, which is why this only broke on Render.
    const payload = {
      ...form,
      years_experience: form.years_experience === "" ? null : Number(form.years_experience),
    };
    try {
      if (editingId) {
        await apiCall(`/api/v1/artisans/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setNotice("Listing updated.");
      } else {
        const body = await apiCall("/api/v1/artisans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        addMyId(body.data.id);
        setMyIds(getMyIds());
        setNotice("You're listed.");
      }
      setForm(emptyForm);
      setEditingId(null);
      setTab("browse");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ height:"100%", background:C.bg, color:C.text, fontFamily:C.sans,
      display:"flex", flexDirection:"column", padding:20, gap:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontWeight:700, fontSize:17 }}>Find an Artisan</div>
        {onClose && <button onClick={onClose} style={{ background:"none", border:"none",
          color:C.muted, fontSize:20, cursor:"pointer" }}>×</button>}
      </div>

      <div style={{ display:"flex", gap:8 }}>
        <button onClick={() => { setTab("browse"); setError(null); }} style={{
          flex:1, padding:"9px 0", borderRadius:9, border:`1px solid ${C.border}`,
          background: tab === "browse" ? C.gold : "transparent",
          color: tab === "browse" ? C.goldFg : C.text, fontWeight:700, fontSize:13,
          cursor:"pointer" }}>Browse</button>
        <button onClick={startCreate} style={{
          flex:1, padding:"9px 0", borderRadius:9, border:`1px solid ${C.border}`,
          background: tab === "form" ? C.gold : "transparent",
          color: tab === "form" ? C.goldFg : C.text, fontWeight:700, fontSize:13,
          cursor:"pointer" }}>List yourself</button>
      </div>

      {error && (
        <div style={{ background:C.dangerBg, border:`1px solid ${C.danger}`,
          color:C.danger, borderRadius:10, padding:"10px 12px", fontSize:13, lineHeight:1.5 }}>
          {error}
        </div>
      )}
      {notice && !error && <div style={{ color:C.gold, fontSize:13 }}>{notice}</div>}

      {tab === "browse" ? (
        <div style={{ display:"grid", gap:10, overflowY:"auto" }}>
          {list.length === 0 && !error && (
            <div style={{ color:C.muted, fontSize:14 }}>No artisans yet.</div>
          )}
          {list.map((a) => (
            <div key={a.id} style={{ background:C.panel, border:`1px solid ${C.border}`,
              borderRadius:12, padding:14, display:"grid", gap:6 }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontWeight:700 }}>{a.name}</div>
                  <div style={{ color:C.gold, fontSize:13, fontWeight:600 }}>
                    {a.trade}{a.years_experience ? ` · ${a.years_experience}+ yrs` : ""}
                  </div>
                </div>
                {myIds.includes(a.id) && (
                  <div style={{ display:"flex", gap:6, height:"fit-content" }}>
                    <button style={btnGhost} onClick={() => startEdit(a)}>Edit</button>
                    <button style={{ ...btnGhost, color:C.danger }} onClick={() => remove(a.id)}>Delete</button>
                  </div>
                )}
              </div>
              {a.city && <div style={{ color:C.muted, fontSize:13 }}>{a.city}</div>}
              {a.bio && <div style={{ fontSize:13.5, lineHeight:1.5 }}>{a.bio}</div>}
              <a href={`tel:${a.phone}`} style={{ color:C.gold, fontSize:13, fontWeight:600 }}>
                {a.phone}
              </a>
            </div>
          ))}
        </div>
      ) : (
        <form onSubmit={submit} style={{ display:"grid", gap:12, overflowY:"auto" }}>
          {["name", "trade", "city", "phone"].map((f) => (
            <input key={f} style={input} placeholder={f} value={form[f]}
              onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
          ))}
          <input style={input} type="number" min="0" placeholder="years of experience"
            value={form.years_experience}
            onChange={(e) => setForm({ ...form, years_experience: e.target.value })} />

          <div>
            <textarea style={{ ...input, minHeight: 80, resize:"vertical" }}
              placeholder="Rough notes about your work — AI can turn this into a polished bio"
              value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            <button type="button" onClick={polish} disabled={polishing || !form.trade} style={{
              marginTop: 8, background:"none", border:`1px solid ${C.gold}`, color:C.gold,
              fontSize:12.5, fontWeight:700, borderRadius:8, padding:"7px 12px",
              cursor: polishing || !form.trade ? "default" : "pointer",
              opacity: polishing || !form.trade ? 0.5 : 1 }}>
              {polishing ? "Polishing…" : "✨ Polish with AI"}
            </button>
          </div>

          <button type="submit" disabled={submitting} style={{ background:C.gold,
            color:C.goldFg, fontWeight:700, border:"none", borderRadius:10,
            padding:"12px 0", cursor:"pointer", opacity: submitting ? 0.7 : 1 }}>
            {submitting ? "Saving…" : editingId ? "Save changes" : "List me"}
          </button>
        </form>
      )}
    </div>
  );
}