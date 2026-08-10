"use client";
/**
 * OfflineBanner.js — mounted once, globally, in app/layout.js (next to
 * <Toaster />) so a dropped connection is visible no matter which of the
 * app's client-side "views" (page.js's view state, not real routes) is on
 * screen: mid-form in Signup, mid-generation in Resume, wherever.
 *
 * A thin top strip rather than a full-screen takeover — losing connectivity
 * is usually transient and the user's in-progress work (typed text, a
 * half-filled form) is still right there under it. Full-screen error
 * treatment is reserved for ErrorScreen's "offline" variant, used when an
 * actual request has already failed because of it.
 */
import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useOnlineStatus } from "@/lib/useOnlineStatus";

export default function OfflineBanner() {
  const online = useOnlineStatus();
  // Only true once we've actually seen an offline moment — skips the
  // "Back online" toast on first mount for someone who was never offline.
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
    } else if (wasOffline.current) {
      wasOffline.current = false;
      toast.success("Back online");
    }
  }, [online]);

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          role="status"
          initial={{ y: "-100%" }}
          animate={{ y: 0 }}
          exit={{ y: "-100%" }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed inset-x-0 top-0 z-[999999998] flex items-center justify-center gap-1.5 border-b border-border bg-card px-3 text-[12.5px] font-medium text-muted-foreground"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)", paddingBottom: "8px" }}
        >
          <WifiOff className="size-3.5 shrink-0 text-destructive" strokeWidth={2} />
          You&apos;re offline — changes will save once you&apos;re back
        </motion.div>
      )}
    </AnimatePresence>
  );
}
