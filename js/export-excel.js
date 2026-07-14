/* export-excel.js — canonical workbook: Cover, Inputs, Assumptions,
   Calculations (live formulas referencing Inputs/Assumptions), 8760 (values,
   8760 mode only), Results. Web UI sections mirror this tab order. */

async function exportExcel(){
  const p=currentProfile(), ieOn=$("ie_toggle").checked;
  const res=calcProject(LINES,p,ieOn);
  const wb=new ExcelJS.Workbook();
  wb.creator="Lighting Savings Calculator v0.1";
  const th={font:{bold:true,color:{argb:"FFFFFFFF"}},fill:{type:"pattern",pattern:"solid",fgColor:{argb:"FF1B2733"}}};
  const provFill={default:"FFE2E8EE",override:"FFF6E3CC",metered:"FFD3EAF2"};

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

  /* Inputs — same columns/order as web grid */
  const inp=wb.addWorksheet("Inputs");
  inp.columns=[{width:5},{width:22},{width:16},{width:18},{width:9},{width:7},{width:20},{width:9},{width:16},{width:8},{width:10},{width:11}];
  inp.addRow(["#","Space / location","Space type","Existing fixture","Ex W","Qty","Proposed fixture","Pr W","Controls","HOU","HOU src","Cost $"]).eachCell(c=>Object.assign(c,th));
  LINES.forEach((l,i)=>{
    const r=inp.addRow([i+1,l.space,SCHEDULES[l.spaceType].label,l.exCode,l.exW,l.qty,l.prCode,l.prW,
      CONTROL_OPTIONS.find(c=>c.id===l.control).label,l.hou,l.houProv.toUpperCase(),l.cost]);
    r.getCell(11).fill={type:"pattern",pattern:"solid",fgColor:{argb:provFill[l.houProv]}};
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
  if(p.mode==="8760") asm.addRow(["Peak demand definition","—",
    `Avg savings kW, months ${p.peakWindow.months.join("/")}, hours ${p.peakWindow.hourStart}:00–${p.peakWindow.hourEnd}:00, weekdays`]);
  else asm.addRow(["Coincidence factors","by space type",p.coincidenceFactor.source]);
  asm.addRow(["Blended rate ($/kWh, economics only)",+$("rate").value,"Customer rate — payback only, not savings"]);
  // named cells for formulas
  asm.getCell("B2").name="IE_KWH"; asm.getCell("B3").name="IE_KW";
  const incRow=4+CONTROL_OPTIONS.length-1;
  asm.getCell(`B${incRow}`).name="INC_RATE"; asm.getCell(`B${incRow+1}`).name="INC_CAP";
  asm.getCell(`B${incRow+2}`).name="EUL";

  /* Calculations — live formulas referencing Inputs & Assumptions */
  const calc=wb.addWorksheet("Calculations");
  calc.columns=[{width:5},{width:22},{width:11},{width:11},{width:10},{width:12},{width:9},{width:12},{width:12}];
  calc.addRow(["#","Space","Ex kW","Pr kW","Ctrl SF","Eff HOU","IE kWh","kWh saved","Notes"]).eachCell(c=>Object.assign(c,th));
  LINES.forEach((l,i)=>{
    const n=i+2, r=i+2; // Inputs data starts row 2
    const sf=p.controlsFactors[l.control]||0;
    const ie=ieFor(p,l.spaceType,ieOn);
    calc.addRow([
      {formula:`Inputs!A${r}`},{formula:`Inputs!B${r}`},
      {formula:`Inputs!E${r}*Inputs!F${r}/1000`},
      {formula:`Inputs!H${r}*Inputs!F${r}/1000`},
      sf,
      {formula:`Inputs!J${r}`},
      ie.kwh,
      {formula:`(C${n}*F${n}-D${n}*F${n}*(1-E${n}))*G${n}`},
      p.mode==="8760"?"Annual-equivalent check; hourly detail on 8760 tab":"" 
    ]);
  });
  const last=LINES.length+1;
  const tot=calc.addRow(["","TOTAL","","","","","",{formula:`SUM(H2:H${last})`},""]);
  tot.font={bold:true};
  calc.getCell(`H${last+1}`).name="TOT_KWH";

  /* 8760 tab (values) */
  if(p.mode==="8760"&&res.hourlySave){
    const hs=wb.addWorksheet("8760");
    hs.columns=[{width:7},{width:6},{width:12},{width:12},{width:12}];
    hs.addRow(["Day","Hour","Existing kW","Proposed kW","Savings kW"]).eachCell(c=>Object.assign(c,th));
    const rows=[];
    for(let i=0;i<8760;i++) rows.push([Math.floor(i/24)+1,i%24,
      +res.hourlyEx[i].toFixed(4),+res.hourlyPr[i].toFixed(4),+res.hourlySave[i].toFixed(4)]);
    hs.addRows(rows);
    hs.views=[{state:"frozen",ySplit:1}];
  }

  /* Results */
  const out=wb.addWorksheet("Results");
  out.columns=[{width:34},{width:18},{width:56}];
  out.addRow(["Result","Value","Basis"]).eachCell(c=>Object.assign(c,th));
  out.addRow(["Annual energy savings (kWh)",{formula:"TOT_KWH"},"Sum of line calculations (live)"]);
  out.addRow(["Peak demand savings (kW)",+res.kw.toFixed(2),
    p.mode==="8760"?"Engine value from 8760 peak window (see Assumptions)":"ΔkW × CF × IE (see Assumptions)"]);
  out.addRow(["Project cost ($)",res.cost,"Sum of line costs"]);
  out.addRow(["Incentive — calculated ($)",{formula:"TOT_KWH*INC_RATE"},p.incentive.label]);
  out.addRow(["Incentive — after cap ($)",{formula:`MIN(TOT_KWH*INC_RATE,${res.cost}*INC_CAP)`},"Lesser of calculated and cost cap"]);
  out.addRow(["Simple payback, net of incentive (yrs)",
    {formula:`(${res.cost}-MIN(TOT_KWH*INC_RATE,${res.cost}*INC_CAP))/(TOT_KWH*${+$("rate").value})`},"Customer economics at blended rate"]);
  out.addRow(["Lifetime savings (kWh)",{formula:"TOT_KWH*EUL"},"Annual × measure life"]);
  out.addRow(["Estimate note","","Pending program review; profile "+p.id+" v"+p.version]);

  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download=($("projname").value||"lighting_calc").replace(/\W+/g,"_")+".xlsx"; a.click();
}
