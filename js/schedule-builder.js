/* schedule-builder.js — user-defined operating schedules for 8760 mode.
   A schedule is a named set of operating windows (time-on / time-off). Each
   window applies to selected days of the week and/or holidays, and to selected
   months. The full 8760 fraction array is generated on demand from the 2026
   calendar (Jan 1 = Thursday), matching schedules.js / engine.js.

   A line item may reference a schedule by id; if it does, the schedule drives
   its hourly shape and its annual HOU. Lines with no schedule fall back to the
   space-type curve in schedules.js (unchanged behaviour). Only used in 8760
   mode; the builder panel is hidden in annual mode. */

/* ---- 2026 calendar helpers (US federal holidays) ---- */
const MONTH_START = [0,31,59,90,120,151,181,212,243,273,304,334]; // day-of-year of month start, non-leap 2026
const MONTH_ABBR  = ["J","F","M","A","M","J","J","A","S","O","N","D"];
const MONTH_NAME  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_ABBR    = ["Su","Mo","Tu","We","Th","Fr","Sa"];            // index 0=Sun … 6=Sat
// 2026 US federal holidays as day-of-year (0-based). See comments for dates.
const HOLIDAYS_2026 = new Set([
  0,   // Jan 1  New Year's Day
  18,  // Jan 19 MLK Day
  46,  // Feb 16 Washington's Birthday
  144, // May 25 Memorial Day
  169, // Jun 19 Juneteenth
  184, // Jul 4  Independence Day
  249, // Sep 7  Labor Day
  284, // Oct 12 Columbus Day
  314, // Nov 11 Veterans Day
  329, // Nov 26 Thanksgiving
  358  // Dec 25 Christmas
]);
function monthOfDay(d){ for(let i=11;i>=0;i--) if(d>=MONTH_START[i]) return i; return 0; }
function isHoliday2026(d){ return HOLIDAYS_2026.has(d); }

/* ---- schedule model ---- */
let SCHEDULES_USER = [];   // array of { id, name, windows:[...] }
let SCHED_SEQ = 1;         // id / default-name counter
let SCHED_COLLAPSED = false;

function mkWindow(){
  return { on:"08:00", off:"17:00",
           days:[false,true,true,true,true,true,false], // Sun..Sat → Mon-Fri on
           hol:false,
           months:[true,true,true,true,true,true,true,true,true,true,true,true] };
}
function mkSchedule(name){
  const id = "sch"+(SCHED_SEQ++);
  return { id, name: name || ("Schedule "+(SCHEDULES_USER.length+1)), windows:[ mkWindow() ] };
}
function userScheduleById(id){ return SCHEDULES_USER.find(s=>s.id===id) || null; }

/* time "HH:MM" → minutes past midnight */
function timeToMin(t){
  const parts = String(t==null?"":t).split(":");
  const h = parseInt(parts[0],10)||0, m = parseInt(parts[1],10)||0;
  return Math.max(0, Math.min(1440, h*60+m));
}
/* overlap of clock hour [hStart,hStart+60) with window [onMin,offMin), as 0..1.
   Supports windows that wrap past midnight (off <= on). */
function hourCoverage(hStart, onMin, offMin){
  const hEnd = hStart+60;
  if(offMin > onMin){
    return Math.max(0, Math.min(hEnd,offMin)-Math.max(hStart,onMin))/60;
  }
  if(offMin === onMin) return 0; // zero-length window
  // wrap: covers [on,1440) and [0,off)
  const a = Math.max(0, Math.min(hEnd,1440)-Math.max(hStart,onMin))/60;
  const b = Math.max(0, Math.min(hEnd,offMin)-Math.max(hStart,0))/60;
  return Math.min(1, a+b);
}

/* Generate the normalized 8760 fraction array for a schedule (values 0..1).
   Fraction = share of the hour any active window is operating. Holidays are
   governed only by windows with hol=true (day-of-week is ignored that day). */
