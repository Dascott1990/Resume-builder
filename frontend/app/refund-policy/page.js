import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

export const metadata = {
  title: "Refund Policy",
  description: "How cancellations and refunds work for paid Noqeev bookings.",
  alternates: { canonical: "/refund-policy" },
};

export default function RefundPolicyPage() {
  return (
    <LegalPageLayout title="Refund Policy" activeHref="/refund-policy">
      <p>
        This policy covers paid bookings made through Noqeev's artisan marketplace. Noqeev's
        resume, job-tracking, and brand tools are free and don't involve payment, so nothing
        below applies to them.
      </p>

      <h2>How payment works</h2>
      <p>
        When you book and pay an artisan through Noqeev, your payment is held in escrow — it
        isn't sent to the artisan yet. It stays held until the job is marked complete and you
        confirm the work is done, at which point you release payment and it's transferred to the
        artisan.
      </p>

      <h2>Cancelling before the job is marked complete</h2>
      <p>
        You can cancel a booking any time before the artisan marks the job complete. If you've
        already paid, cancelling automatically issues a <strong>full refund</strong> through
        Stripe — there's no partial refund or cancellation fee at this stage.
      </p>

      <h2>After the job is marked complete</h2>
      <p>
        Once the artisan marks the job complete, you can no longer cancel it yourself for an
        automatic refund. Take this window to review the work before you confirm and release
        payment — <strong>releasing payment sends the money to the artisan and can't be
        automatically reversed.</strong>
      </p>
      <p>
        If there's a problem with the work at this stage — before or after you've released
        payment — don't release payment yet if you haven't already, and contact{" "}
        <a href="mailto:noqeev@gmail.com">noqeev@gmail.com</a> right away. We'll work with you and
        the artisan to sort it out, and can process a manual refund through Stripe where it's
        warranted.
      </p>

      <h2>How refunds are paid back</h2>
      <p>
        Refunds are issued to the original payment method through Stripe. Stripe's own processing
        time applies once we issue a refund — typically 5–10 business days depending on your
        bank, outside our control.
      </p>

      <h2>Questions</h2>
      <p>
        Email <a href="mailto:noqeev@gmail.com">noqeev@gmail.com</a> — include your booking
        details and we'll take a look. See also our <a href="/terms">Terms & Conditions</a>.
      </p>
    </LegalPageLayout>
  );
}
