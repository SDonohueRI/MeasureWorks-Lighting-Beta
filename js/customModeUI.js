/* customModeUI.js — Custom Mode presentation and mode switching. Renders the
   three-region workspace (top project bar, modeling workspace, results sidebar)
   plus the separate full-results view, per
   updates/custom-mode-screen-layout-spec.md.

   Task A: shell + mode switch + zone CRUD.
   Task B: project-defaults panel + expandable per-zone editor (identity,
           baseline, proposed, controls, scheduling, economics, notes) with
           conditional field reveal.
   Engine math, live result values, and warnings are layered on in later slices;
   result areas render as placeholders here. Reuses the $() helper and PROFILES /
   SCHEDULES / scheduleHOU globals already loaded by ui.js / profiles.js /
   schedules.js. */

// UI-only expanded/collapsed state (ephemeral; never part of saved project data)
const CM_EXPANDED = new Set();

const CM_METHODS = [
  { id:"fixtures",     label:"Fixture inventory" },
  { id:"connectedLoad",label:"Connected load (kW)" },
  { id:"lpd",          label:"LPD × area" }
];
const CM_SOURCES = [
  { id:"existing", label:"Existing" },
  { id:"code",     label:"Code" },
  { id:"custom",   label:"Custom" }
];

/* ---- app-level mode switch (Calculator <-> Custom) ---- */
function setAppMode(mode){
  const isCustom = mode === "custom";
  const calcView   = $("calcView");
  const customView = $("customView");
  const calcTools  = $("calcToolbar");
  const modechip   = $("modechip");

  if(calcView)   calcView.style.display   = isCustom ? "none" : "";
  if(customView) customView.style.display = isCustom ? "" : "none";
  if(calcTools)  calcTools.style.display  = isCustom ? "none" : "";
  if(modechip)   modechip.style.display   = isCustom ? "none" : "";

  const bCalc = $("mode-calc"), bCustom = $("mode-custom");
  if(bCalc)   bCalc.classList.toggle("on", !isCustom);
  if(bCustom) bCustom.classList.toggle("on", isCustom);

  if(!isCustom){ closeFullResults(); }
  if(isCustom) renderCustomMode();
}

/* ---- top-level render ---- */
function renderCustomMode(){
  const p = cmEnsureProject();

  const nameEl = $("cm_projname");
  if(nameEl) nameEl.value = p.name;

  const sel = $("cm_profile");
  if(sel){
    if(!sel.options.length && typeof PROFILES === "object"){
      for(const k in PROFILES){
        const o = document.createElement("option");
        o.value = k; o.textContent = PROFILES[k].label;
        sel.appendChild(o);
      }
    }
    if(p.profileId) sel.value = p.profileId;
  }

  const calcEl = $("cm_calcmode");
  if(calcEl) calcEl.textContent = "Calc: " + p.calcMode;

  renderProjectDefaults();
  renderCustomZones();
  renderCustomSidebar();
}

/* ---- project defaults panel ---- */
function renderProjectDefaults(){
  const p = cmEnsureProject();
  const host = $("cm_defaults");
  if(!host) return;
  host.innerHTML = `
    <div class="grid2">
      <label class="field"><b>Default schedule</b>
        <select onchange="cmOnDefault('scheduleId', this.value || null)">${cmScheduleOptions(p.defaults.scheduleId)}</select></label>
      <label class="field"><b>Electric rate $/kWh</b>
        <input type="number" step="0.001" value="${cmVal(p.defaults.electricRate)}"
               oninput="cmOnDefault('electricRate', cmNum(this.value))"></label>
      <label class="field"><b>Demand rate $/kW</b>
        <input type="number" step="0.01" value="${cmVal(p.defaults.demandRate)}"
               oninput="cmOnDefault('demandRate', cmNum(this.value))"></label>
      <label class="field"><b>Rebate basis</b>
        <input value="Profile default" disabled title="Rebate is profile-driven in Phase 1"></label>
      <div class="toggle"><input type="checkbox" id="cm_ie" ${p.defaults.interactiveEffectsEnabled ? "checked" : ""}
             onchange="cmOnDefault('interactiveEffectsEnabled', this.checked)">
        <label for="cm_ie">Apply HVAC interactive effects</label></div>
    </div>
    <label class="field cm-notes"><b>Project notes</b>
      <textarea rows="2" oninput="cmOnProjectNotes(this.value)">${cmEsc(p.notes)}</textarea></label>`;
}

