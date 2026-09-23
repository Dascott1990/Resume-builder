"use client";
/**
 * SeoStatus.js — the /brand toolkit's SEO zone: noqeev.com's own real
 * Search Console (clicks/impressions/avg. position) and Core Web Vitals
 * (CrUX p75 field data) history, backed by backend/app/api/admin.py's
 * /seo/* routes. Admin-gated (require_admin), unlike the rest of /brand's
 * workspace-token tools — this tracks the app's one fixed domain, not
 * anything per-workspace, so it reuses the same signed-in-admin identity
 * AdminDashboard.js already has rather than a workspace token.
 *
 * The connect button is a real top-level navigation (window.location.href
 * to /seo/oauth/start, so the browser can follow Google's consent-screen
 * redirect) — a fetch() can't do that, which is why the admin's token
 * rides along as ?token= instead of an Authorization header (see
 * app/utils/auth.py's get_admin_user).
 *
 * Trend lines are hand-rolled inline SVG, not a charting library — see
 * the dataviz skill's stat-tile contract: a de-emphasis-hue sparkline
 * with only the current point drawn in the accent color, direct-labeled
 * delta (color = direction × whether up is good for that metric, never
 * color alone — always paired with an arrow icon + "since" label).
 */
import { useEffect, useState, useCallback } from "react";
import { TrendingUp, TrendingDown, ExternalLink, RefreshCw, Loader2, Gauge } from "lucide-react";
import { apiRequest } from "@/components/premium/shared/api";
import { getToken } from "@/lib/authToken";

const BASE = process.env.NEXT_PUBLIC_API_URL;
const DAY_PRESETS = [30, 90, 180];

// Each metric: how to read it off a snapshot, how to format it, and
// whether a rising value is good news or bad news — the delta arrow and
// its color both come from this, never assumed uniformly.
const METRICS = [
  { key: "clicks", label: "Clicks", upIsGood: true, format: formatCompact },
  { key: "impressions", label: "Impressions", upIsGood: true, format: formatCompact },
  { key: "avg_position", label: "Avg. position", upIsGood: false, format: (n) => n.toFixed(1) },
  { key: "cwv_lcp_p75", label: "LCP (p75)", upIsGood: false, format: formatMs, needsCrux: true },
  { key: "cwv_cls_p75", label: "CLS (p75)", upIsGood: false, format: (n) => n.toFixed(3), needsCrux: true },
  { key: "cwv_inp_p75", label: "INP (p75)", upIsGood: false, format: formatMs, needsCrux: true },
];

function formatCompact(n) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function formatMs(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(2)}s` : `${Math.round(n)}ms`;
}

const SPARK_W = 300;
const SPARK_H = 64;
const SPARK_PAD = 6;

function Sparkline({ series, format }) {
  const [hover, setHover] = useState(null);
  const points = series.filter((p) => p.value != null);
  if (points.length < 2) {
    return (
      <div className="mt-2 flex h-12 items-center text-[11px] text-muted-foreground/60">
        Not enough data yet
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerW = SPARK_W - SPARK_PAD * 2;
  const innerH = SPARK_H - SPARK_PAD * 2;

  const coords = points.map((p, i) => ({
    x: SPARK_PAD + (i / (points.length - 1)) * innerW,
    y: SPARK_PAD + innerH - ((p.value - min) / span) * innerH,
    ...p,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(2)} ${SPARK_H - SPARK_PAD} L ${coords[0].x.toFixed(2)} ${SPARK_H - SPARK_PAD} Z`;
  const last = coords[coords.length - 1];
  const active = hover != null ? coords[hover] : null;

  function handleMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const x = ratio * SPARK_W;
    let nearest = 0;
    let best = Infinity;
    coords.forEach((c, i) => {
      const d = Math.abs(c.x - x);
      if (d < best) { best = d; nearest = i; }
    });
    setHover(nearest);
  }

  return (
    <div className="relative mt-2">
      <svg
        viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
        preserveAspectRatio="none"
        className="h-12 w-full cursor-crosshair"
        style={{ aspectRatio: `${SPARK_W} / ${SPARK_H}` }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="Trend over the selected date range"
      >
        <defs>
          <linearGradient id="seo-spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--muted-foreground)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--muted-foreground)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#seo-spark-fill)" stroke="none" />
        <path d={linePath} fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
        {active && (
          <line x1={active.x} x2={active.x} y1={SPARK_PAD} y2={SPARK_H - SPARK_PAD} stroke="var(--border)" strokeWidth="1" strokeDasharray="2 2" />
        )}
        <circle cx={last.x} cy={last.y} r="3.5" fill="var(--primary)" />
        {active && active !== last && (
          <circle cx={active.x} cy={active.y} r="3.5" fill="var(--primary)" />
        )}
      </svg>
      {active && (
        <div className="pointer-events-none absolute -top-6 rounded-md border border-border bg-card px-1.5 py-0.5 text-[10.5px] whitespace-nowrap text-foreground shadow-sm" style={{ left: `${(active.x / SPARK_W) * 100}%`, transform: "translateX(-50%)" }}>
          <span className="font-semibold">{format(active.value)}</span>
          <span className="ml-1 text-muted-foreground">{active.date.slice(5)}</span>
        </div>
      )}
    </div>
  );
}

