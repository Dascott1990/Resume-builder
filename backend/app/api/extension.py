"""
app/api/extension.py — the Chrome extension's endpoints for universal DOM extraction
and saving job postings straight into the Job Tracker.

Includes:
- POST /api/v1/extension/parse   — extracts normalized job metadata from JSON-LD microdata,
                                   OpenGraph tags, or lightweight LLM structured output.
- POST /api/v1/extension/capture — persists the parsed/confirmed job application into
                                   JobApplication and logs audit telemetry into ExtensionCaptureLog.
"""
import json
import logging
import re
from urllib.parse import urlparse

from flask import Blueprint, request, jsonify

from app import db, limiter
from app.models import JobApplication, ExtensionCaptureLog
from app.middleware.error_handlers import APIError
from app.utils.auth import resolve_personal_access_token
from app.utils.ai_client import ai_complete

logger = logging.getLogger("extension_api")
extension_bp = Blueprint("extension", __name__)

NOTES_LIMIT = 1000
URL_LIMIT = 500
TEXT_INPUT_LIMIT = 15000


def _extract_domain(url: str) -> str:
    """Extracts clean hostname/domain from a given URL."""
    if not url:
        return "unknown"
    try:
        parsed = urlparse(url)
        netloc = parsed.netloc.lower()
        if netloc.startswith("www."):
            netloc = netloc[4:]
        return netloc or "unknown"
    except Exception:
        return "unknown"


def _clean_text(val):
    if not val or not isinstance(val, str):
        return ""
    cleaned = re.sub(r"<[^>]+>", " ", val)
    return re.sub(r"\s+", " ", cleaned).strip()


def parse_json_ld(json_ld_data):
    """
    Attempts to extract JobPosting schema from JSON-LD data (dict or list of dicts).
    """
    if not json_ld_data:
        return None

    if isinstance(json_ld_data, str):
        try:
            json_ld_data = json.loads(json_ld_data)
        except Exception:
            return None

    candidates = []
    if isinstance(json_ld_data, list):
        candidates = json_ld_data
    elif isinstance(json_ld_data, dict):
        if "@graph" in json_ld_data and isinstance(json_ld_data["@graph"], list):
            candidates = json_ld_data["@graph"]
        else:
            candidates = [json_ld_data]

    for item in candidates:
        if not isinstance(item, dict):
            continue
        item_type = str(item.get("@type", "")).lower()
        if "jobposting" in item_type:
            role = _clean_text(item.get("title"))
            company_obj = item.get("hiringOrganization")
            company = ""
            if isinstance(company_obj, dict):
                company = _clean_text(company_obj.get("name"))
            elif isinstance(company_obj, str):
                company = _clean_text(company_obj)

            description = _clean_text(item.get("description"))

            loc_obj = item.get("jobLocation")
            location = ""
            if isinstance(loc_obj, dict):
                address = loc_obj.get("address")
                if isinstance(address, dict):
                    location = ", ".join(filter(None, [
                        _clean_text(address.get("addressLocality")),
                        _clean_text(address.get("addressRegion")),
                        _clean_text(address.get("addressCountry")),
                    ]))
                elif isinstance(address, str):
                    location = _clean_text(address)

            salary_obj = item.get("baseSalary")
            salary = ""
            if isinstance(salary_obj, dict):
                val = salary_obj.get("value")
                currency = salary_obj.get("currency", "USD")
                if isinstance(val, dict):
                    v_min = val.get("minValue")
                    v_max = val.get("maxValue")
                    if v_min and v_max:
                        salary = f"{currency} {v_min} - {v_max}"
                    elif val.get("value"):
                        salary = f"{currency} {val.get('value')}"
                elif val:
                    salary = f"{currency} {val}"

            if role and (company or description):
                return {
                    "role": role[:150],
                    "company": (company or "Unknown Company")[:150],
                    "job_description": description[:NOTES_LIMIT],
                    "location": location[:150],
                    "salary": salary[:100],
                    "strategy": "json_ld",
                }
    return None


def parse_open_graph(meta_tags: dict, title: str):
    """
    Extracts metadata from OpenGraph and standard meta tags.
    """
    if not meta_tags:
        return None

    og_title = meta_tags.get("og:title") or title or ""
    og_site = meta_tags.get("og:site_name") or meta_tags.get("author") or ""
    og_desc = meta_tags.get("og:description") or meta_tags.get("description") or ""

    role = ""
    company = og_site

    if og_title:
        cleaned_title = re.sub(r"\s*[|·]\s*(LinkedIn|Indeed|Glassdoor|ZipRecruiter).*$", "", og_title, flags=re.I).strip()
        m = re.match(r"^(.*?)\s+at\s+(.*?)(?:\s*[-|].*)?$", cleaned_title, re.I)
        if m:
            role, company = m.group(1).strip(), m.group(2).strip()
        else:
            m = re.match(r"^(.*?)\s*[-–]\s*(.*?)(?:\s*[-|].*)?$", cleaned_title)
            if m:
                role, company = m.group(1).strip(), m.group(2).strip()
            else:
                role = cleaned_title

    if role and (company or og_desc):
        return {
            "role": _clean_text(role)[:150],
            "company": _clean_text(company or "Unknown Company")[:150],
            "job_description": _clean_text(og_desc)[:NOTES_LIMIT],
            "location": "",
            "salary": "",
            "strategy": "open_graph",
        }
    return None


