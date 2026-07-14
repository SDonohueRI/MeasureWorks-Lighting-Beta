/* settings.js — schema-driven client profile editor.
   PROFILE_SCHEMA is the formal contract for what a program profile contains.
   The editor renders from the schema, so new parameters (e.g. future LPD
   tables, NTG, EUL/RUL) appear automatically once described here.
   Governance: profiles are read-only until edited; saving requires a change
   note and bumps the version; edited profiles are exported as JSON for repo
   commit. localStorage holds only an unsaved-draft recovery copy. */

const PROFILE_SCHEMA = [
  { group:"Calculation mode", fields:[
    { path:"mode", label:"Output mode", type:"select", options:["annual","8760"],
      help:"8760 = hourly engine with schedule-based shapes and peak-window demand (Xcel-style). Annual = flat HOU × factors with coincidence factors." }
  ]},
  { group:"Peak demand definition (8760 mode)", showIf:p=>p.mode==="8760", fields:[
    { path:"peakWindow.months", label:"Peak months (1–12)", type:"intlist", min:1, max:12,
      help:"Months included in the peak window, comma-separated (e.g. 6,7,8 for Jun–Aug)." },
    { path:"peakWindow.hourStart", label:"Window start hour (0–23)", type:"number", min:0, max:23 },
    { path:"peakWindow.hourEnd", label:"Window end hour (1–24)", type:"number", min:1, max:24 },
    { path:"peakWindow.weekdaysOnly", label:"Weekdays only", type:"bool" }
  ]},
  { group:"Coincidence factors (annual mode)", showIf:p=>p.mode==="annual", fields:[
    { path:"coincidenceFactor.office",    label:"Office CF",     type:"number", min:0, max:1 },
    { path:"coincidenceFactor.warehouse", label:"Warehouse CF",  type:"number", min:0, max:1 },
    { path:"coincidenceFactor.retail",    label:"Retail CF",     type:"number", min:0, max:1 },
    { path:"coincidenceFactor.cont24",    label:"24/7 CF",       type:"number", min:0, max:1 },
    { path:"coincidenceFactor.exterior",  label:"Exterior CF",   type:"number", min:0, max:1 },
    { path:"coincidenceFactor.school",    label:"School CF",     type:"number", min:0, max:1 },
    { path:"coincidenceFactor.source",    label:"CF source citation", type:"text", sourceReq:true }
  ]},
  { group:"Interactive effects", fields:[
    { path:"interactiveEffects.variesBySpaceType", label:"Varies by space type", type:"bool",
      help:"On: each space type uses its own kWh/kW factors below; unlisted types use the flat factors. Off: the flat factors apply to every line." },
    { path:"interactiveEffects.kwhFactor", label:"kWh factor (flat / fallback)", type:"number", min:0.8, max:1.5,
      help:"Multiplier on energy savings for HVAC interaction. 1.0 = no effect. Used for all lines when 'varies' is off, and as the fallback for unlisted space types when it is on." },
    { path:"interactiveEffects.kwFactor", label:"kW factor (flat / fallback)", type:"number", min:0.8, max:1.5 },
    { path:"interactiveEffects.defaultOn", label:"Apply by default", type:"bool",
      help:"Sets the calculator's IE toggle default when this profile is selected. Users can still toggle per project." },
    { path:"interactiveEffects.source", label:"IE source citation", type:"text", sourceReq:true }
  ]},
  { group:"Interactive effects by space type", showIf:p=>p.interactiveEffects && p.interactiveEffects.variesBySpaceType, fields:[
    { path:"interactiveEffects.byType.office.kwh",    label:"Office — kWh", type:"number", min:0.8, max:1.5 },
    { path:"interactiveEffects.byType.office.kw",     label:"Office — kW",  type:"number", min:0.8, max:1.5 },
    { path:"interactiveEffects.byType.warehouse.kwh", label:"Warehouse — kWh", type:"number", min:0.8, max:1.5 },
    { path:"interactiveEffects.byType.warehouse.kw",  label:"Warehouse — kW",  type:"number", min:0.8, max:1.5 },
    { path:"interactiveEffects.byType.retail.kwh",    label:"Retail — kWh", type:"number", min:0.8, max:1.5 },
    { path:"interactiveEffects.byType.retail.kw",     label:"Retail — kW",  type:"number", min:0.8, max:1.5 },
    { path:"interactiveEffects.byType.cont24.kwh",    label:"24/7 — kWh", type:"number", min:0.8, max:1.5 },
    { path:"interactiveEffects.byType.cont24.kw",     label:"24/7 — kW",  type:"number", min:0.8, max:1.5 },
    { path:"interactiveEffects.byType.exterior.kwh",  label:"Exterior — kWh", type:"number", min:0.8, max:1.5 },
    { path:"interactiveEffects.byType.exterior.kw",   label:"Exterior — kW",  type:"number", min:0.8, max:1.5 },
    { path:"interactiveEffects.byType.school.kwh",    label:"School — kWh", type:"number", min:0.8, max:1.5 },
    { path:"interactiveEffects.byType.school.kw",     label:"School — kW",  type:"number", min:0.8, max:1.5 }
  ]},
  { group:"Controls savings factors", fields:[
    { path:"controlsFactors.occ",      label:"Occupancy sensor SF", type:"number", min:0, max:0.9 },
    { path:"controlsFactors.daylight", label:"Daylighting SF",      type:"number", min:0, max:0.9 },
    { path:"controlsFactors.nlc",      label:"Networked (NLC) SF",  type:"number", min:0, max:0.9 },
    { path:"controlsFactors.source",   label:"Controls source citation", type:"text", sourceReq:true }
  ]},
  { group:"Incentive rules", fields:[
    { path:"incentive.type", label:"Basis", type:"select", options:["perKWh","perKW"] },
    { path:"incentive.rate", label:"Rate ($/unit)", type:"number", min:0, max:5 },
    { path:"incentive.capPctOfCost", label:"Cap (fraction of cost)", type:"number", min:0, max:1,
      help:"e.g. 0.5 caps incentive at 50% of project cost. Set 1 for no practical cap." },
    { path:"incentive.label", label:"Offer description", type:"text" },
    { path:"incentive.source", label:"Incentive source citation", type:"text", sourceReq:true }
  ]},
  { group:"Measure life & documentation", fields:[
    { path:"measureLifeYrs", label:"Measure life (yrs)", type:"number", min:1, max:30 },
    { path:"houSource", label:"Hours-of-use basis note", type:"text", sourceReq:true }
  ]}
];

