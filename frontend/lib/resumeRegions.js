"use client";
import { useState, useEffect } from "react";
import { apiRequest } from "@/components/premium/shared/api";

// lib/resumeRegions.js — the same honest, already-proven country grouping
// backend/app/api/resume.py's own LOCATION_CONVENTIONS_RULE/
// SCAN_LOCATION_CONVENTIONS_RULE use for AI-tailored resumes (US/Canada,
// UK/Commonwealth, Continental Europe, default), extended here to decide
// page size (A4 vs Letter) and the Resume/CV label the Templates gallery
// shows — not a new, invented set of regional rules, the same real
// distinction this app already makes, just driving a gallery default
// instead of a prompt instruction. Deliberately does NOT vary which
// accent colors/fonts are offered by region — there's no real basis for
// "this color is popular in your country," only for genuine document
// conventions like these.
export const REGIONS = {
  us_ca: { id: "us_ca", label: "United States & Canada", docLabel: "Resume", pageSize: "letter" },
  uk_commonwealth: { id: "uk_commonwealth", label: "UK & Commonwealth", docLabel: "CV", pageSize: "a4" },
  continental_europe: { id: "continental_europe", label: "Continental Europe", docLabel: "CV", pageSize: "a4" },
  default: { id: "default", label: "Other regions", docLabel: "Resume", pageSize: "letter" },
};

export const REGION_LIST = [
  REGIONS.us_ca,
  REGIONS.uk_commonwealth,
  REGIONS.continental_europe,
  REGIONS.default,
];

// Real ISO 3166-1 alpha-2 codes for each group — same named countries as
// the backend's own prompt rules (US/Canada; UK/Ireland/Nigeria/Ghana and
// other real Commonwealth-convention countries; Germany/France and other
// continental European countries), expanded to the actual country set
// each of those categories genuinely covers.
const COUNTRY_TO_REGION = {
  US: "us_ca", CA: "us_ca",
  GB: "uk_commonwealth", IE: "uk_commonwealth", NG: "uk_commonwealth", GH: "uk_commonwealth",
  AU: "uk_commonwealth", NZ: "uk_commonwealth", ZA: "uk_commonwealth", IN: "uk_commonwealth",
  PK: "uk_commonwealth", BD: "uk_commonwealth", KE: "uk_commonwealth", UG: "uk_commonwealth",
  TZ: "uk_commonwealth", ZM: "uk_commonwealth", ZW: "uk_commonwealth", MY: "uk_commonwealth",
  SG: "uk_commonwealth", HK: "uk_commonwealth",
  DE: "continental_europe", FR: "continental_europe", ES: "continental_europe", IT: "continental_europe",
  NL: "continental_europe", BE: "continental_europe", PT: "continental_europe", AT: "continental_europe",
  CH: "continental_europe", PL: "continental_europe", SE: "continental_europe", NO: "continental_europe",
  DK: "continental_europe", FI: "continental_europe",
};

export function regionForCountryCode(code) {
  if (!code) return REGIONS.default;
  return REGIONS[COUNTRY_TO_REGION[code.toUpperCase()]] || REGIONS.default;
}

// A dedicated hook rather than reusing lib/useVisitorLocation.js: that
// hook only ever sets state when data.city resolved, which silently drops
// exactly the case that matters most here — CF-IPCountry resolving a real
// country_code with no city alongside it (common; city needs the heavier
// ip-api.com lookup, country doesn't). This gates on country_code itself.
export function useDetectedRegion() {
  const [region, setRegion] = useState(null);
  useEffect(() => {
    let cancelled = false;
    apiRequest("/api/v1/meta/location")
      .then((data) => {
        if (!cancelled && data?.country_code) setRegion(regionForCountryCode(data.country_code));
      })
      .catch(() => { /* best-effort — default region is a fine fallback */ });
    return () => { cancelled = true; };
  }, []);
  return region; // null until resolved (or never) — callers fall back to REGIONS.default
}
