// ═══════════════════════════════════════════════════════════════════════════════
// RESUME STATE REDUCER
// ═══════════════════════════════════════════════════════════════════════════════
export function resumeReducer(state, action) {
  const clone = () => JSON.parse(JSON.stringify(state));
  switch (action.type) {
    case "SET":    return action.resume;
    case "CONTACT": { const s = clone(); s.contact[action.key] = action.val; return s; }
    case "SEC_TEXT": { const s = clone(); s.sections[action.si].content = action.val; return s; }
    case "BULLET":   { const s = clone(); s.sections[action.si].items[action.ii] = action.val; return s; }
    case "JOB_ROLE":     { const s = clone(); s.sections[action.si].jobs[action.ji].role     = action.val; return s; }
    case "JOB_COMPANY":  { const s = clone(); s.sections[action.si].jobs[action.ji].company  = action.val; return s; }
    case "JOB_LOCATION": { const s = clone(); s.sections[action.si].jobs[action.ji].location = action.val; return s; }
    case "JOB_PERIOD":   { const s = clone(); s.sections[action.si].jobs[action.ji].period   = action.val; return s; }
    case "JOB_BULLET":   { const s = clone(); s.sections[action.si].jobs[action.ji].bullets[action.bi] = action.val; return s; }
    case "DEG_DEGREE":   { const s = clone(); s.sections[action.si].degrees[action.di].degree   = action.val; return s; }
    case "DEG_SCHOOL":   { const s = clone(); s.sections[action.si].degrees[action.di].school   = action.val; return s; }
    case "DEG_LOCATION": { const s = clone(); s.sections[action.si].degrees[action.di].location = action.val; return s; }
    case "DEG_PERIOD":   { const s = clone(); s.sections[action.si].degrees[action.di].period   = action.val; return s; }

    // Structural edits (add/remove an entry) — everything above only ever
    // changes a value that already exists. These are what the Builder
    // sidebar's "+ Add" rows and per-entry delete buttons need that the
    // canvas's click-to-edit fields never did, since editing text in place
    // was always possible but there was never a UI for adding or removing
    // a whole job/degree/bullet until the workspace redesign.
    case "ADD_JOB":    { const s = clone(); s.sections[action.si].jobs.push({ role: "", company: "", location: "", period: "", bullets: [""] }); return s; }
    case "REMOVE_JOB": { const s = clone(); s.sections[action.si].jobs.splice(action.ji, 1); return s; }
    case "ADD_DEGREE":    { const s = clone(); s.sections[action.si].degrees.push({ degree: "", school: "", location: "", period: "" }); return s; }
    case "REMOVE_DEGREE": { const s = clone(); s.sections[action.si].degrees.splice(action.di, 1); return s; }
    case "ADD_JOB_BULLET":    { const s = clone(); s.sections[action.si].jobs[action.ji].bullets.push(""); return s; }
    case "REMOVE_JOB_BULLET": { const s = clone(); s.sections[action.si].jobs[action.ji].bullets.splice(action.bi, 1); return s; }
    case "ADD_BULLET":    { const s = clone(); s.sections[action.si].items.push(""); return s; }
    case "REMOVE_BULLET": { const s = clone(); s.sections[action.si].items.splice(action.ii, 1); return s; }

    default: return state;
  }
}

export function onEditHandler(dispatch) {
  return (type, ...args) => {
    const map = {
      "contact":      (key, val)            => ({ type: "CONTACT",      key, val }),
      "section-text": (si, val)             => ({ type: "SEC_TEXT",     si, val }),
      "bullet":       (si, ii, val)         => ({ type: "BULLET",       si, ii, val }),
      "job-role":     (si, ji, val)         => ({ type: "JOB_ROLE",     si, ji, val }),
      "job-company":  (si, ji, val)         => ({ type: "JOB_COMPANY",  si, ji, val }),
      "job-location": (si, ji, val)         => ({ type: "JOB_LOCATION", si, ji, val }),
      "job-period":   (si, ji, val)         => ({ type: "JOB_PERIOD",   si, ji, val }),
      "job-bullet":   (si, ji, bi, val)     => ({ type: "JOB_BULLET",   si, ji, bi, val }),
      "deg-degree":   (si, di, val)         => ({ type: "DEG_DEGREE",   si, di, val }),
      "deg-school":   (si, di, val)         => ({ type: "DEG_SCHOOL",   si, di, val }),
      "deg-location": (si, di, val)         => ({ type: "DEG_LOCATION", si, di, val }),
      "deg-period":   (si, di, val)         => ({ type: "DEG_PERIOD",   si, di, val }),
      "add-job":         (si)               => ({ type: "ADD_JOB",         si }),
      "remove-job":      (si, ji)           => ({ type: "REMOVE_JOB",      si, ji }),
      "add-degree":      (si)               => ({ type: "ADD_DEGREE",      si }),
      "remove-degree":   (si, di)           => ({ type: "REMOVE_DEGREE",   si, di }),
      "add-job-bullet":  (si, ji)           => ({ type: "ADD_JOB_BULLET",  si, ji }),
      "remove-job-bullet": (si, ji, bi)     => ({ type: "REMOVE_JOB_BULLET", si, ji, bi }),
      "add-bullet":      (si)               => ({ type: "ADD_BULLET",      si }),
      "remove-bullet":   (si, ii)           => ({ type: "REMOVE_BULLET",   si, ii }),
    };
    const action = map[type]?.(...args);
    if (action) dispatch(action);
  };
}
