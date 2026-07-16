/* export-excel.js — canonical workbook: Cover, Inputs, Assumptions, Schedules
   (8760 mode), Calculations (live formulas referencing Inputs/Assumptions/
   SchedData), SchedData + 8760 (live hourly formulas, 8760 mode only), Results.
   Web UI sections mirror this tab order.

   8760 energy reconciles exactly with the simple annual method: per-line kWh is
   (Ex kW·H − Pr kW·H·(1−SF))·IE with H = the schedule's exact annual hours
   (SUM of the line's SchedData column), and the 8760 tab's savings column sums
   to the same total. Controls are normalized to (1−SF) annual energy in the
   engine, so the two modes differ only in demand shape, never in total kWh. */

// 0-based column index → spreadsheet column letter (0→A, 2→C, 26→AA …)
function colLetter(n){ let s=""; n++; while(n>0){ const m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=Math.floor((n-1)/26); } return s; }

async function exportExcel(){
  const p=currentProfile(), ieOn=$("ie_toggle").checked;
  const res=calcProject(LINES,p,ieOn);
  const is8760 = p.mode==="8760";
  const wb=new ExcelJS.Workbook();
  wb.creator="Lighting Savings Calculator v0.1";
  const th={font:{bold:true,color:{argb:"FFFFFFFF"}},fill:{type:"pattern",pattern:"solid",fgColor:{argb:"FF1B2733"}}};
  const provFill={default:"FFE2E8EE",override:"FFF6E3CC",metered:"FFD3EAF2",schedule:"FFD3EAF2"};

  // Per-line export metadata shared by Calculations, SchedData and the 8760 tab.
  const meta = LINES.map((l,i)=>{
    const cf = p.controlsFactors[l.control]||0;
    const ie = ieFor(p,l.spaceType,ieOn);
    const sched = l.scheduleId ? userScheduleById(l.scheduleId) : null;
    return { l, i, inputRow:i+2, cf, ieKwh:ie.kwh,
             schedCol: colLetter(2+i),                 // its column on SchedData (Day=A,Hour=B)
             schedLabel: sched ? sched.name : (SCHEDULES[l.spaceType].label+" (space type)"),
             eff: is8760 ? lineEffectiveShape(l) : null };
  });

  /* Cover */
  const cover=wb.addWorksheet("Cover");
  cover.columns=[{width:26},{width:52}];
  [["Project",$("projname").value],
   ["Program profile",p.label],
   ["Profile version",p.version+" (schema "+p.schemaVersion+")"],
   ["Calculation mode",p.mode],
   ["Interactive effects",ieOn?`Applied (kWh ×${p.interactiveEffects.kwhFactor}, kW ×${p.interactiveEffects.kwFactor})`:"Not applied"],
   ["Exported",new Date().toISOString()],
   ["Tool","Lighting Savings Calculator — framework prototype v0.1"],
   ["Note","Incentive shown is an estimate pending program review."]
  ].forEach(r=>{const row=cover.addRow(r);row.getCell(1).font={bold:true};});

  /* Inputs — same columns/order as web grid (Pr Qty and Schedule added) */
  const inp=wb.addWorksheet("Inputs");
  inp.columns=[{width:5},{width:22},{width:16},{width:18},{width:8},{width:6},{width:20},{width:8},{width:7},{width:16},{width:20},{width:8},{width:9},{width:11}];
  inp.addRow(["#","Space / location","Space type","Existing fixture","Ex W","Qty","Proposed fixture","Pr W","Pr Qty","Controls","Schedule","HOU","HOU src","Cost $"]).eachCell(c=>Object.assign(c,th));
  LINES.forEach((l,i)=>{
    const m=meta[i];
    const r=inp.addRow([i+1,l.space,SCHEDULES[l.spaceType].label,l.exCode,l.exW,l.qty,l.prCode,l.prW,proposedQty(l),
      CONTROL_OPTIONS.find(c=>c.id===l.control).label, l.scheduleId?m.schedLabel:"Space-type default",
      l.hou, (l.houProv==="schedule"?"SCHEDULE":l.houProv.toUpperCase()), l.cost]);
    r.getCell(9).fill={type:"pattern",pattern:"solid",fgColor:{argb:l.prQtyProv==="override"?provFill.override:provFill.default}};
    r.getCell(13).fill={type:"pattern",pattern:"solid",fgColor:{argb:provFill[l.houProv]||provFill.default}};
  });

  /* Assumptions */
  const asm=wb.addWorksheet("Assumptions");
  asm.columns=[{width:30},{width:16},{width:70}];
  asm.addRow(["Assumption","Value","Source / note"]).eachCell(c=>Object.assign(c,th));
  asm.addRow(["Interactive effects — kWh factor (flat/fallback)",ieOn?p.interactiveEffects.kwhFactor:1,p.interactiveEffects.source]);
  asm.addRow(["Interactive effects — kW factor (flat/fallback)",ieOn?p.interactiveEffects.kwFactor:1,p.interactiveEffects.source]);
  if(ieOn && p.interactiveEffects.variesBySpaceType && p.interactiveEffects.byType){
    for(const st in p.interactiveEffects.byType){
      const v=p.interactiveEffects.byType[st];
      asm.addRow([`IE by space type — ${SCHEDULES[st]?SCHEDULES[st].label:st}`,`kWh ×${v.kwh} / kW ×${v.kw}`,p.interactiveEffects.source]);
    }
  }
  CONTROL_OPTIONS.filter(c=>c.id!=="none").forEach(c=>
    asm.addRow([`Controls factor — ${c.label}`,p.controlsFactors[c.id],p.controlsFactors.source]));
  asm.addRow(["Incentive rule",p.incentive.rate,p.incentive.label+" — "+p.incentive.source]);
  asm.addRow(["Incentive cap (% of cost)",p.incentive.capPctOfCost??"n/a",p.incentive.label]);
  asm.addRow(["Measure life (yrs)",p.measureLifeYrs,"Profile EUL"]);
  asm.addRow(["Hours-of-use basis","—",p.houSource]);
  if(is8760) asm.addRow(["Peak demand definition","—",
    `Avg savings kW, months ${p.peakWindow.months.join("/")}, hours ${p.peakWindow.hourStart}:00–${p.peakWindow.hourEnd}:00, weekdays`]);
  else asm.addRow(["Coincidence factors","by space type",p.coincidenceFactor.source]);
  asm.addRow(["Blended rate ($/kWh, economics only)",+$("rate").value,"Customer rate — payback only, not savings"]);
  // named cells for formulas
  asm.getCell("B2").name="IE_KWH"; asm.getCell("B3").name="IE_KW";
  const incRow=4+CONTROL_OPTIONS.length-1;
  asm.getCell(`B${incRow}`).name="INC_RATE"; asm.getCell(`B${incRow+1}`).name="INC_CAP";
  asm.getCell(`B${incRow+2}`).name="EUL";

  /* Schedules (8760 mode) — operating-schedule definitions for the record */
  if(is8760){
    const sc=wb.addWorksheet("Schedules");
    sc.columns=[{width:24},{width:12},{width:9},{width:9},{width:22},{width:8},{width:26}];
    sc.addRow(["Schedule","Applies to line(s)","On","Off","Days","Holiday","Months"]).eachCell(c=>Object.assign(c,th));
    const dayAbbr=["Su","Mo","Tu","We","Th","Fr","Sa"];
    SCHEDULES_USER.forEach(s=>{
      const usedBy=LINES.map((l,i)=>l.scheduleId===s.id?(i+1):null).filter(x=>x).join(", ")||"—";
      (s.windows||[]).forEach((w,wi)=>{
        const days=w.days.map((on,di)=>on?dayAbbr[di]:null).filter(x=>x).join(" ")||"none";
        const mos=w.months.every(Boolean)?"All":w.months.map((on,mi)=>on?MONTH_ABBR[mi]:null).filter(x=>x).join("");
        sc.addRow([wi===0?`${s.name}  (${Math.round(schedImpliedHOU(s))} hrs/yr)`:"", wi===0?usedBy:"",
          w.on,w.off,days,w.hol?"Yes":"—",mos]);
      });
    });
    sc.addRow([]);
    sc.addRow(["Lines with no assigned schedule use the space-type default curve from the profile schedule library."])
      .getCell(1).font={italic:true,color:{argb:"FF8A97A3"}};
  }

  /* Calculations — live formulas referencing Inputs, Assumptions & SchedData */
  const calc=wb.addWorksheet("Calculations");
  calc.columns=[{width:5},{width:22},{width:11},{width:11},{width:10},{width:12},{width:9},{width:12},{width:30}];
  calc.addRow(["#","Space","Ex kW","Pr kW","Ctrl SF","Eff HOU","IE kWh","kWh saved","Notes"]).eachCell(c=>Object.assign(c,th));
  meta.forEach(m=>{
    const n=m.i+2, r=m.inputRow;
    // In 8760 mode Eff HOU = exact annual hours from the line's SchedData column,
    // so the per-line kWh matches the 8760 tab's hourly sum exactly. In annual
    // mode it references the Inputs HOU value.
    const effHou = is8760 ? {formula:`SUM(SchedData!${m.schedCol}2:${m.schedCol}8761)`} : {formula:`Inputs!L${r}`};
    calc.addRow([
      {formula:`Inputs!A${r}`},{formula:`Inputs!B${r}`},
      {formula:`Inputs!E${r}*Inputs!F${r}/1000`},
      {formula:`Inputs!H${r}*Inputs!I${r}/1000`},
      m.cf,
      effHou,
      m.ieKwh,
      {formula:`(C${n}*F${n}-D${n}*F${n}*(1-E${n}))*G${n}`},
      is8760?"Eff HOU = schedule annual hours (SchedData)":""
    ]);
  });
  const last=LINES.length+1;
  const tot=calc.addRow(["","TOTAL","","","","","",{formula:`SUM(H2:H${last})`},""]);
  tot.font={bold:true};
  calc.getCell(`H${last+1}`).name="TOT_KWH";

  /* SchedData + 8760 (values-backed fractions + live hourly formulas) */
  let hourlySumRef=null;
  if(is8760){
    // SchedData: Day, Hour, then one effective-shape column per line (its annual
    // sum = the line's effective hours). Referenced by the 8760 formulas.
    const sd=wb.addWorksheet("SchedData");
    const sdCols=[{width:6},{width:6}]; LINES.forEach(()=>sdCols.push({width:11}));
    sd.columns=sdCols;
    sd.addRow(["Day","Hour",...LINES.map((l,i)=>`L${i+1}`)]).eachCell(c=>Object.assign(c,th));
    const sdRows=new Array(8760);
    for(let hh=0;hh<8760;hh++){
      const row=[Math.floor(hh/24)+1, hh%24];
      for(const m of meta) row.push(+m.eff[hh].toFixed(5));
      sdRows[hh]=row;
    }
    sd.addRows(sdRows);
    sd.views=[{state:"frozen",ySplit:1}];

    // 8760: live formulas = Σ over lines of (connected kW from Inputs) × (fraction
    // from SchedData). Existing = exact shape; proposed/savings apply controls as
    // a uniform (1−SF) factor (energy-exact; daylighting reshape affects peak kW).
    const hs=wb.addWorksheet("8760");
    hs.columns=[{width:7},{width:6},{width:14},{width:14},{width:14}];
    hs.addRow(["Day","Hour","Existing kW","Proposed kW","Savings kW"]).eachCell(c=>Object.assign(c,th));
    const parts = meta.map(m=>({
      ex:`Inputs!$E$${m.inputRow}*Inputs!$F$${m.inputRow}/1000`,
      pr:`Inputs!$H$${m.inputRow}*Inputs!$I$${m.inputRow}/1000*(1-${m.cf})`,
      col:m.schedCol, ie:m.ieKwh }));
    const hsRows=new Array(8760);
    for(let hh=0;hh<8760;hh++){
      const sdRow=hh+2;
      const exStr = parts.map(pt=>`${pt.ex}*SchedData!${pt.col}${sdRow}`).join("+");
      const prStr = parts.map(pt=>`${pt.pr}*SchedData!${pt.col}${sdRow}`).join("+");
      const svStr = parts.map(pt=>`(${pt.ex}-${pt.pr})*SchedData!${pt.col}${sdRow}*${pt.ie}`).join("+");
      hsRows[hh]=[Math.floor(hh/24)+1, hh%24, {formula:exStr}, {formula:prStr}, {formula:svStr}];
    }
    hs.addRows(hsRows);
    hs.views=[{state:"frozen",ySplit:1}];
    // reconciliation total on the 8760 tab
    const sumRow=hs.addRow(["","Σ savings (kWh)","","",{formula:"SUM(E2:E8761)"}]);
    sumRow.font={bold:true};
    hs.getCell("E8762").name="HOURLY_KWH";
    hs.getCell("B8762").font={bold:true};
    hourlySumRef="HOURLY_KWH";
  }

  /* Results */
  const out=wb.addWorksheet("Results");
  out.columns=[{width:38},{width:18},{width:60}];
  out.addRow(["Result","Value","Basis"]).eachCell(c=>Object.assign(c,th));
  out.addRow(["Annual energy savings (kWh)",{formula:"TOT_KWH"},"Sum of line calculations (live)"]);
  out.addRow(["Peak demand savings (kW)",+res.kw.toFixed(2),
    is8760?"Engine value from 8760 peak window (see Assumptions)":"ΔkW × CF × IE (see Assumptions)"]);
  out.addRow(["Project cost ($)",res.cost,"Sum of line costs"]);
  out.addRow(["Incentive — calculated ($)",{formula:"TOT_KWH*INC_RATE"},p.incentive.label]);
  out.addRow(["Incentive — after cap ($)",{formula:`MIN(TOT_KWH*INC_RATE,${res.cost}*INC_CAP)`},"Lesser of calculated and cost cap"]);
  out.addRow(["Simple payback, net of incentive (yrs)",
    {formula:`(${res.cost}-MIN(TOT_KWH*INC_RATE,${res.cost}*INC_CAP))/(TOT_KWH*${+$("rate").value})`},"Customer economics at blended rate"]);
  out.addRow(["Lifetime savings (kWh)",{formula:"TOT_KWH*EUL"},"Annual × measure life"]);
  if(is8760){
    out.addRow(["8760 hourly Σ savings (kWh)",{formula:"HOURLY_KWH"},"Sum of the 8760 tab — reconciles to annual savings above"]);
    out.addRow(["8760 ↔ annual cross-check (kWh)",{formula:"TOT_KWH-HOURLY_KWH"},"Should be 0 — annual method and 8760 sum agree for identical inputs"]);
  }
  out.addRow(["Estimate note","","Pending program review; profile "+p.id+" v"+p.version]);

  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download=($("projname").value||"lighting_calc").replace(/\W+/g,"_")+".xlsx"; a.click();
}
