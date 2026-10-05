"use client";
/**
 * BuilderSidebar.js — the workspace's left panel. "Build" is an accordion
 * over the real resume.sections array (the same data shape ResumeDocument/
 * blockBuilders.js render and export/docx.js exports) — editing a field
 * here dispatches through the exact same onEdit map GuestMode already
 * wires the canvas's own click-to-edit fields through, so the sidebar and
 * the canvas are two views of one source of truth, never a second copy
 * that could drift. "Templates" is the layout picker — the same 3 real
 * layouts (shared/resumeLayouts/registry.js) Dashboard's own Templates
 * card uses, same component even (TemplatePreview).
 */
import { useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { TemplatePreview } from "../../../shared/TemplatePreview";
import { LAYOUTS } from "../../../shared/resumeLayouts/registry";
import { AiRewriteBar } from "./AiRewriteBar";

function Row({ children }) {
  return <div className="flex flex-col gap-2 px-3 pb-3">{children}</div>;
}
function miniInput(value, onChange, placeholder) {
  return (
    <input
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-8 w-full rounded-[7px] border border-border bg-background px-2.5 text-[12px] text-foreground outline-none focus:border-foreground"
    />
  );
}
function RemoveBtn({ onClick, label }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive [-webkit-tap-highlight-color:transparent]">
      <Trash2 className="size-3" />
    </button>
  );
}
function AddRow({ onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className="flex h-8 items-center justify-center gap-1.5 rounded-[7px] border border-dashed border-border text-[11.5px] font-bold text-muted-foreground hover:border-foreground hover:text-foreground [-webkit-tap-highlight-color:transparent]">
      <Plus className="size-3" /> {children}
    </button>
  );
}

function TextSection({ section, si, onEdit, jobDesc, active, setActive }) {
  const key = `text-${si}`;
  return (
    <Row>
      <textarea
        value={section.content || ""}
        onChange={(e) => onEdit("section-text", si, e.target.value)}
        onFocus={() => setActive(key)}
        rows={4}
        className="w-full resize-y rounded-[8px] border border-border bg-background p-2.5 text-[12.5px] leading-relaxed text-foreground outline-none focus:border-foreground"
      />
      {active === key && (
        <AiRewriteBar
          text={section.content}
          jobDescription={jobDesc}
          onResult={(text) => onEdit("section-text", si, text)}
        />
      )}
    </Row>
  );
}

function BulletsSection({ section, si, onEdit }) {
  return (
    <Row>
      {(section.items || []).map((item, ii) => (
        <div key={ii} className="flex items-center gap-1.5">
          {miniInput(item, (v) => onEdit("bullet", si, ii, v), "—")}
          <RemoveBtn label="Remove" onClick={() => onEdit("remove-bullet", si, ii)} />
        </div>
      ))}
      <AddRow onClick={() => onEdit("add-bullet", si)}>Add</AddRow>
    </Row>
  );
}

