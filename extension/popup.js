// popup.js — Universal DOM job extractor and save logic.
// Manifest V3: Uses scripting.executeScript + activeTab to inspect the active job posting.
// Extracts Schema.org JobPosting microdata, OpenGraph tags, or falls back to
// asynchronous backend parsing.
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

function showBadge(text, color = "#146c43", bg = "#eef5ea") {
  const badge = $("detectionBadge");
  if (!badge) return;
  if (!text) {
    badge.style.display = "none";
    return;
  }
  badge.textContent = text;
  badge.style.color = color;
  badge.style.backgroundColor = bg;
  badge.style.display = "block";
}

// Injected into the active tab — standalone function executed in page context.
function extractJobPageInfo() {
  // 1. Extract all Schema.org JSON-LD scripts
  let jsonLdCandidates = [];
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const s of scripts) {
    try {
      const parsed = JSON.parse(s.textContent || "");
      if (parsed) jsonLdCandidates.push(parsed);
    } catch (e) {}
  }

  // 2. Extract OpenGraph and standard meta tags
  const meta = {
    "og:title": document.querySelector('meta[property="og:title"]')?.content || "",
    "og:site_name": document.querySelector('meta[property="og:site_name"]')?.content || "",
    "og:description": document.querySelector('meta[property="og:description"]')?.content || "",
    "author": document.querySelector('meta[name="author"]')?.content || "",
    "description": document.querySelector('meta[name="description"]')?.content || "",
  };

  // 3. Extract semantic body content (prefer main or article containers)
  const mainEl = document.querySelector('main, article, [role="main"]') || document.body;
  const bodyText = (mainEl?.innerText || document.body?.innerText || "").slice(0, 10000);

  return {
    title: document.title || "",
    url: location.href,
    json_ld: jsonLdCandidates.length ? jsonLdCandidates : null,
    meta,
    body_text: bodyText,
  };
}

function parseClientSideJobPosting(jsonLdCandidates) {
  if (!jsonLdCandidates || !jsonLdCandidates.length) return null;

  for (const item of jsonLdCandidates) {
    let list = Array.isArray(item) ? item : (item["@graph"] || [item]);
    for (const obj of list) {
      if (obj && String(obj["@type"] || "").toLowerCase().includes("jobposting")) {
        const title = obj.title || obj.name || "";
        const org = obj.hiringOrganization;
        const company = (typeof org === "object" ? org?.name : org) || "";
        const desc = obj.description ? obj.description.replace(/<[^>]+>/g, " ").trim() : "";
        if (title && (company || desc)) {
          return { role: title, company, description: desc, strategy: "json_ld" };
        }
      }
    }
  }
  return null;
}

function guessRoleAndCompany(pageTitle, meta) {
  const metaCompany = meta?.["og:site_name"] || meta?.author || "";
  const cleaned = (pageTitle || "").replace(/\s*[|·]\s*(LinkedIn|Indeed|Glassdoor|ZipRecruiter).*$/i, "").trim();

  let m = cleaned.match(/^(.*?)\s+at\s+(.*?)(?:\s*[-|].*)?$/i);
  if (m) return { role: m[1].trim(), company: m[2].trim(), strategy: "open_graph" };

  m = cleaned.match(/^(.*?)\s*[-–]\s*(.*?)(?:\s*[-|].*)?$/);
  if (m) return { role: m[1].trim(), company: m[2].trim(), strategy: "open_graph" };

  if (cleaned && metaCompany) {
    return { role: cleaned, company: metaCompany, strategy: "open_graph" };
  }

  return { role: cleaned, company: metaCompany || "", strategy: "manual" };
}

async function apiRequest(path, options = {}) {
  const token = (await chrome.storage.local.get(TOKEN_KEY))[TOKEN_KEY];
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return body.data;
}

async function init() {
  const stored = await chrome.storage.local.get(TOKEN_KEY);
  if (!stored[TOKEN_KEY]) {
    showSetup(true);
    return;
  }
  showSetup(false);
  showBadge("");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractJobPageInfo
    });

    if (!result) return;
    $("save").dataset.url = result.url || tab.url || "";

    // Step A: Immediate local extraction from JSON-LD
    const localLd = parseClientSideJobPosting(result.json_ld);
    if (localLd && localLd.role && localLd.company) {
      $("company").value = localLd.company;
      $("role").value = localLd.role;
      $("jd").value = (localLd.description || result.body_text || "").slice(0, JD_LIMIT);
      $("save").dataset.strategy = "json_ld";
      showBadge("✓ Detected via Schema.org JSON-LD");
      return;
    }

    // Step B: Immediate local extraction from OpenGraph heuristics
    const ogGuess = guessRoleAndCompany(result.title, result.meta);
    if (ogGuess.role && ogGuess.company) {
      $("company").value = ogGuess.company;
      $("role").value = ogGuess.role;
      $("jd").value = (result.meta?.["og:description"] || result.body_text || "").slice(0, JD_LIMIT);
      $("save").dataset.strategy = "open_graph";
      showBadge("✓ Detected via OpenGraph Metadata");
      return;
    }

    // Step C: Fallback to Backend Universal Parser
    showBadge("Analyzing page structure…", "#8a6d00", "#fff8e6");
    $("company").value = ogGuess.company || "";
    $("role").value = ogGuess.role || "";
    $("jd").value = (result.body_text || "").slice(0, JD_LIMIT);

    try {
      const parsed = await apiRequest("/api/v1/extension/parse", {
        method: "POST",
        body: JSON.stringify(result)
      });
      if (parsed) {
        if (parsed.company) $("company").value = parsed.company;
        if (parsed.role) $("role").value = parsed.role;
        if (parsed.job_description) $("jd").value = parsed.job_description.slice(0, JD_LIMIT);
        $("save").dataset.strategy = parsed.strategy || "fallback_llm";

        if (parsed.strategy === "fallback_llm") {
          showBadge("✦ Structured via AI Extractor", "#146c43", "#eef5ea");
        } else if (parsed.strategy === "json_ld") {
          showBadge("✓ Detected via Schema.org", "#146c43", "#eef5ea");
        } else {
          showBadge("✓ Extracted from Page Content", "#146c43", "#eef5ea");
        }
      }
    } catch (parseErr) {
      // Keep existing manual heuristic fields on parse failure
      showBadge("");
    }
  } catch (e) {
    // Restricted tabs (chrome://, webstore) — leave fields manual
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
    const res = await apiRequest("/api/v1/extension/capture", {
      method: "POST",
      body: JSON.stringify({
        company,
        role,
        url: $("save").dataset.url || "",
        job_description: $("jd").value.trim(),
        strategy: $("save").dataset.strategy || "manual",
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
