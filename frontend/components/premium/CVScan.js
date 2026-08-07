"use client";
/**
 * CVScan.js — upload an existing resume, get it parsed straight into the
 * builder's data shape (see backend/app/api/resume.py's /scan endpoint —
 * same {contact, sections} shape /generate and /optimize already produce),
 * so onImported's caller can hand it directly to GuestMode as a
 * pendingImport with no adapter step in between.
 */
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { UploadCloud, FileText, X, Loader2, ScanLine } from "lucide-react";
import { apiRequest } from "./shared/api";
import { Field, Btn } from "./guest/components/primitives";
import { IconTile } from "./shared/IconTile";
import Logo from "./Logo";

const MAX_BYTES = 8 * 1024 * 1024;
// Mirrors the backend's own cutoff (see /resume/scan) — below this, a
// job_description is too short to tailor against, so it's simply not sent
// and the scan stays a plain import instead of silently doing a low-quality
// tailoring pass.
const MIN_JOB_DESC = 50;

export default function CVScan({ onClose, onImported }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [jobDesc, setJobDesc] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const tailoring = jobDesc.trim().length >= MIN_JOB_DESC;

  const validate = (f) => {
    const name = (f.name || "").toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
      return "Only .pdf and .docx files are supported.";
    }
    if (f.size > MAX_BYTES) {
      return "File is too large (8MB max).";
    }
    return null;
  };

  const pickFile = (f) => {
    if (!f) return;
    const err = validate(f);
    if (err) { setError(err); setFile(null); return; }
    setError("");
    setFile(f);
  };

  const scan = async () => {
    if (!file) return;
    setScanning(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (tailoring) formData.append("job_description", jobDesc.trim());
      const data = await apiRequest("/api/v1/resume/scan", { method: "POST", body: formData });
      toast.success(tailoring ? "Tailored — review your resume and cover letter below." : "Imported — review and download below.");
      onImported(data);
    } catch (e) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col overflow-y-auto bg-background font-sans"
    >
      <div className="flex shrink-0 items-center justify-between p-5">
        <Logo size={22} />
        {onClose && (
          <button onClick={onClose} aria-label="Close" className="flex size-10 items-center justify-center rounded-full border border-border bg-muted text-foreground">
            <X className="size-[17px]" />
          </button>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 pb-16">
        <div>
          <IconTile icon={ScanLine} size="md" className="mb-3" />
          <p className="m-0 font-serif text-[22px] italic text-foreground">CV Scan</p>
          <p className="m-0 mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
            Import an existing resume, or add a job posting below to tailor it.
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pickFile(e.dataTransfer.files?.[0]);
          }}
          className={`flex flex-col items-center gap-2.5 rounded-2xl border-2 border-dashed p-8 text-center [-webkit-tap-highlight-color:transparent] ${
            dragging ? "border-primary bg-primary/5" : "border-border bg-card"
          }`}
        >
          {file ? (
            <>
              <FileText className="size-7 text-primary" />
              <span className="text-[13.5px] font-semibold text-foreground">{file.name}</span>
              <span className="text-[11.5px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB — tap to choose a different file</span>
            </>
          ) : (
            <>
              <UploadCloud className="size-7 text-muted-foreground" />
              <span className="text-[13.5px] font-semibold text-foreground">Drop a file here, or tap to browse</span>
              <span className="text-[11.5px] text-muted-foreground">.pdf or .docx, up to 8MB</span>
            </>
          )}
        </button>

        <Field
          label="JOB DESCRIPTION" hint={`Optional — ${tailoring ? "will tailor to this posting ✓" : "paste one to tailor this resume"}`}
          value={jobDesc} onChange={setJobDesc} multiline rows={6} mono
          placeholder={"Paste a job posting here and we'll rewrite this resume to match it — plus a matching cover letter and interview tips. Leave blank to just import as-is."}
        />

        {error && (
          <div role="alert" className="flex gap-2 border-l-2 border-destructive py-0.5 pl-[11px] text-[12.5px] leading-relaxed text-destructive">
            {error}
          </div>
        )}

        <Btn variant="gold" disabled={!file || scanning} loading={scanning} onClick={scan}>
          {scanning ? (tailoring ? "Reading and tailoring…" : "Reading your resume…") : (tailoring ? "Scan and tailor" : "Scan and import")}
        </Btn>
      </div>
    </motion.div>
  );
}
