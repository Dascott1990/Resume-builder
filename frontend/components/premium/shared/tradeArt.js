// tradeArt.js — small flat icon-illustrations for the Artisans browse
// screen's category shelves, one per POPULAR_TRADES entry (shared/
// trades.js). Deliberately not the app's usual lucide line icons: these
// are colored, two-tone pictograms on their own tinted tile (a wrench, a
// padlock, a little house-shaped roof), the same "graphic in a colored
// circle" language marketplace apps like Jiji use for their category
// grid, just drawn in Noqeev's own palette (emerald/amber, plus a couple
// of functional blues for water/HVAC/paint) rather than borrowed art. No
// real photography anywhere here on purpose — this session already
// learned that faking photography (or blurring it) reads worse than a
// clean illustration; simple flat shapes at this tile size read better
// than an attempt at something more detailed would.
//
// Each entry is { bg, Svg }: `bg` is the tile's own background gradient,
// `Svg` is a small function component taking just a `size` prop (a plain
// <svg>, not a lucide-style stroke icon, so it composes fine at any size
// without a currentColor dependency).

function Wrench({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path d="M30 8c4 0 7.5 3 8.4 7l-6 6-4-4 6-6c-1.4-.6-2.9-1-4.4-1a10 10 0 0 0-10 10c0 1 .1 2 .4 2.9L8 35c-1.7 1.7-1.7 4.3 0 6s4.3 1.7 6 0l12.4-12.4c.9.3 1.9.4 2.9.4a10 10 0 0 0 10-10c0-1.5-.4-3-1-4.4l-6 6-4-4 6-6c1.9-1 4-1.5 6.3-1.6-.2 0-.4 0-.6 0Z" fill="#b45309" />
      <circle cx="12" cy="39" r="2.4" fill="#fff" />
    </svg>
  );
}

function Bulb({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path d="M24 6a13 13 0 0 0-8 23.3c1.7 1.4 2.7 2.4 2.7 4.2V36h10.6v-2.5c0-1.8 1-2.8 2.7-4.2A13 13 0 0 0 24 6Z" fill="#059669" />
      <rect x="18.5" y="38" width="11" height="3.4" rx="1.4" fill="#059669" />
      <rect x="19.5" y="42.2" width="9" height="2.6" rx="1.2" fill="#059669" />
      <path d="M25.5 14 20 24h4l-1.5 8L29 20h-4l1.5-6Z" fill="#fff" />
    </svg>
  );
}

function Faucet({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path d="M10 14h10v6h8a6 6 0 0 1 6 6v2h-5v-2a1 1 0 0 0-1-1h-8v5h-5V20h-5v-6Z" fill="#1d4ed8" />
      <path d="M23 30c3.2 3.6 4.8 6.3 4.8 8.6a4.8 4.8 0 1 1-9.6 0c0-2.3 1.6-5 4.8-8.6Z" fill="#3b82f6" />
    </svg>
  );
}

function Fan({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="17" fill="#1d4ed8" />
      <g fill="#bfdbfe">
        <ellipse cx="24" cy="15" rx="4" ry="7" />
        <ellipse cx="24" cy="15" rx="4" ry="7" transform="rotate(120 24 24)" />
        <ellipse cx="24" cy="15" rx="4" ry="7" transform="rotate(240 24 24)" />
      </g>
      <circle cx="24" cy="24" r="3.5" fill="#fff" />
    </svg>
  );
}

function Square({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <rect x="10" y="10" width="8" height="28" rx="2" fill="#b45309" />
      <rect x="10" y="30" width="26" height="8" rx="2" fill="#b45309" />
      <rect x="13" y="13" width="2" height="14" fill="#fde8c8" />
      <rect x="21" y="33" width="12" height="2" fill="#fde8c8" />
    </svg>
  );
}

function Roller({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <rect x="10" y="10" width="20" height="12" rx="2.5" fill="#1d4ed8" />
      <rect x="22" y="21" width="4" height="8" fill="#64748b" />
      <rect x="19" y="28" width="10" height="14" rx="2" fill="#3b82f6" />
    </svg>
  );
}

