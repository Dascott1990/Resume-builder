"use client";
import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { RefreshCw, Zap, FileCheck2, Loader2, RotateCcw } from "lucide-react";
import { Reveal, ScrollBlend, SECTION_WRAP, EYEBROW, CARD, SectionGlow } from "./shared";
import { ResumeDocument } from "../shared/ResumeDocument";
import { apiRequest } from "../shared/api";
import { trackEvent } from "@/lib/trackEvent";
import { useLanguage } from "@/lib/i18n";

const trust = (t) => [
  { Icon: RefreshCw, label: t("landing.trust1") },
  { Icon: Zap, label: t("landing.trust2") },
  { Icon: FileCheck2, label: t("landing.trust3") },
];

// Same Letter-page pixel size Resume.js's own "My Resumes" mode renders
// at (LETTER_WIDTH_PX/LETTER_HEIGHT_PX there) — this isn't a new size
// invented for the landing page, it's what the real document actually
// measures, just displayed smaller via ResumeDocument's own `scale` prop.
const PAGE_WIDTH = 816;
const PAGE_HEIGHT = 1056;
const SHOWCASE_STYLE = { font: "calibri", fontSize: 11, lineHeight: 1.4, accent: "navy", layout: "classic" };

// Real, realistic (not scraped from any real employer) job posting text —
// short but substantial enough for the AI to actually have something to
// tailor against. One click per example, no blank textarea: a visitor
// never has to come up with their own posting to see the real mechanism
// work, which is the one thing nothing else in this market does free and
// unlimited (see backend/app/api/landing_demo.py's own docstring).
const DEMO_EXAMPLES = [
  {
    id: "marketing",
    labelKey: "landing.demoExample1",
    jobDescription:
      "We're hiring a Marketing Manager to own campaign strategy across email, paid social, and content for our e-commerce brand. You'll run A/B tests on ad creative, manage a $40k/month paid media budget, partner with design on seasonal launches, and report weekly on CAC and ROAS to leadership. 4+ years of B2B or DTC marketing experience required, strong analytics background a must.",
  },
  {
    id: "engineering",
    labelKey: "landing.demoExample2",
    jobDescription:
      "Seeking a Software Engineer to build and maintain backend APIs powering our logistics platform. You'll design REST endpoints, write integration tests, optimize Postgres queries under real production load, and collaborate with frontend engineers on API contracts. 3+ years with Python or Node, comfortable with CI/CD pipelines and cloud infrastructure (AWS or GCP).",
  },
  {
    id: "support",
    labelKey: "landing.demoExample3",
    jobDescription:
      "Customer Support Specialist needed to handle inbound tickets across chat, email, and phone for a growing SaaS product. You'll troubleshoot billing and account issues, maintain a 95%+ CSAT score, escalate bugs to engineering with clear repro steps, and help build out our internal knowledge base. Prior SaaS or tech support experience preferred.",
  },
];

export function SeeItHappenSection() {
  const { t } = useLanguage();
  const TRUST = trust(t);
  const containerRef = useRef(null);
  const inView = useInView(containerRef, { once: true, margin: "-15% 0px -15% 0px" });

  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const runExample = async (example) => {
    setStatus("loading");
    setError("");
    try {
      const data = await apiRequest("/api/v1/landing/demo-tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_description: example.jobDescription }),
      });
      setResult(data);
      setStatus("done");
      trackEvent("demo_tailor_used");
    } catch (e) {
      setError(e.message || t("landing.demoError"));
      setStatus("error");
    }
  };

  const reset = () => {
    setStatus("idle");
    setResult(null);
    setError("");
  };

  return (
    <section ref={containerRef} className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden py-20 sm:py-24">
      <SectionGlow color="emerald" side="right" />
      <div
        aria-hidden="true"
        className="dark pointer-events-none absolute inset-x-0 top-0 h-28 bg-background sm:h-36"
        style={{ WebkitMaskImage: "linear-gradient(to bottom, black, transparent)", maskImage: "linear-gradient(to bottom, black, transparent)" }}
      />
      <ScrollBlend className={SECTION_WRAP}>
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <span className={EYEBROW}>{t("landing.seeItHappenEyebrow")}</span>
            <h2 className="m-0 text-[clamp(1.6rem,4vw,2.4rem)] leading-tight font-bold text-foreground">
              {t("landing.seeItHappenTitle")}
            </h2>
            <p className="m-0 mt-3 max-w-sm text-[14.5px] leading-relaxed text-muted-foreground">
              {t("landing.seeItHappenSubtitle")}
            </p>
            <ul className="m-0 mt-6 flex list-none flex-col gap-2.5 p-0">
              {TRUST.map(({ Icon, label }, i) => (
                <motion.li
                  key={label}
                  initial={{ opacity: 0, x: -12 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ type: "spring", stiffness: 340, damping: 22, delay: 0.15 + i * 0.1 }}
                  className="flex items-center gap-2.5 text-[13px] font-semibold text-foreground"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Icon className="size-3.5" />
                  </span>
                  {label}
                </motion.li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.1} className={`${CARD} flex flex-col items-center justify-center gap-4 p-6`}>
            {status === "idle" && (
              <div className="flex w-full flex-col gap-2.5">
                {DEMO_EXAMPLES.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => runExample(ex)}
                    className="rounded-xl border border-border bg-background px-4 py-3 text-left text-[13.5px] font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 [-webkit-tap-highlight-color:transparent]"
                  >
                    {t(ex.labelKey)}
                  </button>
                ))}
                <p className="m-0 mt-1 text-center text-[11.5px] text-muted-foreground/70">{t("landing.demoDisclaimer")}</p>
              </div>
            )}

            {status === "loading" && (
              <div className="flex h-[280px] flex-col items-center justify-center gap-3">
                <Loader2 className="size-6 animate-spin text-primary" strokeWidth={2} />
                <p className="m-0 text-[13px] font-semibold text-muted-foreground">{t("landing.demoLoading")}</p>
              </div>
            )}

            {status === "error" && (
              <div className="flex h-[280px] flex-col items-center justify-center gap-3 px-4 text-center">
                <p className="m-0 text-[13px] font-semibold text-foreground">{error}</p>
                <button
                  type="button" onClick={reset}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[12.5px] font-semibold text-foreground [-webkit-tap-highlight-color:transparent]"
                >
                  <RotateCcw className="size-3.5" /> {t("landing.demoTryAnother")}
                </button>
              </div>
            )}

            {status === "done" && result && (
              <div className="flex flex-col items-center gap-3">
                <div
                  className="overflow-hidden rounded-lg border border-border bg-[#f4f4f4] shadow-[0_12px_28px_-14px_rgba(0,0,0,0.35)]"
                  style={{ width: 208, height: (208 / PAGE_WIDTH) * PAGE_HEIGHT }}
                >
                  <ResumeDocument
                    resume={result}
                    style={SHOWCASE_STYLE}
                    scale={208 / PAGE_WIDTH}
                    pageWidth={PAGE_WIDTH}
                    pageHeight={PAGE_HEIGHT}
                    shadowClassName=""
                  />
                </div>
                <button
                  type="button" onClick={reset}
                  className="flex items-center gap-1.5 border-none bg-transparent p-0 text-[12.5px] font-semibold text-foreground underline [-webkit-tap-highlight-color:transparent]"
                >
                  <RotateCcw className="size-3.5" /> {t("landing.demoTryAnother")}
                </button>
              </div>
            )}
          </Reveal>
        </div>
      </ScrollBlend>
    </section>
  );
}
