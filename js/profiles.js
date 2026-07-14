/* profiles.js — program profiles: pure data, no logic.
   One object per client. In production keep one file per profile in js/profiles/
   and register into PROFILES; combined here for the prototype.
   schemaVersion guards future migrations. */

const PROFILES = {

  xcel_mn: {
    schemaVersion: 1,
    id: "xcel_mn",
    label: "Xcel Energy (MN) — Custom",
    version: "2026.1",
    mode: "8760",                       // native hourly output required
    peakWindow: { months:[6,7,8], hourStart:13, hourEnd:17, weekdaysOnly:true },
    interactiveEffects: {
      defaultOn: true,
      variesBySpaceType: true,
      // fallback used for any space type not listed below
      kwhFactor: 1.07, kwFactor: 1.16,
      byType: {                                   // placeholder values — replace per MN TRM
        office:    { kwh: 1.10, kw: 1.21 },       // cooled office
        retail:    { kwh: 1.09, kw: 1.19 },
        school:    { kwh: 1.06, kw: 1.18 },
        warehouse: { kwh: 1.02, kw: 1.05 },       // semi-conditioned
        cont24:    { kwh: 1.05, kw: 1.10 },
        exterior:  { kwh: 1.00, kw: 1.00 }        // unconditioned — no HVAC interaction
      },
      source: "Placeholder — replace with MN TRM lighting interactive effects by building type" },
    controlsFactors: { none:0, occ:0.24, daylight:0.28, nlc:0.40,
      source: "Placeholder — MN TRM v4 controls savings factors" },
    incentive: { type:"perKWh", rate:0.08, capPctOfCost:0.60,
      label:"$0.08/kWh, capped at 60% of project cost",
      source:"Placeholder — confirm current Xcel custom efficiency offer" },
    measureLifeYrs: 15,
    wattageTable: "std_v1",
    houSource: "Schedule-derived (see schedule library); metered data preferred for custom review."
  },

  midamerican_ia: {
    schemaVersion: 1,
    id: "midamerican_ia",
    label: "MidAmerican (IA) — Custom",
    version: "2026.1",
    mode: "annual",                     // simple annual math, no hourly output
    peakWindow: null,
    coincidenceFactor: { office:0.75, warehouse:0.85, retail:0.90, cont24:1.0, exterior:0.0, school:0.55,
      source: "Placeholder — IA statewide TRM lighting CFs" },
    interactiveEffects: { kwhFactor: 1.0, kwFactor: 1.0, defaultOn: false,
      source: "Not applied per program policy" },
    controlsFactors: { none:0, occ:0.30, daylight:0.30, nlc:0.45,
      source: "Placeholder — IA TRM controls savings factors" },
    incentive: { type:"perKWh", rate:0.06, capPctOfCost:0.50,
      label:"$0.06/kWh, capped at 50% of project cost",
      source:"Placeholder — confirm current MidAmerican custom offer" },
    measureLifeYrs: 13,
    wattageTable: "std_v1",
    houSource: "Profile defaults by space type; customer-verified hours accepted with documentation."
  }
};

const CONTROL_OPTIONS = [
  { id:"none",     label:"None" },
  { id:"occ",      label:"Occupancy sensor" },
  { id:"daylight", label:"Daylighting" },
  { id:"nlc",      label:"Networked (NLC)" }
];
