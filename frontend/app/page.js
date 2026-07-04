"use client";
import { useState } from "react";
import Resume from "../components/premium/Resume";

export default function Home() {
  const [open, setOpen] = useState(true);
  if (!open) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <button onClick={() => setOpen(true)} style={{ padding: "10px 18px" }}>Open Resume Studio</button>
      </div>
    );
  }
  return <Resume onClose={() => setOpen(false)} />;
}
