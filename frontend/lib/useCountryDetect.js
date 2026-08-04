"use client";
import { useEffect, useState } from "react";
import { guessCountryFromBrowser, templateForCountry } from "./countryTemplates";

// Server geo header first (accurate, works on Vercel in production) — falls
// back to a client-side timezone/locale guess when that's unavailable (any
// local dev, or hosting without the header). Either way this never phones
// home to a third-party geolocation service — no IP address leaves this
// app's own request path.
export function useCountryDetect() {
  const [countryCode, setCountryCode] = useState(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let code = null;
      try {
        const res = await fetch("/api/geo");
        const data = await res.json();
        code = data?.country || null;
      } catch { /* route unreachable — fall back below */ }
      if (!code) code = guessCountryFromBrowser();
      if (!cancelled) {
        setCountryCode(code);
        setResolved(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { countryCode, templateKey: countryCode ? templateForCountry(countryCode) : null, resolved };
}
