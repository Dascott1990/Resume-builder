"use client";
/**
 * TermsConsent.js — the checkbox every account-creation/booking form needs
 * before it can submit. A real <input type="checkbox"> wrapped in its own
 * <label> (not a styled div pretending to be one) — native keyboard/
 * screen-reader behavior for free, same reasoning the rest of this app's
 * forms already follow (see Field in guest/components/primitives.js).
 * `required` gives native browser validation as a second layer on top of
 * whatever the caller does with `checked`/`onChange` itself.
 */
import Link from "next/link";

export function TermsConsent({ checked, onChange, id = "terms-consent", refundPolicy = false }) {
  return (
    <label htmlFor={id} className="mt-1 mb-1 flex items-start gap-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
      <input
        id={id}
        type="checkbox"
        required
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 rounded border-border accent-primary"
      />
      <span>
        I agree to Noqeev's{" "}
        <Link href="/terms" target="_blank" className="font-semibold text-foreground underline underline-offset-2">
          Terms & Conditions
        </Link>{" "}
        and{" "}
        <Link href="/privacy" target="_blank" className="font-semibold text-foreground underline underline-offset-2">
          Privacy Policy
        </Link>
        {/* Only shown where money actually changes hands (a paid booking) —
            the plain account-signup forms have nothing to refund. */}
        {refundPolicy && (
          <>
            {" "}and{" "}
            <Link href="/refund-policy" target="_blank" className="font-semibold text-foreground underline underline-offset-2">
              Refund Policy
            </Link>
          </>
        )}
        .
      </span>
    </label>
  );
}
