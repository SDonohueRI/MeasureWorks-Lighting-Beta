/* customModeEngine.js — pure Custom Mode calculations (Phase 1, annual mode).
   No DOM, no global mutation: takes a project (customModeState shape) and the
   active profile, returns per-zone and project results. Mirrors the framework
   rule that reusable math lives in the engine layer, not the UI.

   Reuses SCHEDULES / scheduleHOU (schedules.js) and ieFor (engine.js). Keeps
   the calculator's engine untouched; Custom Mode's derivations live here so the
   two paths evolve independently while sharing profile data.

   Calculation model (implementation spec §11):
   - connected load: fixtures Σ(qty×W)/1000 · direct kW · or LPD×area/1000
   - trim reduces proposed connected load (power) directly
   - occupancy/daylight/scheduling reduce proposed annual energy as SEQUENTIAL
     factors, never additive
   - annual kWh = connected load × annual hours (× control factors for proposed)
   - interactive effects scale savings per profile
   - economics: cost = kWh savings × rate; profile or override rebate; simple
     payback = (install − rebate) / annual cost savings */

// Placeholder annual hours when a zone resolves to no schedule. Explicit and
// overridable rather than a hidden assumption (spec §11.5).
const CM_DEFAULT_ANNUAL_HOURS = 3000;

// Finite number or fallback (treats null/blank/NaN as "not entered").
function cmNumOr(v, d){ return (typeof v === "number" && isFinite(v)) ? v : d; }

/* Connected load (kW) for a baseline/proposed branch. Zone is passed so the LPD
   method can read floor area. Missing inputs contribute 0 (completeness is a
   warnings concern, handled in the warnings slice). */
function cmConnectedLoadKw(branch, zone){
  if(!branch) return 0;
  if(branch.method === "connectedLoad") return cmNumOr(branch.connectedLoadKw, 0);
  if(branch.method === "lpd"){
    return (cmNumOr(branch.lpd, 0) * cmNumOr(zone.floorArea, 0)) / 1000;
  }
  let watts = 0;                                   // fixtures
  for(const r of branch.fixtureRows || [])
    watts += cmNumOr(r.quantity, 0) * cmNumOr(r.inputWatts, 0);
  return watts / 1000;
}

// Annual operating hours for a zone: its resolved schedule → hours, else default.
function cmZoneAnnualHours(zone, project){
  const key = zone.scheduleInherited ? project.defaults.scheduleId : zone.scheduleId;
  if(key && typeof SCHEDULES === "object" && SCHEDULES[key] && typeof scheduleHOU === "function")
    return scheduleHOU(key);
  return CM_DEFAULT_ANNUAL_HOURS;
}

/* Sequential energy multiplier from a controls set's runtime controls
   (occupancy, daylight, scheduling). Each enabled control uses its own factor,
   or the profile default where one exists, and reduces energy multiplicatively
   — so combined savings never exceed 100% and never simply add. Returns [0,1]. */
function cmControlEnergyFactor(controls, profile){
  const c = controls, cf = (profile && profile.controlsFactors) || {};
  let f = 1;
  if(c.occupancy.enabled)  f *= (1 - cmNumOr(c.occupancy.factor,  cmNumOr(cf.occ, 0)));
  if(c.daylight.enabled)   f *= (1 - cmNumOr(c.daylight.factor,   cmNumOr(cf.daylight, 0)));
  if(c.scheduling.enabled) f *= (1 - cmNumOr(c.scheduling.factor, 0));
  return f < 0 ? 0 : f;
}

/* Energy for one side (baseline or proposed) given its raw connected load and
   its own controls: trim lowers connected power directly, then occupancy/
   daylight/scheduling reduce annual energy sequentially. */
function cmBranchEnergy(controls, rawKw, hours, profile){
  const trim = controls.trim;
  const effKw = trim.enabled ? rawKw * (1 - cmNumOr(trim.percent, 0) / 100) : rawKw;
  const factor = cmControlEnergyFactor(controls, profile);
  return { effKw, factor, kwh: effKw * hours * factor };
}

/* Profile/override rebate for a zone. Priority (spec §11.7):
   1) explicit zone override, 2) profile incentive rule (capped by install cost),
   3) null (no basis — surfaced as blank, not zero-with-false-confidence). */
