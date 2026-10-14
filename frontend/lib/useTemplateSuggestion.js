// lib/useTemplateSuggestion.js — one shared fetch so Dashboard's Templates
// teaser and the full TemplatesGallery agree on the same suggestion
// instead of each re-fetching /api/v1/apply/profile themselves. Returns
// null (never throws, never surfaces an error state) whenever there's no
// confirmed CareerProfile yet — the overwhelming common case for guests —
// so every caller can treat null as "render exactly today's behavior."
import { useEffect, useState } from "react";
import { apiRequest } from "@/components/premium/shared/api";
import { pickTemplateForProfile } from "./profileTemplateMatch";

export function useTemplateSuggestion() {
  const [suggestion, setSuggestion] = useState(null);

  useEffect(() => {
    apiRequest("/api/v1/apply/profile")
      .then((profile) => setSuggestion(pickTemplateForProfile(profile)))
      .catch(() => setSuggestion(null));
  }, []);

  return suggestion; // { layout, accent, font, category, role } | null
}
