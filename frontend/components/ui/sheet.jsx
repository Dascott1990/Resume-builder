"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "radix-ui"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// Real Radix primitive (Dialog underneath, side-anchored instead of
// centered — the same shape shadcn's own Sheet component uses), not a
// hand-rolled useState+AnimatePresence panel. Gets scroll-lock, focus
// trap, and Escape-to-close for free — a hand-rolled drawer has none of
// these unless every one is separately, correctly reimplemented.

function Sheet({
  ...props
}) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({
  ...props
}) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({
  ...props
}) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({
  ...props
}) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

const SheetOverlay = React.forwardRef(function SheetOverlay({
  className,
  ...props
}, ref) {
  return (
    <SheetPrimitive.Overlay
      ref={ref}
      data-slot="sheet-overlay"
      className={cn(
        // z-[60] — same reasoning dialog.jsx's own overlay uses: must sit
        // above a fixed z-50 shell (the admin panel's own outer container).
        "fixed inset-0 z-[60] bg-black/50 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props} />
  );
});

const SheetContent = React.forwardRef(function SheetContent({
  className,
  children,
  side = "left",
  showCloseButton = true,
  ...props
}, ref) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        ref={ref}
        data-slot="sheet-content"
        className={cn(
          "fixed z-[60] flex flex-col gap-4 bg-background shadow-lg outline-none duration-200",
          side === "left" &&
            "inset-y-0 left-0 h-full w-72 max-w-[85vw] border-r border-border data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left",
          side === "right" &&
            "inset-y-0 right-0 h-full w-72 max-w-[85vw] border-l border-border data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right",
          side === "bottom" &&
            "inset-x-0 bottom-0 h-auto max-h-[85vh] border-t border-border data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom",
          className
        )}
        {...props}>
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground"
          >
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
});

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetOverlay,
  SheetContent,
}
