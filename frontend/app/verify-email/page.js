"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { Btn } from "@/components/premium/guest/components/primitives";
import Logo from "@/components/premium/Logo";

const ENTERED_KEY = "noviq_entered_app";

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
    <div className="flex h-[100dvh] w-full flex-col items-center justify-center gap-6 bg-background px-6 text-center font-sans">
      <Logo size={26} />

      {status === "verifying" && (
        <>
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="m-0 text-[14.5px] text-muted-foreground">Verifying your email…</p>
        </>
      )}

      {status === "success" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4">
          <CheckCircle2 className="size-12 text-primary" />
          <div>
            <p className="m-0 font-serif text-[20px] italic text-foreground">Email verified</p>
            <p className="m-0 mt-1.5 max-w-xs text-[13.5px] leading-relaxed text-muted-foreground">
              You're signed in — your account is ready to go.
            </p>
          </div>
          <Btn variant="gold" small onClick={() => router.replace("/")}>
            Continue
          </Btn>
        </motion.div>
      )}

      {status === "error" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4">
          <XCircle className="size-12 text-destructive" />
          <div>
            <p className="m-0 font-serif text-[20px] italic text-foreground">Link didn't work</p>
            <p className="m-0 mt-1.5 max-w-xs text-[13.5px] leading-relaxed text-muted-foreground">{message}</p>
          </div>
          <Btn variant="gold" small onClick={() => router.replace("/")}>
            Back to Noviq
          </Btn>
        </motion.div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
