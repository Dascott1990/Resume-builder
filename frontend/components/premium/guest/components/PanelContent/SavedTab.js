"use client";
import { Loader2, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Btn } from "../primitives";

export function SavedTab({ loadingSaved, saved, loadingResumeId, onLoad, onDelete, onNew }) {
  if (loadingSaved) {
    return (
      <div className="flex justify-center p-4 py-10">
        <Loader2 className="size-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (saved.length === 0) {
    return (
      <div className="p-4 px-4 py-10 text-center">
        <FileText className="mx-auto size-8 text-border" />
        <p className="m-0 mt-3 mb-1 text-sm text-muted-foreground">No saved resumes yet</p>
        <p className="m-0 mb-4 text-xs text-muted-foreground/60">Generate one — it saves automatically</p>
        <Btn small variant="ghost" icon="Plus" onClick={onNew}>Build one now</Btn>
      </div>
    );
  }

  return (
    <div className="p-3.5">
      <p className="m-0 mb-3 font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60">
        {saved.length} SAVED RESUME{saved.length !== 1 ? "S" : ""}
      </p>
      {saved.map(r => (
        <Card key={r.id} className="mb-2.5 gap-0 p-[13px_14px]">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="m-0 mb-0.5 truncate text-sm font-semibold text-foreground">{r.name || "Unnamed"}</p>
              <p className="m-0 mb-2 truncate text-xs text-muted-foreground">{r.role || ""}</p>
              {r.keywords?.length > 0 && (
                <p className="m-0 mb-1.5 text-[11.5px] text-muted-foreground">
                  {r.keywords.slice(0, 3).join(" · ")}
                </p>
              )}
              <p className="m-0 font-mono text-[10px] text-muted-foreground/60">
                {r.generated_at ? new Date(r.generated_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-1.5">
              <Btn small icon="Eye" loading={loadingResumeId === r.id} disabled={!!loadingResumeId} onClick={() => onLoad(r.id)}>Load</Btn>
              <Btn small variant="danger" icon="Trash2" onClick={() => onDelete(r.id)}>
                <span className="sr-only">Delete</span>
              </Btn>
            </div>
          </div>
        </Card>
      ))}
      <Btn variant="ghost" icon="Plus" onClick={onNew}>New resume</Btn>
    </div>
  );
}
