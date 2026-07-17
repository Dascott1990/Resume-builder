"""
app/api/resume.py
─────────────────────────────────────────────────────────────────────────────
POST /api/v1/resume/generate
  Body: { user_info: {...}, job_description: "..." }
  Returns: { resume: {...}, keywords: [...] }

Uses Groq (llama-3.3-70b-versatile) — fast, free, structured JSON output.
Saves generated resume to DB via Media table (repurposed as document store).
"""

import os
import json
import uuid
import requests
from datetime import datetime, timezone
from flask import Blueprint, request
from app import db
from app.utils.response import success, created
from app.middleware.error_handlers import APIError

resume_bp = Blueprint("resume", __name__)

GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"


def _groq(messages: list, temperature: float = 0.4, max_tokens: int = 2000) -> str:
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        raise APIError("GROQ_API_KEY not configured", 500)

    res = requests.post(
        GROQ_URL,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"model": GROQ_MODEL, "messages": messages, "max_tokens": max_tokens,
              "temperature": temperature, "stream": False},
        timeout=60,
    )
    if not res.ok:
        try:
            err = res.json().get("error", {}).get("message", f"HTTP {res.status_code}")
        except Exception:
            err = f"Groq HTTP {res.status_code}"
        raise APIError(f"AI generation failed: {err}", 502)

    return res.json()["choices"][0]["message"]["content"].strip()


SYSTEM = """You are an elite ATS resume writer with 15 years of recruiting experience.
You produce clean, keyword-optimised resumes that pass ATS filters and impress human reviewers.
You always respond with ONLY valid JSON — no markdown fences, no explanation, no preamble."""

PROMPT_TEMPLATE = """USER INFO:
Name: {name}
Target Title: {title}
Location: {location}
Email: {email}
Phone: {phone}
Background: {background}
Past Experience: {experience}
Education: {education}
Skills: {skills}

JOB DESCRIPTION:
{job_description}

TASK:
1. Extract the 8-12 most important ATS keywords from the job description.
2. Identify the job location from the posting (city/state or remote).
3. Build a complete tailored resume. Mirror the exact job title and location from the posting.

Return this exact JSON structure (no other text):
{{
  "keywords": ["keyword1", ...],
  "job_location": "City, State detected from posting or null",
  "contact": {{
    "name": "{name}",
    "title": "exact job title from posting",
    "email": "{email}",
    "phone": "{phone}",
    "location": "job location if found, else user location"
  }},
  "sections": [
    {{
      "id": "summary",
      "label": "Professional Summary",
      "type": "text",
      "content": "3-sentence punchy summary packed with top keywords from the JD. First sentence = who you are + years experience. Second = key skills matching the role. Third = value you bring."
    }},
    {{
      "id": "skills",
      "label": "Core Competencies",
      "type": "bullets",
      "items": ["skill matching JD keyword", "..."]
    }},
    {{
      "id": "experience",
      "label": "Experience",
      "type": "jobs",
      "jobs": [
        {{
          "role": "job title",
          "company": "company name",
          "period": "start – end",
          "location": "city, province/state",
          "bullets": [
            "Strong action verb + task + result using JD keywords",
            "..."
          ]
        }}
      ]
    }},
    {{
      "id": "education",
      "label": "Education",
      "type": "education",
      "degrees": [
        {{ "degree": "string", "school": "string", "location": "string", "period": "string" }}
      ]
    }}
  ]
}}

Rules:
- Location in contact MUST match the job posting city/region if one is found.
- Every bullet starts with a strong past-tense action verb (Delivered, Led, Resolved, Optimised...).
- Weave at least 6 keywords from the JD naturally into the body.
- Keep bullets to one line, quantified where possible.
- Do NOT invent companies or degrees. Use exactly what the user provided.
- Return ONLY the JSON object."""


