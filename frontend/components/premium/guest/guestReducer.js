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
    };
    const action = map[type]?.(...args);
    if (action) dispatch(action);
  };
}
