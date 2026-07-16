/* ui.js — DOM handling, input grid, autocomplete, live results, chart,
   provenance tags, save/load, autosave. Engine stays in engine.js. */

let LINES = [];
let nextId = 1;
const PROV_CYCLE = ["default","override","metered"];

function $(id){ return document.getElementById(id); }
function currentProfile(){ return PROFILES[$("profile").value]; }

function init(){
  const ps = $("profile");
  for(const k in PROFILES){ const o=document.createElement("option"); o.value=k; o.textContent=PROFILES[k].label; ps.appendChild(o); }
  const bs = $("bldg");
  for(const k in SCHEDULES){ const o=document.createElement("option"); o.value=k; o.textContent=SCHEDULES[k].label; bs.appendChild(o); }
  const dl = $("fixlist");
  WATTAGE_TABLES.std_v1.fixtures.forEach(f=>{ const o=document.createElement("option"); o.value=f.code; o.label=f.desc; dl.appendChild(o); });

  let saved=null; try{ saved = localStorage.getItem("lightcalc_autosave"); }catch(e){}
  if(saved){ try{ restore(JSON.parse(saved)); } catch(e){ seed(); } } else seed();
  seedSchedulesIfEmpty();
  onProfileChange(true);
}

function seed(){
  LINES = [
    mkLine({space:"Open office 2F", spaceType:"office", exCode:"3L4FT32-T8", qty:48, prCode:"LED-TROFFER-2X4-32", control:"occ", cost:9600}),
    mkLine({space:"Warehouse high bay", spaceType:"warehouse", exCode:"MH-400", qty:22, prCode:"LED-HB-150", control:"nlc", cost:13200}),
    mkLine({space:"Parking lot", spaceType:"exterior", exCode:"HPS-250", qty:12, prCode:"LED-AREA-110", control:"none", cost:7800})
  ];
}

function mkLine(p){
  const ex = findFixture("std_v1", p.exCode||""), pr = findFixture("std_v1", p.prCode||"");
  const st = p.spaceType || $("bldg").value || "office";
  const qty = p.qty||1;
  return { id:nextId++, space:p.space||"", spaceType:st,
    exCode:p.exCode||"", exW:p.exW ?? (ex?ex.watts:0),
    qty, prCode:p.prCode||"", prW:p.prW ?? (pr?pr.watts:0),
    prQty: p.prQty ?? qty, prQtyProv: p.prQtyProv || "same",
    control:p.control||"none", scheduleId:p.scheduleId||null,
    hou:p.hou ?? scheduleHOU(st), houProv:p.houProv||"default",
    cost:p.cost||0 };
}

function addRow(){ LINES.push(mkLine({})); render(); }
function dupRow(id){ const l=LINES.find(x=>x.id===id); const c={...l}; c.id=nextId++; LINES.splice(LINES.indexOf(l)+1,0,c); render(); }
function delRow(id){ LINES = LINES.filter(x=>x.id!==id); render(); }

function upd(id, field, val){
  const l = LINES.find(x=>x.id===id); if(!l) return;
  if(field==="exCode"||field==="prCode"){
    l[field]=val;
    const f=findFixture(currentProfile().wattageTable,val);
    if(f) l[field==="exCode"?"exW":"prW"]=f.watts;
    render(); return;
  }
  if(field==="spaceType"){
    l.spaceType=val;
    if(l.houProv==="default") l.hou=scheduleHOU(val);
    render(); return;
  }
  if(field==="scheduleId"){
    l.scheduleId = val || null;
    if(l.scheduleId){ l.hou=Math.round(lineImpliedHOU(l)); l.houProv="schedule"; }
    else if(l.houProv==="schedule"){ l.hou=scheduleHOU(l.spaceType); l.houProv="default"; }
    render(); return;
  }
  if(field==="qty"){
    l.qty=+val||0;
    if(l.prQtyProv==="same") l.prQty=l.qty;   // proposed tracks existing unless overridden
    render(); return;
  }
  if(field==="prQty"){ l.prQty=+val||0; l.prQtyProv="override"; render(); return; }
  if(field==="hou"){
    if(l.houProv==="schedule") return;         // schedule-driven; edit the schedule instead
    l.hou=+val||0; if(l.houProv==="default") l.houProv="override"; render(); return;
  }
  if(["exW","prW","cost"].includes(field)) l[field]=+val||0; else l[field]=val;
  recalc();
}

// Toggle proposed-qty provenance: SAME (tracks existing) ⇄ OVERRIDE (manual).
function cyclePrQty(id){
  const l=LINES.find(x=>x.id===id); if(!l) return;
  if(l.prQtyProv==="override"){ l.prQtyProv="same"; l.prQty=l.qty; }
  else { l.prQtyProv="override"; }
  render();
}

function cycleProv(id){
  const l=LINES.find(x=>x.id===id);
  const i=(PROV_CYCLE.indexOf(l.houProv)+1)%3;
  l.houProv=PROV_CYCLE[i];
  if(l.houProv==="default") l.hou=scheduleHOU(l.spaceType);
  render();
}

