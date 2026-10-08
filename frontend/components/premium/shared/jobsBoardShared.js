// jobsBoardShared.js — the small bits JobsBoard.js and JobDetail.js both
// need, pulled out instead of JobDetail importing straight from
// JobsBoard.js (which would make the two files import each other).

export const SOURCE_LABELS = { remotive: "Remotive", arbeitnow: "Arbeitnow", greenhouse: "Greenhouse", ashby: "Ashby", scrapegraphai: "company careers page" };

// Extracted straight off the employer's own site, which doesn't always
// expose a real per-listing link (client-side-routed job cards, no
// <a href>) the way an ATS API does — this source's `url` is always the
// company's real jobs LIST page, not a deep link to this specific posting.
export const SOURCES_WITHOUT_DIRECT_LINK = new Set(["scrapegraphai"]);

// `t` passed in, not read via useLanguage() — this is a plain function,
// not a component, so it can't call a hook itself. Same common.* keys
// Dashboard.js's own identical timeAgo reuses.
export function timeAgo(iso, t) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return t("common.today");
  if (days === 1) return t("common.yesterday");
  return t("common.daysAgo", { n: days });
}