function cmZoneRebate(zone, profile, m){
  const ov = zone.economics.rebateOverride;
  if(typeof ov === "number" && isFinite(ov)) return ov;
  const inc = profile && profile.incentive;
  if(inc){
    let raw = inc.type === "perKWh" ? m.kwhSavings * inc.rate
            : inc.type === "perKW"  ? m.kwSavings  * inc.rate : 0;
    if(m.installCost != null && inc.capPctOfCost != null)
      raw = Math.min(raw, m.installCost * inc.capPctOfCost);
    return raw > 0 ? raw : 0;
  }
  return null;
}

// Full result set for one zone.
function cmCalcZone(zone, project, profile){
  const ieOn = !!(project.defaults && project.defaults.interactiveEffectsEnabled);
  const ie = (typeof ieFor === "function") ? ieFor(profile, zone.spaceType, ieOn) : { kwh:1, kw:1 };

  const hours = cmZoneAnnualHours(zone, project);

  // Raw connected loads from each side's method; proposed may mirror baseline.
  const baseRawKw = cmConnectedLoadKw(zone.baseline, zone);
  const propRawKw = zone.proposed.sameAsBaseline ? baseRawKw : cmConnectedLoadKw(zone.proposed, zone);

  // Apply each side's own controls (trim to power, occ/daylight/scheduling to
  // energy). Baseline can carry controls too — savings come from the delta.
  const B = cmBranchEnergy(zone.baseline.controls, baseRawKw, hours, profile);
  const P = cmBranchEnergy(zone.proposed.controls, propRawKw, hours, profile);

  const baselineKw = B.effKw;   // trim-adjusted (operating) connected load
  const proposedKw = P.effKw;
  const baselineKwh = B.kwh;
  const proposedKwh = P.kwh;
  const kwhSavings  = (baselineKwh - proposedKwh) * ie.kwh;

  // Demand savings: operating connected-load delta × coincidence (if the profile
  // defines it for this space type) × interactive-effects kW factor.
  const coincidence = cmNumOr(profile.coincidenceFactor && profile.coincidenceFactor[zone.spaceType], 1);
  const kwSavings = (baselineKw - proposedKw) * coincidence * ie.kw;

  const rate = cmNumOr(zone.economics.rateOverride, cmNumOr(project.defaults.electricRate, null));
  const costSavings = (rate != null) ? kwhSavings * rate : null;

  const installCost = cmNumOr(zone.economics.installCost, null);
  const rebate = cmZoneRebate(zone, profile, { kwhSavings, kwSavings, installCost });

  let payback = null;
  if(costSavings != null && costSavings > 0 && installCost != null){
    payback = (installCost - cmNumOr(rebate, 0)) / costSavings;
  }

  return {
    baselineKw, proposedKw, deltaKw: baselineKw - proposedKw,
    baseRawKw, propRawKw,
    hours, baseCtrlFactor: B.factor, propCtrlFactor: P.factor,
    baselineKwh, proposedKwh, kwhSavings,
    kwSavings, coincidence,
    rate, costSavings,
    installCost, rebate, payback,
    ieKwh: ie.kwh, ieKw: ie.kw
  };
}

/* Project result: per-zone results plus aggregated totals. Totals are the sum
   of zone-level values (spec §11.9); cost/rebate/payback aggregate only where a
   basis exists so a single rate-less zone doesn't silently zero the project. */
function cmCalcProject(project, profile){
  const zones = (project.zones || []).map(z => ({
    id: z.id, name: z.name, results: cmCalcZone(z, project, profile)
  }));

  const t = { baselineKw:0, proposedKw:0, deltaKw:0, kwSavings:0,
              baselineKwh:0, proposedKwh:0, kwhSavings:0,
              costSavings:0, hasCost:false, rebate:0, hasRebate:false,
              installCost:0, hasInstall:false, payback:null };

  for(const z of zones){
    const r = z.results;
    t.baselineKw += r.baselineKw; t.proposedKw += r.proposedKw; t.deltaKw += r.deltaKw;
    t.kwSavings  += r.kwSavings;
    t.baselineKwh += r.baselineKwh; t.proposedKwh += r.proposedKwh; t.kwhSavings += r.kwhSavings;
    if(r.costSavings != null){ t.costSavings += r.costSavings; t.hasCost = true; }
    if(r.rebate != null){ t.rebate += r.rebate; t.hasRebate = true; }
    if(r.installCost != null){ t.installCost += r.installCost; t.hasInstall = true; }
  }
  if(t.hasCost && t.costSavings > 0 && t.hasInstall && t.installCost > 0)
    t.payback = (t.installCost - t.rebate) / t.costSavings;

  return { zones, totals: t };
}