function JobsSection({ section, si, onEdit, jobDesc, active, setActive }) {
  return (
    <Row>
      {(section.jobs || []).map((job, ji) => (
        <div key={ji} className="flex flex-col gap-1.5 rounded-[9px] border border-border p-2.5">
          <div className="flex items-center gap-1.5">
            {miniInput(job.role, (v) => onEdit("job-role", si, ji, v), "Role")}
            <RemoveBtn label="Remove position" onClick={() => onEdit("remove-job", si, ji)} />
          </div>
          {miniInput(job.company, (v) => onEdit("job-company", si, ji, v), "Company")}
          <div className="flex gap-1.5">
            {miniInput(job.location, (v) => onEdit("job-location", si, ji, v), "Location")}
            {miniInput(job.period, (v) => onEdit("job-period", si, ji, v), "2023 — Present")}
          </div>
          <div className="mt-1 flex flex-col gap-1.5">
            {(job.bullets || []).map((b, bi) => {
              const key = `job-${si}-${ji}-${bi}`;
              return (
                <div key={bi} className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    {miniInput(b, (v) => onEdit("job-bullet", si, ji, bi, v), "—")}
                    <RemoveBtn label="Remove bullet" onClick={() => onEdit("remove-job-bullet", si, ji, bi)} />
                  </div>
                  <div onFocus={() => setActive(key)} tabIndex={-1}>
                    {active === key && (
                      <AiRewriteBar
                        text={b}
                        jobDescription={jobDesc}
                        onResult={(text) => onEdit("job-bullet", si, ji, bi, text)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
            <AddRow onClick={() => onEdit("add-job-bullet", si, ji)}>Add bullet</AddRow>
          </div>
        </div>
      ))}
      <AddRow onClick={() => onEdit("add-job", si)}>Add position</AddRow>
    </Row>
  );
}

function EducationSection({ section, si, onEdit }) {
  return (
    <Row>
      {(section.degrees || []).map((deg, di) => (
        <div key={di} className="flex flex-col gap-1.5 rounded-[9px] border border-border p-2.5">
          <div className="flex items-center gap-1.5">
            {miniInput(deg.degree, (v) => onEdit("deg-degree", si, di, v), "Degree")}
            <RemoveBtn label="Remove" onClick={() => onEdit("remove-degree", si, di)} />
          </div>
          {miniInput(deg.school, (v) => onEdit("deg-school", si, di, v), "School")}
          <div className="flex gap-1.5">
            {miniInput(deg.location, (v) => onEdit("deg-location", si, di, v), "Location")}
            {miniInput(deg.period, (v) => onEdit("deg-period", si, di, v), "2019 — 2023")}
          </div>
        </div>
      ))}
      <AddRow onClick={() => onEdit("add-degree", si)}>Add education</AddRow>
    </Row>
  );
}

function SectionAccordion({ section, si, open, onToggle, onEdit, jobDesc, active, setActive }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex h-9 w-full items-center justify-between bg-card px-3 text-left [-webkit-tap-highlight-color:transparent]"
      >
        <span className="text-[12.5px] font-bold text-foreground">{section.label}</span>
        <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        section.type === "text" ? <TextSection section={section} si={si} onEdit={onEdit} jobDesc={jobDesc} active={active} setActive={setActive} />
        : section.type === "bullets" ? <BulletsSection section={section} si={si} onEdit={onEdit} />
        : section.type === "jobs" ? <JobsSection section={section} si={si} onEdit={onEdit} jobDesc={jobDesc} active={active} setActive={setActive} />
        : section.type === "education" ? <EducationSection section={section} si={si} onEdit={onEdit} />
        : null
      )}
    </div>
  );
}

export function BuilderSidebar({ resume, onEdit, jobDesc, docStyle, setDocStyle, onBuildAnother }) {
  const [view, setView] = useState("build");
  const [openIndex, setOpenIndex] = useState(0);
  const [active, setActive] = useState(null);

  if (!resume) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-0.5 p-2.5">
        {[["build", "Build"], ["templates", "Templates"]].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`h-8 flex-1 rounded-[7px] text-[12px] font-bold [-webkit-tap-highlight-color:transparent] ${
              view === id ? "bg-muted text-foreground" : "bg-transparent text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "build" ? (
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2.5 pb-4">
          {resume.sections.map((sec, si) => (
            <SectionAccordion
              key={sec.id || si}
              section={sec} si={si}
              open={openIndex === si}
              onToggle={() => setOpenIndex(openIndex === si ? -1 : si)}
              onEdit={onEdit} jobDesc={jobDesc}
              active={active} setActive={setActive}
            />
          ))}
          {onBuildAnother && (
            <button
              type="button"
              onClick={onBuildAnother}
              className="mt-1 h-8 shrink-0 rounded-[7px] text-[11.5px] font-bold text-muted-foreground hover:text-foreground [-webkit-tap-highlight-color:transparent]"
            >
              Build another
            </button>
          )}
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto p-2.5 content-start">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              onClick={() => setDocStyle((s) => ({ ...s, layout: l.id }))}
              aria-pressed={(docStyle.layout || "classic") === l.id}
              className={`flex flex-col items-center gap-1.5 rounded-[10px] border p-2.5 [-webkit-tap-highlight-color:transparent] ${
                (docStyle.layout || "classic") === l.id ? "border-foreground/40 bg-muted/60" : "border-border"
              }`}
            >
              <TemplatePreview layoutId={l.id} width={64} height={84} />
              <span className="text-[11px] font-bold text-foreground">{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
