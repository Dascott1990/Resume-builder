"""
app/api/resume.py
POST /api/v1/resume/generate
POST /api/v1/resume/optimize
GET /api/v1/resume/saved
GET /api/v1/resume/<resume_id>
DELETE /api/v1/resume/<resume_id>
"""

import os
import io
import json
import uuid
import anthropic
import requests
from pypdf import PdfReader
from docx import Document
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from app import db, limiter
from app.middleware.error_handlers import APIError
from app.utils.auth import get_scope

resume_bp = Blueprint("resume", __name__)

CLAUDE_MODEL = "claude-opus-5"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "openai/gpt-oss-120b"

def _claude(messages: list, system: str, effort: str = "medium", max_tokens: int = 2000) -> str:
    api_key = os.environ.get("CLAUDE_API_KEY", "")
    if not api_key:
        raise APIError("CLAUDE_API_KEY not configured", 500)

    client = anthropic.Anthropic(api_key=api_key)

    try:
        res = client.with_options(timeout=60).messages.create(
            model=CLAUDE_MODEL,
            system=system,
            messages=messages,
            max_tokens=max_tokens,
            output_config={"effort": effort},
        )

        if res.stop_reason == "refusal":
            raise APIError("AI declined to generate this content", 502)

        text = next((b.text for b in res.content if b.type == "text"), None)
        if text is None:
            raise APIError("AI returned no text content", 502)
        return text.strip()

    except anthropic.APITimeoutError:
        raise APIError("AI generation timed out. Please try again.", 504)
    except anthropic.APIStatusError as e:
        error_msg = f"Claude API error: HTTP {e.status_code}"
        try:
            error_msg = e.body.get("error", {}).get("message", error_msg)
        except Exception:
            pass
        raise APIError(error_msg, 502)
    except anthropic.APIConnectionError as e:
        raise APIError(f"Network error while calling AI: {str(e)}", 502)

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
                "reasoning_effort": "low",
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
            except Exception:
                pass
            raise APIError(error_msg, 502)

        return res.json()["choices"][0]["message"]["content"].strip()

    except requests.exceptions.Timeout:
        raise APIError("AI generation timed out. Please try again.", 504)
    except requests.exceptions.RequestException as e:
        raise APIError(f"Network error while calling AI: {str(e)}", 502)

def _ai_complete(system: str, prompt: str, effort: str = "medium", max_tokens: int = 2000, groq_temperature: float = 0.4) -> str:
    """Generate text via Claude, falling back to Groq if Claude fails for any reason."""
    try:
        return _claude(
            messages=[{"role": "user", "content": prompt}],
            system=system,
            effort=effort,
            max_tokens=max_tokens,
        )
    except APIError as claude_err:
        print(f"⚠️ Claude generation failed, falling back to Groq: {claude_err}")
        try:
            return _groq(
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                temperature=groq_temperature,
                max_tokens=max_tokens,
            )
        except APIError as groq_err:
            raise APIError(
                f"AI generation failed (Claude: {claude_err}; Groq: {groq_err})", 502
            )


def _ai_chat(system: str, messages: list, effort: str = "medium", max_tokens: int = 500, groq_temperature: float = 0.6) -> str:
    """Same Claude-then-Groq fallback as _ai_complete, but for an actual
    multi-turn conversation instead of one prompt — used by the mock
    interview chat, which is stateless server-side (see /interview-chat):
    the frontend keeps the whole transcript and resends it every turn."""
    try:
        return _claude(messages=messages, system=system, effort=effort, max_tokens=max_tokens)
    except APIError as claude_err:
        print(f"⚠️ Claude chat failed, falling back to Groq: {claude_err}")
        try:
            return _groq(
                messages=[{"role": "system", "content": system}, *messages],
                temperature=groq_temperature,
                max_tokens=max_tokens,
            )
        except APIError as groq_err:
            raise APIError(
                f"AI generation failed (Claude: {claude_err}; Groq: {groq_err})", 502
            )

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

