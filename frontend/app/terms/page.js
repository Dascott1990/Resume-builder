import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

export const metadata = {
  title: "Terms & Conditions",
  description: "The terms that govern using Noqeev.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms & Conditions" activeHref="/terms">
      <p>
        These terms govern your use of Noqeev (noqeev.com and the Noqeev apps, the "Service"),
        operated by Noqeev Technology, based in Ottawa, Ontario, Canada. By using the Service you
        agree to these terms. If you don't agree, don't use the Service.
      </p>

      <h2>What Noqeev is</h2>
      <p>
        Noqeev provides AI-assisted resume and job-application tools and a set of brand/content
        tools. Most features work anonymously; an account is optional and mainly useful for
        syncing your data across devices.
      </p>

      <h2>Eligibility</h2>
      <p>You must be at least 18 years old and able to form a binding contract to use the Service.</p>

      <h2>Accounts</h2>
      <p>
        You're responsible for keeping your login credentials secure and for anything that
        happens under your account. Tell us right away at{" "}
        <a href="mailto:support@noqeev.com">support@noqeev.com</a> if you think your account has been
        accessed without your permission.
      </p>

      <h2>AI features</h2>
      <p>
        Resume, cover letter, and application suggestions are generated using third-party AI
        providers based on the information you provide (see our{" "}
        <a href="/privacy">Privacy Policy</a>). AI-generated content is a starting point, not a
        guarantee of accuracy, completeness, or fitness for any particular job application —
        review everything before you use it. Using Noqeev's resume or apply-with-AI tools does
        not guarantee you'll be contacted, interviewed, or hired for any position.
      </p>

      <h2>Your content</h2>
      <p>
        You keep ownership of what you upload (resumes, career profile details). By posting or
        uploading content, you give Noqeev a license to store, display, and process it as needed
        to operate the Service. You confirm you have the right to share anything you upload.
      </p>

      <h2>Prohibited conduct</h2>
      <ul>
        <li>Impersonating another person or business, or misrepresenting your identity.</li>
        <li>Posting knowingly false information.</li>
        <li>Uploading content you don't have the right to share, or that's unlawful, harassing, or infringing.</li>
        <li>Interfering with or attempting to disrupt the Service's normal operation.</li>
      </ul>

      <h2>Termination</h2>
      <p>
        You can stop using the Service, or delete your account, at any time. We may suspend or
        terminate access to the Service for conduct that violates these terms or puts other users
        at risk.
      </p>

      <h2>Disclaimer of warranties</h2>
      <p>
        The Service is provided "as is," without warranties of any kind, express or implied. We
        don't guarantee the Service will be uninterrupted, error-free, or that any AI-generated
        content will meet your expectations.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, Noqeev is not liable for indirect, incidental, or
        consequential damages arising from your use of the Service, or from the conduct of any
        other user. Our total liability for any claim is limited to the amount of any fees you
        paid Noqeev in the six months before the claim arose, if any.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of the Province of Ontario and the federal laws of
        Canada applicable in Ontario, without regard to conflict-of-law principles.
      </p>

      <h2>Changes</h2>
      <p>We may update these terms from time to time. We'll update the date at the top of this page when we do — continued use after a change means you accept the update.</p>

      <h2>Contact</h2>
      <p>
        Noqeev Technology<br />
        305 Rideau St, Ottawa, ON, Canada<br />
        <a href="mailto:support@noqeev.com">support@noqeev.com</a>
      </p>
    </LegalPageLayout>
  );
}
