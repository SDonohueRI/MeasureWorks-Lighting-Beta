/* customModeWarnings.js — pure, non-blocking review warnings for Custom Mode.
   Returns [{level, msg}] arrays; no DOM, no mutation. Mirrors engine.js
   sanityChecks: it flags likely-incomplete or suspect inputs, never blocks
   editing or calculation (implementation spec §12). "warn" = amber review flag,
   "info" = assumption/limitation the user should know about. */

function cmHasNum(v){ return typeof v === "number" && isFinite(v); }

// Warnings for one baseline/proposed branch (label distinguishes them).
function cmBranchWarnings(branch, zone, label, out){
  if(branch.method === "fixtures"){
    const rows = branch.fixtureRows || [];
    if(!rows.length){ out.push({ level:"warn", msg:`${label}: fixtures selected but no rows entered.` }); return; }
    rows.forEach((r, i) => {
      if(!cmHasNum(r.quantity) || r.quantity <= 0) out.push({ level:"warn", msg:`${label}: fixture row ${i+1} missing quantity.` });
      if(!cmHasNum(r.inputWatts))                   out.push({ level:"warn", msg:`${label}: fixture row ${i+1} missing watts.` });
    });
  } else if(branch.method === "connectedLoad"){
    if(!cmHasNum(branch.connectedLoadKw)) out.push({ level:"warn", msg:`${label}: connected load (kW) not entered.` });
  } else if(branch.method === "lpd"){
    if(!cmHasNum(branch.lpd))       out.push({ level:"warn", msg:`${label}: LPD not entered.` });
    if(!cmHasNum(zone.floorArea))   out.push({ level:"warn", msg:`${label}: LPD method needs floor area.` });
  }
}

// All warnings for a zone. `results` (from cmCalcZone) enables savings sanity.
function cmZoneWarnings(zone, project, profile, results){
  const out = [];
  cmBranchWarnings(zone.baseline, zone, "Baseline", out);
  if(!zone.proposed.sameAsBaseline) cmBranchWarnings(zone.proposed, zone, "Proposed", out);

  // controls enabled without a usable factor (zone value or profile default)
  const cf = (profile && profile.controlsFactors) || {};
  const c = zone.controls;
  if(c.occupancy.enabled && !cmHasNum(c.occupancy.factor) && !cmHasNum(cf.occ))
    out.push({ level:"warn", msg:"Occupancy control enabled without a savings factor." });
  if(c.daylight.enabled && !cmHasNum(c.daylight.factor) && !cmHasNum(cf.daylight))
    out.push({ level:"warn", msg:"Daylight control enabled without a savings factor." });
  if(c.scheduling.enabled && !cmHasNum(c.scheduling.factor))
    out.push({ level:"warn", msg:"Scheduling control enabled without a factor." });
  if(c.trim.enabled && (!cmHasNum(c.trim.percent) || c.trim.percent <= 0))
    out.push({ level:"warn", msg:"Trim enabled but percent reduction is 0." });

  // schedule-dependent energy: no resolved schedule → default hours placeholder
  const key = zone.scheduleInherited ? (project.defaults && project.defaults.scheduleId) : zone.scheduleId;
  const defH = (typeof CM_DEFAULT_ANNUAL_HOURS === "number") ? CM_DEFAULT_ANNUAL_HOURS : 3000;
  if(!key) out.push({ level:"info", msg:`No schedule set — using default ${defH} annual hours.` });

  // savings sanity
  if(results && results.baselineKw > 0 && results.proposedKw >= results.baselineKw)
    out.push({ level:"warn", msg:"Proposed load ≥ baseline — savings will be zero or negative." });

  // economics completeness
  if(cmHasNum(zone.economics.installCost) && results && results.costSavings == null)
    out.push({ level:"info", msg:"Install cost entered but no electric rate — payback unavailable." });

  return out;
}

// Project-level warnings (things not tied to a single zone).
function cmProjectWarnings(project, profile, totals){
  const out = [];
  if(!project.zones || !project.zones.length){ out.push({ level:"info", msg:"No zones yet — add one to begin modeling." }); return out; }
  const anyRate = cmHasNum(project.defaults && project.defaults.electricRate)
    || project.zones.some(z => cmHasNum(z.economics.rateOverride));
  if(!anyRate) out.push({ level:"info", msg:"No electric rate set — cost savings and payback unavailable." });
  return out;
}
