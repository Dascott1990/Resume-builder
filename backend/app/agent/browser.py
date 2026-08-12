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
        self._decision_lock = threading.Lock()
        self.decided = threading.Event()
        self.acted = threading.Event()
        self.outcome = None  # "submit" | "cancel" | None (timed out)
        self.result = None
        self.error = None

    def _decide(self, outcome, timeout):
        # First decision wins — without the lock, confirm() and cancel()
        # racing from two request threads (e.g. a double-click, or two
        # tabs open on the same run) could both write self.outcome, and
        # whichever writes LAST wins even if it wasn't first — including
        # after the owning background thread has already woken up on
        # `decided` but before it's read self.outcome, silently switching
        # which action actually executes. Locking the read-modify-write
        # and only ever setting outcome once makes the first caller's
        # decision the only one that can ever take effect; a second,
        # racing caller just waits for and receives the SAME real outcome
        # instead of corrupting it.
        with self._decision_lock:
            if not self.decided.is_set():
                self.outcome = outcome
                self.decided.set()
        self.acted.wait(timeout=timeout)
        return self.result, self.error

    def confirm(self, timeout=30):
        return self._decide("submit", timeout)

    def cancel(self, timeout=30):
        return self._decide("cancel", timeout)


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


def is_submit_classified(label: str, tag: str = None, el_type: str = None, in_form: bool = None) -> bool:
    # Text match ONLY — used to require tag in (button, input) AND in_form,
    # which sounds tighter but actually missed the two most common real
    # submit buttons: a styled `<div role="button">Submit application</div>`
    # (not a real button/input tag) and any React/Workday-style form with no
    # `<form>` ancestor at all (most SPA forms don't use one). Either gap
    # alone meant the agent could click a real final submit itself with no
    # human ever approving it — the exact thing this classifier exists to
    # prevent. Deliberately over-inclusive on text alone: better to
    # occasionally refuse a legitimate "next section" button than ever miss
    # a real one. tag/el_type/in_form are accepted but unused now, kept so
    # existing call sites don't need to change their argument lists.
    if not label:
        return False
    return bool(_SUBMIT_TEXT_RE.search(label))


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

  // Radio/checkbox OPTIONS almost never carry the sensitive question text
  // themselves (their own label is just "Yes"/"No"/"Male"/etc.) — the
  // question lives on the group, not the option. Without this, "Are you
  // legally authorized to work in the US?" never matches any sensitive
  // pattern because classify_sensitive only ever saw "Yes".
  const groupLabelFor = (el) => {
    const type = (el.getAttribute("type") || "").toLowerCase();
    const role = el.getAttribute("role") || "";
    if (type !== "radio" && type !== "checkbox" && role !== "radio" && role !== "checkbox") return "";
    const group = el.closest('[role="radiogroup"], [role="group"]');
    if (group) {
      const aria = group.getAttribute("aria-label");
      if (aria && aria.trim()) return aria.trim();
      const labelledby = group.getAttribute("aria-labelledby");
      if (labelledby) {
        const parts = labelledby.split(/\s+/).map(id => document.getElementById(id)?.innerText?.trim()).filter(Boolean);
        if (parts.length) return parts.join(" ");
      }
    }
    const fieldset = el.closest("fieldset");
    if (fieldset) {
      const legend = fieldset.querySelector("legend");
      if (legend && legend.innerText.trim()) return legend.innerText.trim();
    }
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
    // For a <select>, .value is the option's `value` attribute (often a
    // meaningless code like "4"), never what a human reviewing the filled
    // form would recognize — the selected option's own visible TEXT is
    // what actually belongs on a review screen.
    const selectedLabel = tag === "select" && el.selectedIndex >= 0
      ? el.options[el.selectedIndex].text.trim()
      : null;
    return {
      index: i,
      tag,
      type,
      name: el.getAttribute("name") || "",
      label: labelFor(el),
      group_label: groupLabelFor(el),
      value: (el.value !== undefined ? String(el.value) : "").slice(0, 300),
      selected_label: selectedLabel,
      checked: (type === "checkbox" || type === "radio") ? !!el.checked : null,
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
        frame, index, meta = entry["frame"], entry["index"], entry["meta"]
        handle = frame.evaluate_handle(
            "(i) => Array.from(document.querySelectorAll('input, select, textarea, button, [role=button], [role=combobox], [role=checkbox], [role=radio]'))[i]",
            index,
        )
        el = handle.as_element()
        if el is None:
            raise ValueError(f"Ref '{ref}' no longer exists on the page — re-observe before acting.")
        # A cheap identity check before acting — a DOM insertion/removal
        # between extract_state() and this call (a conditional field
        # appearing, a React re-render) can shift what the same index
        # points to. Without this, a value classify_sensitive() approved
        # against the OLD element's label could silently land in a
        # completely different field. Doesn't catch every possible drift
        # (same tag/type/name but different visible text), but catches the
        # structural case cheaply without a full re-extraction on every action.
        current = frame.evaluate(
            "(i) => { const e = Array.from(document.querySelectorAll('input, select, textarea, button, [role=button], [role=combobox], [role=checkbox], [role=radio]'))[i]; return e ? {tag: e.tagName.toLowerCase(), type: (e.getAttribute('type')||'').toLowerCase(), name: e.getAttribute('name')||''} : null; }",
            index,
        )
        if not current or current["tag"] != meta.get("tag") or current["name"] != meta.get("name"):
            raise ValueError(f"Ref '{ref}' no longer matches what was last observed there — the page changed, re-observe before acting.")
        return frame, el

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