function StatTile({ metric, snapshots, cruxConfigured }) {
  const series = snapshots.map((s) => ({ date: s.snapshot_date, value: s[metric.key] }));
  const points = series.filter((p) => p.value != null);

  if (metric.needsCrux && !cruxConfigured) {
    return (
      <div className="glass-surface rounded-xl p-4">
        <p className="m-0 text-[12px] font-medium text-muted-foreground">{metric.label}</p>
        <p className="m-0 mt-2 text-[11px] text-muted-foreground/60">CRUX_API_KEY not configured</p>
      </div>
    );
  }

  const latest = points.at(-1)?.value ?? null;
  const earliest = points[0]?.value ?? null;
  const hasDelta = points.length >= 2 && latest != null && earliest != null;
  const delta = hasDelta ? latest - earliest : null;
  const isGoodDelta = delta != null && (delta === 0 ? null : (delta > 0) === metric.upIsGood);

  return (
    <div className="glass-surface rounded-xl p-4">
      <p className="m-0 text-[12px] font-medium text-muted-foreground">{metric.label}</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <p className="m-0 text-[22px] font-bold text-foreground">{latest != null ? metric.format(latest) : "—"}</p>
        {hasDelta && delta !== 0 && (
          <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${isGoodDelta ? "text-success" : "text-destructive"}`}>
            {delta > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {metric.format(Math.abs(delta))}
          </span>
        )}
      </div>
      {hasDelta && (
        <p className="m-0 mt-0.5 text-[10.5px] text-muted-foreground/60">since {points[0].date.slice(5)}</p>
      )}
      <Sparkline series={series} format={metric.format} />
    </div>
  );
}

export function SeoStatus() {
  const [status, setStatus] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [days, setDays] = useState(90);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadStatus = useCallback(async () => {
    try {
      const data = await apiRequest("/api/v1/admin/seo/status");
      setStatus(data);
      setError("");
      return data;
    } catch (e) {
      setError(e.message || "Couldn't load SEO status.");
      return null;
    }
  }, []);

  const loadSnapshots = useCallback(async (rangeDays) => {
    try {
      const data = await apiRequest(`/api/v1/admin/seo/snapshots?days=${rangeDays}`);
      setSnapshots(data || []);
    } catch (e) {
      setError(e.message || "Couldn't load SEO history.");
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await loadStatus();
      if (data?.connected) await loadSnapshots(days);
      setLoading(false);
    })();
    // Only on mount — the day-range effect below handles re-fetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status?.connected) loadSnapshots(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  function handleConnect() {
    const token = getToken();
    const url = `${BASE}/api/v1/admin/seo/oauth/start${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    window.location.href = url;
  }

  async function handleRefreshNow() {
    setRefreshing(true);
    setError("");
    try {
      await apiRequest("/api/v1/admin/seo/refresh-now", { method: "POST" });
      await loadSnapshots(days);
    } catch (e) {
      setError(e.message || "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="glass-surface rounded-xl p-5 text-center">
        <p className="m-0 text-[13px] text-muted-foreground">{error}</p>
        <p className="m-0 mt-1 text-[11.5px] text-muted-foreground/60">Sign in with an admin account to view this.</p>
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <div className="glass-surface rounded-xl p-6 text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Gauge className="size-5" />
        </div>
        <p className="m-0 mt-3 text-[14.5px] font-bold text-foreground">Connect Google Search Console</p>
        <p className="m-0 mx-auto mt-1.5 max-w-[42ch] text-[12.5px] text-muted-foreground">
          Tracks noqeev.com's real search clicks, impressions, ranking position, and Core Web Vitals over time — once connected, a daily job keeps this up to date automatically.
        </p>
        <button
          onClick={handleConnect}
          className="mx-auto mt-4 flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-[13px] font-bold text-primary-foreground"
        >
          Connect <ExternalLink className="size-3.5" />
        </button>
        {error && <p className="m-0 mt-3 text-[11.5px] text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full border border-border bg-card p-1">
          {DAY_PRESETS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-full px-3 py-1 text-[11.5px] font-semibold ${days === d ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {d}d
            </button>
          ))}
        </div>
        <button
          onClick={handleRefreshNow}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11.5px] font-semibold text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh now
        </button>
      </div>

      {error && <p className="m-0 text-[11.5px] text-destructive">{error}</p>}

      {snapshots.length === 0 ? (
        <div className="glass-surface rounded-xl p-5 text-center text-[12.5px] text-muted-foreground">
          Connected — no snapshot yet. Click "Refresh now" to fetch the first one (the daily job otherwise runs automatically).
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {METRICS.map((metric) => (
            <StatTile key={metric.key} metric={metric} snapshots={snapshots} cruxConfigured={status.crux_configured} />
          ))}
        </div>
      )}

      <p className="m-0 text-[10.5px] text-muted-foreground/50">
        Connected {status.credential?.connected_by ? `by ${status.credential.connected_by}` : ""} · backlinks aren't available via any free API — tracked manually per the backlink strategy doc.
      </p>
    </div>
  );
}
