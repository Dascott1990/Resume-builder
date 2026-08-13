"use client";
/**
 * ArtisanMap.js — the real Leaflet map. This file (and only this file)
 * imports `leaflet`/`react-leaflet`, both of which touch `window`/`document`
 * at module scope and would break Next's SSR/prerender pass if imported
 * unguarded. It's only ever reached through ArtisanMapLoader.js's
 * next/dynamic({ ssr: false }) call — mirrors this codebase's existing
 * Logo3D.js → Logo3DScene.js pattern for the same class of problem.
 *
 * Markers are custom L.divIcons (not Leaflet's default marker image, which
 * breaks under webpack bundling) built from the exact same tintFor/
 * initialsOf helpers ArtisanCard uses, so a pin always matches its card.
 */
import { useEffect, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import { MapPin } from "lucide-react";
import { tintFor, initialsOf } from "../shared/artisanDisplay";
import { Btn } from "../guest/components/primitives";

function pinIcon(name) {
  return L.divIcon({
    className: "",
    html: `<div title="${(name || "").replace(/"/g, "&quot;")}" class="flex size-8 items-center justify-center rounded-full border-2 shadow-md font-mono text-[11px] font-bold ${tintFor(name || "?")} bg-background">${initialsOf(name || "?")}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

const YOU_ICON = L.divIcon({
  className: "",
  html: `<div class="flex size-6 items-center justify-center rounded-full border-2 border-primary bg-primary/15 shadow-md text-primary"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// react-leaflet's <MapContainer center/zoom> props are only the INITIAL
// view — they don't reactively re-center when the pinned set or nearMe
// change later (a trade filter narrowing results, geolocation resolving
// after mount, etc). This imperative helper is what actually keeps the
// view in sync with the data.
function FitBounds({ pinned, nearMe }) {
  const map = useMap();
  useEffect(() => {
    // animate: false — an animated pan/zoom spans multiple frames, during
    // which Leaflet repositions every attached layer on each tick; a
    // marker that's still mid-mount in the same effect flush (e.g. the
    // "you are here" pin appearing for the first time as nearMe resolves)
    // can get caught by that mid-animation without a _leaflet_pos yet. An
    // instant jump has no such window.
    if (nearMe) {
      map.setView([nearMe.lat, nearMe.lng], 12, { animate: false });
      return;
    }
    if (pinned.length === 1) {
      map.setView([pinned[0].lat, pinned[0].lng], 13, { animate: false });
      return;
    }
    if (pinned.length > 1) {
      map.fitBounds(L.latLngBounds(pinned.map((a) => [a.lat, a.lng])), { padding: [32, 32], maxZoom: 14, animate: false });
    }
  }, [pinned, nearMe, map]);
  return null;
}

function MapEmptyState() {
  return (
    <div className="grid h-full justify-items-center content-center gap-2.5 px-5 text-center">
      <div className="flex size-11 items-center justify-center rounded-full border border-border bg-card">
        <MapPin className="size-[18px] text-muted-foreground" />
      </div>
      <p className="m-0 text-sm font-bold text-foreground">No locations to show yet</p>
      <p className="m-0 max-w-[240px] text-[12.5px] leading-relaxed text-muted-foreground">
        None of these listings have a map location yet — try List view instead.
      </p>
    </div>
  );
}

export default function ArtisanMap({ artisans, nearMe, onOpenArtisan, hasMore, onLoadMore, loadingMore }) {
  const pinned = useMemo(() => (artisans || []).filter((a) => a.lat != null && a.lng != null), [artisans]);
  const unpinned = (artisans || []).length - pinned.length;

  if (pinned.length === 0) return <MapEmptyState />;

  // Initial center/zoom are placeholders — FitBounds takes over on mount
  // and every time the pinned set or nearMe changes.
  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-border">
      <MapContainer center={[pinned[0].lat, pinned[0].lng]} zoom={12} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pinned.map((a) => (
          <Marker
            key={a.id}
            position={[a.lat, a.lng]}
            icon={pinIcon(a.name)}
            eventHandlers={{ click: () => onOpenArtisan(a) }}
          />
        ))}
        {nearMe && <Marker position={[nearMe.lat, nearMe.lng]} icon={YOU_ICON} />}
        {/* Rendered LAST, not first: React fires sibling effects in render
            order, and this recenters imperatively via map.setView/fitBounds.
            Mounting it before the Markers above let a still-attaching
            marker (most reproducibly the "you are here" pin appearing for
            the first time when nearMe resolves) get caught mid-mount by
            Leaflet's view-reset repositioning pass, throwing on a layer
            that had no _leaflet_pos yet. Ordering the markers' own mount
            effects first avoids the race. */}
        <FitBounds pinned={pinned} nearMe={nearMe} />
      </MapContainer>

      {unpinned > 0 && (
        <div className="pointer-events-none absolute top-2 left-1/2 z-[400] -translate-x-1/2 rounded-full border border-border bg-card/95 px-2.5 py-1 font-mono text-[10px] tracking-[0.06em] text-muted-foreground/70 shadow-sm">
          {unpinned} listing{unpinned === 1 ? "" : "s"} without a location yet
        </div>
      )}

      {hasMore && (
        <div className="absolute bottom-2.5 left-1/2 z-[400] -translate-x-1/2">
          <Btn small variant="ghost" onClick={onLoadMore} loading={loadingMore} className="border border-border bg-card shadow-md">
            {loadingMore ? "Loading…" : "Load more"}
          </Btn>
        </div>
      )}
    </div>
  );
}
