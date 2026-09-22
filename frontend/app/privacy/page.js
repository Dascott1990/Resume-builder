import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

export const metadata = {
  title: "Privacy Policy",
  description: "How Noqeev collects, uses, and protects your data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" updated="September 22, 2026" activeHref="/privacy">
      <p>
        Noqeev ("Noqeev," "we," "us") is operated by Rasheed, a sole proprietorship based at
        305 Rideau St, Ottawa, ON, Canada. This policy explains what personal information we
        collect through noqeev.com and the Noqeev apps (the "Service"), why we collect it, who
        we share it with, and the choices you have. If anything here is unclear, email{" "}
        <a href="mailto:noqeev@gmail.com">noqeev@gmail.com</a>.
      </p>

      <h2>The short version</h2>
      <p>
        Most of Noqeev works without an account. We don't run analytics or advertising trackers
        of any kind, and we don't use cookies — everything we store locally in your browser is
        strictly functional (keeping you signed in, remembering an anonymous session so your
        drafts aren't lost). We collect only what a given feature actually needs to work, and we
        never sell personal information.
      </p>

      <h2>Information we collect</h2>
      <h3>Used anonymously, no account needed</h3>
      <p>
        Resume building, job tracking, and most of the artisan directory work from a random,
        anonymous identifier stored only in your browser (a "guest ID") — no name, email, or
        account is required. If you never create an account, we have no way to identify you
        personally from this identifier alone.
      </p>
      <h3>If you create an account</h3>
      <ul>
        <li><strong>Email and password</strong> — required to sign in and sync your data across devices.</li>
        <li><strong>Display name, avatar, status line</strong> — optional, set in Settings.</li>
      </ul>
      <h3>If you register as an artisan</h3>
      <ul>
        <li><strong>Name, trade, and phone number</strong> — required, shown on your public listing.</li>
        <li><strong>Email, bio, years of experience, city</strong> — optional, shown on your listing if provided.</li>
        <li><strong>Portfolio photos</strong> — you control what you upload; by uploading a photo you confirm you own the rights to it or have permission to share it.</li>
        <li><strong>Payment payout details</strong> — handled entirely by Stripe (see "Third parties" below); we never see or store your bank details ourselves.</li>
      </ul>
      <h3>If you request or complete a booking</h3>
      <p>
        A job request captures the contact name and phone number you provide for that specific
        request (email is optional), a description of the work, and — once payment is involved —
        the amount and Stripe's own payment/transfer references. Messages you send an artisan
        through the platform are stored so the conversation is visible to both sides.
      </p>
      <h3>If you use the resume, career profile, or apply-with-AI tools</h3>
      <p>
        Your saved resumes and any career profile details you enter (name, email, phone, location,
        work history, skills, salary expectations) are stored so the tools can use them. Two
        fields are especially sensitive and are always optional:
      </p>
      <ul>
        <li>
          <strong>Work authorization status</strong> — only used if you choose to include it, to
          help tailor applications; never required, never inferred.
        </li>
        <li>
          <strong>Voluntary demographic information</strong> (race, gender, veteran, disability
          status) — the kind of information some job applications separately ask for on an
          entirely voluntary basis. Noqeev never requires this, defaults every field to "prefer
          not to answer," and never infers it from anything else you've entered. If you provide
          it, you're giving us clear, specific consent to store it for that purpose alone.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>Operating the feature you're using (matching you with an artisan, saving your resume, tracking an application).</li>
        <li>Processing payments and payouts for completed bookings.</li>
        <li>Sending account, booking, and verification emails.</li>
        <li>Generating AI-assisted resume/application content, using the text you provide (see "Third parties").</li>
        <li>Fixing bugs — our error-monitoring tool (Sentry) receives crash reports if something breaks, not a record of your normal activity.</li>
      </ul>
      <p>We do not use your data for advertising, and we do not run any analytics or ad-tracking service — none is installed on the Service.</p>

      <h2>Third parties we share data with</h2>
      <p>We use a small number of specialist providers to run the Service. Each only receives what it needs to do its job:</p>
      <ul>
        <li><strong>Stripe</strong> — payment processing and artisan payouts. Stripe, not Noqeev, holds your payment card or bank details.</li>
        <li><strong>Anthropic (Claude) and Groq</strong> — process resume, job-description, and application text you submit to generate AI suggestions. This text is sent to these providers to produce a response; it is not used by them to train their models on our plan.</li>
        <li><strong>Resend</strong> — delivers account, verification, and notification emails.</li>
        <li><strong>Neon, Render, Vercel</strong> — database and application hosting.</li>
        <li><strong>Sentry</strong> — error monitoring; may capture technical details like your IP address at the moment of a crash.</li>
      </ul>
      <p>
        Some of these providers process data outside Canada, including in the United States. By
        using the Service you understand your information may be processed in a country with
        different privacy laws than Canada's.
      </p>
      <p>We do not sell personal information to anyone, for any reason.</p>

      <h2>Cookies and local storage</h2>
      <p>
        Noqeev does not use cookies. We do use your browser's local storage for strictly
        functional purposes — see our <a href="/cookies">Cookie Policy</a> for the full list.
      </p>

      <h2>Your choices and rights</h2>
      <p>
        You can access, correct, or request deletion of your personal information at any time by
        emailing <a href="mailto:noqeev@gmail.com">noqeev@gmail.com</a>. We'll respond within a
        reasonable time and verify your identity before acting on a request tied to an account.
        Anonymous, guest-only usage can be cleared simply by clearing your browser's local storage
        — there's no account to delete.
      </p>

      <h2>Data retention</h2>
      <p>
        We keep account and booking data for as long as your account is active, or as needed to
        meet legal, accounting, or dispute-resolution obligations after that. Ask us to delete
        your data and we will, except where we're required to keep it (for example, financial
        records tied to a completed payment).
      </p>

      <h2>Security</h2>
      <p>
        We take reasonable technical and organizational measures to protect your information, but
        no method of storage or transmission is perfectly secure, and we can't guarantee absolute
        security.
      </p>

      <h2>Children</h2>
      <p>The Service is not directed at, and we do not knowingly collect information from, anyone under 18.</p>

      <h2>Changes to this policy</h2>
      <p>If we make a material change, we'll update the date at the top of this page. Continued use of the Service after a change means you accept the updated policy.</p>

      <h2>Contact</h2>
      <p>
        Noqeev, operated by Rasheed<br />
        305 Rideau St, Ottawa, ON, Canada<br />
        <a href="mailto:noqeev@gmail.com">noqeev@gmail.com</a>
      </p>
    </LegalPageLayout>
  );
}
