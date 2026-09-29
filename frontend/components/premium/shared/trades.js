// Single source of truth for the trade taxonomy — used by the directory's
// browse filter, the self-listing form, artisan account signup, and the
// customer "request a job" form. Keeping this in one place matters now in
// a way it didn't before: the backend's job-request matching (see
// backend/app/api/requests.py) compares a request's trade against an
// artisan's trade with a case-insensitive EXACT match, not a fuzzy one —
// two components picking their own slightly-different trade lists would
// silently break matching between them.
//
// Alphabetical, and deliberately broad — a real home-services directory's
// category list (the same shape TrustedPros/HomeStars use for the Ottawa
// market this app targets), not just the handful of trades that happened
// to come up first. Renamed from the original 10-item list: "HVAC" ->
// "HVAC Contractor", "Landscaper" -> "Landscaping Company", "Mover" ->
// "Moving Company", "Roofer" -> "Roofing Specialist" — anywhere else in
// the app that hardcoded one of those exact old strings (see
// ArtisanSeniorHelp.js's CHECKLIST_ISSUES) needs the same rename or its
// own exact-match query silently stops matching anyone.
export const TRADES = [
  "Appliance Repair Specialist", "Architect", "Bathroom Renovation Company", "Business Services",
  "Cabinet Maker", "Carpenter", "Cleaning Company", "Concrete Specialist",
  "Condominium/Apartment Specialist", "Countertops Specialist", "Demolition Company",
  "Drywall Specialist", "Electrician", "Excavation Specialist", "Fences & Gates Specialist",
  "Fireplace and BBQ Specialist", "Flooring Contractor", "Garage Specialist", "General Contractor",
  "Gutters & Eavestroughs Specialist", "Handyman", "Home Electronics Specialist", "Home Inspector",
  "HVAC Contractor", "Insulation Company", "Interior Decorator", "Interior Designer",
  "Junk Removal Specialist", "Kitchen Renovation Company", "Landscaping Company", "Locksmith",
  "Mason", "Metal Worker", "Mirrors & Glass Specialist", "Moving Company", "Painter",
  "Paving Contractor", "Pest Treatment Specialist", "Plasterer", "Plumber", "Pool Company",
  "Refrigeration Specialist", "Renewable Energy Specialist", "Roofing Specialist",
  "Security Specialist and Business Services", "Siding Specialist", "Stair Builder", "Tiler",
  "Upholsterer", "Window Contractor",
];

export const TRADES_WITH_ALL = ["All", ...TRADES];

// The curated subset CategoryGrid (Artisans.js's browse landing screen)
// shows as tappable icon tiles — the full 50-trade list rendered as icon
// tiles would be an overwhelming wall with no real icon for most of them.
// Everything else is still reachable: TradeChips (the results pane's own
// filter) and every Select dropdown already iterate the full TRADES list
// above, since both are scrollable controls built for an arbitrary-length
// list, not a fixed grid.
export const POPULAR_TRADES = [
  "Handyman", "Plumber", "Electrician", "HVAC Contractor", "Carpenter", "Painter",
  "Cleaning Company", "Landscaping Company", "Locksmith", "Roofing Specialist",
  "General Contractor", "Moving Company",
];