# Same rule for the scan-and-tailor flow, which has no separate "stated
# target title" form field to fall back to (there's no form at all — the
# candidate's title comes from the uploaded resume itself) — falls back to
# their own most recent title from the raw text instead of a {title} kwarg.
SCAN_TITLE_EXTRACTION_RULE = """TITLE EXTRACTION (do this first, before anything else):
- Read the JOB DESCRIPTION below in full, including any header or first paragraph.
- Find the job title AS WRITTEN by the employer. Look for patterns like "Job Title:", "Position:",
  "We're hiring a ___", a bolded/first-line role name, or the role name repeated most consistently
  through the posting.
- Use that exact title — word for word as the employer wrote it — everywhere a title is needed:
  contact.title, the resume summary, and the cover letter and its greeting.
- Only fall back to the candidate's own current/most recent job title (as found in the raw resume
  text below) if the job description genuinely contains no discernible title anywhere in the text."""

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

def _extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        text = "\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception as e:
        raise APIError(f"Could not read this PDF: {e}", 400)
    if not text.strip():
        raise APIError("Could not find any text in this PDF — it may be a scanned image without a text layer", 400)
    return text


def _extract_text_from_docx(file_bytes: bytes) -> str:
    try:
        doc = Document(io.BytesIO(file_bytes))
        text = "\n".join(p.text for p in doc.paragraphs)
    except Exception as e:
        raise APIError(f"Could not read this Word document: {e}", 400)
    if not text.strip():
        raise APIError("Could not find any text in this document", 400)
    return text


SCAN_PROMPT_TEMPLATE = """RAW RESUME TEXT (extracted from an uploaded file — formatting/line breaks may be imperfect):
{raw_text}

TASK:
Read the raw text above and extract it into the exact JSON structure below, faithfully
reorganizing what's actually there. Do NOT invent, embellish, or add anything that isn't
genuinely present in the source text. If a field truly isn't findable, use an empty string
("") for text fields or an empty array ([]) for lists — never fabricate a placeholder.

Return this exact JSON structure (no other text, no markdown fences):
{{
  "contact": {{
    "name": "full name as found",
    "title": "the person's current or most recent job title / target role, as found",
    "email": "email address as found, or empty string",
    "phone": "phone number as found, or empty string",
    "location": "city/region as found, or empty string"
  }},
  "sections": [
    {{ "id": "summary", "label": "Professional Summary", "type": "text", "content": "the resume's own summary/objective text, reworded only for clarity, or empty string if none exists" }},
    {{ "id": "skills", "label": "Skills", "type": "bullets", "items": ["each distinct skill found, one per item"] }},
    {{ "id": "experience", "label": "Experience", "type": "jobs", "jobs": [
        {{ "role": "job title", "company": "employer name", "period": "date range as written", "bullets": ["each responsibility/achievement bullet found under this job"] }}
    ] }},
    {{ "id": "education", "label": "Education", "type": "education", "degrees": [
        {{ "degree": "degree/program name", "school": "institution name", "location": "as found or empty string", "period": "date range as written" }}
    ] }}
  ]
}}

Rules:
- Preserve the person's actual wording in bullets as closely as reasonable — you are
  transcribing and organizing, not rewriting their career.
- Do NOT invent any company, degree, date, or achievement not present in the source text.
- Return ONLY the JSON object."""


# Same four-things-in-one-pass shape as OPTIMIZE_PROMPT_TEMPLATE (resume +
# cover letter + interview tips + apply-method detection), except the
# candidate's background comes from an uploaded file's raw text instead of
# hand-typed form fields — "scan and tailor" in one AI call rather than
# scan-then-separately-optimize.
SCAN_OPTIMIZE_PROMPT_TEMPLATE = """RAW RESUME TEXT (extracted from an uploaded file — formatting/line breaks may be imperfect):
{raw_text}

JOB DESCRIPTION:
{job_description}

""" + SCAN_TITLE_EXTRACTION_RULE + """

COMPANY EXTRACTION:
- Also find the employer/company name from the posting if it's stated anywhere. If genuinely absent,
  use null — never invent one.

TASK:
The candidate's real background, employers, dates, education, and skills are ONLY what's present
in the RAW RESUME TEXT above — never invent anything not found there. Using that real background,
produce FOUR things in one pass, all tailored to this specific job posting:

1. A complete ATS-optimised resume, rebuilt from the candidate's actual history in the raw text,
   reworded and reprioritised (not simply copied) to match the job posting, using the exact title
   found above.

2. A SHORT, straight-to-the-point cover letter — not a template, not padded, no throat-clearing.
   Build it in this exact shape:
   - Opening (1 sentence): Name the exact job title and company (if found), plus one concrete
     detail from the posting that proves the candidate actually read it.
   - Body (1 short paragraph, 2-3 sentences MAX): Pick the SINGLE most important requirement
     from the posting and pair it directly with the candidate's strongest matching real
     experience from the raw resume text — one clear, specific example. Do not try to cover
     multiple requirements.
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
   bring up, grounded in their ACTUAL background as found in the raw resume text, relevant to
   this specific role.

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
    "name": "full name as found in the raw resume text",
    "title": "exact job title as written in the posting (see TITLE EXTRACTION rule above)",
    "company": "employer name found in the posting, or null",
    "email": "email as found in the raw resume text, or empty string",
    "phone": "phone as found in the raw resume text, or empty string",
    "location": "job location if found in the posting, else the candidate's own location from the raw text"
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
- Do NOT invent companies, degrees, dates, or achievements not present in the raw resume text.
- Every resume bullet starts with a strong past-tense action verb.
- Weave at least 6 keywords from the JD naturally into the resume body.
- The cover letter must sound like a real person wrote it, follow the shape specified above, and
  avoid every banned phrase listed above.
- Return ONLY the JSON object."""


