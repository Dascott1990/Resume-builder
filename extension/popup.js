// popup.js — the extension's only real logic. No content_scripts entry in
// the manifest on purpose: scripting.executeScript + "activeTab" only
// touches the page the user is actually looking at, at the moment they
// click the extension icon, instead of asking Chrome for standing
// permission to run on every job board site. Same reasoning as the
// existing bookmarklet (generic document.body.innerText extraction, not
// fragile per-site selectors) — see frontend/lib/bookmarklet.js.
const API_BASE = "https://resume-builder-blfc.onrender.com";
const TOKEN_KEY = "noqeev_pat";
const JD_LIMIT = 6000;

const $ = (id) => document.getElementById(id);

function setStatus(el, text, kind) {
  el.textContent = text || "";
  el.className = kind || "";
}

function showSetup(show) {
  $("main").style.display = show ? "none" : "block";
  $("setup").style.display = show ? "block" : "none";
}

// Injected into the active tab — must be a standalone function (no
// closure over this file's scope), since scripting.executeScript sends
// only its source across to the page.
function extractJobPageInfo() {
  const text = (document.title || "") + "\n" + (document.body?.innerText || "");
  const metaCompany =
    document.querySelector('meta[property="og:site_name"]')?.content ||
    document.querySelector('meta[name="author"]')?.content || "";
  return {
    title: document.title || "",
    url: location.href,
    metaCompany,
    bodyText: (document.body?.innerText || "").slice(0, 8000),
  };
}

function guessRoleAndCompany(pageTitle) {
  // Common job-board <title> shapes: "Role at Company | Site",
  // "Role - Company - Site", "Company hiring Role". Best-effort only —
  // always left editable, never trusted blindly (see popup.html).
  const cleaned = (pageTitle || "").replace(/\s*[|·]\s*(LinkedIn|Indeed|Glassdoor).*$/i, "").trim();
  let m = cleaned.match(/^(.*?)\s+at\s+(.*?)(?:\s*[-|].*)?$/i);
  if (m) return { role: m[1].trim(), company: m[2].trim() };
  m = cleaned.match(/^(.*?)\s*[-–]\s*(.*?)(?:\s*[-|].*)?$/);
  if (m) return { role: m[1].trim(), company: m[2].trim() };
  return { role: cleaned, company: "" };
}

async function apiRequest(path, options = {}) {
  const token = (await chrome.storage.local.get(TOKEN_KEY))[TOKEN_KEY];
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) throw new Error(body.error || `Request failed (${res.status})`);
  return body.data;
}

async function init() {
  const stored = await chrome.storage.local.get(TOKEN_KEY);
  if (!stored[TOKEN_KEY]) {
    showSetup(true);
    return;
  }
  showSetup(false);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractJobPageInfo });
      if (result) {
        const guess = guessRoleAndCompany(result.title);
        $("company").value = guess.company || result.metaCompany || "";
        $("role").value = guess.role || "";
        $("jd").value = result.bodyText.slice(0, JD_LIMIT);
        $("save").dataset.url = result.url || tab.url || "";
      }
    }
  } catch (e) {
    // Can't inject into chrome:// pages, the Chrome Web Store, etc. —
    // leave the form blank rather than show a scary error for something
    // that isn't actually a job page anyway.
  }
}

$("save").addEventListener("click", async () => {
  const status = $("status");
  const company = $("company").value.trim();
  const role = $("role").value.trim();
  if (!company || !role) {
    setStatus(status, "Company and role are required.", "error");
    return;
  }
  $("save").disabled = true;
  setStatus(status, "Saving…");
  try {
    await apiRequest("/api/v1/extension/capture", {
      method: "POST",
      body: JSON.stringify({
        company, role,
        url: $("save").dataset.url || "",
        job_description: $("jd").value.trim(),
      }),
    });
    setStatus(status, "Saved to your Job Tracker.", "success");
  } catch (e) {
    if (String(e.message).toLowerCase().includes("invalid or revoked")) {
      setStatus(status, "Your connection expired — reconnect your account.", "error");
      showSetup(true);
    } else {
      setStatus(status, e.message, "error");
    }
  } finally {
    $("save").disabled = false;
  }
});

$("openSettings").addEventListener("click", () => showSetup(true));
$("backToMain").addEventListener("click", () => showSetup(false));

$("saveToken").addEventListener("click", async () => {
  const status = $("setupStatus");
  const raw = $("token").value.trim();
  if (!raw.startsWith("npat_")) {
    setStatus(status, "That doesn't look like a Noqeev token (should start with npat_).", "error");
    return;
  }
  await chrome.storage.local.set({ [TOKEN_KEY]: raw });
  setStatus(status, "Connected.", "success");
  setTimeout(() => { $("token").value = ""; init(); }, 600);
});

init();
