/* customModeUI.js — Custom Mode presentation and mode switching. Renders the
   three-region workspace (top project bar, modeling workspace, results sidebar)
   plus the separate full-results view, per
   updates/custom-mode-screen-layout-spec.md.

   Task A scope: shell + mode switch + zone CRUD wired to state. Deep zone
   editing, engine math, and warnings are layered on in later slices. Reuses the
   $() helper and PROFILES global already loaded by ui.js / profiles.js. */

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

/* ---- render ---- */
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

  renderCustomZones();
  renderCustomSidebar();
}

function renderCustomZones(){
  const p = cmEnsureProject();
  const host = $("cm_zonelist");
  if(!host) return;
  host.innerHTML = p.zones.length
    ? p.zones.map(cmZoneRowHTML).join("")
    : `<div class="cm-empty">No zones yet. Add one to begin modeling.</div>`;
}

function cmZoneRowHTML(z){
  return `<div class="cm-zone" data-zone="${z.id}">
    <input class="cm-zone-name" value="${cmEsc(z.name)}"
           oninput="cmOnZoneName('${z.id}', this.value)"
           aria-label="Zone name">
    <span class="cm-zone-sum">${cmZoneSummary(z)}</span>
    <span class="cm-zone-actions">
      <button class="rowbtn" title="Duplicate zone" onclick="cmOnDuplicateZone('${z.id}')">&#10697;</button>
      <button class="rowbtn" title="Delete zone" onclick="cmOnDeleteZone('${z.id}')">&#10005;</button>
    </span>
  </div>`;
}

// Placeholder collapsed summary — full inline results arrive with the engine slice.
function cmZoneSummary(z){
  const b = z.baseline, pr = z.proposed;
  return `Baseline: ${b.source} &middot; ${b.method} &nbsp;&rarr;&nbsp; Proposed: ${pr.sameAsBaseline ? "same as baseline" : pr.method}`;
}

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

/* ---- zone CRUD handlers (mutate state, then re-render) ---- */
function cmAddZoneAndRender(){ cmAddZone(); renderCustomMode(); }
function cmOnDuplicateZone(id){ cmDuplicateZone(id); renderCustomMode(); }
function cmOnDeleteZone(id){ cmDeleteZone(id); renderCustomMode(); }

// Name edits update state without rebuilding the list, to preserve input focus.
function cmOnZoneName(id, val){ cmSetZoneFieldState(id, "name", val); }

/* ---- top-bar handlers ---- */
function cmSetProjectField(field, val){
  cmSetProjectFieldState(field, val);
  if(field === "profileId"){ /* reserved: reflect profile-driven calc mode later */ }
  renderCustomSidebar();
}

/* ---- full results view ---- */
function openFullResults(){
  const el = $("cm_fullresults");
  if(el) el.style.display = "flex";
}
function closeFullResults(){
  const el = $("cm_fullresults");
  if(el) el.style.display = "none";
}

/* ---- utils ---- */
function cmEsc(s){ return (s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
