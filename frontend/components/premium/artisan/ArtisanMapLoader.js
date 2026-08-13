"use client";
/**
 * ArtisanMapLoader.js — lightweight wrapper around the heavy ArtisanMap.js.
 * This file has NO leaflet/react-leaflet imports at module scope, so it's
 * safe to import statically from Artisans.js; the actual Leaflet code only
 * ever loads via the next/dynamic call below (mirrors Logo3D.js).
 */
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const ArtisanMap = dynamic(() => import("./ArtisanMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-lg" />,
});

export default function ArtisanMapLoader(props) {
  return <ArtisanMap {...props} />;
}