@resume_bp.route("/scan", methods=["POST"])
@limiter.limit("20 per hour")
def scan_resume():
    """
    Upload an existing resume (PDF or DOCX) and extract it into the builder's
    data shape. If a job_description is also pasted alongside the file
    (optional — same 50-char minimum as /generate and /optimize), the AI
    tailors the extracted resume to that posting in the same pass instead of
    just transcribing it faithfully — resume + cover letter + interview tips
    + apply-method detection, identical output shape to /optimize.
    """
    if "file" not in request.files:
        raise APIError("No file uploaded", 400)
    upload = request.files["file"]
    filename = (upload.filename or "").lower()
    if not (filename.endswith(".pdf") or filename.endswith(".docx")):
        raise APIError("Only .pdf and .docx files are supported", 400)

    file_bytes = upload.read()
    if len(file_bytes) > 8 * 1024 * 1024:
        raise APIError("File is too large (8MB max)", 400)

    job_desc = (request.form.get("job_description") or "").strip()[:4000]
    tailoring = len(job_desc) >= 50

    raw_text = _extract_text_from_pdf(file_bytes) if filename.endswith(".pdf") else _extract_text_from_docx(file_bytes)
    raw_text = raw_text[:12000]  # keeps the prompt sane for unusually long documents

    if tailoring:
        prompt = SCAN_OPTIMIZE_PROMPT_TEMPLATE.format(raw_text=raw_text, job_description=job_desc)
        raw = _ai_complete(system=SYSTEM, prompt=prompt, effort="medium", max_tokens=3000, groq_temperature=0.5)
    else:
        prompt = SCAN_PROMPT_TEMPLATE.format(raw_text=raw_text)
        raw = _ai_complete(system=SYSTEM, prompt=prompt, effort="medium", max_tokens=2200, groq_temperature=0.2)
    clean = raw.replace("```json", "").replace("```", "").strip()

    try:
        parsed = json.loads(clean)
    except json.JSONDecodeError as e:
        raise APIError(f"AI returned invalid JSON: {str(e)}", 502)

    # Persist to database — same as /generate and /optimize. Without this,
    # a scanned-in resume only ever existed in the browser's local draft:
    # invisible to "Saved", invisible to the dashboard's recent-resumes
    # list, and gone entirely if that draft was ever cleared.
    try:
        from app.models import Media
        scope_user_id, scope_guest_id = get_scope(request)
        if not scope_user_id and not scope_guest_id:
            # No X-Guest-Id and not signed in — usually localStorage being
            # blocked (private browsing, storage disabled) rather than a
            # real absence of identity. Saving anyway would write a row
            # with BOTH columns NULL: never findable by any future
            # request, an orphan forever. The resume itself still comes
            # back in the response below; it just can't be saved for
            # later from this browser.
            parsed["saved_id"] = None
        else:
            doc_bytes = json.dumps(parsed).encode()
            contact = parsed.get("contact", {})
            record = Media(
                filename=f"resume_{uuid.uuid4().hex[:8]}.json",
                media_type="document",
                mime_type="application/json",
                file_data=doc_bytes,
                file_size=len(doc_bytes),
                caption=f"{contact.get('name')} — {contact.get('title')}",
                filter_name="guest_resume",
                user_id=scope_user_id,
                guest_id=None if scope_user_id else scope_guest_id,
                metadata_json={
                    "user_name": contact.get("name"),
                    "user_email": contact.get("email"),
                    "target_role": contact.get("title"),
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                    "keywords": parsed.get("keywords", []),
                    "imported": True,
                    "optimized": tailoring,
                },
            )
            db.session.add(record)
            db.session.commit()
            parsed["saved_id"] = record.id
    except Exception as e:
        print(f"⚠️ Could not save scanned resume to database: {e}")
        parsed["saved_id"] = None

    return jsonify({"success": True, "data": parsed}), 200


