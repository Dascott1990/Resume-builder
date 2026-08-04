"use client";
// ── Desktop: top segmented nav, bigger and always labeled ──────────────────
// Same visual language as guest/components/DesktopTabNav.js (bottom-border
// active indicator, icon+label, border-b bg-card) but generic — takes a
// plain `items` array instead of a hardcoded view list.
export function TopTabNav({ items, active, onChange }) {
  return (
    <div role="tablist" aria-label="View" className="flex shrink-0 border-b border-border bg-card px-2.5">
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button key={item.id} role="tab" aria-selected={isActive} onClick={() => onChange(item.id)}
            className={`flex min-h-[52px] items-center justify-center gap-2 border-none border-b-[3px] bg-transparent px-[18px] text-[14.5px] transition-colors ${
              isActive ? "border-primary font-bold text-foreground" : "border-transparent font-medium text-muted-foreground/60"
            }`}>
            <item.Icon className={`size-4 ${isActive ? "text-primary" : "text-muted-foreground/60"}`} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
