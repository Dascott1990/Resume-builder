// dashboardArt.js — the remaining illustrated icons Dashboard.js needs
// beyond the three already in quickActionArt.js (Auto Apply/CV Scan/
// Tracker) — same flat, two-tone, colored-tile style throughout the app
// now, no bare line icons left standing next to it for the screen's
// actual content (nav items, the hero card, stat cards, notifications,
// recent activity). Pure UI chrome
// — chevrons, close buttons, overflow-menu dots, dropdown items — stays
// as plain lucide icons on purpose: those are interaction affordances,
// not content, and illustrating a ">" would just make it harder to read
// as "this is tappable."

function House({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path d="M24 6 40 20h-4v16H12V20H8Z" fill="#3f3f46" />
      <rect x="20" y="28" width="8" height="8" fill="#e4e4e7" />
    </svg>
  );
}

function Megaphone({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path d="M8 20v8l22 8V12Z" fill="#b45309" />
      <path d="M30 14v20l8 3V11Z" fill="#d97706" />
      <path d="M12 28v6a3 3 0 0 0 3 3h2a3 3 0 0 0 3-3v-4Z" fill="#78350f" />
    </svg>
  );
}

// Distinct from quickActionArt.js's DocScan (a magnifying glass, for
// scanning an existing resume) — this is BUILDING one, so a sparkle/pen
// accent instead, same document base shape for the family resemblance.
function ResumeSparkle({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <rect x="10" y="6" width="22" height="28" rx="2.5" fill="#b45309" />
      <rect x="14" y="12" width="14" height="2.2" fill="#fde8c8" />
      <rect x="14" y="17" width="14" height="2.2" fill="#fde8c8" />
      <rect x="14" y="22" width="9" height="2.2" fill="#fde8c8" />
      <path d="M35 26 l2.4 5 5 2.4-5 2.4-2.4 5-2.4-5-5-2.4 5-2.4Z" fill="#fff" />
    </svg>
  );
}

function Calendar({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <rect x="8" y="10" width="32" height="28" rx="3" fill="#059669" />
      <rect x="8" y="10" width="32" height="8" rx="3" fill="#047857" />
      <rect x="15" y="6" width="3" height="8" rx="1.5" fill="#047857" />
      <rect x="30" y="6" width="3" height="8" rx="1.5" fill="#047857" />
      <path d="M17 27 21 31 31 21" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BellArt({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path d="M24 8a10 10 0 0 0-10 10v6l-4 8h28l-4-8v-6A10 10 0 0 0 24 8Z" fill="#b45309" />
      <path d="M19 34a5 5 0 0 0 10 0Z" fill="#78350f" />
    </svg>
  );
}

// Simpler than a literal gear (a 12-tooth cog silhouette is a lot of path
// data to hand-author correctly) — a phone handset in a warm care-toned
// tile does the same "settings/account" job here and matches the senior-
// booking banner's own "someone will actually talk to you" spirit better
// anyway, since this only ever shows in the signed-out mobile header.
function Handset({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path d="M14 10c2-2 5-2 6 0l3 5c1 2 0 4-1 5l-2 2c1 4 4 7 8 8l2-2c1-1 3-2 5-1l5 3c2 1 2 4 0 6-3 3-8 4-13 2-8-3-15-10-18-18-2-5-1-10 2-13Z" fill="#059669" />
    </svg>
  );
}

function Care({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path d="M24 40s-16-9-16-20a9 9 0 0 1 16-5 9 9 0 0 1 16 5c0 11-16 20-16 20Z" fill="#b45309" />
    </svg>
  );
}

const AMBER_TILE = "linear-gradient(155deg,#fde8c8,#fbd9a0)";
const EMERALD_TILE = "linear-gradient(155deg,#d7f5e6,#b8ecd2)";
const GRAY_TILE = "linear-gradient(155deg,#e4e4e7,#cfcfd4)";

export const DASHBOARD_ART = {
  home: { bg: GRAY_TILE, Svg: House },
  news: { bg: AMBER_TILE, Svg: Megaphone },
  resume: { bg: AMBER_TILE, Svg: ResumeSparkle },
  interviews: { bg: EMERALD_TILE, Svg: Calendar },
  bell: { bg: AMBER_TILE, Svg: BellArt },
  handset: { bg: EMERALD_TILE, Svg: Handset },
  care: { bg: AMBER_TILE, Svg: Care },
};