let SHIPPED_PROFILES = null;   // deep copy taken at load for revert
let EDIT = null;               // working copy being edited

function deepClone(o){ return JSON.parse(JSON.stringify(o)); }
function getPath(o,p){ return p.split(".").reduce((a,k)=>a&&a[k],o); }
function setPath(o,p,v){ const ks=p.split("."); let t=o; for(let i=0;i<ks.length-1;i++){ if(t[ks[i]]==null) t[ks[i]]={}; t=t[ks[i]]; } t[ks[ks.length-1]]=v; }

function openSettings(){
  if(!SHIPPED_PROFILES) SHIPPED_PROFILES = deepClone(PROFILES);
  EDIT = deepClone(currentProfile());
  const draft = safeGet("lightcalc_profile_draft_"+EDIT.id);
  if(draft){
    if(confirm("An unsaved profile draft was found for "+EDIT.label+". Recover it?")) EDIT = JSON.parse(draft);
    else safeDel("lightcalc_profile_draft_"+EDIT.id);
  }
  renderSettings();
  document.getElementById("settingsmodal").style.display="flex";
}
function closeSettings(){ document.getElementById("settingsmodal").style.display="none"; EDIT=null; }

function renderSettings(){
  const el=document.getElementById("settingsbody");
  let h=`<div class="sethead">
    <div><b>${esc(EDIT.label)}</b><div class="note">id <code>${EDIT.id}</code> · version <code>${EDIT.version}</code> · schema ${EDIT.schemaVersion}</div></div>
    <div class="setflags" id="setflags"></div></div>`;

  for(const g of PROFILE_SCHEMA){
    if(g.showIf && !g.showIf(EDIT)) continue;
    h+=`<h3>${g.group}</h3><div class="setgrid">`;
    for(const f of g.fields){
      const v=getPath(EDIT,f.path);
      const tip=f.help?`<span class="info" data-tip="${esc(f.help)}">i</span>`:"";
      if(f.type==="bool"){
        h+=`<label class="field setrow"><b>${f.label} ${tip}</b><input type="checkbox" ${v?"checked":""} onchange="setEdit('${f.path}',this.checked,'bool')" style="width:auto"></label>`;
      } else if(f.type==="select"){
        h+=`<label class="field setrow"><b>${f.label} ${tip}</b><select onchange="setEdit('${f.path}',this.value,'select')">${f.options.map(o=>`<option ${o===v?"selected":""}>${o}</option>`).join("")}</select></label>`;
      } else if(f.type==="intlist"){
        h+=`<label class="field setrow"><b>${f.label} ${tip}</b><input value="${(v||[]).join(",")}" onchange="setEdit('${f.path}',this.value,'intlist')"></label>`;
      } else {
        const cls=(f.sourceReq && !(v&&String(v).trim()))?"missing":"";
        h+=`<label class="field setrow"><b>${f.label} ${tip}</b><input class="${cls}" type="${f.type==="number"?"number":"text"}" ${f.type==="number"?'step="any"':""} value="${v??""}" onchange="setEdit('${f.path}',this.value,'${f.type}')"></label>`;
      }
    }
    h+=`</div>`;
  }

  // wattage table editor
  const wt=WATTAGE_TABLES[EDIT.wattageTable];
  h+=`<h3>Wattage table <span class="hint" style="font-weight:400;text-transform:none">— ${esc(wt.label)} · shared across profiles that reference it · paste rows from Excel (code, description, watts)</span></h3>
  <div id="wtzone" contenteditable="true" spellcheck="false" class="pastebox" onpaste="onWattagePaste(event)" oninput="this.textContent='Click here, then paste (Ctrl+V) — columns: code, description, watts'">Click here, then paste (Ctrl+V) — columns: code, description, watts</div>
  <table class="lines" style="margin-top:8px"><thead><tr><th>Code</th><th>Description</th><th>Watts</th><th style="width:36px"></th></tr></thead><tbody>`;
  wt.fixtures.forEach((f,i)=>{
    h+=`<tr><td><input value="${esc(f.code)}" onchange="updWatt(${i},'code',this.value)"></td>
      <td><input value="${esc(f.desc)}" onchange="updWatt(${i},'desc',this.value)" style="font-family:var(--sans)"></td>
      <td><input type="number" value="${f.watts}" onchange="updWatt(${i},'watts',this.value)" style="width:70px"></td>
      <td><button class="rowbtn" onclick="delWatt(${i})">✕</button></td></tr>`;
  });
  h+=`</tbody></table><div class="addrow"><button onclick="addWatt()">+ Add fixture</button></div>`;

  // save bar
  h+=`<h3>Save changes</h3>
  <div class="setgrid">
    <label class="field" style="grid-column:1/-1"><b>Change note (required to save)</b><input id="changenote" placeholder="e.g. Updated NLC factor to MN TRM v4.1 Table 3.2"></label>
  </div>
  <div class="setactions">
    <button class="importbtn" onclick="saveProfileEdits()">Apply &amp; bump version</button>
    <button class="importbtn ghost" onclick="exportProfileJson()">Export profile JSON</button>
    <button class="importbtn ghost" onclick="document.getElementById('profimport').click()">Import profile JSON</button>
    <input type="file" id="profimport" accept=".json" style="display:none" onchange="importProfileJson(event)">
    <button class="importbtn ghost" onclick="revertProfile()">Revert to shipped</button>
    <button class="importbtn ghost" onclick="closeSettings()">Close</button>
  </div>
  <div class="note">Applied edits live in this browser session and are stamped on all outputs. To distribute to the team, export the JSON and commit it to <code>js/profiles/</code>. Unsaved edits are kept as a local draft for recovery only.</div>`;
  el.innerHTML=h;
  validateProfile();
}