function SprayBottle({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path d="M20 10h6v4h2a3 3 0 0 1 3 3v2l4-1 1 4-4 1v17a3 3 0 0 1-3 3H19a3 3 0 0 1-3-3V21a3 3 0 0 1 3-3h1v-4Z" fill="#059669" />
      <rect x="19" y="26" width="10" height="3" rx="1.2" fill="#fff" />
      <rect x="19" y="32" width="10" height="3" rx="1.2" fill="#fff" />
    </svg>
  );
}

function Tree({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path d="M24 6 14 22h6L11 34h10v8h6v-8h10L26 22h6L24 6Z" fill="#059669" />
    </svg>
  );
}

function Padlock({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path d="M16 20v-4a8 8 0 1 1 16 0v4" fill="none" stroke="#3f3f46" strokeWidth="4" />
      <rect x="11" y="20" width="26" height="20" rx="4" fill="#3f3f46" />
      <circle cx="24" cy="28" r="2.6" fill="#fff" />
      <rect x="22.8" y="29.5" width="2.4" height="6" rx="1.2" fill="#fff" />
    </svg>
  );
}

function HouseRoof({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path d="M24 6 40 20h-4v16H12V20H8Z" fill="#b45309" />
      <rect x="20" y="28" width="8" height="8" fill="#fde8c8" />
    </svg>
  );
}

function HardHat({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path d="M10 30a14 14 0 0 1 28 0Z" fill="#d97706" />
      <rect x="7" y="30" width="34" height="5" rx="2.5" fill="#b45309" />
      <rect x="21" y="12" width="6" height="10" rx="2" fill="#d97706" />
    </svg>
  );
}

function Box({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path d="M8 16 24 9l16 7-16 7-16-7Z" fill="#b45309" />
      <path d="M8 16v16l16 7V23L8 16Z" fill="#d97706" />
      <path d="M40 16v16l-16 7V23l16-7Z" fill="#92400e" />
    </svg>
  );
}

const AMBER_TILE = "linear-gradient(155deg,#fde8c8,#fbd9a0)";
const EMERALD_TILE = "linear-gradient(155deg,#d7f5e6,#b8ecd2)";
const BLUE_TILE = "linear-gradient(155deg,#dbeafe,#bfdcfa)";
const GRAY_TILE = "linear-gradient(155deg,#e4e4e7,#cfcfd4)";

export const TRADE_ART = {
  Handyman: { bg: AMBER_TILE, Svg: Wrench },
  Electrician: { bg: EMERALD_TILE, Svg: Bulb },
  Plumber: { bg: BLUE_TILE, Svg: Faucet },
  "HVAC Contractor": { bg: BLUE_TILE, Svg: Fan },
  Carpenter: { bg: AMBER_TILE, Svg: Square },
  Painter: { bg: BLUE_TILE, Svg: Roller },
  "Cleaning Company": { bg: EMERALD_TILE, Svg: SprayBottle },
  "Landscaping Company": { bg: EMERALD_TILE, Svg: Tree },
  Locksmith: { bg: GRAY_TILE, Svg: Padlock },
  "Roofing Specialist": { bg: AMBER_TILE, Svg: HouseRoof },
  "General Contractor": { bg: AMBER_TILE, Svg: HardHat },
  "Moving Company": { bg: AMBER_TILE, Svg: Box },
};

export function TradeTile({ trade, size = 72, onClick }) {
  const entry = TRADE_ART[trade];
  if (!entry) return null;
  const { bg, Svg } = entry;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 flex-col items-center gap-1.5 border-none bg-transparent p-0 [-webkit-tap-highlight-color:transparent]"
      style={{ width: size + 12 }}
    >
      <span
        className="flex items-center justify-center rounded-[20px] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.25)]"
        style={{ width: size, height: size, background: bg }}
      >
        <Svg size={Math.round(size * 0.53)} />
      </span>
      <span className="w-full text-center text-[11px] leading-tight font-bold break-words text-foreground">{trade}</span>
    </button>
  );
}
