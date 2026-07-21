/* customModeState.js — Custom Mode in-memory project model and mutation
   helpers. Pure state: no DOM. Matches the schema in
   updates/custom-mode-implementation-spec.md §10. The shape is intentionally
   JSON-serializable (no circular refs, results/warnings recomputable) so a
   project can be exported and reconstructed, and so 8760 expansion can attach
   to the same structure later. Mirrors the framework rule from engine.js:
   inputs in, state out, presentation lives elsewhere (customModeUI.js). */

let CUSTOM_PROJECT = null;   // single active project in browser state
let CM_ZONE_SEQ = 1;         // stable, monotonic zone id counter
let CM_FX_SEQ = 1;           // stable, monotonic fixture-row id counter

// Factory: one fixture row (baseline or proposed inventory line).
function createFixtureRow(opts){
  opts = opts || {};
  return {
    id: opts.id || ("fx-" + (CM_FX_SEQ++)),
    label: opts.label || "",
    quantity: opts.quantity ?? 1,
    inputWatts: opts.inputWatts ?? null
  };
}

// First registered profile, used as the default when none is chosen yet.
function cmDefaultProfileId(){
  return (typeof PROFILES === "object" && PROFILES) ? (Object.keys(PROFILES)[0] || null) : null;
}

/* Factory: one zone with the full editable structure. Every modeling field a
   zone can hold exists here from the start so the UI and engine never have to
   guard against missing branches. */
function createCustomZone(opts){
  opts = opts || {};
  return {
    id: opts.id || ("zone-" + (CM_ZONE_SEQ++)),
    name: opts.name || "New Zone",
    spaceType: opts.spaceType || "",
    floorArea: opts.floorArea ?? null,
    daylightEligible: opts.daylightEligible ?? false,
    scheduleId: opts.scheduleId ?? null,
    scheduleInherited: opts.scheduleInherited ?? true,
    notes: opts.notes || "",
    baseline: {
      source: "existing",              // existing | code | custom
      method: "fixtures",              // fixtures | connectedLoad | lpd
      connectedLoadKw: null,
      lpd: null,
      fixtureRows: [],
      referenceNote: ""
    },
    proposed: {
      method: "fixtures",              // fixtures | connectedLoad | lpd
      connectedLoadKw: null,
      lpd: null,
      fixtureRows: [],
      sameAsBaseline: false,
      referenceNote: ""
    },
    controls: {
      occupancy:  { enabled:false, factor:null },
      daylight:   { enabled:false, factor:null },
      trim:       { enabled:false, percent:0 },
      scheduling: { enabled:false, factor:null },
      customNote: ""
    },
    economics: {
      installCost: null,
      rebateOverride: null,
      rateOverride: null
    },
    results: {},                       // derived, filled by the results layer
    warnings: []                       // derived, filled by the warnings layer
  };
}

/* Factory: a fresh project seeded with one zone. Project-level defaults are
   kept separate from per-zone data so a zone can inherit or override cleanly. */
function createCustomProject(profileId){
  return {
    name: "Untitled Project",
    profileId: profileId || cmDefaultProfileId(),
    calcMode: "annual",                // annual required now; room reserved for 8760
    notes: "",
    defaults: {
      scheduleId: null,
      electricRate: null,
      demandRate: null,
      interactiveEffectsEnabled: true,
      rebateMode: "profile"
    },
    zones: [ createCustomZone({ name: "Zone 1" }) ],
    results: {},
    warnings: []
  };
}

// Lazily create the active project so callers never touch a null.
function cmEnsureProject(){
  if(!CUSTOM_PROJECT) CUSTOM_PROJECT = createCustomProject();
  return CUSTOM_PROJECT;
}

// Deep, serializable clone. Doubles as a guard: a project that can't round-trip
// through JSON isn't a valid Custom Mode state.
function cmCloneZone(zone){
  return JSON.parse(JSON.stringify(zone));
}