function setEdit(path,val,type){
  if(type==="number") val=parseFloat(val);
  if(type==="intlist") val=String(val).split(",").map(s=>parseInt(s.trim())).filter(n=>!isNaN(n));
  setPath(EDIT,path,val);
  safeSet("lightcalc_profile_draft_"+EDIT.id, JSON.stringify(EDIT));
  if(path==="mode"||path==="interactiveEffects.variesBySpaceType") renderSettings(); else validateProfile();
}

function validateProfile(){
  const flags=[];
  for(const g of PROFILE_SCHEMA){
    if(g.showIf && !g.showIf(EDIT)) continue;
    for(const f of g.fields){
      const v=getPath(EDIT,f.path);
      if(f.type==="number" && v!=null && (v<f.min || v>f.max))
        flags.push(`${f.label}: ${v} outside expected range ${f.min}–${f.max}`);
      if(f.sourceReq && !(v&&String(v).trim()))
        flags.push(`${f.label}: source citation missing`);
      if(f.type==="intlist" && (v||[]).some(n=>n<f.min||n>f.max))
        flags.push(`${f.label}: values must be ${f.min}–${f.max}`);
    }
  }
  if(EDIT.mode==="8760" && EDIT.peakWindow && EDIT.peakWindow.hourEnd<=EDIT.peakWindow.hourStart)
    flags.push("Peak window: end hour must be after start hour");
  const el=document.getElementById("setflags");
  if(el) el.innerHTML=flags.length
    ? flags.map(f=>`<div class="flag-item">${f}</div>`).join("")
    : `<div class="flag-item ok">Profile valid. All ranges OK, citations present.</div>`;
  return flags;
}

