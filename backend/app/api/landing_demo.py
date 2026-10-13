"""
app/api/landing_demo.py
POST /api/v1/landing/demo-tailor — the public landing page's "see it
happen" live tailoring demo (components/premium/landing/SeeItHappenSection.js).

Deliberately its own tiny blueprint, not a route bolted onto resume.py:
this is marketing/demo surface, not real user resume management — no
auth, no get_scope, nothing ever persisted (a Media row per random
visitor's demo click would be pure noise, and this product's own stance
is "not to collect your data"). Reuses resume.py's real SYSTEM prompt,
PROMPT_TEMPLATE, _ai_complete, and _strip_empty_sections exactly as-is —
this calls the SAME AI pipeline every real tailoring feature uses, just
with a fixed demo candidate profile (so a visitor only has to paste/pick
a job posting, not fill out a form) and a trimmed token budget, because
no cheap non-AI matcher exists anywhere in this backend and a public,
unauthenticated demo still has to bound its own cost.
"""
import json

from flask import Blueprint, request, jsonify
from app import limiter
from app.middleware.error_handlers import APIError
from app.api.resume import SYSTEM, PROMPT_TEMPLATE, _ai_complete, _strip_empty_sections

landing_demo_bp = Blueprint("landing_demo", __name__)

# One fixed, generic-but-real candidate background — broad enough (cross-
# functional ops/program management: process, data, stakeholders) to
# tailor sensibly against almost any real job posting a visitor pastes,
# without needing a form. Never shown as-is; only its tailored-for-this-
# posting result is.
#
# Deliberately no invented person's name/email/phone here — "Jordan Rivera"
# read as a real, specific individual, not a placeholder, which this
# product's own stance (no fabricated people, no fake testimonials) rules
# out. "Your Name" etc. make it unambiguous this is a template standing in
# for the visitor, not someone who supposedly exists.
_DEMO_CANDIDATE = {
    "name": "Your Name",
    "title": "Program Manager",
    "location": "Your City",
    "email": "you@example.com",
    "phone": "(000) 000-0000",
    "background": "6 years leading cross-functional programs across product, operations, and customer success teams at B2B SaaS companies.",
    "experience": (
        "Program Manager, Northstar Analytics (2022-present): owned the roadmap for 3 concurrent "
        "product launches, cut average release cycle from 11 to 7 weeks by restructuring the sprint "
        "review process, and built the dashboard leadership now uses for weekly OKR check-ins. "
        "Operations Lead, Brightline Software (2019-2022): managed vendor contracts and onboarding "
        "for a 40-person support team, reduced new-hire ramp time by a third, ran monthly process "
        "audits that caught and fixed a recurring billing discrepancy worth $80k/year."
    ),
    "education": "B.A. Business Administration, University of Texas at Austin",
    "skills": "Project management, stakeholder communication, process improvement, data analysis, Jira, SQL basics, cross-functional leadership",
}

MIN_JOB_DESC_LENGTH = 50
MAX_JOB_DESC_LENGTH = 4000


@landing_demo_bp.route("/demo-tailor", methods=["POST"])
@limiter.limit("5 per hour")
def demo_tailor():
    body = request.get_json(force=True) or {}
    job_desc = (body.get("job_description") or "").strip()
    if len(job_desc) < MIN_JOB_DESC_LENGTH:
        raise APIError(f"job_description must be at least {MIN_JOB_DESC_LENGTH} characters", 400)
    job_desc = job_desc[:MAX_JOB_DESC_LENGTH]

    prompt = PROMPT_TEMPLATE.format(job_description=job_desc, **_DEMO_CANDIDATE)

    raw = _ai_complete(
        system=SYSTEM,
        prompt=prompt,
        effort="low",
        max_tokens=1200,
        groq_temperature=0.35,
    )

    clean = raw.replace("```json", "").replace("```", "").strip()
    try:
        parsed = _strip_empty_sections(json.loads(clean))
    except json.JSONDecodeError as e:
        raise APIError(f"AI returned invalid JSON: {str(e)}", 502)

    return jsonify({"success": True, "data": parsed}), 200
