/* engine.js — core calculation engine. Pure functions: no DOM, no globals
   mutated. Inputs in, results out, so the math is unit-testable and reusable
   across future calculators in the framework. */

/* line: { space, spaceType, exCode, exW, qty, prCode, prW, prQty, prQtyProv,
           control, hou, houProv, scheduleId, cost }
   qty is the existing quantity; prQty is the proposed quantity (defaults to
   qty unless overridden). profile: see profiles.js. ieOn: boolean (user toggle).
   Returns per-line and project results; in 8760 mode also hourly arrays. */

// Proposed quantity for a line — defaults to existing qty unless overridden.
function proposedQty(ln){
  return (ln.prQtyProv === "override" && ln.prQty != null) ? ln.prQty : ln.qty;
}

/* Interactive effects factors for one line. If the profile's IE varies by
   space type, look the line's space type up in byType; otherwise (or if the
   type isn't listed) fall back to the flat kwhFactor/kwFactor. */
function ieFor(profile, spaceType, ieOn){
  if(!ieOn) return { kwh: 1.0, kw: 1.0 };
  const ie = profile.interactiveEffects;
  if(ie.variesBySpaceType && ie.byType && ie.byType[spaceType])
    return { kwh: ie.byType[spaceType].kwh, kw: ie.byType[spaceType].kw };
  return { kwh: ie.kwhFactor, kw: ie.kwFactor };
}

/* Effective existing (pre-controls) hourly shape for a line, including the
   HOU-override scaling k. Its annual sum equals the line's effective hours.
   Shared with the Excel exporters so the workbook's 8760 traces to the same
   numbers the engine produces. Only meaningful in 8760 mode. */
function lineEffectiveShape(ln){
  const base = lineBaseShape(ln);
  let k = 1;
  if(!(ln.scheduleId && userScheduleById(ln.scheduleId))){
    const bH = scheduleHOU(ln.spaceType);
    k = (ln.houProv !== "default" && ln.houProv !== "schedule" && bH > 0) ? ln.hou/bH : 1;
  }
  if(k === 1) return base;
  const eff = new Float32Array(base.length);
  for(let i=0;i<base.length;i++) eff[i] = base[i]*k;
  return eff;
}

function calcProject(lines, profile, ieOn){
  const res = { lines:[], kwh:0, kw:0, cost:0,
                hourlyEx:null, hourlyPr:null, hourlySave:null, mode:profile.mode };

  if(profile.mode === "8760"){
    res.hourlyEx = new Float64Array(8760);
    res.hourlyPr = new Float64Array(8760);
    res.hourlySave = new Float64Array(8760);
  }

  for(const ln of lines){
    const ie = ieFor(profile, ln.spaceType, ieOn);
    const exKW = (ln.exW * ln.qty)/1000, prKW = (ln.prW * proposedQty(ln))/1000;
    let lineKwh = 0, lineHouEff = ln.hou;

    if(profile.mode === "8760"){
      const base = lineBaseShape(ln);              // existing (pre-controls) shape
      const shapeEx = base;
      const shapePr = applyControls(base, ln.control, profile);
      // Scale factor k reconciles the shape's annual hours to the line's HOU.
      // Scheduled lines already carry the schedule's exact hours, so k = 1.
      let baseHOU, k;
      if(ln.scheduleId && userScheduleById(ln.scheduleId)){
        baseHOU = 0; for(let i=0;i<8760;i++) baseHOU += base[i];
        k = 1;
      } else {
        baseHOU = scheduleHOU(ln.spaceType);
        k = (ln.houProv !== "default" && ln.houProv !== "schedule" && baseHOU > 0) ? ln.hou/baseHOU : 1;
      }
      for(let i=0;i<8760;i++){
        res.hourlyEx[i] += exKW * shapeEx[i] * k;
        res.hourlyPr[i] += prKW * shapePr[i] * k;
        res.hourlySave[i] += (exKW*shapeEx[i] - prKW*shapePr[i]) * k * ie.kw;
      }
      let exE=0, prE=0;
      for(let i=0;i<8760;i++){ exE += shapeEx[i]; prE += shapePr[i]; }
      lineKwh = (exKW*exE - prKW*prE) * k * ie.kwh;
    } else {
      const cf = (profile.controlsFactors[ln.control] || 0);
      lineKwh = (exKW*ln.hou - prKW*ln.hou*(1-cf)) * ie.kwh;
    }

    res.lines.push({ ...ln, exKW, prKW, kwh:lineKwh, ieKwh:ie.kwh, ieKw:ie.kw });
    res.kwh += lineKwh;
    res.cost += (ln.cost || 0);
  }

  // Peak kW (interactive effects already applied per line above)
  if(profile.mode === "8760"){
    res.kw = peakWindowAverage(res.hourlySave, profile.peakWindow);
  } else {
    let kw = 0;
    for(const l of res.lines){
      const cf = (profile.coincidenceFactor && profile.coincidenceFactor[l.spaceType]) || 0;
      const ctrl = (profile.controlsFactors[l.control] || 0);
      kw += (l.exKW - l.prKW*(1-ctrl)) * cf * l.ieKw;
    }
    res.kw = kw;
  }

  // Incentive & economics
  res.incentiveRaw = profile.incentive.type === "perKWh" ? res.kwh * profile.incentive.rate
                   : profile.incentive.type === "perKW"  ? res.kw  * profile.incentive.rate : 0;
  res.incentiveCap = res.cost * (profile.incentive.capPctOfCost ?? 1);
  res.incentive = res.cost > 0 ? Math.min(res.incentiveRaw, res.incentiveCap) : res.incentiveRaw;
  res.lifetimeKwh = res.kwh * profile.measureLifeYrs;
  return res;
}

