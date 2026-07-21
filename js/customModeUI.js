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
  cmRefreshResults();
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
  cmRefreshResults();                               // rate/schedule/IE affect results
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
      <span class="cm-zone-kwh" id="cm-zkwh-${z.id}"></span>
      <span class="cm-zone-warn" id="cm-zwarn-${z.id}"></span>
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
  return `<div class="cm-zone-warns" id="cm-zwarns-${z.id}"></div>`
       + `<div class="cm-ed-pair">`
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
       + `<div class="cm-zone-results" id="cm-zres-${z.id}"></div>`;
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

  // Count "warn"-level review flags (info items are assumptions, not flags).
  const countWarn = list => (list || []).reduce((n, w) => n + (w.level === "warn" ? 1 : 0), 0);
  const warns = p.zones.reduce((n, z) => n + countWarn(z.warnings), 0) + countWarn(p.warnings);
  const wc = $("cm_warncount");
  if(wc) wc.textContent = warns;
  const status = $("cm_status");
  if(status){
    status.textContent = warns + (warns === 1 ? " warning" : " warnings");
    status.classList.toggle("clear", warns === 0);
  }
}

/* ---- handlers: zone CRUD ---- */
function cmAddZoneAndRender(){ const z = cmAddZone(); CM_EXPANDED.add(z.id); renderCustomMode(); }
function cmOnDuplicateZone(id){ const c = cmDuplicateZone(id); if(c) CM_EXPANDED.add(c.id); renderCustomMode(); }
function cmOnDeleteZone(id){ CM_EXPANDED.delete(id); cmDeleteZone(id); renderCustomMode(); }
function cmToggleZone(id){ if(CM_EXPANDED.has(id)) CM_EXPANDED.delete(id); else CM_EXPANDED.add(id); renderCustomZones(); cmRefreshResults(); }

// Name edits update state without rebuilding the list, to preserve input focus.
function cmOnZoneName(id, val){ cmSetZoneFieldState(id, "name", val); }

/* ---- handlers: zone fields ----
   cmZ  = non-structural edit (text/number): update state + recompute results,
          without rebuilding inputs (keeps focus while typing).
   cmZR = structural edit (select/checkbox that reveals/hides fields or changes
          the collapsed summary): update state, re-render zones, recompute. */
function cmZ(id, path, val){ cmSetZoneNested(id, path, val); cmRefreshResults(); }
function cmZR(id, path, val){ cmSetZoneNested(id, path, val); renderCustomZones(); cmRefreshResults(); }

function cmCopyBaseline(id){ cmCopyBaselineToProposed(id); renderCustomZones(); cmRefreshResults(); }

/* ---- handlers: fixture rows ---- */
function cmFxAdd(id, which){ cmAddFixtureRow(id, which); renderCustomZones(); cmRefreshResults(); }
function cmFxDel(id, which, rowId){ cmDeleteFixtureRow(id, which, rowId); renderCustomZones(); cmRefreshResults(); }
function cmFxSet(id, which, rowId, field, val){ cmSetFixtureRow(id, which, rowId, field, val); cmRefreshResults(); }

/* ---- top-bar handlers ---- */
function cmSetProjectField(field, val){
  cmSetProjectFieldState(field, val);
  if(field === "profileId"){ /* profile change re-bases every zone's math */ }
  renderCustomSidebar();
  cmRefreshResults();
}

/* ---- results: live sidebar, inline zone lines, full-results view ---- */
function cmProfile(){
  const p = cmEnsureProject();
  return (typeof PROFILES === "object" && PROFILES[p.profileId]) ? PROFILES[p.profileId] : null;
}

