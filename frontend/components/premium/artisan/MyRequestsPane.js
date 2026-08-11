"use client";
/**
 * MyRequestsPane.js — a customer's own posted job requests and their
 * status (requested -> accepted -> completed, or cancelled). Lives inside
 * Artisans.js's "My requests" tab.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, MapPin, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "../shared/api";
import { Btn } from "../guest/components/primitives";

const STATUS_META = {
  requested: { label: "Waiting for an artisan", className: "border-primary/30 bg-primary/10 text-primary" },
  accepted: { label: "Accepted", className: "border-[var(--success,#22c55e)]/30 bg-[var(--success,#22c55e)]/10 text-[var(--success,#22c55e)]" },
  completed: { label: "Completed", className: "border-border bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelled", className: "border-border bg-muted text-muted-foreground/60" },
};

export default function MyRequestsPane() {
  const [items, setItems] = useState(null); // null = loading
  const [cancellingId, setCancellingId] = useState(null);

  const load = () => {
    apiRequest("/api/v1/requests/mine")
      .then(setItems)
      .catch(() => setItems([]));
  };
  useEffect(() => { load(); }, []);

  const cancel = async (id) => {
    setCancellingId(id);
    try {
      await apiRequest(`/api/v1/requests/${id}/cancel`, { method: "POST" });
      toast.success("Request cancelled");
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCancellingId(null);
    }
  };

  if (items === null) {
    return (
      <div className="flex flex-col items-center gap-2.5 py-10">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="grid justify-items-center gap-2 px-5 py-10 text-center">
        <p className="m-0 text-sm font-bold text-foreground">No requests yet</p>
        <p className="m-0 max-w-[240px] text-[12.5px] leading-relaxed text-muted-foreground">
          Post a job request above and available artisans nearby will be notified.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-2.5 overflow-y-auto pb-1">
      {items.map((j) => {
        const meta = STATUS_META[j.status] || STATUS_META.requested;
        return (
          <Card key={j.id} className="gap-0 overflow-hidden p-3.5">
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <span className="text-[13.5px] font-bold text-foreground">{j.trade}</span>
              <Badge variant="outline" className={`shrink-0 rounded-full text-[10px] font-bold ${meta.className}`}>
                {meta.label}
              </Badge>
            </div>
            {j.city && (
              <div className="mb-1 flex items-center gap-1">
                <MapPin className="size-[11px] text-muted-foreground" />
                <span className="text-[12px] text-muted-foreground">{j.city}</span>
              </div>
            )}
            <p className="m-0 mb-2 text-[12.5px] leading-relaxed text-foreground">{j.description}</p>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                <Clock className="size-[11px]" />
                {new Date(j.created_at).toLocaleDateString()}
              </div>
              {(j.status === "requested" || j.status === "accepted") && (
                <Btn small variant="ghost" disabled={cancellingId === j.id} loading={cancellingId === j.id}
                  onClick={() => cancel(j.id)}>
                  Cancel
                </Btn>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