function saveProfileEdits(){
  const note=document.getElementById("changenote").value.trim();
  if(!note){ alert("A change note is required — it becomes part of the profile's change log."); return; }
  const warn=validateProfile();
  if(warn.length && !confirm("Profile has "+warn.length+" validation warning(s). Apply anyway?")) return;
  // bump version: 2026.1 -> 2026.1-e1 -> 2026.1-e2 ...
  const m=EDIT.version.match(/^(.*?)(?:-e(\d+))?$/);
  EDIT.version=m[1]+"-e"+((parseInt(m[2])||0)+1);
  EDIT.changeLog=EDIT.changeLog||[];
  EDIT.changeLog.push({date:new Date().toISOString(), note});
  PROFILES[EDIT.id]=deepClone(EDIT);
  safeDel("lightcalc_profile_draft_"+EDIT.id);
  closeSettings();
  onProfileChange();
}

function revertProfile(){
  if(!confirm("Discard all edits and restore the shipped "+EDIT.label+" profile?")) return;
  PROFILES[EDIT.id]=deepClone(SHIPPED_PROFILES[EDIT.id]);
  EDIT=deepClone(SHIPPED_PROFILES[EDIT.id]);
  safeDel("lightcalc_profile_draft_"+EDIT.id);
  renderSettings(); onProfileChange();
}

function exportProfileJson(){
  const blob=new Blob([JSON.stringify(EDIT,null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download="profile_"+EDIT.id+"_"+EDIT.version.replace(/\W+/g,"_")+".json"; a.click();
}
function importProfileJson(ev){
  const f=ev.target.files[0]; if(!f)return;
  const r=new FileReader();
  r.onload=()=>{ try{
      const p=JSON.parse(r.result);
      if(!p.id || !p.schemaVersion) throw new Error("not a profile file (missing id/schemaVersion)");
      if(p.schemaVersion!==1) throw new Error("schema version "+p.schemaVersion+" not supported by this build");
      PROFILES[p.id]=p; EDIT=deepClone(p);
      // refresh selector if new profile id
      const ps=document.getElementById("profile");
      if(![...ps.options].some(o=>o.value===p.id)){ const o=document.createElement("option"); o.value=p.id; o.textContent=p.label; ps.appendChild(o); }
      ps.value=p.id;
      renderSettings(); onProfileChange();
    }catch(e){ alert("Could not import profile: "+e.message); } };
  r.readAsText(f); ev.target.value="";
}

/* wattage table edits (shared table object) */
function updWatt(i,field,val){ const t=WATTAGE_TABLES[EDIT.wattageTable].fixtures[i];
  t[field]=field==="watts"?(parseFloat(val)||0):val; refreshFixList(); }
function addWatt(){ WATTAGE_TABLES[EDIT.wattageTable].fixtures.push({code:"NEW",desc:"",watts:0}); renderSettings(); }
function delWatt(i){ WATTAGE_TABLES[EDIT.wattageTable].fixtures.splice(i,1); renderSettings(); refreshFixList(); }
function onWattagePaste(ev){
  const text=(ev.clipboardData||window.clipboardData).getData("text"); ev.preventDefault();
  const rows=parseClipboardTable(text);
  let added=0;
  for(const r of rows){
    if(r.length<3) continue;
    const w=parseFloat(r[2]); if(isNaN(w)) continue; // skips header rows automatically
    WATTAGE_TABLES[EDIT.wattageTable].fixtures.push({code:r[0].trim().toUpperCase(),desc:r[1].trim(),watts:w});
    added++;
  }
  renderSettings(); refreshFixList();
  if(!added) alert("No rows imported — expected 3 columns: code, description, watts.");
}
function refreshFixList(){
  const dl=document.getElementById("fixlist"); dl.innerHTML="";
  WATTAGE_TABLES.std_v1.fixtures.forEach(f=>{ const o=document.createElement("option"); o.value=f.code; o.label=f.desc; dl.appendChild(o); });
  render();
}

function safeGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function safeSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
function safeDel(k){ try{ localStorage.removeItem(k); }catch(e){} }
