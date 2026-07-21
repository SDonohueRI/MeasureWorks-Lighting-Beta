/* customModeState.js — Custom Mode in-memory project model and mutation
   helpers. Pure state: no DOM. Matches the schema in
   updates/custom-mode-implementation-spec.md §10. The shape is intentionally
   JSON-serializable (no circular refs, results/warnings recomputable) so a
   project can be exported and reconstructed, and so 8760 expansion can attach
   to the same structure later. Mirrors the framework rule from engine.js:
   inputs in, state out, presentation lives elsewhere (customModeUI.js). */

let CUSTOM_PROJECT = null;   // single active project in browser state
let CM_ZONE_SEQ = 1;         // stable, monotonic zone id counter

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
