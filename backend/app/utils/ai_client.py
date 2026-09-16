"""
app/utils/ai_client.py — shared Claude-then-Groq text completion.

Extracted here so a new AI-calling endpoint (api/brand.py) doesn't need a
third copy of this logic. api/resume.py and api/artisans.py each already
carry their own pre-existing copies of the same pattern — deliberately not
refactored to use this one here: neither was broken, and touching a
working, already-deployed AI call path wasn't part of what this file was
added for. New AI endpoints from here on should use this instead of
copy-pasting a fourth one.
"""
import os
import re
import time

import anthropic
import requests

from app.middleware.error_handlers import APIError

CLAUDE_MODEL = "claude-opus-5"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "openai/gpt-oss-120b"

# Same reasoning as resume.py's identical constants — Groq's free-tier TPM
# limit is easy to hit and near-certain to clear within a few seconds.
MAX_RATE_LIMIT_RETRIES = 2
DEFAULT_RATE_LIMIT_BACKOFF = 3
MAX_RATE_LIMIT_BACKOFF = 10
_RETRY_AFTER_RE = re.compile(r"try again in ([\d.]+)s", re.IGNORECASE)


def _claude(messages, system, effort="medium", max_tokens=800):
    api_key = os.environ.get("CLAUDE_API_KEY", "")
    if not api_key:
        raise APIError("CLAUDE_API_KEY not configured", 500)

    client = anthropic.Anthropic(api_key=api_key)
    try:
        res = client.with_options(timeout=45).messages.create(
            model=CLAUDE_MODEL, system=system, messages=messages,
            max_tokens=max_tokens, output_config={"effort": effort},
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
        raise APIError(f"Network error while calling AI: {e}", 502)


def _groq(messages, temperature=0.5, max_tokens=800):
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        raise APIError("GROQ_API_KEY not configured", 500)

    attempt = 0
    while True:
        try:
            res = requests.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": GROQ_MODEL, "messages": messages, "max_tokens": max_tokens,
                    "temperature": temperature, "reasoning_effort": "low", "stream": False,
                },
                timeout=45,
            )
            if res.status_code == 429 and attempt < MAX_RATE_LIMIT_RETRIES:
                attempt += 1
                retry_after = None
                header_val = res.headers.get("retry-after")
                if header_val:
                    try:
                        retry_after = float(header_val)
                    except ValueError:
                        pass
                if retry_after is None:
                    match = _RETRY_AFTER_RE.search(res.text)
                    if match:
                        retry_after = float(match.group(1))
                time.sleep(min(retry_after or DEFAULT_RATE_LIMIT_BACKOFF, MAX_RATE_LIMIT_BACKOFF))
                continue

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
            raise APIError(f"Network error while calling AI: {e}", 502)


def ai_complete(system, prompt, effort="medium", max_tokens=800, groq_temperature=0.5):
    """Generate text via Claude, falling back to Groq if Claude fails for any reason."""
    try:
        return _claude(messages=[{"role": "user", "content": prompt}], system=system, effort=effort, max_tokens=max_tokens)
    except APIError as claude_err:
        print(f"⚠️ Claude generation failed, falling back to Groq: {claude_err}")
        try:
            return _groq(
                messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}],
                temperature=groq_temperature, max_tokens=max_tokens,
            )
        except APIError as groq_err:
            raise APIError(f"AI generation failed (Claude: {claude_err}; Groq: {groq_err})", 502)
