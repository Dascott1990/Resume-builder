"""
app/agent/tools.py — the agent's only vocabulary of actions. Two things
matter more than anything else here:

1. There is no `submit` tool. It does not exist in TOOL_SCHEMAS, so the
   model cannot call it no matter what it decides — see the module
   docstring in agent/browser.py for why that's a structural guarantee,
   not a policy.
2. Sensitive fields (work authorization, visa/immigration, security
   clearance, education, certifications, employment dates, years of
   experience, salary, background/criminal history) can only be written
   from an already-verified source (the profile snapshot or an answered
   question) — never from free text the model invented in its own tool
   call. See resolve_profile_value / classify_sensitive and how
   tool_fill_field/tool_select_dropdown enforce them below.
"""
import re

from app.agent.browser import is_submit_classified


# ── Sensitive-field classification — by the FIELD'S LABEL on the real page,
# not by anything the model claims about it. ────────────────────────────────
_SENSITIVE_PATTERNS = {
    "work_authorization": re.compile(r"work authoriz|visa|sponsor|immigration|right to work|legally (authorized|eligible)", re.I),
    "security_clearance": re.compile(r"security clearance|clearance level", re.I),
    "education": re.compile(r"\bdegree\b|education level|gpa\b|graduat", re.I),
    "certification": re.compile(r"certificat|\blicense\b", re.I),
    "employment_dates": re.compile(r"start date|end date|employment date|hire date|date of birth|\bdob\b", re.I),
    "years_experience": re.compile(r"years? of experience|years? experience", re.I),
    "salary": re.compile(r"salary|compensation|pay expectation|desired pay|current pay", re.I),
    "background": re.compile(r"criminal|conviction|background check|felony", re.I),
}


def classify_sensitive(label):
    if not label:
        return None
    for category, pattern in _SENSITIVE_PATTERNS.items():
        if pattern.search(label):
            return category
    return None


def resolve_profile_value(key, profile_snapshot, answered_map):
    """profile.<dot.path> resolves into the frozen profile snapshot;
    qa.<id> resolves into an already-answered pending question from THIS
    run. Anything that doesn't cleanly resolve is refused, not guessed."""
    if not key:
        return None, "profile_field_key is required for a sensitive field — reference verified data, don't invent a value."
    if key.startswith("profile."):
        node = profile_snapshot or {}
        for part in key[len("profile."):].split("."):
            if isinstance(node, list):
                try:
                    node = node[int(part)]
                except (ValueError, IndexError):
                    return None, f"Could not resolve '{key}' — no such item in the verified profile."
            elif isinstance(node, dict):
                if part not in node:
                    return None, f"'{key}' is not present in the verified profile — call ask_user instead of guessing."
                node = node[part]
            else:
                return None, f"Could not resolve '{key}'."
        if node in (None, "", []):
            return None, f"'{key}' is not set in the verified profile — call ask_user instead of guessing."
        return node, None
    if key.startswith("qa."):
        qid = key[len("qa."):]
        entry = answered_map.get(qid)
        if not entry:
            return None, f"No confirmed answer for '{key}' yet — call ask_user first and wait for it to be answered."
        return entry["answer"], None
    return None, f"Unrecognized profile_field_key '{key}' — must start with 'profile.' or 'qa.'."


class ToolContext:
    """Everything a tool call needs, handed in by the loop each turn.
    `pending_questions`/`steps_log` are mutated in place — the loop persists
    them to the ApplicationRun row after every step."""

    def __init__(self, session, profile_snapshot, pending_questions, unfillable_fields):
        self.session = session
        self.profile_snapshot = profile_snapshot or {}
        self.pending_questions = pending_questions
        self.unfillable_fields = unfillable_fields
        self.answered_map = {
            q["id"]: q for q in pending_questions if q.get("answered") and q.get("answer") is not None
        }
        self.stop_requested = False
        self.stop_reason = None


def _element_meta_or_error(ctx, ref):
    meta = ctx.session.element_meta(ref)
    if not meta:
        return None, {"ok": False, "message": f"Unknown or stale ref '{ref}' — page state changed, re-observe before acting."}
    return meta, None


def tool_fill_field(ctx, tool_input):
    ref = tool_input.get("ref")
    value = tool_input.get("value")
    profile_field_key = tool_input.get("profile_field_key")

    meta, err = _element_meta_or_error(ctx, ref)
    if err:
        return err

    category = classify_sensitive(meta.get("label", ""))
    if category:
        resolved, err_msg = resolve_profile_value(profile_field_key, ctx.profile_snapshot, ctx.answered_map)
        if err_msg:
            return {"ok": False, "message": f"[{category}] {err_msg}"}
        final_value = resolved
    else:
        if profile_field_key:
            resolved, err_msg = resolve_profile_value(profile_field_key, ctx.profile_snapshot, ctx.answered_map)
            if err_msg:
                return {"ok": False, "message": err_msg}
            final_value = resolved
        elif value is not None:
            final_value = value
        else:
            return {"ok": False, "message": "Provide either 'value' or 'profile_field_key'."}

    ctx.session.fill(ref, final_value)
    return {"ok": True, "message": f"Filled '{meta.get('label') or ref}' with: {final_value}", "written_value": str(final_value)}


