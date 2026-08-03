"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// LIVE PREVIEW — fully editable inline
// ═══════════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from "react";

export function EditableSpan({ value, onChange, style: extraStyle, multiline, bold, italic }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(value);
  const ref = useRef(null);

  useEffect(() => { setVal(value); }, [value]);
  useEffect(() => {
    if (!editing || !ref.current) return;
    ref.current.focus();
    // This field inherits its font-size from the resume's own type scale
    // (9–13pt, i.e. under 16px), which is exactly the range that makes iOS
    // Safari auto-zoom the whole page on focus. Reading the computed size
    // after mount (rather than hard-coding a number here) means this stays
    // correct no matter what parent wrapper it's nested in — if it's ever
    // under 16px, bump it for the duration of the edit only; the display
    // span goes right back to inheriting the true size on blur.
    const computed = parseFloat(window.getComputedStyle(ref.current).fontSize);
    if (computed && computed < 16) ref.current.style.fontSize = "16px";
  }, [editing]);

  const commit = () => { onChange(val); setEditing(false); };
  const shared = {
    fontFamily: "inherit", fontSize: "inherit", lineHeight: "inherit",
    fontWeight: bold ? "bold" : "inherit", fontStyle: italic ? "italic" : "inherit",
    color: "inherit", border: "2px solid #3B82F6", borderRadius: 3,
    background: "rgba(59,130,246,0.06)", outline: "none",
    padding: "0 2px", width: "100%", boxSizing: "border-box", ...extraStyle,
  };

  if (editing) {
    return multiline
      ? <textarea ref={ref} value={val} rows={Math.max(2, val.split("\n").length)}
          onChange={e => setVal(e.target.value)} onBlur={commit}
          style={{ ...shared, resize: "vertical", display: "block" }} />
      : <input ref={ref} value={val} type="text"
          onChange={e => setVal(e.target.value)}
          onBlur={commit} onKeyDown={e => e.key === "Enter" && commit()}
          style={shared} />;
  }
  return (
    <span onClick={() => setEditing(true)} title="Click to edit"
      style={{ cursor: "text", borderBottom: "1.5px dashed transparent",
        WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
        transition: "border-color 0.12s", ...extraStyle,
        fontWeight: bold ? "bold" : undefined, fontStyle: italic ? "italic" : undefined }}
      onMouseEnter={e => { e.currentTarget.style.borderBottomColor = "#3B82F680"; }}
      onMouseLeave={e => { e.currentTarget.style.borderBottomColor = "transparent"; }}>
      {val || <span style={{ color: "#aaa" }}>Click to edit</span>}
    </span>
  );
}
