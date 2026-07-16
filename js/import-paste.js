/* import-paste.js — paste spreadsheet data (Excel/Sheets clipboard = TSV)
   into the line-item grid. Flow: paste → parse → auto-map columns by header
   synonyms → preview with editable mapping → import.
   CSV fallback supported for .csv text pastes. */

const IMPORT_FIELDS = [
  { id:"skip",      label:"— skip —" },
  { id:"space",     label:"Space / location", syn:["space","location","room","area","description","loc"] },
  { id:"spaceType", label:"Space type",       syn:["space type","spacetype","type","usage","schedule"] },
  { id:"exCode",    label:"Existing fixture", syn:["existing fixture","existing","ex fixture","baseline","existing code","fixture code existing","existing type"] },
  { id:"exW",       label:"Existing watts",   syn:["existing watts","ex w","ex watts","baseline watts","existing wattage","watts existing"] },
  { id:"qty",       label:"Quantity",         syn:["qty","quantity","count","fixtures","# fixtures","number","existing qty","ex qty"] },
  { id:"prCode",    label:"Proposed fixture", syn:["proposed fixture","proposed","new fixture","retrofit","proposed code","led","proposed type"] },
  { id:"prW",       label:"Proposed watts",   syn:["proposed watts","pr w","new watts","proposed wattage","watts proposed","led watts"] },
  { id:"prQty",     label:"Proposed qty",     syn:["proposed qty","pr qty","new qty","proposed quantity","proposed count"] },
  { id:"control",   label:"Controls",         syn:["controls","control","sensor","control type"] },
  { id:"hou",       label:"Annual hours",     syn:["hou","hours","annual hours","operating hours","hrs","run hours"] },
  { id:"cost",      label:"Cost $",           syn:["cost","installed cost","price","total cost","cost $","material + labor"] }
];

let IMPORT_GRID = null; // parsed rows cache

function parseClipboardTable(text){
  text = text.replace(/\r\n?/g,"\n").replace(/\n+$/,"");
  if(!text.trim()) return [];
  const delim = text.includes("\t") ? "\t" : ",";
  return text.split("\n").map(line => delim === "\t"
    ? line.split("\t")
    : splitCsvLine(line));
}
function splitCsvLine(line){ // minimal quoted-CSV splitter
  const out=[]; let cur="",q=false;
  for(let i=0;i<line.length;i++){ const c=line[i];
    if(c==='"'){ if(q&&line[i+1]==='"'){cur+='"';i++;} else q=!q; }
    else if(c===","&&!q){ out.push(cur); cur=""; }
    else cur+=c; }
  out.push(cur); return out;
}

function guessMapping(headerRow){
  return headerRow.map(h=>{
    const t=(h||"").trim().toLowerCase();
    if(!t) return "skip";
    for(const f of IMPORT_FIELDS){ if(f.syn && f.syn.includes(t)) return f.id; }
    for(const f of IMPORT_FIELDS){ if(f.syn && f.syn.some(s=>t.includes(s)||s.includes(t))) return f.id; }
    return "skip";
  });
}

function headerLooksLikeHeader(row){
  // header if most cells are non-numeric text
  const nonNum = row.filter(c=>c.trim() && isNaN(parseFloat(c))).length;
  return nonNum >= Math.max(2, row.length/2);
}

function onPaste(ev){
  const text=(ev.clipboardData||window.clipboardData).getData("text");
  ev.preventDefault();
  const grid=parseClipboardTable(text);
  if(!grid.length){ $("importmsg").textContent="Nothing usable on the clipboard — copy a cell range from Excel and paste again."; return; }
  IMPORT_GRID = grid;
  renderImportPreview();
}

