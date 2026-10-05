"use client";
/**
 * TemplatePreview.js — a tiny abstract swatch for each resume layout (see
 * shared/resumeLayouts/registry.js's LAYOUTS), not a real screenshot of
 * the layout. A handful of bars standing in for header/section-rule/line
 * positions is enough to tell the three apart at a glance, costs nothing
 * to keep in sync (no actual preview images to regenerate when a layout
 * changes), and stays strictly black/white/neutral — no decorative color
 * on something whose only job is to suggest shape and density.
 */
export function TemplatePreview({ layoutId, width = 64, height = 84 }) {
  const bar = (style) => (
    <div className="rounded-[1px] bg-foreground/15" style={style} />
  );

  let body;
  if (layoutId === "sidebar") {
    body = (
      <div className="flex h-full w-full gap-[3px] p-[5px]">
        <div className="flex w-[30%] flex-col gap-[3px] rounded-[1px] bg-foreground/10 p-[3px]">
          {bar({ height: 4, width: "70%" })}
          {bar({ height: 2, width: "100%" })}
          {bar({ height: 2, width: "100%" })}
          {bar({ height: 2, width: "60%" })}
        </div>
        <div className="flex flex-1 flex-col gap-[4px] pt-[3px]">
          {bar({ height: 3, width: "80%" })}
          {bar({ height: 2, width: "100%" })}
          {bar({ height: 2, width: "90%" })}
          {bar({ height: 2, width: "100%" })}
          {bar({ height: 2, width: "70%" })}
        </div>
      </div>
    );
  } else if (layoutId === "minimal") {
    body = (
      <div className="flex h-full w-full flex-col items-center gap-[7px] p-[8px] pt-[10px]">
        {bar({ height: 3, width: "40%" })}
        {bar({ height: 2, width: "55%" })}
        <div className="mt-[4px] flex w-full flex-col gap-[6px]">
          {bar({ height: 1.5, width: "100%" })}
          {bar({ height: 1.5, width: "85%" })}
          {bar({ height: 1.5, width: "92%" })}
        </div>
      </div>
    );
  } else {
    // classic — centered header, full-width section rules.
    body = (
      <div className="flex h-full w-full flex-col items-center gap-[5px] p-[7px]">
        {bar({ height: 4, width: "50%" })}
        {bar({ height: 2, width: "35%" })}
        <div className="mt-[3px] w-full border-t border-foreground/20" />
        <div className="flex w-full flex-col gap-[3px]">
          {bar({ height: 2, width: "100%" })}
          {bar({ height: 2, width: "90%" })}
          {bar({ height: 2, width: "95%" })}
        </div>
      </div>
    );
  }

  return (
    <div
      className="shrink-0 overflow-hidden rounded-[6px] border border-border bg-card"
      style={{ width, height }}
    >
      {body}
    </div>
  );
}