def parse_with_llm(raw_text: str, page_title: str = "", url: str = ""):
    """
    Fallback parser using Claude/Groq to extract job fields from unstructured page text.
    """
    truncated_text = raw_text[:TEXT_INPUT_LIMIT]
    system_prompt = (
        "You are a job posting extraction assistant. "
        "Extract the company name, job role/title, concise job description summary, "
        "location, and salary from the provided job page text. "
        "Respond ONLY with a valid JSON object with keys: "
        '"company", "role", "job_description", "location", "salary". '
        "Do not invent facts; if a field cannot be determined, use an empty string."
    )
    user_prompt = f"Page Title: {page_title}\nURL: {url}\n\nContent:\n{truncated_text}"

    try:
        raw_res = ai_complete(
            system=system_prompt,
            prompt=user_prompt,
            effort="low",
            max_tokens=500,
            groq_temperature=0.2,
        )
        clean = re.sub(r"^```(json)?", "", raw_res.strip(), flags=re.MULTILINE)
        clean = re.sub(r"```$", "", clean.strip(), flags=re.MULTILINE).strip()
        data = json.loads(clean)
        return {
            "role": _clean_text(data.get("role"))[:150],
            "company": _clean_text(data.get("company"))[:150],
            "job_description": _clean_text(data.get("job_description"))[:NOTES_LIMIT],
            "location": _clean_text(data.get("location"))[:150],
            "salary": _clean_text(data.get("salary"))[:100],
            "strategy": "fallback_llm",
        }
    except Exception as e:
        logger.warning("LLM fallback extraction failed: %s", e)
        return None


@extension_bp.route("/parse", methods=["POST"])
@limiter.limit("60 per hour")
def parse_job_payload():
    """
    Extracts structured job posting fields from raw client-side DOM extracts.
    Prioritizes Schema.org JSON-LD and OpenGraph tags before falling back to LLM.
    """
    user_id = resolve_personal_access_token(request)
    if not user_id:
        raise APIError("Invalid or revoked token", 401)

    body = request.get_json(force=True) or {}
    url = (body.get("url") or "").strip()
    title = (body.get("title") or "").strip()
    json_ld = body.get("json_ld")
    meta = body.get("meta") or {}
    body_text = (body.get("body_text") or "").strip()

    # 1. Try JSON-LD Microdata
    result = parse_json_ld(json_ld)

    # 2. Try OpenGraph / Meta tags
    if not result:
        result = parse_open_graph(meta, title)

    # 3. LLM Fallback on unstructured body text
    if not result and body_text:
        result = parse_with_llm(body_text, page_title=title, url=url)

    if not result:
        result = {
            "role": title[:150],
            "company": "",
            "job_description": body_text[:NOTES_LIMIT],
            "location": "",
            "salary": "",
            "strategy": "manual",
        }

    return jsonify({"success": True, "data": result}), 200


@extension_bp.route("/capture", methods=["POST"])
@limiter.limit("60 per hour")
def capture_job():
    """
    Saves a captured job posting directly into the user's Job Tracker as 'saved'.
    Records extraction audit metadata into ExtensionCaptureLog.
    """
    user_id = resolve_personal_access_token(request)
    if not user_id:
        raise APIError("Invalid or revoked token", 401)

    body = request.get_json(force=True) or {}
    company = (body.get("company") or "").strip()
    role = (body.get("role") or "").strip()
    url = (body.get("url") or "").strip()
    strategy = (body.get("strategy") or "manual").strip()
    description = (body.get("job_description") or "").strip()

    # If role or company are missing, attempt auto-parse if DOM data was sent
    if not company or not role:
        parsed = None
        if body.get("json_ld"):
            parsed = parse_json_ld(body.get("json_ld"))
        if not parsed and body.get("meta"):
            parsed = parse_open_graph(body.get("meta"), body.get("title") or "")
        if not parsed and body.get("body_text"):
            parsed = parse_with_llm(body.get("body_text"), page_title=body.get("title", ""), url=url)

        if parsed:
            company = company or parsed.get("company", "")
            role = role or parsed.get("role", "")
            description = description or parsed.get("job_description", "")
            strategy = parsed.get("strategy", strategy)

    if not company or not role:
        raise APIError("company and role are required", 400)

    # Save to JobApplication
    app_row = JobApplication(
        company=company[:150],
        role=role[:150],
        status="saved",
        notes=description[:NOTES_LIMIT] or None,
        source_url=url[:URL_LIMIT] or None,
        user_id=user_id,
    )
    db.session.add(app_row)

    # Audit log entry in ExtensionCaptureLog
    capture_log = ExtensionCaptureLog(
        user_id=user_id,
        source_url=url[:1024] or "unknown",
        domain=_extract_domain(url),
        parsing_strategy=strategy[:50],
    )
    db.session.add(capture_log)

    db.session.commit()
    return jsonify({
        "success": True,
        "data": {
            **app_row.to_dict(),
            "parsing_strategy": strategy,
        }
    }), 201