function cmOnDefault(field, val){
  cmSetProjectDefault(field, val);
  if(field === "scheduleId") renderCustomZones();  // refresh zones that inherit
}
function cmOnProjectNotes(val){ cmSetProjectFieldState("notes", val); }

/* ---- zone manager ---- */
function renderCustomZones(){
  const p = cmEnsureProject();
  const host = $("cm_zonelist");
  if(!host) return;
  host.innerHTML = p.zones.length
    ? p.zones.map(cmZoneCardHTML).join("")
    : `<div class="cm-empty">No zones yet. Add one to begin modeling.</div>`;
}

function cmZoneCardHTML(z){
  const open = CM_EXPANDED.has(z.id);
  return `<div class="cm-zone ${open ? "open" : ""}" data-zone="${z.id}">
    <div class="cm-zone-head">
      <button class="cm-caret" onclick="cmToggleZone('${z.id}')" title="${open ? "Collapse" : "Expand"}">${open ? "▾" : "▸"}</button>
      <input class="cm-zone-name" value="${cmEsc(z.name)}" oninput="cmOnZoneName('${z.id}', this.value)" aria-label="Zone name">
      <span class="cm-zone-sum">${cmZoneSummary(z)}</span>
      <span class="cm-zone-actions">
        <button class="rowbtn" title="Duplicate zone" onclick="cmOnDuplicateZone('${z.id}')">&#10697;</button>
        <button class="rowbtn" title="Delete zone" onclick="cmOnDeleteZone('${z.id}')">&#10005;</button>
      </span>
    </div>
    ${open ? `<div class="cm-zone-body">${cmZoneEditorHTML(z)}</div>` : ``}
  </div>`;
}

function cmZoneSummary(z){
  const pr = z.proposed.sameAsBaseline ? "same as baseline" : cmMethodLabel(z.proposed.method);
  const ctrls = cmControlsSummary(z);
  return `Baseline: ${cmSourceLabel(z.baseline.source)} &middot; ${cmMethodLabel(z.baseline.method)}`
       + ` &nbsp;&rarr;&nbsp; Proposed: ${pr}`
       + (ctrls ? ` &middot; Controls: ${ctrls}` : ``);
}

function cmControlsSummary(z){
  const c = z.controls, on = [];
  if(c.occupancy.enabled) on.push("Occ");
  if(c.daylight.enabled)  on.push("Day");
  if(c.trim.enabled)      on.push("Trim" + (c.trim.percent ? " " + c.trim.percent + "%" : ""));
  if(c.scheduling.enabled)on.push("Sched");
  return on.join(" + ");
}

/* ---- zone editor ---- */
function cmZoneEditorHTML(z){
  return `<div class="cm-ed-pair">`
         + cmSection("Identity", cmIdentityHTML(z))
         + cmSection("Scheduling", cmSchedulingHTML(z))
       + `</div>`
       + `<div class="cm-ed-triple">`
         + cmSection("Baseline", cmBaselineHTML(z))
         + cmSection("Proposed", cmProposedHTML(z))
         + cmSection("Controls", cmControlsHTML(z))
       + `</div>`
       + `<div class="cm-ed-pair">`
         + cmSection("Economics / overrides", cmEconomicsHTML(z))
         + cmSection("Notes", cmNotesHTML(z))
       + `</div>`
       + `<div class="cm-zone-results">Zone results calculate once the engine slice lands.</div>`;
}

function cmSection(title, body){
  return `<div class="cm-sub"><div class="cm-sub-h">${title}</div><div class="cm-sub-b">${body}</div></div>`;
}