// Recompute and paint results. Updates text/HTML only (never input values), so
// it is safe to call on every keystroke without disturbing focus.
function cmRefreshResults(){
  const p = cmEnsureProject();
  const prof = cmProfile();
  if(!prof || typeof cmCalcProject !== "function") return;
  const R = cmCalcProject(p, prof);
  const t = R.totals;

  cmText("cm_k_kw",     cmFmtNum(t.kwSavings, 1));
  cmText("cm_k_kwh",    cmFmtNum(t.kwhSavings, 0));
  cmText("cm_k_cost",   t.hasCost   ? cmFmtMoney(t.costSavings) : "—");
  cmText("cm_k_rebate", t.hasRebate ? cmFmtMoney(t.rebate)      : "—");
  cmText("cm_k_pb",     cmFmtYrs(t.payback));

  R.zones.forEach((zr, i) => {
    const z = p.zones[i];
    // store warnings on state so the sidebar count and full results can read them
    z.warnings = (typeof cmZoneWarnings === "function") ? cmZoneWarnings(z, p, prof, zr.results) : [];

    const badge = $("cm-zkwh-" + z.id);
    if(badge) badge.textContent = (zr.results.kwhSavings > 0 ? cmFmtNum(zr.results.kwhSavings, 0) + " kWh" : "");
    const line = $("cm-zres-" + z.id);
    if(line) line.innerHTML = cmZoneResultsHTML(zr.results);
    const warnInd = $("cm-zwarn-" + z.id);
    if(warnInd){
      const n = z.warnings.filter(w => w.level === "warn").length;
      warnInd.textContent = n ? "⚠ " + n : "";
    }
    const warnBlock = $("cm-zwarns-" + z.id);
    if(warnBlock) warnBlock.innerHTML = cmWarnsHTML(z.warnings);
  });
  p.warnings = (typeof cmProjectWarnings === "function") ? cmProjectWarnings(p, prof, t) : [];

  renderCustomSidebar();  // refresh warning/zone counts now that warnings exist

  const fr = $("cm_fullresults");
  if(fr && fr.style.display !== "none") cmRenderFullResults(R);
}

function cmWarnsHTML(list){
  if(!list || !list.length) return "";
  return list.map(w =>
    `<div class="cm-warn lvl-${w.level}">${w.level === "warn" ? "⚠" : "ℹ"} ${cmEsc(w.msg)}</div>`
  ).join("");
}

function cmZoneResultsHTML(r){
  const parts = [
    `Baseline <b>${cmFmtNum(r.baselineKw, 2)}</b> kW`,
    `Proposed <b>${cmFmtNum(r.proposedKw, 2)}</b> kW`,
    `Save <b>${cmFmtNum(r.kwSavings, 2)}</b> kW`,
    `<b>${cmFmtNum(r.kwhSavings, 0)}</b> kWh/yr`
  ];
  if(r.costSavings != null) parts.push(`<b>${cmFmtMoney(r.costSavings)}</b>/yr`);
  if(r.rebate != null)      parts.push(`rebate <b>${cmFmtMoney(r.rebate)}</b>`);
  if(r.payback != null)     parts.push(`payback <b>${cmFmtYrs(r.payback)}</b> yr`);
  return parts.join(" &nbsp;·&nbsp; ");
}

/* ---- full results view ---- */
function openFullResults(){
  cmRenderFullResults();
  const el = $("cm_fullresults");
  if(el) el.style.display = "flex";
}
function closeFullResults(){ const el = $("cm_fullresults"); if(el) el.style.display = "none"; }

