"use client";
/**
 * lib/i18n.js — UI-chrome translation, phase 1: infrastructure + the
 * landing page's entry surfaces (Navbar, Hero, FinalCTA) — the first
 * thing any visitor, from any country, actually sees. Every other
 * screen's copy stays English for now; extending coverage anywhere else
 * is the same `t("key")` + a new dictionary entry, not a new system.
 * Deliberately UI-only — the AI-GENERATED resume itself is untouched by
 * this (a separate, larger scope: translating generated content, not
 * just interface chrome).
 *
 * Resolution order for the initial language, each one overriding the
 * last: a saved explicit choice (localStorage) > the visitor's own
 * country (via the existing GET /api/v1/meta/location geo lookup — see
 * backend/app/utils/geoip.py, already used for the landing page's city
 * display, reused here rather than a second IP lookup) > the browser's
 * own language > English. Resolving the geo step needs a network round
 * trip, so the very first paint always renders English/the saved choice
 * immediately — never a blank/loading state — and silently upgrades a
 * FIRST-time, no-saved-choice visitor to their detected language once
 * that lookup resolves. Same "one safe default pre-mount, correct
 * shortly after" shape as useViewport.js's own mounted-gate pattern, not
 * a new convention.
 *
 * Context (not a plain hook, unlike useTheme/useViewport elsewhere in
 * this app) on purpose: changing the language needs EVERY translated
 * string on the page to re-render at once, not just the one control that
 * changed it — a genuinely different, stronger requirement than any
 * existing hook here has needed, where usually only one component at a
 * time ever reads or writes the value.
 */
import { createContext, useContext, useEffect, useState } from "react";

export const LANGUAGES = [
  { id: "en", label: "English", flag: "🇬🇧" },
  { id: "es", label: "Español", flag: "🇪🇸" },
  { id: "fr", label: "Français", flag: "🇫🇷" },
  { id: "pt", label: "Português", flag: "🇵🇹" },
];

// Best-effort, not exhaustive — a country with no entry here just falls
// back to English (or the browser's own navigator.language, checked
// first). Canada deliberately has no entry despite being officially
// bilingual: French is a minority nationally, and silently defaulting
// every Canadian visitor to French would be wrong far more often than
// right — safer to let them reach for the switcher themselves.
const COUNTRY_TO_LANG = {
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", VE: "es",
  EC: "es", GT: "es", CU: "es", BO: "es", DO: "es", HN: "es", PY: "es",
  SV: "es", NI: "es", CR: "es", PA: "es", UY: "es", GQ: "es",
  FR: "fr", HT: "fr",
  PT: "pt", BR: "pt", AO: "pt", MZ: "pt", CV: "pt", GW: "pt", ST: "pt", TL: "pt",
};

const STORAGE_KEY = "noqeev_lang";

const translations = {
  en: {
    "nav.features": "Features",
    "nav.howItWorks": "How it works",
    "nav.faq": "FAQ",
    "nav.getStarted": "Get Started",
    "nav.language": "Language",
    "hero.headline": "Tailored resumes, matched to the job.",
    "hero.subheadline": "Set up your profile once. Tailor unlimited resumes after that.",
    "hero.createResume": "Create Resume",
    "hero.download": "Download",
    "hero.installed": "Installed",
    "finalCta.headline": "Set up your profile once. Get a tailored resume for every job after that.",
    "finalCta.createResume": "Create Resume",
  },
  es: {
    "nav.features": "Funciones",
    "nav.howItWorks": "Cómo funciona",
    "nav.faq": "Preguntas frecuentes",
    "nav.getStarted": "Comenzar",
    "nav.language": "Idioma",
    "hero.headline": "Currículums personalizados, a la medida del puesto.",
    "hero.subheadline": "Configura tu perfil una vez. Personaliza currículums ilimitados después.",
    "hero.createResume": "Crear currículum",
    "hero.download": "Descargar",
    "hero.installed": "Instalada",
    "finalCta.headline": "Configura tu perfil una vez. Obtén un currículum personalizado para cada empleo después.",
    "finalCta.createResume": "Crear currículum",
  },
  fr: {
    "nav.features": "Fonctionnalités",
    "nav.howItWorks": "Comment ça marche",
    "nav.faq": "FAQ",
    "nav.getStarted": "Commencer",
    "nav.language": "Langue",
    "hero.headline": "Des CV sur mesure, adaptés au poste.",
    "hero.subheadline": "Configurez votre profil une fois. Personnalisez des CV illimités ensuite.",
    "hero.createResume": "Créer un CV",
    "hero.download": "Télécharger",
    "hero.installed": "Installée",
    "finalCta.headline": "Configurez votre profil une fois. Obtenez un CV sur mesure pour chaque emploi ensuite.",
    "finalCta.createResume": "Créer un CV",
  },
  pt: {
    "nav.features": "Recursos",
    "nav.howItWorks": "Como funciona",
    "nav.faq": "Perguntas frequentes",
    "nav.getStarted": "Começar",
    "nav.language": "Idioma",
    "hero.headline": "Currículos personalizados, feitos sob medida para a vaga.",
    "hero.subheadline": "Configure seu perfil uma vez. Personalize currículos ilimitados depois.",
    "hero.createResume": "Criar currículo",
    "hero.download": "Baixar",
    "hero.installed": "Instalado",
    "finalCta.headline": "Configure seu perfil uma vez. Obtenha um currículo personalizado para cada vaga depois.",
    "finalCta.createResume": "Criar currículo",
  },
};

function detectFromBrowser() {
  if (typeof navigator === "undefined") return "en";
  const prefix = (navigator.language || "en").slice(0, 2).toLowerCase();
  return translations[prefix] ? prefix : "en";
}

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState("en");

  useEffect(() => {
    let saved;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* best-effort */ }
    if (saved && translations[saved]) {
      setLangState(saved);
      return; // explicit choice already made — never override it with geo/browser detection
    }

    setLangState(detectFromBrowser());

    // Geo lookup takes priority over the plain browser-language guess
    // once it resolves (closer to "based on where you live," the actual
    // ask) — but only for a visitor who has never explicitly chosen a
    // language, same guard as above.
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/meta/location`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const code = json?.data?.country_code;
        const mapped = code && COUNTRY_TO_LANG[code];
        if (mapped) setLangState(mapped);
      })
      .catch(() => {});
  }, []);

  const setLang = (next) => {
    setLangState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* best-effort */ }
  };

  const t = (key) => translations[lang]?.[key] ?? translations.en[key] ?? key;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
