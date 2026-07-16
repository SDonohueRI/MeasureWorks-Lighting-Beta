/* schedules.js — schedule library and 8760 generation.
   Schedules are stored compactly as 24-hr weekday/weekend fraction-on profiles;
   the full 8760 is generated on demand (2026 calendar, Jan 1 = Thursday).
   Values are fraction of connected load operating in that hour (0–1). */

const SCHEDULES = {
  office:      { label:"Office",              wd:[0,0,0,0,0,.1,.3,.7,.95,1,1,1,1,1,1,1,.9,.7,.4,.2,.1,.05,0,0],
                 we:[0,0,0,0,0,0,.05,.1,.15,.2,.2,.2,.2,.2,.15,.1,.1,.05,0,0,0,0,0,0] },
  warehouse:   { label:"Warehouse (2-shift)",  wd:[.1,.1,.1,.1,.1,.5,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,.6,.2,.1],
                 we:[.1,.1,.1,.1,.1,.2,.4,.4,.4,.4,.4,.4,.4,.4,.4,.4,.3,.2,.1,.1,.1,.1,.1,.1] },
  retail:      { label:"Retail",              wd:[0,0,0,0,0,.1,.3,.8,1,1,1,1,1,1,1,1,1,1,1,1,.8,.4,.1,0],
                 we:[0,0,0,0,0,.05,.2,.6,1,1,1,1,1,1,1,1,1,1,1,.9,.6,.3,.05,0] },
  cont24:      { label:"24/7 Continuous",      wd:Array(24).fill(1), we:Array(24).fill(1) },
  exterior:    { label:"Exterior (dusk-dawn)", wd:[1,1,1,1,1,1,.5,0,0,0,0,0,0,0,0,0,0,0,.3,1,1,1,1,1],
                 we:[1,1,1,1,1,1,.5,0,0,0,0,0,0,0,0,0,0,0,.3,1,1,1,1,1] },
  school:      { label:"School (K-12)",        wd:[0,0,0,0,0,.05,.4,.9,1,1,1,1,1,1,1,.8,.5,.3,.15,.1,.05,0,0,0],
                 we:[0,0,0,0,0,0,.05,.1,.15,.15,.15,.15,.1,.1,.1,.05,0,0,0,0,0,0,0,0] }
};

// Annual HOU implied by a schedule (used for annual-mode defaults and display)
function scheduleHOU(key){
  const s = SCHEDULES[key];
  const wd = s.wd.reduce((a,b)=>a+b,0), we = s.we.reduce((a,b)=>a+b,0);
  return Math.round(wd*261 + we*104); // 2026: 261 weekdays, 104 weekend days
}

// Generate normalized 8760 array for a schedule key. 2026-01-01 is a Thursday (dow=4).
function schedule8760(key){
  const s = SCHEDULES[key], out = new Float32Array(8760);
  for(let d=0; d<365; d++){
    const dow = (4 + d) % 7;                 // 0=Sun … 6=Sat
    const prof = (dow===0 || dow===6) ? s.we : s.wd;
    for(let h=0; h<24; h++) out[d*24+h] = prof[h];
  }
  return out;
}

/* Controls factors reshape a schedule rather than flat-scaling, where sensible:
   occupancy/NLC: scale all hours by (1-sf); daylighting: concentrate the
   reduction into daytime hours (shifts *when* savings land, i.e. peak kW).

   In every case the reshaped profile is normalized so its annual integral is
   exactly (1-sf) of the original. This guarantees the 8760 energy result
   reconciles with the simple annual math for identical inputs — the two modes
   differ in demand shape, never in total kWh. */
function applyControls(arr8760, control, profile){
  const sf = (profile.controlsFactors[control] || 0);
  if(!sf) return arr8760;
  const out = new Float32Array(8760);
  if(control === "daylight"){
    for(let i=0;i<8760;i++){
      const h = i % 24;
      out[i] = (h>=9 && h<16) ? arr8760[i]*(1-Math.min(1,sf*2)) : arr8760[i];
      if(out[i] < 0) out[i] = 0;
    }
    // normalize to exact (1-sf) annual energy
    let sin=0, sout=0;
    for(let i=0;i<8760;i++){ sin+=arr8760[i]; sout+=out[i]; }
    if(sout > 0){
      const k = (1-sf)*sin/sout;
      for(let i=0;i<8760;i++) out[i] *= k;
    }
    return out;
  }
  for(let i=0;i<8760;i++) out[i] = arr8760[i]*(1-sf);
  return out;
}
