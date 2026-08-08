"""
app/agent/browser.py — the "Hands": a real Playwright browser session, page
state extracted into something an LLM can reason about, and the one
hard-coded guardrail this whole feature actually leans on: refusing to
click anything that looks like a final submit.

Threading model — this is the part that isn't optional to get right:
Playwright's sync API is bound to the OS thread that created it. The
background thread spawned by api/apply.py owns this session end to end,
INCLUDING the final submit click. An HTTP request thread (e.g. the
confirm-submit endpoint) can never safely call into a session it didn't
create — so it doesn't. Instead, once a run reaches ready_for_review, its
owning thread parks on a threading.Event and waits; confirm-submit/cancel
just set a flag on the registered PendingReview and wait for that same
owning thread to notice, act, and report back. See PendingReview / the
SESSION_REGISTRY below.
"""
import re
import threading
import time
import uuid

# ── Cross-thread handoff for the review window ─────────────────────────────
# In-process only, by design — a run's live browser only ever exists on the
# single dyno that started it (see the plan's single-worker/no-queue
# reasoning). A restart loses any in-flight PendingReview; the boot-time
# sweep in app/__init__.py is what reconciles the DB row when that happens.
SESSION_REGISTRY = {}
_REGISTRY_LOCK = threading.Lock()


class PendingReview:
    """One awaited decision: the owning thread is blocked on `decided`,
    and confirm()/cancel() (called from a completely different thread — an
    HTTP request handler) are the only way to unblock it. `outcome` is
    "submit" or "cancel" once set; `result`/`error` are populated by the
    owning thread AFTER it acts, so confirm()/cancel() can wait for the
    actual result instead of just firing and hoping."""

    def __init__(self):
        self.decided = threading.Event()
        self.acted = threading.Event()
        self.outcome = None  # "submit" | "cancel" | None (timed out)
        self.result = None
        self.error = None

    def confirm(self, timeout=30):
        self.outcome = "submit"
        self.decided.set()
        self.acted.wait(timeout=timeout)
        return self.result, self.error

    def cancel(self, timeout=30):
        self.outcome = "cancel"
        self.decided.set()
        self.acted.wait(timeout=timeout)
        return self.result, self.error


def register_session(pending: PendingReview) -> str:
    session_id = uuid.uuid4().hex
    with _REGISTRY_LOCK:
        SESSION_REGISTRY[session_id] = pending
    return session_id


def get_pending(session_id):
    with _REGISTRY_LOCK:
        return SESSION_REGISTRY.get(session_id)


def unregister_session(session_id):
    with _REGISTRY_LOCK:
        SESSION_REGISTRY.pop(session_id, None)


# ── Submit-button classifier — the actual guardrail ─────────────────────────
# Deliberately over-inclusive: better to occasionally refuse a legitimate
# "next section" button on a multi-step wizard than ever miss a real final
# submit. This runs regardless of what the model intended (see
# app/agent/tools.py's click()) — it is not a prompt instruction.
_SUBMIT_TEXT_RE = re.compile(
    r"\b(submit( application)?|apply now|send application|finish application|"
    r"complete application|submit your application)\b",
    re.IGNORECASE,
)
_CONFIRMATION_URL_RE = re.compile(
    r"thank[\s-]?you|confirmation|application[\s-]?(received|submitted|complete)",
    re.IGNORECASE,
)


def is_submit_classified(label: str, tag: str, el_type: str, in_form: bool) -> bool:
    if not label:
        return False
    if not _SUBMIT_TEXT_RE.search(label):
        return False
    looks_like_button = tag == "button" or (tag == "input" and el_type in ("submit", "button"))
    return looks_like_button and in_form


def looks_like_confirmation_page(url: str, title: str) -> bool:
    return bool(_CONFIRMATION_URL_RE.search(url or "")) or bool(_CONFIRMATION_URL_RE.search(title or ""))


