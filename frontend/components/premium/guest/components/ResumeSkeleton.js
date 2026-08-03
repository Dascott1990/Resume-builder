"use client";
import { Skeleton } from "@/components/ui/skeleton";

// ── Skeleton — shown in the exact shape of the page while a saved resume loads ──
// This sits on the literal white "paper" background that mimics the coming
// resume page, so it deliberately uses light-gray bars rather than the app's
// (dark) --muted token — same reasoning as LivePreview staying independent of
// app-chrome theming.
function Bar({ w = "100%", h = 9, mb = 8 }) {
  return <Skeleton className="rounded-sm bg-gray-200" style={{ width: w, height: h, marginBottom: mb }} />;
}

export function ResumeSkeleton() {
  return (
    <div style={{ background: "white", padding: "20mm 18mm", width: "210mm", minHeight: "297mm", boxSizing: "border-box" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
        <Bar w="46%" h={16} mb={8} />
        <Bar w="30%" h={10} mb={8} />
        <Bar w="60%" h={9} mb={0} />
      </div>
      {[0, 1, 2].map(section => (
        <div key={section} style={{ marginBottom: 18 }}>
          <Bar w="24%" h={11} mb={10} />
          <Bar w="100%" />
          <Bar w="94%" />
          <Bar w="88%" mb={0} />
        </div>
      ))}
    </div>
  );
}
