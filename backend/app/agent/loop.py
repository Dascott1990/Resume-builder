"""
app/agent/loop.py — the "Brain": a manual, multi-turn tool-use loop that
drives the browser session one action at a time. Deliberately NOT the
beta tool-runner — the safety enforcement in agent/tools.py needs a code
hook on every single tool call before it executes, which a manual loop
makes explicit rather than something happening inside a library.

Claude-then-Groq fallback, matching how every other AI-calling endpoint in
this app already handles the (currently ongoing) Claude billing gap — see
resume.py's _ai_complete. The difference here: this is a STATEFUL,
multi-turn conversation, and Anthropic's tool_use content blocks and
Groq's OpenAI-compatible tool_calls are genuinely different wire formats,
not just different endpoints. So the conversation history is kept in one
provider-neutral internal representation throughout (see _history_to_*
below) and only converted to a specific wire format at call time. The
provider is chosen ONCE at the start of a run (try Claude, fall back to
Groq on failure) and then used for every remaining turn — switching
providers mid-conversation would mean re-deriving a whole history in a
format neither provider ever actually produced, which is fragile for no
real benefit (if Claude is down/out of credit, it's down for the whole run).

Scope: this loop ONLY fills the form. Reading the job posting and
preparing/tailoring a resume (reusing the existing /resume/optimize
pipeline) both happen in the caller (app/api/apply.py) before this is ever
invoked — this file's only job is: given a browser already sitting on the
application page, fill it out using verified data, then stop.
"""
import json
import os
import time

import anthropic
import requests

from app.agent.tools import TOOL_IMPLS, TOOL_SCHEMAS, ToolContext

CLAUDE_MODEL = "claude-opus-5"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"

MAX_STEPS = 60
MAX_WALL_CLOCK_SECONDS = 220
MAX_TOKENS_PER_TURN = 1500
MAX_MAX_TOKENS_RETRIES = 2
MAX_NO_ACTION_WARNINGS = 1

SYSTEM_PROMPT = """You are filling out a real job application form on behalf of a candidate. You act through tools only — you never see or touch anything except through fill_field, select_dropdown, click, upload_file, ask_user, and done.

HARD RULES:
- Never invent, guess, or estimate any fact about the candidate. If a required field needs information you don't have a verified source for (via profile_field_key), call ask_user instead of filling anything.
- This is especially strict for: work authorization, visa/immigration status, security clearance, education, certifications, employment dates, years of experience, salary, and background/criminal history. Those fields WILL be refused unless you supply profile_field_key referencing verified data — don't bother trying a literal value.
- You have no submit capability and never will. Once every required field is filled, or flagged as unfillable/asked-about, call done(). A human reviews everything and submits separately.
- Call exactly one tool per turn. After each action, you'll be shown the page's current state — always act on what you're actually shown, not what you assume is still true from before.
- If a field is optional and you don't have data for it, just skip it rather than asking or inventing something.
- If you notice a field that's genuinely required but you have no way to fill it (not a fact question — e.g. a file type you can't produce), don't loop on it — note it and keep moving, it will show up for the human to finish.

You'll receive the candidate's verified profile data as context below. Use profile_field_key (e.g. "profile.full_name", "profile.work_authorization.status") to reference it for sensitive fields, or plain values for ordinary contact/text fields."""

TOOL_SCHEMAS_OPENAI = [
    {"type": "function", "function": {"name": t["name"], "description": t["description"], "parameters": t["input_schema"]}}
    for t in TOOL_SCHEMAS
]


def _build_profile_context(profile_snapshot):
    return "VERIFIED CANDIDATE PROFILE (only source of truth — nothing outside this is verified):\n" + json.dumps(profile_snapshot, indent=2)


def _state_to_observation_text(state):
    fields = [
        {k: v for k, v in el.items() if k in ("ref", "tag", "type", "label", "value", "options", "required")}
        for el in state["elements"]
    ]
    return f"PAGE: {state['title']} ({state['url']})\nINTERACTIVE ELEMENTS:\n{json.dumps(fields, indent=2)}"


# ── Provider-neutral history <-> wire format converters ────────────────────
# History entries: {"role": "user", "content": str}
#                   {"role": "assistant", "tool_calls": [{"id","name","input"}], "text": str|None}
#                   {"role": "tool_results", "results": [{"tool_call_id","content","is_error"}]}