@resume_bp.post("/generate")
def generate_resume():
    body = request.get_json(force=True)

    info = body.get("user_info", {})
    job_desc = (body.get("job_description") or "").strip()

    if not job_desc or len(job_desc) < 50:
        raise APIError("job_description must be at least 50 characters", 400)
    if not info.get("name") or not info.get("title"):
        raise APIError("user_info.name and user_info.title are required", 400)

    prompt = PROMPT_TEMPLATE.format(
        name=info.get("name", ""),
        title=info.get("title", ""),
        location=info.get("location", ""),
        email=info.get("email", ""),
        phone=info.get("phone", ""),
        background=info.get("background") or "Not provided",
        experience=info.get("experience") or "Not provided",
        education=info.get("education") or "Not provided",
        skills=info.get("skills") or "Not provided",
        job_description=job_desc[:4000],  # cap to avoid token overflow
    )

    raw = _groq(
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user",   "content": prompt},
        ],
        temperature=0.35,
        max_tokens=2000,
    )

    # Strip accidental markdown fences
    clean = raw.replace("```json", "").replace("```", "").strip()
    try:
        parsed = json.loads(clean)
    except json.JSONDecodeError as e:
        raise APIError(f"AI returned invalid JSON: {e}", 502)

    # ── Persist to DB as a JSON document (Media table repurposed) ────────────
    try:
        from app.models import Media
        doc_bytes = json.dumps(parsed).encode()
        record = Media(
            filename=f"resume_{uuid.uuid4().hex[:8]}.json",
            media_type="document",
            mime_type="application/json",
            file_data=doc_bytes,
            file_size=len(doc_bytes),
            caption=f"{info.get('name')} — {parsed.get('contact', {}).get('title', info.get('title'))}",
            filter_name="guest_resume",
            metadata_json={
                "user_name":  info.get("name"),
                "user_email": info.get("email"),
                "target_role": parsed.get("contact", {}).get("title"),
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "keywords": parsed.get("keywords", []),
            },
        )
        db.session.add(record)
        db.session.commit()
        parsed["saved_id"] = record.id
    except Exception:
        # Save failure is non-fatal — still return the resume
        parsed["saved_id"] = None

    return created(parsed, "Resume generated")


OPTIMIZE_PROMPT_TEMPLATE = """USER INFO:
Name: {name}
Target Title: {title}
Location: {location}
Email: {email}
Phone: {phone}
Background: {background}
Past Experience: {experience}
Education: {education}
Skills: {skills}

JOB DESCRIPTION:
{job_description}

TASK:
Produce THREE things in one pass, all tailored to this specific job posting:
1. A complete ATS-optimised resume (same rules as a standard tailored resume).
2. A concise, specific cover letter (3-4 short paragraphs, no generic filler, references
   1-2 concrete details from the job description, matches the candidate's real background).
3. Exactly 3 interview talking points — short, concrete stories/angles the candidate could
   bring up, grounded in their actual background/experience, relevant to this role.

Return this exact JSON structure (no other text, no markdown fences):
{{
  "keywords": ["keyword1", ...],
  "job_location": "City, State detected from posting or null",
  "contact": {{
    "name": "{name}",
    "title": "exact job title from posting",
    "email": "{email}",
    "phone": "{phone}",
    "location": "job location if found, else user location"
  }},
  "sections": [
    {{ "id": "summary", "label": "Professional Summary", "type": "text", "content": "..." }},
    {{ "id": "skills", "label": "Core Competencies", "type": "bullets", "items": ["...", "..."] }},
    {{ "id": "experience", "label": "Experience", "type": "jobs", "jobs": [
        {{ "role": "...", "company": "...", "period": "...", "location": "...", "bullets": ["...", "..."] }}
    ] }},
    {{ "id": "education", "label": "Education", "type": "education", "degrees": [
        {{ "degree": "...", "school": "...", "location": "...", "period": "..." }}
    ] }}
  ],
  "cover_letter": "full cover letter text as one string with \\n\\n between paragraphs",
  "interview_tips": ["tip 1", "tip 2", "tip 3"]
}}

Rules:
- Do NOT invent companies, degrees, or achievements. Use exactly what the user provided.
- Every resume bullet starts with a strong past-tense action verb.
- Weave at least 6 keywords from the JD naturally into the resume body.
- The cover letter must sound like a real person wrote it, not a template. No "I am writing to express my interest" openers.
- Return ONLY the JSON object."""


