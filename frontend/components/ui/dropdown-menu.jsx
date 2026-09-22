"use client"

import * as React from "react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// Real Radix primitive, not a hand-rolled useState+backdrop panel — gets
// focus trap, keyboard nav, Escape-to-close, click-outside, and (the one
// that actually matters most here) automatic collision detection for
// free: a hand-rolled absolute-positioned panel has no way to know it's
// about to overflow off a narrow phone screen and reposition itself: this
// does, out of the box.

function DropdownMenu({
  ...props
}) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger({
  ...props
}) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuPortal({
  ...props
}) {
  return <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

const DropdownMenuContent = React.forwardRef(function DropdownMenuContent({
  className,
  sideOffset = 8,
  align = "end",
  ...props
}, ref) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        align={align}
        collisionPadding={8}
        className={cn(
          // z-[60] — same reasoning dialog.jsx's own overlay uses: must
          // sit above a fixed z-50 shell (BottomSheet, or the admin
          // panel's own fixed inset-0 z-50 container).
          "z-[60] min-w-[10rem] overflow-hidden rounded-2xl border border-white/[0.12] bg-card/95 p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props} />
    </DropdownMenuPrimitive.Portal>
  );
});

const DropdownMenuItem = React.forwardRef(function DropdownMenuItem({
  className,
  ...props
}, ref) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      data-slot="dropdown-menu-item"
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-semibold text-foreground outline-none select-none data-highlighted:bg-accent data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      {...props} />
  );
});

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
}