function cmIdentityHTML(z){
  return `<div class="grid2">
    <label class="field"><b>Space type</b>
      <select onchange="cmZR('${z.id}', 'spaceType', this.value)">${cmSpaceTypeOptions(z.spaceType)}</select></label>
    <label class="field"><b>Floor area (ft&sup2;)</b>
      <input type="number" step="1" value="${cmVal(z.floorArea)}" oninput="cmZ('${z.id}', 'floorArea', cmNum(this.value))"></label>
    <div class="toggle"><input type="checkbox" id="cm_dl_${z.id}" ${z.daylightEligible ? "checked" : ""}
           onchange="cmZ('${z.id}', 'daylightEligible', this.checked)">
      <label for="cm_dl_${z.id}">Daylight eligible</label></div>
  </div>`;
}

function cmBaselineHTML(z){
  return `<div class="grid2">
    <label class="field"><b>Baseline source</b>
      <select onchange="cmZR('${z.id}', 'baseline.source', this.value)">${cmOptions(CM_SOURCES, z.baseline.source)}</select></label>
    <label class="field"><b>Baseline method</b>
      <select onchange="cmZR('${z.id}', 'baseline.method', this.value)">${cmOptions(CM_METHODS, z.baseline.method)}</select></label>
  </div>
  ${cmMethodFieldsHTML(z, "baseline")}
  <label class="field cm-notes"><b>Reference / citation</b>
    <input value="${cmEsc(z.baseline.referenceNote)}" oninput="cmZ('${z.id}', 'baseline.referenceNote', this.value)"></label>
  <div class="cm-shortcut"><button onclick="cmCopyBaseline('${z.id}')">Copy baseline &rarr; proposed</button></div>`;
}

function cmProposedHTML(z){
  const same = z.proposed.sameAsBaseline;
  return `<div class="toggle"><input type="checkbox" id="cm_sab_${z.id}" ${same ? "checked" : ""}
           onchange="cmZR('${z.id}', 'proposed.sameAsBaseline', this.checked)">
      <label for="cm_sab_${z.id}">Same as baseline (controls-only)</label></div>
    ${same ? `<div class="cm-inline-note">Proposed connected load mirrors baseline; apply controls below.</div>`
      : `<div class="cm-row"><label class="field"><b>Proposed method</b>
           <select onchange="cmZR('${z.id}', 'proposed.method', this.value)">${cmOptions(CM_METHODS, z.proposed.method)}</select></label></div>
         ${cmMethodFieldsHTML(z, "proposed")}
         <label class="field cm-notes"><b>Reference / citation</b>
           <input value="${cmEsc(z.proposed.referenceNote)}" oninput="cmZ('${z.id}', 'proposed.referenceNote', this.value)"></label>`}`;
}

// Method-conditional inputs shared by baseline & proposed (which = branch name).
function cmMethodFieldsHTML(z, which){
  const b = z[which];
  if(b.method === "connectedLoad"){
    return `<div class="cm-row"><label class="field"><b>Connected load (kW)</b>
      <input type="number" step="0.01" value="${cmVal(b.connectedLoadKw)}"
             oninput="cmZ('${z.id}', '${which}.connectedLoadKw', cmNum(this.value))"></label></div>`;
  }
  if(b.method === "lpd"){
    const areaWarn = (z.floorArea == null || z.floorArea === "")
      ? `<div class="cm-inline-note warn">Set floor area (Identity) to derive connected load from LPD.</div>` : ``;
    return `<div class="cm-row"><label class="field"><b>LPD (W/ft&sup2;)</b>
      <input type="number" step="0.01" value="${cmVal(b.lpd)}"
             oninput="cmZ('${z.id}', '${which}.lpd', cmNum(this.value))"></label></div>${areaWarn}`;
  }
  return cmFixtureRowsHTML(z, which);   // default: fixtures
}