def _history_to_anthropic(history):
    messages = []
    for turn in history:
        if turn["role"] == "user":
            messages.append({"role": "user", "content": turn["content"]})
        elif turn["role"] == "assistant":
            content = []
            if turn.get("text"):
                content.append({"type": "text", "text": turn["text"]})
            for tc in turn["tool_calls"]:
                content.append({"type": "tool_use", "id": tc["id"], "name": tc["name"], "input": tc["input"]})
            messages.append({"role": "assistant", "content": content})
        elif turn["role"] == "tool_results":
            messages.append({"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": r["tool_call_id"], "content": r["content"], "is_error": r["is_error"]}
                for r in turn["results"]
            ]})
    return messages


def _history_to_openai(history):
    messages = []
    for turn in history:
        if turn["role"] == "user":
            messages.append({"role": "user", "content": turn["content"]})
        elif turn["role"] == "assistant":
            msg = {"role": "assistant", "content": turn.get("text")}
            if turn["tool_calls"]:
                msg["tool_calls"] = [
                    {"id": tc["id"], "type": "function", "function": {"name": tc["name"], "arguments": json.dumps(tc["input"])}}
                    for tc in turn["tool_calls"]
                ]
            messages.append(msg)
        elif turn["role"] == "tool_results":
            for r in turn["results"]:
                messages.append({"role": "tool", "tool_call_id": r["tool_call_id"], "content": r["content"]})
    return messages


def _call_claude(history, system):
    api_key = os.environ.get("CLAUDE_API_KEY", "")
    if not api_key:
        raise RuntimeError("CLAUDE_API_KEY not configured")
    client = anthropic.Anthropic(api_key=api_key)
    res = client.with_options(timeout=60).messages.create(
        model=CLAUDE_MODEL,
        system=system,
        messages=_history_to_anthropic(history),
        tools=TOOL_SCHEMAS,
        max_tokens=MAX_TOKENS_PER_TURN,
        output_config={"effort": "medium"},
    )
    tool_calls = [{"id": b.id, "name": b.name, "input": b.input} for b in res.content if b.type == "tool_use"]
    text = next((b.text for b in res.content if b.type == "text"), None)
    if res.stop_reason == "tool_use":
        norm_stop = "tool_use"
    elif res.stop_reason == "max_tokens":
        norm_stop = "max_tokens"
    elif res.stop_reason == "refusal":
        norm_stop = "refusal"
    else:
        norm_stop = "end_turn"
    return {"stop_reason": norm_stop, "tool_calls": tool_calls, "assistant_text": text}


def _call_groq(history, system):
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not configured")
    messages = [{"role": "system", "content": system}] + _history_to_openai(history)
    res = requests.post(
        GROQ_URL,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": GROQ_MODEL, "messages": messages, "tools": TOOL_SCHEMAS_OPENAI,
            "max_tokens": MAX_TOKENS_PER_TURN, "temperature": 0.2, "stream": False,
        },
        timeout=60,
    )
    if not res.ok:
        raise RuntimeError(f"Groq API error: HTTP {res.status_code} — {res.text[:300]}")
    choice = res.json()["choices"][0]
    message = choice["message"]
    raw_tool_calls = message.get("tool_calls") or []
    tool_calls = []
    for tc in raw_tool_calls:
        try:
            args = json.loads(tc["function"]["arguments"])
        except (json.JSONDecodeError, KeyError):
            args = {}
        tool_calls.append({"id": tc["id"], "name": tc["function"]["name"], "input": args})

    finish_reason = choice.get("finish_reason")
    if tool_calls or finish_reason == "tool_calls":
        norm_stop = "tool_use"
    elif finish_reason == "length":
        norm_stop = "max_tokens"
    elif finish_reason == "content_filter":
        norm_stop = "refusal"
    else:
        norm_stop = "end_turn"
    return {"stop_reason": norm_stop, "tool_calls": tool_calls, "assistant_text": message.get("content")}


def _first_turn_with_fallback(history, system):
    """Only the first turn decides the provider for the whole run — see
    module docstring for why switching mid-conversation isn't worth it."""
    try:
        return _call_claude(history, system), "claude"
    except (anthropic.APIStatusError, anthropic.APIConnectionError, anthropic.APITimeoutError, RuntimeError) as claude_err:
        try:
            return _call_groq(history, system), "groq"
        except Exception as groq_err:
            raise RuntimeError(f"Both providers failed (Claude: {claude_err}; Groq: {groq_err})")


