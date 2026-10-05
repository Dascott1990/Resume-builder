"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { Btn } from "@/components/premium/guest/components/primitives";
import { AuthShell } from "@/components/premium/auth/AuthShell";

const ENTERED_KEY = "noqeev_entered_app";

function VerifyEmailContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { verifyEmail } = useAuth();
  const [status, setStatus] = useState("verifying"); // "verifying" | "success" | "error"
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMessage("This verification link is missing its token.");
      return;
    }
    verifyEmail(token)
      .then(() => {
        setStatus("success");
        try { localStorage.setItem(ENTERED_KEY, "1"); } catch {}
      })
      .catch((e) => {
        setStatus("error");
        setMessage(e.message || "This verification link is invalid or has expired.");
      });
    // Only ever run once, against whatever token was in the URL on load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthShell>
      <div className="flex flex-col items-center gap-4 text-center">
        {status === "verifying" && (
          <>
            <Loader2 className="size-7 animate-spin text-primary" />
            <p className="m-0 text-[14px] text-muted-foreground">Verifying your email…</p>
          </>
        )}

        {status === "success" && (
          <>
            <div>
              <p className="m-0 text-[18px] font-bold text-foreground">Email verified</p>
              <p className="m-0 mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                You're signed in. Your account is ready to go.
              </p>
            </div>
            <Btn variant="gold" small onClick={() => router.replace("/")}>Continue</Btn>
          </>
        )}

        {status === "error" && (
          <>
            <div>
              <p className="m-0 text-[18px] font-bold text-foreground">Link didn't work</p>
              <p className="m-0 mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{message}</p>
            </div>
            <Btn variant="gold" small onClick={() => router.replace("/")}>Back to Noqeev</Btn>
          </>
        )}
      </div>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