function cmFixtureRowsHTML(z, which){
  const rows = z[which].fixtureRows;
  const body = rows.length ? rows.map(r => `
    <tr>
      <td><input value="${cmEsc(r.label)}" placeholder="Fixture / description"
                 oninput="cmFxSet('${z.id}','${which}','${r.id}','label', this.value)"></td>
      <td><input type="number" step="1" value="${cmVal(r.quantity)}" style="width:70px"
                 oninput="cmFxSet('${z.id}','${which}','${r.id}','quantity', cmNum(this.value))"></td>
      <td><input type="number" step="1" value="${cmVal(r.inputWatts)}" style="width:80px"
                 oninput="cmFxSet('${z.id}','${which}','${r.id}','inputWatts', cmNum(this.value))"></td>
      <td><button class="rowbtn" title="Remove row" onclick="cmFxDel('${z.id}','${which}','${r.id}')">&#10005;</button></td>
    </tr>`).join("")
    : `<tr><td colspan="4" class="cm-inline-note">No fixtures yet.</td></tr>`;
  return `<table class="cm-fx"><thead><tr><th>Fixture</th><th>Qty</th><th>Watts ea.</th><th></th></tr></thead>
    <tbody>${body}</tbody></table>
    <div class="addrow"><button onclick="cmFxAdd('${z.id}','${which}')">+ Add fixture row</button></div>`;
}

function cmControlsHTML(z){
  const c = z.controls;
  const line = (key, label, valField, unit, step) => {
    const on = c[key].enabled;
    const val = c[key][valField];
    return `<div class="cm-ctrl">
      <label class="cm-ctrl-en"><input type="checkbox" ${on ? "checked" : ""}
        onchange="cmZR('${z.id}', 'controls.${key}.enabled', this.checked)"> ${label}</label>
      ${on ? `<label class="cm-ctrl-val">${unit}
        <input type="number" step="${step}" value="${cmVal(val)}"
          oninput="cmZ('${z.id}', 'controls.${key}.${valField}', cmNum(this.value))"></label>` : ``}
    </div>`;
  };
  return line("occupancy", "Occupancy", "factor", "Savings factor", "0.01")
       + line("daylight",  "Daylight",  "factor", "Savings factor", "0.01")
       + line("trim",      "High-end trim", "percent", "% power reduction", "1")
       + line("scheduling","Scheduling", "factor", "Runtime factor", "0.01")
       + `<label class="field cm-notes"><b>Controls note</b>
           <input value="${cmEsc(c.customNote)}" oninput="cmZ('${z.id}', 'controls.customNote', this.value)"></label>`;
}

function cmSchedulingHTML(z){
  const p = cmEnsureProject();
  const inherited = z.scheduleInherited;
  const defLabel = cmScheduleLabel(p.defaults.scheduleId);
  return `<div class="toggle"><input type="checkbox" id="cm_si_${z.id}" ${inherited ? "checked" : ""}
        onchange="cmZR('${z.id}', 'scheduleInherited', this.checked)">
      <label for="cm_si_${z.id}">Inherit project default schedule</label></div>
    ${inherited
      ? `<div class="cm-inline-note">Using project default: <b>${defLabel}</b></div>`
      : `<div class="cm-row"><label class="field"><b>Zone schedule</b>
           <select onchange="cmZ('${z.id}', 'scheduleId', this.value || null)">${cmScheduleOptions(z.scheduleId)}</select></label></div>`}`;
}

function cmEconomicsHTML(z){
  const e = z.economics;
  return `<div class="grid2">
    <label class="field"><b>Install cost $</b>
      <input type="number" step="1" value="${cmVal(e.installCost)}" oninput="cmZ('${z.id}', 'economics.installCost', cmNum(this.value))"></label>
    <label class="field"><b>Rebate override $</b>
      <input type="number" step="1" value="${cmVal(e.rebateOverride)}" oninput="cmZ('${z.id}', 'economics.rebateOverride', cmNum(this.value))"></label>
    <label class="field"><b>Rate override $/kWh</b>
      <input type="number" step="0.001" value="${cmVal(e.rateOverride)}" oninput="cmZ('${z.id}', 'economics.rateOverride', cmNum(this.value))"></label>
  </div>`;
}

function cmNotesHTML(z){
  return `<label class="field cm-notes"><b>Zone notes</b>
    <textarea rows="2" oninput="cmZ('${z.id}', 'notes', this.value)">${cmEsc(z.notes)}</textarea></label>`;
}

