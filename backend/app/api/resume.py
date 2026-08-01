"""
app/api/resume.py
POST /api/v1/resume/generate
POST /api/v1/resume/optimize
GET /api/v1/resume/saved
GET /api/v1/resume/<resume_id>
DELETE /api/v1/resume/<resume_id>
"""

import os
import json
import uuid
import requests
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from app import db
from app.middleware.error_handlers import APIError

resume_bp = Blueprint("resume", __name__)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"

def _groq(messages: list, temperature: float = 0.4, max_tokens: int = 2000) -> str:
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        raise APIError("GROQ_API_KEY not configured", 500)

    try:
        res = requests.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": GROQ_MODEL,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stream": False,
            },
            timeout=60,
        )

        if not res.ok:
            error_msg = f"Groq API error: HTTP {res.status_code}"
            try:
                error_data = res.json()
                if "error" in error_data:
                    error_msg = error_data["error"].get("message", error_msg)
            except:
                pass
            raise APIError(error_msg, 502)

        return res.json()["choices"][0]["message"]["content"].strip()

    except requests.exceptions.Timeout:
        raise APIError("AI generation timed out. Please try again.", 504)
    except requests.exceptions.RequestException as e:
        raise APIError(f"Network error while calling AI: {str(e)}", 502)

# System prompt
SYSTEM = """You are an elite ATS resume writer and cover letter strategist with 15 years of recruiting experience.
You produce clean, keyword-optimised resumes that pass ATS filters and impress human reviewers, and cover letters
that read like a specific human wrote them for a specific job — never templated, never generic.
You ground every claim in what the candidate actually provided and every detail in what the job posting actually says.
You always respond with ONLY valid JSON — no markdown fences, no explanation, no preamble."""

# Shared rule block: how to find the real job title inside the pasted posting,
# instead of just echoing back whatever the user typed into the "title" field.
TITLE_EXTRACTION_RULE = """TITLE EXTRACTION (do this first, before anything else):
- Read the JOB DESCRIPTION below in full, including any header or first paragraph.
- Find the job title AS WRITTEN by the employer. Look for patterns like "Job Title:", "Position:",
  "We're hiring a ___", a bolded/first-line role name, or the role name repeated most consistently
  through the posting.
- Use that exact title — word for word as the employer wrote it — everywhere a title is needed:
  contact.title, the resume summary, and (for the optimize task) the cover letter and its greeting.
- Only fall back to the candidate's stated target title ("{title}") if the job description genuinely
  contains no discernible title anywhere in the text."""

# Prompt templates
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

""" + TITLE_EXTRACTION_RULE + """

TASK:
1. Extract the 8-12 most important ATS keywords from the job description.
2. Identify the job location from the posting (city/state or remote).
3. Build a complete tailored resume using the exact title found above. Mirror the exact job title
   and location from the posting.

