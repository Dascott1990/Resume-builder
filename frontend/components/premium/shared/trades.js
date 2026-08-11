// Single source of truth for the trade taxonomy — used by the directory's
// browse filter, the self-listing form, artisan account signup, and the
// customer "request a job" form. Keeping this in one place matters now in
// a way it didn't before: the backend's job-request matching (see
// backend/app/api/requests.py) compares a request's trade against an
// artisan's trade with a case-insensitive EXACT match, not a fuzzy one —
// two components picking their own slightly-different trade lists would
// silently break matching between them.
export const TRADES = ["Carpenter", "Electrician", "Handyman", "HVAC", "Landscaper",
  "Mason", "Mover", "Painter", "Plumber", "Roofer"];

export const TRADES_WITH_ALL = ["All", ...TRADES];