/* ---- sidebar ---- */
function renderCustomSidebar(){
  const p = cmEnsureProject();
  const zc = $("cm_zonecount");
  if(zc) zc.textContent = p.zones.length;

  const warns = p.zones.reduce((n, z) => n + (z.warnings ? z.warnings.length : 0), 0)
              + (p.warnings ? p.warnings.length : 0);
  const wc = $("cm_warncount");
  if(wc) wc.textContent = warns;
  const status = $("cm_status");
  if(status) status.textContent = warns + (warns === 1 ? " warning" : " warnings");
}

/* ---- handlers: zone CRUD ---- */
function cmAddZoneAndRender(){ const z = cmAddZone(); CM_EXPANDED.add(z.id); renderCustomMode(); }
function cmOnDuplicateZone(id){ const c = cmDuplicateZone(id); if(c) CM_EXPANDED.add(c.id); renderCustomMode(); }
function cmOnDeleteZone(id){ CM_EXPANDED.delete(id); cmDeleteZone(id); renderCustomMode(); }
function cmToggleZone(id){ if(CM_EXPANDED.has(id)) CM_EXPANDED.delete(id); else CM_EXPANDED.add(id); renderCustomZones(); }

// Name edits update state without rebuilding the list, to preserve input focus.
function cmOnZoneName(id, val){ cmSetZoneFieldState(id, "name", val); }

/* ---- handlers: zone fields ----
   cmZ  = non-structural edit (text/number): update state only, keep focus.
   cmZR = structural edit (select/checkbox that reveals or hides fields, or
          changes the collapsed summary): update state and re-render zones. */
function cmZ(id, path, val){ cmSetZoneNested(id, path, val); }
function cmZR(id, path, val){ cmSetZoneNested(id, path, val); renderCustomZones(); }

function cmCopyBaseline(id){ cmCopyBaselineToProposed(id); renderCustomZones(); }

/* ---- handlers: fixture rows ---- */
function cmFxAdd(id, which){ cmAddFixtureRow(id, which); renderCustomZones(); }
function cmFxDel(id, which, rowId){ cmDeleteFixtureRow(id, which, rowId); renderCustomZones(); }
function cmFxSet(id, which, rowId, field, val){ cmSetFixtureRow(id, which, rowId, field, val); }

/* ---- top-bar handlers ---- */
function cmSetProjectField(field, val){
  cmSetProjectFieldState(field, val);
  if(field === "profileId"){ /* reserved: reflect profile-driven calc mode later */ }
  renderCustomSidebar();
}

/* ---- full results view ---- */
function openFullResults(){ const el = $("cm_fullresults"); if(el) el.style.display = "flex"; }
function closeFullResults(){ const el = $("cm_fullresults"); if(el) el.style.display = "none"; }

/* ---- option/label + value utils ---- */
function cmOptions(list, sel){
  return list.map(o => `<option value="${o.id}" ${o.id === sel ? "selected" : ""}>${o.label}</option>`).join("");
}
function cmSpaceTypeOptions(sel){
  let out = `<option value="" ${!sel ? "selected" : ""}>—</option>`;
  for(const k in SCHEDULES)
    out += `<option value="${k}" ${k === sel ? "selected" : ""}>${SCHEDULES[k].label}</option>`;
  return out;
}
function cmScheduleOptions(sel){
  let out = `<option value="" ${!sel ? "selected" : ""}>— none —</option>`;
  for(const k in SCHEDULES)
    out += `<option value="${k}" ${k === sel ? "selected" : ""}>${SCHEDULES[k].label} (${scheduleHOU(k)} h)</option>`;
  return out;
}
function cmScheduleLabel(key){ return (key && SCHEDULES[key]) ? SCHEDULES[key].label : "none"; }
function cmMethodLabel(id){ const m = CM_METHODS.find(x => x.id === id); return m ? m.label : id; }
function cmSourceLabel(id){ const s = CM_SOURCES.find(x => x.id === id); return s ? s.label : id; }

function cmVal(v){ return (v == null) ? "" : v; }
function cmNum(v){ return (v === "" || v == null) ? null : (+v); }
function cmEsc(s){ return (s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
