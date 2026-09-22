import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

export const metadata = {
  title: "Cookie Policy",
  description: "Noqeev doesn't use cookies. Here's what we use instead, and why.",
  alternates: { canonical: "/cookies" },
};

export default function CookiePolicyPage() {
  return (
    <LegalPageLayout title="Cookie Policy" updated="September 22, 2026" activeHref="/cookies">
      <h2>Noqeev doesn't use cookies</h2>
      <p>
        We don't set cookies, and we don't run any advertising, analytics, or cross-site tracking
        technology — none is installed on the Service. There's no cookie consent banner because
        there's nothing to consent to.
      </p>

      <h2>What we do use: your browser's local storage</h2>
      <p>
        A handful of small, strictly functional items are saved in your browser's local storage —
        not sent to any third party, not used for tracking or advertising. The main ones:
      </p>
      <ul>
        <li><strong>An anonymous session ID</strong> — lets your resume drafts and other in-progress work stay saved between visits, without requiring an account.</li>
        <li><strong>A sign-in token</strong> — only created if you make an account, so you stay signed in.</li>
        <li><strong>Interface preferences</strong> — theme (light/dark), and similar settings, so the app looks the way you left it.</li>
      </ul>
      <p>
        These aren't cookies (they never leave your browser or get sent to our servers with every
        request the way a cookie does), and under applicable law, strictly necessary/functional
        storage like this doesn't require a consent banner. You can clear all of it at any time
        through your browser's own settings — doing so signs you out and clears any unsaved
        anonymous drafts.
      </p>

      <h2>Fonts</h2>
      <p>
        The two fonts used site-wide are served directly from our own servers, not loaded live
        from Google or any other font provider — so simply loading a Noqeev page doesn't share
        your IP address with a third party the way many sites' font setups do.
      </p>

      <h2>Error monitoring</h2>
      <p>
        We use Sentry to catch and fix bugs. It doesn't use cookies or track your normal browsing
        — it only activates when something actually breaks, to capture the technical details
        needed to fix it.
      </p>

      <h2>Questions</h2>
      <p>
        Email <a href="mailto:noqeev@gmail.com">noqeev@gmail.com</a> if you'd like more detail on
        anything here. See also our <a href="/privacy">Privacy Policy</a>.
      </p>
    </LegalPageLayout>
  );
}