def tool_select_dropdown(ctx, tool_input):
    ref = tool_input.get("ref")
    option = tool_input.get("option")
    profile_field_key = tool_input.get("profile_field_key")

    meta, err = _element_meta_or_error(ctx, ref)
    if err:
        return err

    category = classify_sensitive(meta.get("label", ""))
    if category:
        resolved, err_msg = resolve_profile_value(profile_field_key, ctx.profile_snapshot, ctx.answered_map)
        if err_msg:
            return {"ok": False, "message": f"[{category}] {err_msg}"}
        option = str(resolved)
    elif not option:
        return {"ok": False, "message": "Provide 'option' (or profile_field_key for a sensitive field)."}

    try:
        ctx.session.select(ref, option)
    except Exception as e:
        return {"ok": False, "message": f"Could not select '{option}': {e}"}
    return {"ok": True, "message": f"Selected '{option}' for '{meta.get('label') or ref}'", "written_value": option}


def tool_click(ctx, tool_input):
    ref = tool_input.get("ref")
    meta, err = _element_meta_or_error(ctx, ref)
    if err:
        return err

    if is_submit_classified(meta.get("label", ""), meta.get("tag", ""), meta.get("type", ""), meta.get("in_form", False)):
        return {
            "ok": False,
            "message": "Refused: this looks like the final submit button. This agent never clicks that — call done() once the rest of the form is filled; a human reviews and submits separately.",
        }

    ctx.session.click(ref)
    return {"ok": True, "message": f"Clicked '{meta.get('label') or ref}'"}


def tool_upload_file(ctx, tool_input):
    ref = tool_input.get("ref")
    file_type = tool_input.get("file_type")
    meta, err = _element_meta_or_error(ctx, ref)
    if err:
        return err
    if file_type not in ("resume", "cover_letter"):
        return {"ok": False, "message": "file_type must be 'resume' or 'cover_letter'."}
    path = ctx.profile_snapshot.get(f"_{file_type}_file_path")
    if not path:
        return {"ok": False, "message": f"No {file_type} file is available for this run."}
    ctx.session.upload(ref, path)
    return {"ok": True, "message": f"Uploaded {file_type}"}


def tool_ask_user(ctx, tool_input):
    question = tool_input.get("question")
    field_label = tool_input.get("field_label", "")
    if not question:
        return {"ok": False, "message": "question is required."}
    import uuid
    qid = uuid.uuid4().hex[:8]
    ctx.pending_questions.append({
        "id": qid, "question": question, "field_label": field_label,
        "answered": False, "answer": None,
    })
    ctx.stop_requested = True
    ctx.stop_reason = "needs_input"
    return {"ok": True, "message": f"Asked the user: {question} (run paused until answered)"}


def tool_done(ctx, tool_input):
    ctx.stop_requested = True
    ctx.stop_reason = "done"
    return {"ok": True, "message": "Form filling complete."}


TOOL_IMPLS = {
    "fill_field": tool_fill_field,
    "select_dropdown": tool_select_dropdown,
    "click": tool_click,
    "upload_file": tool_upload_file,
    "ask_user": tool_ask_user,
    "done": tool_done,
}

# Anthropic tool-use schema — no `submit`/`press_key`/`execute_js` tool
# exists anywhere in this list, on purpose (see module docstring).
TOOL_SCHEMAS = [
    {
        "name": "fill_field",
        "description": "Type a value into a text/email/tel/date/textarea field. For sensitive fields (work authorization, visa/immigration, security clearance, education, certifications, employment dates, years of experience, salary, background) you MUST pass profile_field_key instead of value — a raw value will be refused.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ref": {"type": "string", "description": "The element ref from the last page observation."},
                "value": {"type": "string", "description": "Literal text to type — only allowed for non-sensitive fields."},
                "profile_field_key": {"type": "string", "description": "e.g. 'profile.full_name', 'profile.work_authorization.status', 'qa.<id>' — a reference into verified data, required for sensitive fields."},
            },
            "required": ["ref"],
        },
    },
    {
        "name": "select_dropdown",
        "description": "Choose an option in a <select> or dropdown widget. For sensitive fields, pass profile_field_key instead of option.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ref": {"type": "string"},
                "option": {"type": "string", "description": "The visible option text to select."},
                "profile_field_key": {"type": "string"},
            },
            "required": ["ref"],
        },
    },
    {
        "name": "click",
        "description": "Click a button/link/checkbox/radio. Refused automatically if it looks like the application's final submit button — call done() instead once the form is filled.",
        "input_schema": {
            "type": "object",
            "properties": {"ref": {"type": "string"}},
            "required": ["ref"],
        },
    },
    {
        "name": "upload_file",
        "description": "Attach the candidate's resume or cover letter to a file-upload field.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ref": {"type": "string"},
                "file_type": {"type": "string", "enum": ["resume", "cover_letter"]},
            },
            "required": ["ref", "file_type"],
        },
    },
    {
        "name": "ask_user",
        "description": "Pause and ask the human a question when a REQUIRED field has no verified data behind it. Never guess or invent an answer — always ask instead.",
        "input_schema": {
            "type": "object",
            "properties": {
                "question": {"type": "string"},
                "field_label": {"type": "string"},
            },
            "required": ["question"],
        },
    },
    {
        "name": "done",
        "description": "Call this once every required field is filled (or flagged as unfillable/asked about). This ends the run and hands it to the human for review — you never click the final submit button yourself.",
        "input_schema": {"type": "object", "properties": {}},
    },
]