# ── Page-state extraction ───────────────────────────────────────────────────
# Injected into every frame (including iframes — Greenhouse and a lot of
# ATS platforms embed the real form in one). Walks interactive elements and
# assigns each a stable `ref` scoped to (frame_index, element_index) so a
# later action can be resolved back to the exact element even though
# Playwright ElementHandles themselves can't survive a round trip through
# the LLM's tool call.
_EXTRACT_JS = r"""
() => {
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  };
  const labelFor = (el) => {
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl && lbl.innerText.trim()) return lbl.innerText.trim();
    }
    const aria = el.getAttribute("aria-label");
    if (aria && aria.trim()) return aria.trim();
    const labelledby = el.getAttribute("aria-labelledby");
    if (labelledby) {
      const parts = labelledby.split(/\s+/).map(id => document.getElementById(id)?.innerText?.trim()).filter(Boolean);
      if (parts.length) return parts.join(" ");
    }
    const wrapping = el.closest("label");
    if (wrapping) {
      // A <label>Text <select>...</select></label> wrap (no `for`/id) is
      // common on real forms — read the label's text MINUS the field's own
      // subtree, or a <select>'s option text ends up mashed into its own label.
      const clone = wrapping.cloneNode(true);
      const idx = Array.from(wrapping.querySelectorAll("input, select, textarea, button")).indexOf(el);
      const cloneEl = clone.querySelectorAll("input, select, textarea, button")[idx];
      if (cloneEl) cloneEl.remove();
      const text = clone.innerText.trim();
      if (text) return text;
    }
    if (el.placeholder) return el.placeholder.trim();
    if (el.innerText && el.innerText.trim()) return el.innerText.trim().slice(0, 200);
    if (el.value && (el.tagName === "BUTTON" || el.type === "submit" || el.type === "button")) return el.value.trim();
    return "";
  };

  const els = Array.from(document.querySelectorAll(
    "input, select, textarea, button, [role=button], [role=combobox], [role=checkbox], [role=radio]"
  ));

  return els.map((el, i) => {
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute("type") || "").toLowerCase();
    const options = tag === "select"
      ? Array.from(el.options).map(o => o.text.trim())
      : (el.getAttribute("role") === "combobox" ? null : null);
    return {
      index: i,
      tag,
      type,
      name: el.getAttribute("name") || "",
      label: labelFor(el),
      value: (el.value !== undefined ? String(el.value) : "").slice(0, 300),
      options,
      required: el.required === true || el.getAttribute("aria-required") === "true",
      visible: isVisible(el),
      in_form: !!el.closest("form"),
      disabled: !!el.disabled,
    };
  }).filter(e => e.visible);
}
"""


class AgentBrowserSession:
    """Owns exactly one Playwright browser/context/page for the lifetime of
    one ApplicationRun. Must only ever be touched from the single
    background thread that created it (see module docstring)."""

    def __init__(self, run_id):
        self.run_id = run_id
        self._pw = None
        self.browser = None
        self.context = None
        self.page = None
        # ref -> (frame, element_index) resolved fresh on every extract();
        # refs are only valid until the next extract() call, matching how
        # the tool loop always re-observes after every action (see loop.py).
        self._ref_map = {}

    def start(self, url, timeout_ms=30000):
        from playwright.sync_api import sync_playwright
        self._pw = sync_playwright().start()
        self.browser = self._pw.chromium.launch(headless=True)
        self.context = self.browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            viewport={"width": 1280, "height": 900},
        )
        self.page = self.context.new_page()
        self.page.goto(url, timeout=timeout_ms, wait_until="domcontentloaded")

    def _frames(self):
        # Main frame first, then any iframes — first-match-wins when a ref
        # is resolved, consistent ordering between extract() calls on a
        # stable page.
        return list(self.page.frames)

    def extract_state(self):
        self._ref_map = {}
        elements = []
        for frame in self._frames():
            try:
                found = frame.evaluate(_EXTRACT_JS)
            except Exception:
                continue  # detached/cross-origin frame mid-navigation — skip, not fatal
            for item in found:
                ref = f"r{len(elements)}"
                # meta cached from THIS SAME extraction pass — element_meta()
                # below returns it directly rather than re-querying the DOM
                # with a second, weaker label computation that could
                # disagree with what was actually shown to the model
                # (exactly the kind of drift that would let a sensitive
                # field slip past classify_sensitive() undetected).
                self._ref_map[ref] = {"frame": frame, "index": item["index"], "meta": item}
                elements.append({**item, "ref": ref, "index": None})
        return {
            "url": self.page.url,
            "title": self.page.title(),
            "elements": elements,
        }

    def _resolve(self, ref):
        entry = self._ref_map.get(ref)
        if not entry:
            raise ValueError(f"Unknown or stale ref '{ref}' — page state changed, re-observe before acting.")
        frame, index = entry["frame"], entry["index"]
        handle = frame.evaluate_handle(
            "(i) => Array.from(document.querySelectorAll('input, select, textarea, button, [role=button], [role=combobox], [role=checkbox], [role=radio]'))[i]",
            index,
        )
        return frame, handle.as_element()

    def element_meta(self, ref):
        entry = self._ref_map.get(ref)
        return entry["meta"] if entry else None

    def fill(self, ref, value):
        frame, el = self._resolve(ref)
        el.scroll_into_view_if_needed()
        el.fill(str(value))

    def select(self, ref, option_text):
        frame, el = self._resolve(ref)
        el.scroll_into_view_if_needed()
        el.select_option(label=option_text)

    def click(self, ref):
        frame, el = self._resolve(ref)
        el.scroll_into_view_if_needed()
        el.click()
        self.page.wait_for_timeout(400)  # let any resulting nav/render settle before the next extract()

    def upload(self, ref, file_path):
        frame, el = self._resolve(ref)
        el.set_input_files(file_path)

    def screenshot_bytes(self):
        return self.page.screenshot(full_page=True, type="png")

    def close(self):
        try:
            if self.context:
                self.context.close()
            if self.browser:
                self.browser.close()
        finally:
            if self._pw:
                self._pw.stop()