Return this exact JSON structure (no other text):
{{
  "keywords": ["keyword1", ...],
  "job_location": "City, State detected from posting or null",
  "contact": {{
    "name": "{name}",
    "title": "exact job title as written in the posting (see TITLE EXTRACTION rule above)",
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

""" + TITLE_EXTRACTION_RULE + """

COMPANY EXTRACTION:
- Also find the employer/company name from the posting if it's stated anywhere. If genuinely absent,
  use null — never invent one.

TASK:
Produce FOUR things in one pass, all tailored to this specific job posting:

1. A complete ATS-optimised resume (same rules as a standard tailored resume), using the exact
   title found above.

2. A SHORT, straight-to-the-point cover letter — not a template, not padded, no throat-clearing.
   Build it in this exact shape:
   - Opening (1 sentence): Name the exact job title and company (if found), plus one concrete
     detail from the posting that proves the candidate actually read it.
   - Body (1 short paragraph, 2-3 sentences MAX): Pick the SINGLE most important requirement
     from the posting and pair it directly with the candidate's strongest matching real
     experience — one clear, specific example. Do not try to cover multiple requirements.
   - Closing (1 sentence): Direct call to action. No "exciting opportunity" filler.
   - HARD LENGTH LIMIT: 120-150 words total, 3 short paragraphs. If it runs longer, cut it —
     shorter and sharper beats complete.
   - Greeting: "Dear Hiring Manager," unless the posting names a specific person.
   - Sign off with the candidate's actual name — no placeholder brackets like "[Your Name]".
   - BANNED phrases and close equivalents — do not use any of these or reword them into a
     near-synonym: "I am writing to express my interest", "I am confident that my skills and
     experience make me a strong candidate", "team player", "hard worker", "proven track record",
     "passionate about", "to whom it may concern", "I believe I would be a great fit",
     "detail-oriented", "results-driven professional".
     
3. Exactly 3 interview talking points — short, concrete stories/angles the candidate could
   bring up, grounded in their actual background/experience, relevant to this specific role.

4. How-to-apply detection: read the job description carefully for the ACTUAL way this
   employer wants applications submitted, then report exactly one of:
   - "email"   — the JD contains an application email address
   - "website" — the JD points to a careers page, ATS link, or company site
   - "unclear" — the JD gives no explicit application channel

Return this exact JSON structure (no other text, no markdown fences):
{{
  "keywords": ["keyword1", ...],
  "job_location": "City, State detected from posting or null",
  "contact": {{
    "name": "{name}",
    "title": "exact job title as written in the posting (see TITLE EXTRACTION rule above)",
    "company": "employer name found in the posting, or null",
    "email": "{email}",
    "phone": "{phone}",
    "location": "job location if found, else user location"
  }},
  "sections": [
    {{ "id": "summary", "label": "Professional Summary", "type": "text", "content": "..." }},
    {{ "id": "skills", "label": "Core Competencies", "type": "bullets", "items": ["..."] }},
    {{ "id": "experience", "label": "Experience", "type": "jobs", "jobs": [
        {{ "role": "...", "company": "...", "period": "...", "location": "...", "bullets": ["..."] }}
    ] }},
    {{ "id": "education", "label": "Education", "type": "education", "degrees": [
        {{ "degree": "...", "school": "...", "location": "...", "period": "..." }}
    ] }}
  ],
  "cover_letter": "full cover letter text as one string with \\n\\n between paragraphs",
  "interview_tips": ["tip 1", "tip 2", "tip 3"],
  "application": {{
    "method": "email | website | unclear",
    "value": "the exact email address or URL found in the JD, else null",
    "instructions": "One direct sentence telling the candidate exactly how to apply"
  }}
}}

Rules:
- Do NOT invent companies, degrees, or achievements.
- Every resume bullet starts with a strong past-tense action verb.
- Weave at least 6 keywords from the JD naturally into the resume body.
- The cover letter must sound like a real person wrote it, follow the shape specified above, and
  avoid every banned phrase listed above.
- Return ONLY the JSON object."""

@resume_bp.route("/generate", methods=["POST"])
def generate_resume():
    """Generate a tailored resume from user info and job description."""
    body = request.get_json(force=True)

    info = body.get("user_info", {})
    job_desc = (body.get("job_description") or "").strip()

    if not job_desc or len(job_desc) < 50:
        raise APIError("job_description must be at least 50 characters", 400)
    if not info.get("name") or not info.get("title"):
        raise APIError("user_info.name and user_info.title are required", 400)

    # Truncate job description to avoid token overflow
    job_desc_truncated = job_desc[:4000]

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
        job_description=job_desc_truncated,
    )

    raw = _groq(
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": prompt},
        ],
        temperature=0.35,
        max_tokens=2000,
    )

    # Strip markdown fences
    clean = raw.replace("```json", "").replace("```", "").strip()

    try:
        parsed = json.loads(clean)
    except json.JSONDecodeError as e:
        print(f"❌ JSON parse error: {e}")
        print(f"Raw response: {raw[:500]}")
        raise APIError(f"AI returned invalid JSON: {str(e)}", 502)

    # Persist to database
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
                "user_name": info.get("name"),
                "user_email": info.get("email"),
                "target_role": parsed.get("contact", {}).get("title"),
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "keywords": parsed.get("keywords", []),
            },
        )
        db.session.add(record)
        db.session.commit()
        parsed["saved_id"] = record.id
    except Exception as e:
        print(f"⚠️ Could not save to database: {e}")
        parsed["saved_id"] = None

    return jsonify({"success": True, "data": parsed}), 201

@resume_bp.route("/optimize", methods=["POST"])
def optimize_resume():
    """One-click: tailored resume + cover letter + interview tips."""
    body = request.get_json(force=True)

    info = body.get("user_info", {})
    job_desc = (body.get("job_description") or "").strip()

    if not job_desc or len(job_desc) < 50:
        raise APIError("job_description must be at least 50 characters", 400)
    if not info.get("name") or not info.get("title"):
        raise APIError("user_info.name and user_info.title are required", 400)

    job_desc_truncated = job_desc[:4000]

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
        job_description=job_desc_truncated,
    )

    raw = _groq(
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": prompt},
        ],
        temperature=0.5,
        max_tokens=3000,
    )

    clean = raw.replace("```json", "").replace("```", "").strip()

    try:
        parsed = json.loads(clean)
    except json.JSONDecodeError as e:
        print(f"❌ JSON parse error: {e}")
        print(f"Raw response: {raw[:500]}")
        raise APIError(f"AI returned invalid JSON: {str(e)}", 502)

    # Persist to database
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
                "user_name": info.get("name"),
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
    except Exception as e:
        print(f"⚠️ Could not save to database: {e}")
        parsed["saved_id"] = None

    return jsonify({"success": True, "data": parsed}), 201

@resume_bp.route("/saved", methods=["GET"])
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
    return jsonify({"success": True, "data": results}), 200

@resume_bp.route("/<resume_id>", methods=["GET"])
def get_saved(resume_id):
    """Re-load a previously generated resume."""
    from app.models import Media
    record = Media.query.filter_by(
        id=resume_id,
        filter_name="guest_resume",
        is_deleted=False
    ).first()

    if not record or not record.file_data:
        raise APIError("Resume not found", 404)

    try:
        data = json.loads(record.file_data)
        return jsonify({"success": True, "data": data}), 200
    except json.JSONDecodeError:
        raise APIError("Stored resume data is corrupted", 500)

@resume_bp.route("/<resume_id>", methods=["DELETE"])
def delete_saved(resume_id):
    """Soft delete a saved resume."""
    from app.models import Media
    record = Media.query.filter_by(
        id=resume_id,
        filter_name="guest_resume"
    ).first()

    if record:
        record.is_deleted = True
        db.session.commit()
        return jsonify({"success": True}), 200

    return jsonify({"success": False, "error": "Resume not found"}), 404