function renderImportPreview(){
  const grid=IMPORT_GRID;
  const hasHeader=headerLooksLikeHeader(grid[0]);
  const cols=Math.max(...grid.map(r=>r.length));
  const map=hasHeader ? guessMapping(grid[0]) : new Array(cols).fill("skip");
  const dataRows = hasHeader ? grid.slice(1) : grid;

  let html=`<div class="note" style="margin-bottom:8px">${dataRows.length} data row(s) detected${hasHeader?", header row recognized":", no header row detected — set column mapping manually"}. Adjust the mapping dropdowns, then import.</div>`;
  html+='<div style="overflow-x:auto"><table class="lines"><thead><tr>';
  for(let c=0;c<cols;c++){
    html+=`<th><select class="mapsel" data-col="${c}">${IMPORT_FIELDS.map(f=>`<option value="${f.id}" ${f.id===(map[c]||"skip")?"selected":""}>${f.label}</option>`).join("")}</select></th>`;
  }
  html+="</tr></thead><tbody>";
  dataRows.slice(0,8).forEach(r=>{
    html+="<tr>"+Array.from({length:cols},(_,c)=>`<td style="font-family:var(--mono);font-size:11.5px;color:#51606e">${esc(r[c]||"")}</td>`).join("")+"</tr>";
  });
  if(dataRows.length>8) html+=`<tr><td colspan="${cols}" class="note">… ${dataRows.length-8} more row(s)</td></tr>`;
  html+="</tbody></table></div>";
  html+=`<div style="margin-top:10px"><button class="importbtn" onclick="commitImport(${hasHeader})">Import ${dataRows.length} line item(s)</button>
         <button class="importbtn ghost" onclick="cancelImport()">Cancel</button></div>`;
  $("importpreview").innerHTML=html;
  $("importmsg").textContent="";
}

function commitImport(hasHeader){
  const grid=IMPORT_GRID;
  const dataRows=hasHeader?grid.slice(1):grid;
  const map=[...document.querySelectorAll(".mapsel")].map(s=>s.value);
  const p=currentProfile();
  let added=0, unmatched=0;

  for(const r of dataRows){
    if(!r.some(c=>c && c.trim())) continue;
    const raw={};
    map.forEach((f,c)=>{ if(f!=="skip") raw[f]=(r[c]||"").trim(); });

    const ln=mkLine({});
    if(raw.space) ln.space=raw.space;
    if(raw.spaceType){
      const st=matchSpaceType(raw.spaceType);
      if(st){ ln.spaceType=st; ln.hou=scheduleHOU(st); }
    }
    if(raw.qty){ ln.qty=parseFloat(raw.qty)||1; if(ln.prQtyProv!=="override") ln.prQty=ln.qty; }
    if(raw.prQty){ const q=parseFloat(raw.prQty); if(q>0 && Math.abs(q-ln.qty)>=0.0001){ ln.prQty=q; ln.prQtyProv="override"; } }
    if(raw.cost) ln.cost=parseFloat(String(raw.cost).replace(/[$,]/g,""))||0;

    // fixtures: try table match on text; explicit watt columns win
    if(raw.exCode){ ln.exCode=raw.exCode;
      const f=findFixture(p.wattageTable,raw.exCode); if(f){ln.exCode=f.code; ln.exW=f.watts;} else unmatched++; }
    if(raw.exW) ln.exW=parseFloat(raw.exW)||ln.exW;
    if(raw.prCode){ ln.prCode=raw.prCode;
      const f=findFixture(p.wattageTable,raw.prCode); if(f){ln.prCode=f.code; ln.prW=f.watts;} else unmatched++; }
    if(raw.prW) ln.prW=parseFloat(raw.prW)||ln.prW;

    if(raw.control){ const c=matchControl(raw.control); if(c) ln.control=c; }
    if(raw.hou){ const h=parseFloat(raw.hou);
      if(h>0){ ln.hou=h; ln.houProv = Math.abs(h-scheduleHOU(ln.spaceType))<1 ? "default" : "override"; } }

    LINES.push(ln); added++;
  }
  cancelImport();
  render();
  $("importmsg").textContent=`Imported ${added} line(s).`+(unmatched?` ${unmatched} fixture description(s) had no wattage-table match — enter watts manually or refine codes (flagged rows show 0 W).`:"");
}

function cancelImport(){ IMPORT_GRID=null; $("importpreview").innerHTML=""; }

function matchSpaceType(text){
  const t=text.toLowerCase();
  for(const k in SCHEDULES){ if(k===t || SCHEDULES[k].label.toLowerCase().includes(t) || t.includes(k)) return k; }
  if(/24|cont/.test(t)) return "cont24";
  if(/ext|park|outdoor|site/.test(t)) return "exterior";
  if(/ware|storage|shop|mfg|manuf/.test(t)) return "warehouse";
  if(/off|admin|conf/.test(t)) return "office";
  if(/retail|store|sales/.test(t)) return "retail";
  if(/school|class/.test(t)) return "school";
  return null;
}
function matchControl(text){
  const t=text.toLowerCase();
  if(/nlc|network|lumin/.test(t)) return "nlc";
  if(/day|photo/.test(t)) return "daylight";
  if(/occ|motion|vac|sensor/.test(t)) return "occ";
  if(/none|no|n\/a|-/.test(t)) return "none";
  return null;
}