// Average savings kW over the profile-defined peak window (2026 calendar; Jan 1 = Thu)
function peakWindowAverage(hourly, win){
  if(!win) { let m=0; for(const v of hourly) if(v>m) m=v; return m; }
  const daysInMonth=[31,28,31,30,31,30,31,31,30,31,30,31];
  let sum=0, n=0, d=0;
  for(let mo=0; mo<12; mo++){
    for(let dm=0; dm<daysInMonth[mo]; dm++, d++){
      if(!win.months.includes(mo+1)) continue;
      const dow=(4+d)%7;
      if(win.weekdaysOnly && (dow===0||dow===6)) continue;
      for(let h=win.hourStart; h<win.hourEnd; h++){ sum += hourly[d*24+h]; n++; }
    }
  }
  return n ? sum/n : 0;
}

/* Sanity checks — non-blocking review flags. Returns [{level,msg}] */
function sanityChecks(lines, results, customerRateKwh){
  const flags=[];
  lines.forEach((l,i)=>{
    const n = i+1;
    if(l.exW && l.prW && l.prW >= l.exW)
      flags.push({level:"warn", msg:`Line ${n}: proposed watts (${l.prW}) ≥ existing (${l.exW}). Verify — savings will be zero or negative.`});
    if(l.prCode && !l.prW)
      flags.push({level:"warn", msg:`Line ${n}: proposed fixture "${l.prCode}" has 0 W — no wattage-table match. Enter watts manually; savings are overstated until corrected.`});
    if(l.exCode && !l.exW)
      flags.push({level:"warn", msg:`Line ${n}: existing fixture "${l.exCode}" has 0 W — no wattage-table match. Enter watts manually.`});
    if(l.hou > 8760) flags.push({level:"warn", msg:`Line ${n}: HOU exceeds 8,760.`});
    if(l.hou > 4500 && l.spaceType==="office")
      flags.push({level:"warn", msg:`Line ${n}: ${l.hou} HOU is high for an office space — expect reviewer scrutiny; attach justification.`});
    if(l.houProv==="override")
      flags.push({level:"warn", msg:`Line ${n}: HOU manually overridden — document the basis for program review.`});
    if(!l.qty || l.qty<1) flags.push({level:"warn", msg:`Line ${n}: quantity missing.`});
  });
  if(results.cost>0 && results.incentiveRaw > results.incentiveCap)
    flags.push({level:"warn", msg:`Incentive capped at ${(100*(results.incentiveCap/results.incentiveRaw)).toFixed(0)}% of calculated value by cost cap.`});
  if(!flags.length) flags.push({level:"ok", msg:"No review flags. All inputs within expected ranges."});
  return flags;
}
