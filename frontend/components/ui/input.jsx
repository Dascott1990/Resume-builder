"use client";
import * as React from "react"

import { cn } from "@/lib/utils"

// Placeholder only renders once the field is actually focused — an empty,
// unfocused input shows nothing rather than an example value sitting there
// looking like real content. Every Input in the app goes through here, so
// this one change is what makes it true everywhere at once.
function Input({
  className,
  type,
  placeholder,
  onFocus,
  onBlur,
  ...props
}) {
  const [focused, setFocused] = React.useState(false);
  return (
    <input
      type={type}
      data-slot="input"
      placeholder={focused ? placeholder : undefined}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); onBlur?.(e); }}
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props} />
  );
}

export { Input }