/* ---- mutation helpers (state only; UI re-renders separately) ---- */

function cmAddZone(){
  const p = cmEnsureProject();
  const zone = createCustomZone({ name: "Zone " + (p.zones.length + 1) });
  p.zones.push(zone);
  return zone;
}

function cmDuplicateZone(id){
  const p = cmEnsureProject();
  const i = p.zones.findIndex(z => z.id === id);
  if(i < 0) return null;
  const copy = cmCloneZone(p.zones[i]);
  copy.id = "zone-" + (CM_ZONE_SEQ++);
  copy.name = p.zones[i].name + " (copy)";
  p.zones.splice(i + 1, 0, copy);
  return copy;
}

function cmDeleteZone(id){
  const p = cmEnsureProject();
  p.zones = p.zones.filter(z => z.id !== id);
  return p;
}

function cmSetProjectFieldState(field, value){
  const p = cmEnsureProject();
  p[field] = value;
  return p;
}

function cmSetProjectDefault(field, value){
  const p = cmEnsureProject();
  p.defaults[field] = value;
  return p;
}

function cmSetZoneFieldState(id, field, value){
  const p = cmEnsureProject();
  const zone = p.zones.find(z => z.id === id);
  if(zone) zone[field] = value;
  return zone;
}

// Toggle a zone between inheriting a project default and holding its own value.
function cmToggleZoneInherit(id, inheritedFlag, value){
  const p = cmEnsureProject();
  const zone = p.zones.find(z => z.id === id);
  if(!zone) return null;
  zone[inheritedFlag] = !zone[inheritedFlag];
  if(value !== undefined) return zone;
  return zone;
}

function cmZoneById(id){
  return cmEnsureProject().zones.find(z => z.id === id) || null;
}

/* Set a nested zone field by dotted path, e.g. "baseline.method" or
   "controls.trim.percent". Walks existing branches only (the factory seeds
   every branch), so it never fabricates structure. */
function cmSetZoneNested(id, path, value){
  const zone = cmZoneById(id);
  if(!zone) return null;
  const parts = path.split(".");
  let o = zone;
  for(let i = 0; i < parts.length - 1; i++){
    o = o[parts[i]];
    if(o == null) return null;
  }
  o[parts[parts.length - 1]] = value;
  return zone;
}

/* ---- fixture-row helpers (which = "baseline" | "proposed") ---- */
function cmAddFixtureRow(id, which){
  const zone = cmZoneById(id);
  if(!zone || !zone[which]) return null;
  const row = createFixtureRow();
  zone[which].fixtureRows.push(row);
  return row;
}

function cmDeleteFixtureRow(id, which, rowId){
  const zone = cmZoneById(id);
  if(!zone || !zone[which]) return null;
  zone[which].fixtureRows = zone[which].fixtureRows.filter(r => r.id !== rowId);
  return zone;
}

function cmSetFixtureRow(id, which, rowId, field, value){
  const zone = cmZoneById(id);
  if(!zone || !zone[which]) return null;
  const row = zone[which].fixtureRows.find(r => r.id === rowId);
  if(row) row[field] = value;
  return row;
}

/* Shortcut: seed proposed from baseline (fresh fixture-row ids so the two
   inventories edit independently). Clears sameAsBaseline since proposed now
   holds its own explicit values. */
function cmCopyBaselineToProposed(id){
  const zone = cmZoneById(id);
  if(!zone) return null;
  zone.proposed.method = zone.baseline.method;
  zone.proposed.connectedLoadKw = zone.baseline.connectedLoadKw;
  zone.proposed.lpd = zone.baseline.lpd;
  zone.proposed.fixtureRows = zone.baseline.fixtureRows.map(r =>
    createFixtureRow({ label:r.label, quantity:r.quantity, inputWatts:r.inputWatts }));
  zone.proposed.sameAsBaseline = false;
  return zone;
}