@resume_bp.route("/generate", methods=["POST"])
@limiter.limit("20 per hour")
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

    raw = _ai_complete(
        system=SYSTEM,
        prompt=prompt,
        effort="medium",
        max_tokens=2000,
        groq_temperature=0.35,
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
        scope_user_id, scope_guest_id = get_scope(request)
        if not scope_user_id and not scope_guest_id:
            # See the identical guard in scan_resume() above — no scope to
            # save under means a permanently-orphaned NULL/NULL row instead
            # of just skipping the save.
            parsed["saved_id"] = None
        else:
            doc_bytes = json.dumps(parsed).encode()
            record = Media(
                filename=f"resume_{uuid.uuid4().hex[:8]}.json",
                media_type="document",
                mime_type="application/json",
                file_data=doc_bytes,
                file_size=len(doc_bytes),
                caption=f"{info.get('name')} — {parsed.get('contact', {}).get('title', info.get('title'))}",
                filter_name="guest_resume",
                user_id=scope_user_id,
                guest_id=None if scope_user_id else scope_guest_id,
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
@limiter.limit("20 per hour")
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

    raw = _ai_complete(
        system=SYSTEM,
        prompt=prompt,
        effort="medium",
        max_tokens=3000,
        groq_temperature=0.5,
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
        scope_user_id, scope_guest_id = get_scope(request)
        if not scope_user_id and not scope_guest_id:
            # See the identical guard in scan_resume() above.
            parsed["saved_id"] = None
        else:
            doc_bytes = json.dumps(parsed).encode()
            record = Media(
                filename=f"resume_{uuid.uuid4().hex[:8]}.json",
                media_type="document",
                mime_type="application/json",
                file_data=doc_bytes,
                file_size=len(doc_bytes),
                caption=f"{info.get('name')} — {parsed.get('contact', {}).get('title', info.get('title'))}",
                filter_name="guest_resume",
                user_id=scope_user_id,
                guest_id=None if scope_user_id else scope_guest_id,
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


INTERVIEW_CHAT_SYSTEM = """You are a warm, encouraging mock-interview coach helping someone practice
for a specific job before the real thing. You are NOT a resume writer here — you ask questions and react
to answers, nothing else.

RULES:
- Ask exactly ONE question at a time. Never stack multiple questions in one message.
- Ground every question in the job description and the provided talking points — mix behavioral
  ("tell me about a time...") and role-specific technical/situational questions, drawn from what the
  posting actually asks for.
- After the candidate answers, give ONE short sentence of specific, genuine feedback (what landed, what
  could be sharper) — never generic praise like "great answer!" — then ask the next question in the same
  message.
- Keep every message SHORT: 2-4 sentences total, feedback plus the next question. This is a conversation,
  not an essay.
- If this is the very first message (no prior candidate answer yet), skip feedback and just open with a
  warm one-line welcome plus the first question.
- Never break character to explain what you're doing. Never invent details about the candidate's
  background beyond what they've told you in the conversation so far."""


@resume_bp.route("/interview-chat", methods=["POST"])
@limiter.limit("60 per hour")
def interview_chat():
    """
    Stateless mock-interview turn — the frontend keeps and resends the whole
    transcript every call (see components/premium/guest/components/
    InterviewChat.js); nothing here is persisted, matching the rest of the
    app's "ephemeral unless explicitly saved" default.
    """
    body = request.get_json(force=True) or {}
    job_desc = (body.get("job_description") or "").strip()[:4000]
    interview_tips = body.get("interview_tips") or []
    messages = body.get("messages") or []

    if not job_desc:
        raise APIError("job_description is required", 400)
    if not isinstance(messages, list):
        raise APIError("messages must be a list", 400)
    # Bounded so nobody can turn this into an unbounded-cost proxy for
    # arbitrary Claude conversations — a real practice session never needs
    # more than a handful of exchanges anyway.
    if len(messages) > 40:
        raise APIError("This mock interview has gone on long enough — start a new one.", 400)

    clean_messages = []
    for m in messages:
        role = m.get("role")
        content = (m.get("content") or "").strip()
        if role not in ("user", "assistant") or not content:
            continue
        clean_messages.append({"role": role, "content": content[:2000]})

    # clean_messages always starts with "assistant" once a conversation is
    # underway — the frontend's own transcript state seeds itself with the
    # AI's opening question (see InterviewChat.js), it never echoes back a
    # synthetic "Let's begin" user turn. A hardcoded assistant turn used to
    # sit right here between the context message and clean_messages, which
    # meant every reply after the very first one sent the AI provider TWO
    # consecutive assistant messages — both Anthropic and Groq's chat APIs
    # reject non-alternating roles outright, so every follow-up answer in a
    # mock interview failed. Fixed by dropping that hardcoded turn entirely
    # — a single leading "user" message plus the frontend's own
    # (correctly-alternating) transcript already alternates on its own.
    context = f"JOB DESCRIPTION:\n{job_desc}\n\nTALKING POINTS TO DRAW ON:\n" + "\n".join(f"- {t}" for t in interview_tips[:5])
    chat_messages = [{"role": "user", "content": context}, *clean_messages]
    if not clean_messages:
        chat_messages.append({"role": "user", "content": "Let's begin."})

    # Defensive normalization — cheap insurance against this exact bug class
    # recurring if the transcript shape ever changes again: collapse any
    # accidental consecutive same-role messages by merging their content,
    # rather than letting a malformed request reach the AI provider at all.
    normalized = []
    for m in chat_messages:
        if normalized and normalized[-1]["role"] == m["role"]:
            normalized[-1] = {"role": m["role"], "content": normalized[-1]["content"] + "\n\n" + m["content"]}
        else:
            normalized.append(dict(m))
    chat_messages = normalized

    reply = _ai_chat(system=INTERVIEW_CHAT_SYSTEM, messages=chat_messages, effort="low", max_tokens=300, groq_temperature=0.7)
    return jsonify({"success": True, "data": {"message": reply.strip()}}), 200


ATS_CHECK_SYSTEM = """You are an ATS (Applicant Tracking System) parsing simulator and resume auditor.
You know exactly how real ATS software (Workday, Greenhouse, Taleo, iCIMS) actually parses resumes —
not folklore about it. You always respond with ONLY valid JSON — no markdown fences, no explanation."""

ATS_CHECK_PROMPT = """RESUME (structured JSON, as built in this app):
{resume_json}

{job_context}

TASK:
Score this resume's ATS-readiness from 0-100 and list specific, actionable issues. Judge on real ATS
parsing behavior: contact info completeness, whether section labels are standard and parseable, whether
bullets use quantifiable achievements and strong verbs, keyword alignment with the job description (if
one was provided), and structural red flags (missing dates, vague titles, no measurable results).

Return this exact JSON structure (no other text, no markdown fences):
{{
  "score": 0,
  "summary": "one direct sentence on where this resume stands",
  "issues": [
    {{ "severity": "high | medium | low", "message": "specific, actionable fix — not generic advice" }}
  ]
}}

Rules:
- score must be an integer 0-100.
- 3-6 issues, ordered most severe first. If it's genuinely strong, say so with fewer/lower-severity issues
  rather than inventing problems.
- Every issue must reference something ACTUALLY in the resume, never a generic "add more keywords" without
  saying which ones.
- Return ONLY the JSON object."""


def _score_resume(resume: dict, job_context: str) -> dict:
    """Shared by /ats-check and /ats-improve so the improve loop scores each
    rewrite pass with the exact same judge it reports to the user — a resume
    that "passes" during improvement but re-fails on a fresh /ats-check call
    would just be confusing."""
    prompt = ATS_CHECK_PROMPT.format(resume_json=json.dumps(resume)[:6000], job_context=job_context)
    raw = _ai_complete(system=ATS_CHECK_SYSTEM, prompt=prompt, effort="low", max_tokens=900, groq_temperature=0.3)
    clean = raw.replace("```json", "").replace("```", "").strip()

    try:
        parsed = json.loads(clean)
    except json.JSONDecodeError as e:
        raise APIError(f"AI returned invalid JSON: {str(e)}", 502)

    try:
        parsed["score"] = max(0, min(100, int(parsed.get("score", 0))))
    except (TypeError, ValueError):
        parsed["score"] = 0
    parsed.setdefault("issues", [])
    return parsed


@resume_bp.route("/ats-check", methods=["POST"])
@limiter.limit("30 per hour")
def ats_check():
    """Score a resume's ATS-readiness, optionally against a specific job posting."""
    body = request.get_json(force=True) or {}
    resume = body.get("resume") or {}
    job_desc = (body.get("job_description") or "").strip()[:4000]

    if not resume.get("contact") or not resume.get("sections"):
        raise APIError("resume (with contact and sections) is required", 400)

    job_context = f"JOB DESCRIPTION (score keyword alignment against this too):\n{job_desc}" if job_desc else "No specific job description provided — score general ATS-readiness only."
    parsed = _score_resume(resume, job_context)
    return jsonify({"success": True, "data": parsed}), 200


ATS_IMPROVE_SYSTEM = """You are an elite ATS resume writer. You rewrite resumes to fix specific,
already-identified ATS issues. You never invent employers, job titles, dates, schools, certifications,
or achievements that aren't already present in the resume you're given — rephrasing, reordering,
quantifying, and keyword-aligning REAL content is the job; fabricating credentials is resume fraud and
is never acceptable, even if it would raise the score. You always respond with ONLY valid JSON."""

ATS_IMPROVE_PROMPT = """CURRENT RESUME (structured JSON):
{resume_json}

{job_context}

ATS ISSUES TO FIX THIS PASS:
{issues_text}

TASK:
Rewrite this resume to fix the issues above, following these rules exactly:
- Use ONLY information already present in the resume above — the same employers, dates, schools,
  certifications, and skills. Rephrasing, reordering, quantifying existing achievements, and aligning
  wording with the job description's keywords are all fine. Inventing a new employer, degree, school,
  certification, or metric is NEVER fine, even if it would fix the issue.
- If an issue genuinely can't be fixed without inventing something the candidate hasn't provided (for
  example, the job wants a certification the resume shows no sign of), do not touch the resume for it.
  Instead add one entry to "unresolved" naming the real, specific thing the candidate could go get
  (e.g. "Food Handler Certification" or "a WHMIS course") — a suggestion for them to actually pursue,
  never something written into the resume as if it already happened.
- You may add, rename, split, or reorder SECTIONS (e.g. break out a dedicated "Certifications" section
  from something buried in Skills) if that better organizes content already present — never populate a
  new section with invented content.
- Every section MUST use exactly one of these four shapes — the app's renderer only understands
  these field names, so any other shape (e.g. a "content" array, or fields like "jobtitle"/"achievements")
  will silently fail to display:
  {{ "id": "...", "label": "...", "type": "text", "content": "prose string" }}
  {{ "id": "...", "label": "...", "type": "bullets", "items": ["...", "..."] }}
  {{ "id": "...", "label": "...", "type": "jobs", "jobs": [
    {{ "role": "...", "company": "...", "period": "start – end", "location": "...", "bullets": ["...", "..."] }}
  ] }}
  {{ "id": "...", "label": "...", "type": "education", "degrees": [
    {{ "degree": "...", "school": "...", "location": "...", "period": "..." }}
  ] }}
  A new section you add (e.g. a "Certifications" section) must still use one of these four shapes —
  "bullets" for a flat list of certifications is usually the right one.

Return this exact JSON structure (no other text, no markdown fences):
{{
  "contact": {{ "name": "...", "title": "...", "email": "...", "phone": "...", "location": "..." }},
  "sections": [ ...revised sections, each in one of the four shapes above... ],
  "unresolved": ["real, specific, actionable suggestion — never a fabrication", "..."]
}}

Return ONLY the JSON object."""


def _valid_section(sec) -> bool:
    """Defense in depth on top of ATS_IMPROVE_PROMPT's schema rules — an AI
    response that drifts from the four known section shapes must never reach
    the frontend renderer (Resume.js), which only knows how to draw exactly
    these four. A malformed section silently failing to render on a resume
    someone's about to submit for a job is exactly the kind of small bug
    that isn't small to the person it happens to."""
    if not isinstance(sec, dict) or not sec.get("id") or not sec.get("label") or not sec.get("type"):
        return False
    t = sec["type"]
    if t == "text":
        return isinstance(sec.get("content"), str)
    if t == "bullets":
        return isinstance(sec.get("items"), list)
    if t == "jobs":
        return isinstance(sec.get("jobs"), list)
    if t == "education":
        return isinstance(sec.get("degrees"), list)
    return False


@resume_bp.route("/ats-improve", methods=["POST"])
@limiter.limit("10 per hour")
def ats_improve():
    """Score a resume, rewrite it to address the issues found, re-score, and repeat
    for a small bounded number of passes — the "keep going until it's actually good"
    loop behind the ATS score modal's "Fix these issues" button. Bounded (not truly
    "until satisfaction") on purpose: each pass is a real AI call, so an unbounded
    loop is a cost/latency/rate-limit problem waiting to happen, and diminishing
    returns set in fast — two focused passes fix what's fixable; a resume that still
    scores low after that has issues that need real information from the user, not
    another rewrite (see ATS_IMPROVE_PROMPT's `unresolved` rule)."""
    body = request.get_json(force=True) or {}
    resume = body.get("resume") or {}
    job_desc = (body.get("job_description") or "").strip()[:4000]

    if not resume.get("contact") or not resume.get("sections"):
        raise APIError("resume (with contact and sections) is required", 400)

    MAX_PASSES = 2
    TARGET_SCORE = 85

    job_context = f"JOB DESCRIPTION (score/align against this too):\n{job_desc}" if job_desc else "No specific job description provided — score general ATS-readiness only."

    current = {"contact": resume["contact"], "sections": resume["sections"]}
    history = []
    unresolved = []
    check = _score_resume(current, job_context)
    history.append({"pass": 0, "score": check["score"]})

    passes_run = 0
    while check["score"] < TARGET_SCORE and check["issues"] and passes_run < MAX_PASSES:
        issues_text = "\n".join(f"- ({iss.get('severity', 'medium')}) {iss.get('message', '')}" for iss in check["issues"])
        prompt = ATS_IMPROVE_PROMPT.format(
            resume_json=json.dumps(current)[:6000],
            job_context=job_context,
            issues_text=issues_text,
        )
        raw = _ai_complete(system=ATS_IMPROVE_SYSTEM, prompt=prompt, effort="medium", max_tokens=1800, groq_temperature=0.3)
        clean = raw.replace("```json", "").replace("```", "").strip()
        passes_run += 1

        try:
            revised = json.loads(clean)
        except json.JSONDecodeError:
            break  # keep the last good version rather than fail the whole request

        if not revised.get("contact") or not revised.get("sections"):
            break

        valid_sections = [s for s in revised["sections"] if _valid_section(s)]
        if not valid_sections:
            break  # nothing usable came back — keep the last good version

        current = {"contact": revised["contact"], "sections": valid_sections}
        unresolved = revised.get("unresolved") or []
        check = _score_resume(current, job_context)
        history.append({"pass": passes_run, "score": check["score"]})

    return jsonify({"success": True, "data": {
        "resume": current,
        "score": check["score"],
        "summary": check["summary"],
        "issues": check["issues"],
        "unresolved": unresolved,
        "history": history,
    }}), 200


def _saved_scope_filter(query):
    """Signed-in user_id wins if present; otherwise falls back to guest_id.
    Neither present means no rows — never "show everything" as a fallback."""
    user_id, guest_id = get_scope(request)
    if user_id:
        return query.filter_by(user_id=user_id)
    if guest_id:
        return query.filter_by(guest_id=guest_id)
    return query.filter(db.false())


@resume_bp.route("/saved", methods=["GET"])
def list_saved():
    """Return this visitor's own saved resumes — never anyone else's."""
    from app.models import Media
    records = (
        _saved_scope_filter(Media.query.filter_by(filter_name="guest_resume", is_deleted=False))
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
    """Re-load a previously generated resume — only whoever saved it can."""
    from app.models import Media
    record = _saved_scope_filter(
        Media.query.filter_by(id=resume_id, filter_name="guest_resume", is_deleted=False)
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
    """Soft delete a saved resume — only whoever saved it can."""
    from app.models import Media
    record = _saved_scope_filter(
        Media.query.filter_by(id=resume_id, filter_name="guest_resume")
    ).first()

    if record:
        record.is_deleted = True
        db.session.commit()
        return jsonify({"success": True}), 200

    return jsonify({"success": False, "error": "Resume not found"}), 404