function schedFractions(sch){
  const out = new Float32Array(8760);
  if(!sch || !sch.windows || !sch.windows.length) return out;
  // precompute window minute bounds
  const wins = sch.windows.map(w=>({ on:timeToMin(w.on), off:timeToMin(w.off),
    days:w.days||[], hol:!!w.hol, months:w.months||[] }));
  for(let d=0; d<365; d++){
    const dow = (4+d)%7, mo = monthOfDay(d), hol = isHoliday2026(d);
    for(let h=0; h<24; h++){
      let f = 0;
      for(const w of wins){
        if(!w.months[mo]) continue;
        const dayOK = hol ? w.hol : !!w.days[dow];
        if(!dayOK) continue;
        f += hourCoverage(h*60, w.on, w.off);
        if(f >= 1){ f = 1; break; }
      }
      out[d*24+h] = f;
    }
  }
  return out;
}
function schedImpliedHOU(sch){
  const a = schedFractions(sch); let s=0;
  for(let i=0;i<a.length;i++) s+=a[i];
  return s;
}

/* ---- integration points used by engine.js / ui.js ---- */
// Base (existing, pre-controls) hourly shape for a line: user schedule if
// assigned and present, else the space-type curve from schedules.js.
function lineBaseShape(ln){
  if(ln.scheduleId){ const s=userScheduleById(ln.scheduleId); if(s) return schedFractions(s); }
  return schedule8760(ln.spaceType);
}
// Annual HOU implied for a line under the current schedule assignment.
function lineImpliedHOU(ln){
  if(ln.scheduleId){ const s=userScheduleById(ln.scheduleId); if(s) return schedImpliedHOU(s); }
  return scheduleHOU(ln.spaceType);
}
// Refresh hou on every scheduled line (call after a schedule definition changes).
function refreshScheduledLineHOU(){
  let changed=false;
  for(const ln of (typeof LINES!=="undefined"?LINES:[])){
    if(ln.scheduleId){
      const s=userScheduleById(ln.scheduleId);
      if(s){ ln.hou = Math.round(schedImpliedHOU(s)); ln.houProv="schedule"; }
      else { ln.scheduleId=null; if(ln.houProv==="schedule"){ ln.hou=scheduleHOU(ln.spaceType); ln.houProv="default"; } }
      changed=true;
    }
  }
  return changed;
}

/* ---- builder UI ---- */
function seedSchedulesIfEmpty(){
  if(!SCHEDULES_USER.length){
    const s = mkSchedule("Standard weekday");
    SCHEDULES_USER.push(s); // default: 8a–5p, Mon–Fri, all 12 months
  }
}

// Show/hide the whole panel based on calculation mode.
function updateScheduleVisibility(){
  const panel = document.getElementById("schedpanel");
  if(!panel) return;
  const on = currentProfile().mode === "8760";
  panel.style.display = on ? "" : "none";
}

function toggleSchedCollapse(){ SCHED_COLLAPSED=!SCHED_COLLAPSED; renderScheduleBuilder(); }