function render(){
  const tb=$("rows"); tb.innerHTML="";
  const res=calcProject(LINES, currentProfile(), $("ie_toggle").checked);
  LINES.forEach((l,i)=>{
    const lr=res.lines[i];
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td style="color:#8a97a3;font-family:var(--mono)">${i+1}</td>
      <td><input value="${esc(l.space)}" oninput="upd(${l.id},'space',this.value)" style="font-family:var(--sans);min-width:110px"></td>
      <td><select onchange="upd(${l.id},'spaceType',this.value)">${Object.keys(SCHEDULES).map(k=>`<option value="${k}" ${k===l.spaceType?"selected":""}>${SCHEDULES[k].label}</option>`).join("")}</select></td>
      <td><input list="fixlist" value="${esc(l.exCode)}" onchange="upd(${l.id},'exCode',this.value)" style="min-width:120px"></td>
      <td><input type="number" value="${l.exW}" onchange="upd(${l.id},'exW',this.value)" style="width:62px"></td>
      <td><input type="number" value="${l.qty}" onchange="upd(${l.id},'qty',this.value)" style="width:56px"></td>
      <td><input list="fixlist" value="${esc(l.prCode)}" onchange="upd(${l.id},'prCode',this.value)" style="min-width:120px"></td>
      <td><input type="number" value="${l.prW}" onchange="upd(${l.id},'prW',this.value)" style="width:62px"></td>
      <td style="white-space:nowrap"><input type="number" value="${proposedQty(l)}" onchange="upd(${l.id},'prQty',this.value)" style="width:52px" ${l.prQtyProv==="same"?'title="Same as existing (auto)"':''}> <span class="tag ${l.prQtyProv==="override"?"override":"default"}" title="${l.prQtyProv==="override"?"Manual override — click to reset to existing qty":"Same as existing — click to override"}" onclick="cyclePrQty(${l.id})">${l.prQtyProv==="override"?"OVR":"= EX"}</span></td>
      <td><select onchange="upd(${l.id},'control',this.value)">${CONTROL_OPTIONS.map(c=>`<option value="${c.id}" ${c.id===l.control?"selected":""}>${c.label}</option>`).join("")}</select></td>
      <td><select onchange="upd(${l.id},'scheduleId',this.value)" style="min-width:120px" ${currentProfile().mode!=="8760"?"disabled title='8760 mode only'":""}>${scheduleOptionsHTML(l.scheduleId)}</select></td>
      <td style="white-space:nowrap"><input type="number" value="${l.hou}" onchange="upd(${l.id},'hou',this.value)" style="width:66px" ${l.houProv==="schedule"?"disabled title='Set by assigned schedule'":""}> <span class="tag ${l.houProv==="schedule"?"metered":l.houProv}" title="${l.houProv==="schedule"?"Hours from assigned schedule":"Click to cycle provenance"}" ${l.houProv==="schedule"?"":`onclick="cycleProv(${l.id})"`}>${l.houProv==="schedule"?"SCH":l.houProv.toUpperCase().slice(0,3)}</span></td>
      <td><input type="number" value="${l.cost}" onchange="upd(${l.id},'cost',this.value)" style="width:78px"></td>
      <td class="rowsave">${fmt(lr?lr.kwh:0,0)}</td>
      <td><button class="rowbtn" title="Duplicate line" onclick="dupRow(${l.id})">⧉</button><button class="rowbtn" title="Delete line" onclick="delRow(${l.id})">✕</button></td>`;
    tb.appendChild(tr);
  });
  recalc(res);
}

function recalc(pre){
  const p=currentProfile();
  const res=pre||calcProject(LINES,p,$("ie_toggle").checked);
  $("k_kwh").textContent=fmt(res.kwh,0);
  $("k_kw").textContent=fmt(res.kw,1);
  $("k_inc").textContent="$"+fmt(res.incentive,0);
  const rate=+$("rate").value||0;
  const annualSavings=res.kwh*rate;
  const net=res.cost-res.incentive;
  $("k_pb").textContent=(annualSavings>0&&res.cost>0)?(net/annualSavings).toFixed(1):"—";
  // update per-row kWh cells without full re-render
  const cells=document.querySelectorAll("td.rowsave");
  res.lines.forEach((l,i)=>{ if(cells[i]) cells[i].textContent=fmt(l.kwh,0); });

  const flags=sanityChecks(LINES,res);
  $("flags").innerHTML=flags.map(f=>`<div class="flag-item ${f.level}">${f.msg}</div>`).join("");
  drawShape(res,p);
  $("stamp").textContent=`profile ${p.id} v${p.version} · schema ${p.schemaVersion} · mode ${p.mode} · engine v0.1 · ${new Date().toISOString().slice(0,10)}`;
  try{ localStorage.setItem("lightcalc_autosave", JSON.stringify(snapshot())); }catch(e){}
}

function drawShape(res,p){
  const cv=$("shape"), ctx=cv.getContext("2d");
  ctx.clearRect(0,0,cv.width,cv.height);
  let ex=new Array(24).fill(0), pr=new Array(24).fill(0);
  if(p.mode==="8760"&&res.hourlyEx){
    let n=0;
    for(let d=0;d<365;d++){ const dow=(4+d)%7; if(dow===0||dow===6)continue; n++;
      for(let h=0;h<24;h++){ ex[h]+=res.hourlyEx[d*24+h]; pr[h]+=res.hourlyPr[d*24+h]; } }
    ex=ex.map(v=>v/n); pr=pr.map(v=>v/n);
    $("shapenote").textContent="Average weekday load shape (project total kW). Full 8760 included in Excel export.";
  } else {
    // annual mode: show connected kW as flat bars over default office shape for context
    for(const l of LINES){ const s=SCHEDULES[l.spaceType];
      for(let h=0;h<24;h++){ ex[h]+=l.exW*l.qty/1000*s.wd[h]; pr[h]+=l.prW*l.qty/1000*s.wd[h]*(1-(p.controlsFactors[l.control]||0)); } }
    $("shapenote").textContent="Illustrative weekday shape from schedule library. Annual mode — savings use flat HOU × CF math.";
  }
  const max=Math.max(...ex,...pr,0.001), W=cv.width,H=cv.height,pad=8;
  const X=h=>pad+h*(W-2*pad)/23, Y=v=>H-pad-(v/max)*(H-2*pad);
  const line=(arr,color,fill)=>{ ctx.beginPath(); arr.forEach((v,h)=>h?ctx.lineTo(X(h),Y(v)):ctx.moveTo(X(h),Y(v)));
    ctx.strokeStyle=color; ctx.lineWidth=2.5; ctx.stroke();
    if(fill){ ctx.lineTo(X(23),Y(0)); ctx.lineTo(X(0),Y(0)); ctx.closePath(); ctx.fillStyle=fill; ctx.fill(); } };
  line(ex,"#8a97a3","rgba(138,151,163,.15)");
  line(pr,"#1c7c4a","rgba(28,124,74,.15)");
}

/* ---- profile / building handlers ---- */
function onProfileChange(first){
  const p=currentProfile();
  $("ie_toggle").checked=p.interactiveEffects.defaultOn;
  $("modechip").textContent="MODE: "+p.mode.toUpperCase();
  updateScheduleVisibility();
  renderScheduleBuilder();
  render();
}
function onBldgChange(){ /* building type informs new-line defaults only in prototype */ recalc(); }

/* ---- save / load ---- */
function snapshot(){
  return { app:"lighting-calc", schemaVersion:1, saved:new Date().toISOString(),
    projname:$("projname").value, profile:$("profile").value, bldg:$("bldg").value,
    rate:+$("rate").value, ieOn:$("ie_toggle").checked,
    schedules:SCHEDULES_USER, lines:LINES };
}
function restore(s){
  $("projname").value=s.projname||""; $("profile").value=s.profile||Object.keys(PROFILES)[0];
  $("bldg").value=s.bldg||"office"; $("rate").value=s.rate??0.10; $("ie_toggle").checked=!!s.ieOn;
  SCHEDULES_USER = Array.isArray(s.schedules) ? s.schedules : [];
  // keep the id counter ahead of any restored schedule ids
  SCHEDULES_USER.forEach(sc=>{ const n=parseInt(String(sc.id).replace(/\D/g,""),10); if(n>=SCHED_SEQ) SCHED_SEQ=n+1; });
  LINES=(s.lines||[]).map(l=>({...l,id:nextId++}));
  $("modechip").textContent="MODE: "+currentProfile().mode.toUpperCase();
}
function saveProject(){
  const blob=new Blob([JSON.stringify(snapshot(),null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download=($("projname").value||"project").replace(/\W+/g,"_")+".json"; a.click();
}
function loadProject(ev){
  const f=ev.target.files[0]; if(!f)return;
  const r=new FileReader();
  r.onload=()=>{ try{ restore(JSON.parse(r.result)); seedSchedulesIfEmpty(); updateScheduleVisibility(); renderScheduleBuilder(); render(); }catch(e){ alert("Could not read project file: "+e.message); } };
  r.readAsText(f); ev.target.value="";
}

/* ---- QPL stub (scaffolded, not wired) ---- */
async function qplLookup(dlcId){
  // TODO: wire to DLC QPL API or bundled QPL snapshot when credentials/data provided.
  // Expected return: { productId, wattage, lumens, dlcListed:true, category }
  throw new Error("QPL lookup not configured");
}

function fmt(v,d){ return (v||0).toLocaleString("en-US",{maximumFractionDigits:d,minimumFractionDigits:0}); }
function esc(s){ return (s||"").replace(/"/g,"&quot;"); }

window.addEventListener("DOMContentLoaded", init);
