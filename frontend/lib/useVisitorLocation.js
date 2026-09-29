import { useEffect, useState } from "react";
import { apiRequest } from "@/components/premium/shared/api";

// Best-effort visitor city from IP (backend/app/api/meta.py's GET
// /location, backed by app/utils/geoip.py) — used by the landing page's
// Hero and ArtisanTeaser to show where the visitor actually is, instead
// of a hardcoded "Ottawa." Noqeev's marketplace is Ottawa-only today, but
// the copy shouldn't assume that stays true — and this same visitor-city
// signal works unchanged once it isn't. Returns null until (if ever) a
// real city comes back; every caller already treats null as "don't show
// a location," never a broken placeholder.
export function useVisitorLocation() {
  const [location, setLocation] = useState(null);
  useEffect(() => {
    let cancelled = false;
    apiRequest("/api/v1/meta/location")
      .then((data) => { if (!cancelled && data?.city) setLocation(data); })
      .catch(() => { /* best-effort — no location shown is a fine fallback */ });
    return () => { cancelled = true; };
  }, []);
  return location;
}