function renderScheduleBuilder(){
  const body = document.getElementById("schedbody");
  const caret = document.getElementById("schedcaret");
  if(!body) return;
  if(caret) caret.textContent = SCHED_COLLAPSED ? "▸" : "▾";
  body.style.display = SCHED_COLLAPSED ? "none" : "";
  if(SCHED_COLLAPSED) return;

  let h = `<div class="note" style="margin-bottom:10px">Named operating schedules for 8760 mode. Assign a schedule to a line item in the <b>Schedule</b> column; unassigned lines use the space-type default curve. Times are 24-hour; a window may wrap past midnight (e.g. 22:00 → 06:00). Holidays use the 2026 US federal calendar.</div>`;

  SCHEDULES_USER.forEach((s,si)=>{
    const hou = Math.round(schedImpliedHOU(s));
    h += `<div class="sched-card">
      <div class="sched-head">
        <input class="sched-name" value="${esc(s.name)}" onchange="schedUpd(${si},'name',this.value)" aria-label="Schedule name">
        <span class="sched-hou">${hou.toLocaleString("en-US")} hrs/yr</span>
        <button class="rowbtn" title="Remove schedule" onclick="removeSchedule(${si})" ${SCHEDULES_USER.length<=1?'style="visibility:hidden"':''}>✕</button>
      </div>`;
    (s.windows||[]).forEach((w,wi)=>{
      h += `<div class="sched-win">
        <div class="sched-times">
          <label>On <input type="time" value="${esc(w.on)}" onchange="winUpd(${si},${wi},'on',this.value)"></label>
          <label>Off <input type="time" value="${esc(w.off)}" onchange="winUpd(${si},${wi},'off',this.value)"></label>
        </div>
        <div class="sched-days">`;
      for(let di=0; di<7; di++){
        h += `<button class="daychip ${w.days[di]?'on':''}" title="${DAY_ABBR[di]}" onclick="toggleDay(${si},${wi},${di})">${DAY_ABBR[di]}</button>`;
      }
      h += `<button class="daychip hol ${w.hol?'on':''}" title="Holidays (2026 US federal)" onclick="toggleHol(${si},${wi})">Hol</button>`;
      h += `</div><div class="sched-months">`;
      const allOn = w.months.every(Boolean);
      h += `<button class="mochip all ${allOn?'on':''}" title="Toggle all months" onclick="toggleAllMonths(${si},${wi})">All</button>`;
      for(let mi=0; mi<12; mi++){
        h += `<button class="mochip ${w.months[mi]?'on':''}" title="${MONTH_NAME[mi]}" onclick="toggleMonth(${si},${wi},${mi})">${MONTH_ABBR[mi]}</button>`;
      }
      h += `<button class="rowbtn winrm" title="Remove window" onclick="removeWindow(${si},${wi})" ${s.windows.length<=1?'style="visibility:hidden"':''}>✕</button>`;
      h += `</div></div>`;
    });
    h += `<div class="sched-add"><button onclick="addWindow(${si})">+ Add operating window</button></div>`;
    h += `</div>`;
  });
  h += `<div class="addrow" style="margin-top:12px"><button onclick="addSchedule()">+ Add schedule</button></div>`;
  body.innerHTML = h;
}

/* ---- builder edit handlers ---- */
function schedApplied(){ // after any schedule change: refresh line HOU + grid + results
  refreshScheduledLineHOU();
  renderScheduleBuilder();
  if(typeof render==="function") render();
  autosaveSafe();
}
function schedUpd(si,field,val){ SCHEDULES_USER[si][field]=val; schedApplied(); }
function winUpd(si,wi,field,val){ SCHEDULES_USER[si].windows[wi][field]=val; schedApplied(); }
function toggleDay(si,wi,di){ const w=SCHEDULES_USER[si].windows[wi]; w.days[di]=!w.days[di]; schedApplied(); }
function toggleHol(si,wi){ const w=SCHEDULES_USER[si].windows[wi]; w.hol=!w.hol; schedApplied(); }
function toggleMonth(si,wi,mi){ const w=SCHEDULES_USER[si].windows[wi]; w.months[mi]=!w.months[mi]; schedApplied(); }
function toggleAllMonths(si,wi){ const w=SCHEDULES_USER[si].windows[wi]; const all=w.months.every(Boolean); w.months=w.months.map(()=>!all); schedApplied(); }
function addWindow(si){ SCHEDULES_USER[si].windows.push(mkWindow()); schedApplied(); }
function removeWindow(si,wi){ const s=SCHEDULES_USER[si]; if(s.windows.length>1){ s.windows.splice(wi,1); schedApplied(); } }
function addSchedule(){ SCHEDULES_USER.push(mkSchedule()); schedApplied(); }
function removeSchedule(si){
  if(SCHEDULES_USER.length<=1) return;
  const removed=SCHEDULES_USER[si];
  // detach any lines using this schedule
  for(const ln of (typeof LINES!=="undefined"?LINES:[])){
    if(ln.scheduleId===removed.id){ ln.scheduleId=null; ln.houProv="default"; ln.hou=scheduleHOU(ln.spaceType); }
  }
  SCHEDULES_USER.splice(si,1);
  schedApplied();
}
function autosaveSafe(){ try{ localStorage.setItem("lightcalc_autosave", JSON.stringify(snapshot())); }catch(e){} }

// <option> list for the per-line Schedule selector.
function scheduleOptionsHTML(selectedId){
  let h = `<option value="" ${!selectedId?"selected":""}>Space-type default</option>`;
  SCHEDULES_USER.forEach(s=>{ h += `<option value="${s.id}" ${s.id===selectedId?"selected":""}>${esc(s.name)}</option>`; });
  return h;
}
