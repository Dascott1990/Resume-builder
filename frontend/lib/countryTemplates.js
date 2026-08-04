// Which resume template matches which country, and what that country's flag
// looks like — the single source both the auto-select logic and the 3D flag
// scene read from, so they can never drift out of sync with each other.
export const COUNTRY_TEMPLATE_MAP = {
  CA: "it",
  US: "usa",
  GB: "uk",
  DE: "germany",
  FR: "france",
  NG: "africa",
  GH: "africa",
};

export const COUNTRY_NAMES = {
  CA: "Canada",
  US: "the United States",
  GB: "the United Kingdom",
  DE: "Germany",
  FR: "France",
  NG: "Nigeria",
  GH: "Ghana",
};

// A handful of IANA timezones per supported country — used when there's no
// server-side geo header to read (local dev, or hosting that isn't Vercel).
// Not exhaustive, just enough to cover the common case for each country we
// actually have a template for.
const TIMEZONE_COUNTRY_MAP = {
  "America/Toronto": "CA", "America/Vancouver": "CA", "America/Edmonton": "CA",
  "America/Winnipeg": "CA", "America/Halifax": "CA", "America/St_Johns": "CA",
  "America/Regina": "CA",
  "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US",
  "America/Los_Angeles": "US", "America/Anchorage": "US", "Pacific/Honolulu": "US",
  "America/Phoenix": "US",
  "Europe/London": "GB",
  "Europe/Berlin": "DE",
  "Europe/Paris": "FR",
  "Africa/Lagos": "NG",
  "Africa/Accra": "GH",
};

const LOCALE_COUNTRY_MAP = {
  "en-CA": "CA", "fr-CA": "CA",
  "en-US": "US",
  "en-GB": "GB",
  "de-DE": "DE",
  "fr-FR": "FR",
  "en-NG": "NG",
  "en-GH": "GH",
};

export function guessCountryFromBrowser() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_COUNTRY_MAP[tz]) return TIMEZONE_COUNTRY_MAP[tz];
  } catch { /* Intl unsupported — fall through */ }
  try {
    const locale = navigator.language;
    if (locale && LOCALE_COUNTRY_MAP[locale]) return LOCALE_COUNTRY_MAP[locale];
  } catch { /* navigator unavailable (shouldn't happen client-side) */ }
  return null;
}

export function templateForCountry(countryCode) {
  return COUNTRY_TEMPLATE_MAP[countryCode] || "it";
}
