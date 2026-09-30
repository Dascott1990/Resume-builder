// quickActionArt.js — the illustrated-tile language applied to
// Dashboard.js's own QuickAction tiles (Auto Apply / CV Scan / Tracker)
// so the app's icon grids read as one consistent system instead of flat
// line icons.

function DocBolt({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <rect x="10" y="6" width="22" height="28" rx="2.5" fill="#b45309" />
      <rect x="14" y="12" width="14" height="2.2" fill="#fde8c8" />
      <rect x="14" y="17" width="14" height="2.2" fill="#fde8c8" />
      <rect x="14" y="22" width="9" height="2.2" fill="#fde8c8" />
      <path d="M30 22 20 34h6l-2 8 12-14h-6l2-6Z" fill="#fff" stroke="#b45309" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function DocScan({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <rect x="8" y="8" width="20" height="26" rx="2.5" fill="#1d4ed8" />
      <rect x="11.5" y="13.5" width="13" height="2.2" fill="#dbeafe" />
      <rect x="11.5" y="18" width="9" height="2.2" fill="#dbeafe" />
      <rect x="11.5" y="22.5" width="13" height="2.2" fill="#dbeafe" />
      <circle cx="31" cy="30" r="7" fill="none" stroke="#3b82f6" strokeWidth="3.4" />
      <line x1="35.6" y1="34.6" x2="41" y2="40" stroke="#3b82f6" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}

function Clipboard({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <rect x="10" y="8" width="28" height="34" rx="3" fill="#059669" />
      <rect x="17" y="4" width="14" height="8" rx="2" fill="#047857" />
      <rect x="14" y="19" width="20" height="2.4" rx="1.2" fill="#fff" />
      <rect x="14" y="25" width="20" height="2.4" rx="1.2" fill="#fff" />
      <path d="M15 32.5 19 36.5 27 28.5" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Buildings({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <rect x="6" y="18" width="14" height="24" fill="#3f3f46" />
      <rect x="22" y="8" width="20" height="34" fill="#52525b" />
      <rect x="10" y="23" width="3" height="3" fill="#e4e4e7" />
      <rect x="16" y="23" width="3" height="3" fill="#e4e4e7" />
      <rect x="10" y="30" width="3" height="3" fill="#e4e4e7" />
      <rect x="16" y="30" width="3" height="3" fill="#e4e4e7" />
      <rect x="27" y="14" width="3" height="3" fill="#e4e4e7" />
      <rect x="33" y="14" width="3" height="3" fill="#e4e4e7" />
      <rect x="27" y="21" width="3" height="3" fill="#e4e4e7" />
      <rect x="33" y="21" width="3" height="3" fill="#e4e4e7" />
      <rect x="27" y="28" width="3" height="3" fill="#e4e4e7" />
      <rect x="33" y="28" width="3" height="3" fill="#e4e4e7" />
    </svg>
  );
}

const AMBER_TILE = "linear-gradient(155deg,#fde8c8,#fbd9a0)";
const EMERALD_TILE = "linear-gradient(155deg,#d7f5e6,#b8ecd2)";
const BLUE_TILE = "linear-gradient(155deg,#dbeafe,#bfdcfa)";
const GRAY_TILE = "linear-gradient(155deg,#e4e4e7,#cfcfd4)";

export const QUICK_ACTION_ART = {
  apply: { bg: AMBER_TILE, Svg: DocBolt },
  scan: { bg: BLUE_TILE, Svg: DocScan },
  tracker: { bg: EMERALD_TILE, Svg: Clipboard },
  jobsboard: { bg: GRAY_TILE, Svg: Buildings },
};
