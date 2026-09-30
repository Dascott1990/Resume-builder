import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

export const metadata = {
  title: "Refund Policy",
  description: "Noqeev's resume and job-tracking tools are free.",
  alternates: { canonical: "/refund-policy" },
};

export default function RefundPolicyPage() {
  return (
    <LegalPageLayout title="Refund Policy" activeHref="/refund-policy">
      <p>
        Noqeev's resume-building, job-tracking, and brand tools are free — no credit card, no
        trial, no subscription. There's no payment involved anywhere in the Service, so there's
        nothing to refund.
      </p>

      <h2>Questions</h2>
      <p>
        Email <a href="mailto:support@noqeev.com">support@noqeev.com</a> if anything here is
        unclear. See also our <a href="/terms">Terms & Conditions</a>.
      </p>
    </LegalPageLayout>
  );
}