function cmRenderFullResults(R){
  const host = $("cm_fullresults_body");
  if(!host) return;
  const p = cmEnsureProject();
  const prof = cmProfile();
  if(!R) R = prof ? cmCalcProject(p, prof) : null;
  if(!R){ host.innerHTML = `<div class="cm-placeholder">Select a program profile to compute results.</div>`; return; }
  const t = R.totals;

  const tile = (label, val) => `<div class="cm-fr-tile"><div class="v">${val}</div><div class="l">${label}</div></div>`;
  const totals = `<div class="cm-fr-tiles">
      ${tile("kW saved", cmFmtNum(t.kwSavings, 1))}
      ${tile("kWh / yr", cmFmtNum(t.kwhSavings, 0))}
      ${tile("Cost savings / yr", t.hasCost ? cmFmtMoney(t.costSavings) : "—")}
      ${tile("Rebate", t.hasRebate ? cmFmtMoney(t.rebate) : "—")}
      ${tile("Payback, yrs", cmFmtYrs(t.payback))}
      ${tile("Zones", R.zones.length)}
    </div>`;

  const rows = R.zones.map((zr, i) => {
    const r = zr.results, z = p.zones[i];
    return `<tr>
      <td>${cmEsc(z.name)}</td>
      <td>${cmSourceLabel(z.baseline.source)} · ${cmMethodLabel(z.baseline.method)} → ${z.proposed.sameAsBaseline ? "same" : cmMethodLabel(z.proposed.method)}</td>
      <td>${cmControlsSummary(z) || "—"}</td>
      <td class="num">${cmFmtNum(r.baselineKw, 2)}</td>
      <td class="num">${cmFmtNum(r.proposedKw, 2)}</td>
      <td class="num">${cmFmtNum(r.kwSavings, 2)}</td>
      <td class="num">${cmFmtNum(r.baselineKwh, 0)}</td>
      <td class="num">${cmFmtNum(r.proposedKwh, 0)}</td>
      <td class="num">${cmFmtNum(r.kwhSavings, 0)}</td>
      <td class="num">${r.costSavings != null ? cmFmtMoney(r.costSavings) : "—"}</td>
      <td class="num">${r.rebate != null ? cmFmtMoney(r.rebate) : "—"}</td>
      <td class="num">${cmFmtYrs(r.payback)}</td>
    </tr>`;
  }).join("");

  const foot = `<tr class="cm-fr-total">
      <td>Project total</td><td></td><td></td>
      <td class="num">${cmFmtNum(t.baselineKw, 2)}</td>
      <td class="num">${cmFmtNum(t.proposedKw, 2)}</td>
      <td class="num">${cmFmtNum(t.kwSavings, 2)}</td>
      <td class="num">${cmFmtNum(t.baselineKwh, 0)}</td>
      <td class="num">${cmFmtNum(t.proposedKwh, 0)}</td>
      <td class="num">${cmFmtNum(t.kwhSavings, 0)}</td>
      <td class="num">${t.hasCost ? cmFmtMoney(t.costSavings) : "—"}</td>
      <td class="num">${t.hasRebate ? cmFmtMoney(t.rebate) : "—"}</td>
      <td class="num">${cmFmtYrs(t.payback)}</td>
    </tr>`;

  const table = `<table class="cm-fr">
      <thead><tr>
        <th>Zone</th><th>Baseline → Proposed</th><th>Controls</th>
        <th class="num">Base kW</th><th class="num">Prop kW</th><th class="num">kW saved</th>
        <th class="num">Base kWh</th><th class="num">Prop kWh</th><th class="num">kWh saved</th>
        <th class="num">Cost/yr</th><th class="num">Rebate</th><th class="num">Payback</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>${foot}</tfoot>
    </table>`;

  const meta = `<div class="cm-fr-meta">Profile: ${cmEsc(prof.label)} v${prof.version} · mode ${p.calcMode} · engine v0.1${p.defaults.interactiveEffectsEnabled ? " · interactive effects on" : ""}</div>`;

  // Warnings & assumptions, gathered per zone plus project-level.
  const all = [];
  R.zones.forEach((zr, i) => {
    const z = p.zones[i];
    const ws = (typeof cmZoneWarnings === "function") ? cmZoneWarnings(z, p, prof, zr.results) : [];
    ws.forEach(w => all.push({ zone: z.name, level: w.level, msg: w.msg }));
  });
  ((typeof cmProjectWarnings === "function") ? cmProjectWarnings(p, prof, t) : [])
    .forEach(w => all.push({ zone: null, level: w.level, msg: w.msg }));

  const warns = `<div class="cm-fr-warns">
      <h3>Warnings &amp; assumptions</h3>
      ${all.length
        ? all.map(w => `<div class="cm-warn lvl-${w.level}">${w.level === "warn" ? "⚠" : "ℹ"} ${w.zone ? `<b>${cmEsc(w.zone)}:</b> ` : ""}${cmEsc(w.msg)}</div>`).join("")
        : `<div class="cm-warn lvl-info">ℹ No warnings — all inputs within expected ranges.</div>`}
    </div>`;

  host.innerHTML = totals + table + warns + meta;
}

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

// Set an element's text by id, if present.
function cmText(id, txt){ const e = $(id); if(e) e.textContent = txt; }

// Result formatters: em dash for null/non-finite so blanks read as "no basis".
function cmFmtNum(v, dec){
  return (v == null || !isFinite(v)) ? "—"
       : Number(v).toLocaleString("en-US", { maximumFractionDigits: dec, minimumFractionDigits: 0 });
}
function cmFmtMoney(v){ return (v == null || !isFinite(v)) ? "—" : "$" + cmFmtNum(v, 0); }
function cmFmtYrs(v){ return (v == null || !isFinite(v)) ? "—" : Number(v).toFixed(1); }
