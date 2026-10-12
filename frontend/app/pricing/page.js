import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

export const metadata = {
  title: "Pricing",
  description: "Noqeev is free — every feature, no card required.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <LegalPageLayout title="Pricing" activeHref="/pricing" eyebrow="Pricing" hideLastUpdated>
      <p>
        Noqeev is free. That's not an introductory offer or a limited trial — it's where the
        product is today. There's no hidden paid tier waiting behind a paywall, and no credit
        card is ever requested.
      </p>

      <h2>What's included</h2>
      <ul>
        <li>AI resume and cover letter generation, tailored to a pasted job description</li>
        <li>ATS scoring, keyword-gap matching, and per-bullet feedback</li>
        <li>Unlimited saved resumes and job tracker entries</li>
        <li>PDF and Word (.docx) export</li>
        <li>The "Apply with AI" browser agent and CV scan tools</li>
      </ul>

      <h2>Why mention this at all</h2>
      <p>
        Most resume tools in this space run on subscriptions or credit packs. We'd rather say
        plainly where things stand than leave pricing as an unanswered question. If that changes
        in the future — a real paid tier, not a surprise paywall on something that already
        worked for free — this page will say so, with real numbers, not placeholders.
      </p>

      <h2>Questions</h2>
      <p>
        See the <a href="/refund-policy">Refund Policy</a> (short, because there's nothing to
        refund yet) or email <a href="mailto:support@noqeev.com">support@noqeev.com</a>.
      </p>
    </LegalPageLayout>
  );
}
