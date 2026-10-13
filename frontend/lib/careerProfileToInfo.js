// lib/careerProfileToInfo.js — turns a real, human-confirmed CareerProfile
// (backend/app/models.py — "verified memory" the Apply-with-AI agent
// trusts, GET /api/v1/apply/profile) into the plain free-text shape
// GuestMode's own step-1 form fields expect (name/title/location/email/
// phone/background/experience/education/skills — see guest/constants.js's
// EMPTY_INFO). Every value below is either a direct real field or a
// straightforward reformatting of one (e.g. "role at company (period)"
// from work_history's own real fields) — nothing here is invented.
//
// `background` has no real source: CareerProfile has no narrative
// "about yourself" field, only structured work_history/education/skills,
// so it's deliberately left blank rather than synthesizing one — same
// "never fabricate" line this app holds everywhere else.
//
// `title` has no direct field either, but a real, legitimate one exists:
// the role on the most recent work_history entry (index 0 — same
// most-recent-first order the agent itself already relies on).
export function mapCareerProfileToInfo(profile) {
  if (!profile) return null;

  const workHistory = profile.work_history || [];
  const education = profile.education || [];
  const skills = profile.skills || [];

  const title = workHistory[0]?.role || "";

  const experience = workHistory
    .map((job) => {
      const head = [job.role, job.company].filter(Boolean).join(" at ");
      const period = job.period ? ` (${job.period})` : "";
      const bullets = (job.bullets || []).join("; ");
      return [head + period, bullets].filter(Boolean).join(": ");
    })
    .filter(Boolean)
    .join("\n");

  const educationText = education
    .map((deg) => {
      const head = [deg.degree, deg.school].filter(Boolean).join(", ");
      const period = deg.period ? ` (${deg.period})` : "";
      return head + period;
    })
    .filter(Boolean)
    .join("\n");

  return {
    name: profile.full_name || "",
    title,
    location: profile.location || "",
    email: profile.email || "",
    phone: profile.phone || "",
    background: "",
    experience,
    education: educationText,
    skills: skills.join(", "),
  };
}
