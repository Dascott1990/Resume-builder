"use client";
import { useEffect, useState } from "react";

const C = { bg:"#0B0D14", panel:"#15171D", border:"rgba(255,255,255,0.10)",
  text:"#F5F2EA", muted:"#A6ABB4", gold:"#C9A24E", goldFg:"#1A1710",
  danger:"#E78A8A", dangerBg:"rgba(231,138,138,0.10)",
  sans:"'Helvetica Neue',Arial,sans-serif" };
const API = process.env.NEXT_PUBLIC_API_URL || "";
const input = { width:"100%", background:"#0F1117", border:`1px solid ${C.border}`,
  borderRadius:10, color:C.text, fontSize:14, padding:"10px 12px", marginTop:6 };

// Every request goes through here so failures always surface as a readable
// message instead of dying silently in a rejected promise. Handles three
// distinct failure modes separately, since they need different fixes:
//  1. Network/connection failure (backend not running, wrong URL, CORS)
//  2. Backend reachable but returned non-JSON (wrong route, proxy, HTML 404 page)
//  3. Backend reachable, valid JSON, but success:false (real validation error)
async function apiCall(path, options) {
  if (!API) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set — the app doesn't know where the backend is. " +
      "Add it to frontend/.env.local and restart `npm run dev`."
    );
  }

  let res;
  try {
    res = await fetch(`${API}${path}`, options);
  } catch {
    throw new Error(
      `Couldn't reach the backend at ${API}. Is it running (\`python run.py\`), ` +
      `and is that the right URL/port?`
    );
  }

  let body;
  try {
    body = await res.json();
  } catch {
    throw new Error(
      `Backend responded with ${res.status} but not valid JSON — ` +
      `check the backend logs, the route may not exist (404) or crashed (500).`
    );
  }

  if (!res.ok || body.success === false) {
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return body;
}

export default function Artisans({ onClose }) {
  const [tab, setTab] = useState("browse");
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ name:"", trade:"", city:"", phone:"" });
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      await apiCall("/api/v1/artisans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm({ name:"", trade:"", city:"", phone:"" });
      setNotice("You're listed.");
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
        {["browse", "list yourself"].map((t) => (
          <button key={t} onClick={() => { setTab(t); setError(null); }} style={{
            flex:1, padding:"9px 0", borderRadius:9, border:`1px solid ${C.border}`,
            background: tab === t ? C.gold : "transparent",
            color: tab === t ? C.goldFg : C.text, fontWeight:700, fontSize:13,
            cursor:"pointer", textTransform:"capitalize" }}>{t}</button>
        ))}
      </div>

      {error && (
        <div style={{ background:C.dangerBg, border:`1px solid ${C.danger}`,
          color:C.danger, borderRadius:10, padding:"10px 12px", fontSize:13, lineHeight:1.5 }}>
          {error}
        </div>
      )}
      {notice && !error && (
        <div style={{ color:C.gold, fontSize:13 }}>{notice}</div>
      )}

      {tab === "browse" ? (
        <div style={{ display:"grid", gap:10, overflowY:"auto" }}>
          {list.length === 0 && !error && (
            <div style={{ color:C.muted, fontSize:14 }}>No artisans yet.</div>
          )}
          {list.map((a) => (
            <div key={a.id} style={{ background:C.panel, border:`1px solid ${C.border}`,
              borderRadius:12, padding:14 }}>
              <div style={{ fontWeight:700 }}>{a.name}</div>
              <div style={{ color:C.gold, fontSize:13, fontWeight:600 }}>{a.trade}</div>
              {a.city && <div style={{ color:C.muted, fontSize:13 }}>{a.city}</div>}
              <a href={`tel:${a.phone}`} style={{ color:C.gold, fontSize:13, fontWeight:600 }}>
                {a.phone}
              </a>
            </div>
          ))}
        </div>
      ) : (
        <form onSubmit={submit} style={{ display:"grid", gap:12 }}>
          {["name", "trade", "city", "phone"].map((f) => (
            <input key={f} style={input} placeholder={f} value={form[f]}
              onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
          ))}
          <button type="submit" disabled={submitting} style={{ background:C.gold,
            color:C.goldFg, fontWeight:700, border:"none", borderRadius:10,
            padding:"12px 0", cursor:"pointer", opacity: submitting ? 0.7 : 1 }}>
            {submitting ? "Listing…" : "List me"}
          </button>
        </form>
      )}
    </div>
  );
}