def run_agent_loop(session, profile_snapshot, pending_questions, unfillable_fields, on_step):
    """
    Drives the fill loop to completion. Mutates pending_questions/
    unfillable_fields in place (same lists the caller persists). Returns
    {"stop_reason": "done" | "needs_input" | "failed" | "step_limit_exceeded" | "time_limit_exceeded", "error": str|None}.
    `on_step(entry)` is called after every executed tool call so the caller
    can persist steps_log incrementally — a crash mid-run still leaves a
    useful partial record instead of nothing.
    """
    ctx = ToolContext(session, profile_snapshot, pending_questions, unfillable_fields)
    system = SYSTEM_PROMPT + "\n\n" + _build_profile_context(profile_snapshot)

    state = session.extract_state()
    history = [{"role": "user", "content": _state_to_observation_text(state)}]

    deadline = time.monotonic() + MAX_WALL_CLOCK_SECONDS
    no_action_warnings = 0
    max_tokens_retries = 0
    provider = None  # locked in after the first successful turn

    for step in range(1, MAX_STEPS + 1):
        if time.monotonic() > deadline:
            return {"stop_reason": "time_limit_exceeded", "error": None}

        try:
            if provider is None:
                turn, provider = _first_turn_with_fallback(history, system)
            elif provider == "claude":
                turn = _call_claude(history, system)
            else:
                turn = _call_groq(history, system)
        except Exception as e:
            return {"stop_reason": "failed", "error": str(e)}

        if turn["stop_reason"] == "refusal":
            return {"stop_reason": "failed", "error": "AI declined to continue with this application."}

        if turn["stop_reason"] == "max_tokens":
            max_tokens_retries += 1
            if max_tokens_retries > MAX_MAX_TOKENS_RETRIES:
                return {"stop_reason": "failed", "error": "AI response repeatedly truncated."}
            continue

        if not turn["tool_calls"]:
            no_action_warnings += 1
            if no_action_warnings > MAX_NO_ACTION_WARNINGS:
                return {"stop_reason": "failed", "error": "AI stopped acting without calling done()."}
            history.append({"role": "assistant", "tool_calls": [], "text": turn["assistant_text"]})
            history.append({"role": "user", "content": "You must call exactly one tool every turn — call done() if you believe the form is complete."})
            continue

        # Only the first tool call executes if the model emitted more than
        # one — page state changes after every action, so a second queued
        # action's ref may already be stale by the time we'd run it.
        primary = turn["tool_calls"][0]
        impl = TOOL_IMPLS.get(primary["name"])
        if not impl:
            result = {"ok": False, "message": f"Unknown tool '{primary['name']}'."}
        else:
            try:
                result = impl(ctx, primary["input"])
            except Exception as e:
                result = {"ok": False, "message": f"Tool execution error: {e}"}

        try:
            observation = _state_to_observation_text(session.extract_state())
        except Exception as e:
            observation = f"(Could not re-observe page: {e})"

        on_step({
            "step_number": step,
            "tool_name": primary["name"],
            "tool_input": primary["input"],
            "result_summary": result.get("message", ""),
            "ok": result.get("ok", False),
            "page_url": session.page.url,
        })

        # Every tool_use/tool_call in the assistant turn needs a matching
        # result or the next request to either provider gets rejected —
        # extras beyond the first are marked explicitly not-executed
        # rather than silently dropped.
        tool_results = [{
            "tool_call_id": primary["id"],
            "content": f"{result.get('message', '')}\n\n{observation}",
            "is_error": not result.get("ok", False),
        }]
        for extra in turn["tool_calls"][1:]:
            tool_results.append({
                "tool_call_id": extra["id"],
                "content": "Not executed — only one tool call is processed per turn. Re-observe the current page state before retrying this action.",
                "is_error": True,
            })

        history.append({"role": "assistant", "tool_calls": turn["tool_calls"], "text": turn["assistant_text"]})
        history.append({"role": "tool_results", "results": tool_results})

        if ctx.stop_requested:
            return {"stop_reason": ctx.stop_reason, "error": None}

    return {"stop_reason": "step_limit_exceeded", "error": None}