@resume_bp.post("/optimize")
def optimize_resume():
    """One-click: tailored resume + cover letter + interview tips, single Groq call."""
    body = request.get_json(force=True)

    info = body.get("user_info", {})
    job_desc = (body.get("job_description") or "").strip()

    if not job_desc or len(job_desc) < 50:
        raise APIError("job_description must be at least 50 characters", 400)
    if not info.get("name") or not info.get("title"):
        raise APIError("user_info.name and user_info.title are required", 400)

    prompt = OPTIMIZE_PROMPT_TEMPLATE.format(
        name=info.get("name", ""),
        title=info.get("title", ""),
        location=info.get("location", ""),
        email=info.get("email", ""),
        phone=info.get("phone", ""),
        background=info.get("background") or "Not provided",
        experience=info.get("experience") or "Not provided",
        education=info.get("education") or "Not provided",
        skills=info.get("skills") or "Not provided",
        job_description=job_desc[:4000],
    )

    raw = _groq(
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user",   "content": prompt},
        ],
        temperature=0.35,
        max_tokens=2800,  # bigger cap — resume + cover letter + tips in one response
    )

    clean = raw.replace("```json", "").replace("```", "").strip()
    try:
        parsed = json.loads(clean)
    except json.JSONDecodeError as e:
        raise APIError(f"AI returned invalid JSON: {e}", 502)

    # ── Persist to DB (same Media-as-document-store pattern as /generate) ────
    try:
        from app.models import Media
        doc_bytes = json.dumps(parsed).encode()
        record = Media(
            filename=f"resume_{uuid.uuid4().hex[:8]}.json",
            media_type="document",
            mime_type="application/json",
            file_data=doc_bytes,
            file_size=len(doc_bytes),
            caption=f"{info.get('name')} — {parsed.get('contact', {}).get('title', info.get('title'))}",
            filter_name="guest_resume",
            metadata_json={
                "user_name":  info.get("name"),
                "user_email": info.get("email"),
                "target_role": parsed.get("contact", {}).get("title"),
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "keywords": parsed.get("keywords", []),
                "optimized": True,
            },
        )
        db.session.add(record)
        db.session.commit()
        parsed["saved_id"] = record.id
    except Exception:
        parsed["saved_id"] = None

    return created(parsed, "Resume optimized")


@resume_bp.get("/saved")
def list_saved():
    """Return all guest resumes saved to DB."""
    from app.models import Media
    records = (
        Media.query
        .filter_by(filter_name="guest_resume", is_deleted=False)
        .order_by(Media.created_at.desc())
        .limit(20)
        .all()
    )
    results = []
    for r in records:
        meta = r.metadata_json or {}
        results.append({
            "id": r.id,
            "name": meta.get("user_name"),
            "role": meta.get("target_role"),
            "generated_at": r.created_at.isoformat() if r.created_at else None,
            "keywords": meta.get("keywords", []),
        })
    return success(results)


@resume_bp.get("/<resume_id>")
def get_saved(resume_id):
    """Re-load a previously generated resume."""
    from app.models import Media
    record = Media.query.filter_by(id=resume_id, filter_name="guest_resume", is_deleted=False).first()
    if not record or not record.file_data:
        raise APIError("Resume not found", 404)
    return success(json.loads(record.file_data))


@resume_bp.delete("/<resume_id>")
def delete_saved(resume_id):
    from app.models import Media
    from app.utils.response import no_content
    record = Media.query.filter_by(id=resume_id, filter_name="guest_resume").first()
    if record:
        record.is_deleted = True
        db.session.commit()
    return no_content()