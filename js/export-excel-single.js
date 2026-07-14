/* export-excel-single.js — single-sheet workbook variant.
   Section flow, top-down: RESULTS → COVER → ASSUMPTIONS → INPUTS →
   CALCULATIONS. Same live-formula approach as the multi-tab export; formulas
   use named cells (TOT_KWH, INC_RATE, INC_CAP, EUL) so section order doesn't
   matter. In 8760 mode the hourly detail still lands on its own "8760" tab —
   8,760 rows inlined would bury the report — with a pointer note in Results. */

async function exportExcelSingle(){
  const p=currentProfile(), ieOn=$("ie_toggle").checked;
  const res=calcProject(LINES,p,ieOn);
  const wb=new ExcelJS.Workbook();
  wb.creator="Lighting Savings Calculator v0.1";
  const ws=wb.addWorksheet("Calc", {views:[{showGridLines:true}]});
  ws.columns=[{width:5},{width:26},{width:16},{width:18},{width:9},{width:8},{width:20},{width:9},{width:16},{width:9},{width:10},{width:12},{width:60}];

  const sectionStyle={font:{bold:true,size:12,color:{argb:"FFFFFFFF"}},fill:{type:"pattern",pattern:"solid",fgColor:{argb:"FF1B2733"}}};
  const subhead={font:{bold:true,color:{argb:"FF37424D"}},fill:{type:"pattern",pattern:"solid",fgColor:{argb:"FFE2E8EE"}}};
  const provFill={default:"FFE2E8EE",override:"FFF6E3CC",metered:"FFD3EAF2"};
  let r=1;

  function section(title){
    const row=ws.getRow(r);
    row.getCell(1).value=title;
    ws.mergeCells(r,1,r,13);
    Object.assign(row.getCell(1),sectionStyle);
    r++;
  }
  function head(cells){
    const row=ws.getRow(r);
    cells.forEach((c,i)=>{ row.getCell(i+1).value=c; Object.assign(row.getCell(i+1),subhead); });
    r++;
  }
  function line(cells,opts){
    const row=ws.getRow(r);
    cells.forEach((c,i)=>{ if(c!==undefined&&c!==null) row.getCell(i+1).value=c; });
    if(opts&&opts.bold) row.font={bold:true};
    r++;
    return row;
  }
  function gap(){ r++; }

  /* ---- RESULTS ---- */
  section("RESULTS");
  head(["","Result","Value","","Basis"]);
  const put=(label,val,basis)=>{ const row=line(["",label,val]); row.getCell(5).value=basis; };
  put("Annual energy savings (kWh)",{formula:"TOT_KWH"},"Sum of line calculations (live — see CALCULATIONS below)");
  put("Peak demand savings (kW)",+res.kw.toFixed(2),
      p.mode==="8760"?"Engine value from 8760 peak window (see ASSUMPTIONS)":"ΔkW × CF × IE per line (see ASSUMPTIONS)");
  put("Project cost ($)",res.cost,"Sum of line costs");
  put("Incentive — calculated ($)",{formula:"TOT_KWH*INC_RATE"},p.incentive.label);
  put("Incentive — after cap ($)",{formula:`MIN(TOT_KWH*INC_RATE,${res.cost}*INC_CAP)`},"Lesser of calculated and cost cap");
  put("Simple payback, net (yrs)",{formula:`(${res.cost}-MIN(TOT_KWH*INC_RATE,${res.cost}*INC_CAP))/(TOT_KWH*${+$("rate").value})`},"Customer economics at blended rate");
  put("Lifetime savings (kWh)",{formula:"TOT_KWH*EUL"},"Annual × measure life");
  if(p.mode==="8760") put("Hourly detail","see 8760 tab","Full 8,760-hour existing/proposed/savings kW");
  put("Estimate note","","Pending program review · profile "+p.id+" v"+p.version);
  gap();

  /* ---- COVER / PROJECT ---- */
  section("PROJECT");
  [["Project",$("projname").value],
   ["Program profile",p.label],
   ["Profile version",p.version+" (schema "+p.schemaVersion+")"],
   ["Calculation mode",p.mode],
   ["Interactive effects",ieOn?(p.interactiveEffects.variesBySpaceType?"Applied — varies by space type (see ASSUMPTIONS)":`Applied (kWh ×${p.interactiveEffects.kwhFactor}, kW ×${p.interactiveEffects.kwFactor})`):"Not applied"],
   ["Exported",new Date().toISOString()],
   ["Tool","Lighting Savings Calculator — framework prototype v0.1"]
  ].forEach(([a,b])=>{ const row=line(["",a,b]); row.getCell(2).font={bold:true}; });
  gap();

  /* ---- ASSUMPTIONS ---- */
  section("ASSUMPTIONS");
  head(["","Assumption","Value","","Source / note"]);
  const asm=(label,val,src,name)=>{
    const row=line(["",label,val]); row.getCell(5).value=src;
    if(name) row.getCell(3).name=name;
  };
  asm("Interactive effects — kWh (flat/fallback)",ieOn?p.interactiveEffects.kwhFactor:1,p.interactiveEffects.source);
  asm("Interactive effects — kW (flat/fallback)",ieOn?p.interactiveEffects.kwFactor:1,p.interactiveEffects.source);
  if(ieOn && p.interactiveEffects.variesBySpaceType && p.interactiveEffects.byType){
    for(const st in p.interactiveEffects.byType){
      const v=p.interactiveEffects.byType[st];
      asm(`IE by space type — ${SCHEDULES[st]?SCHEDULES[st].label:st}`,`kWh ×${v.kwh} / kW ×${v.kw}`,p.interactiveEffects.source);
    }
  }
  CONTROL_OPTIONS.filter(c=>c.id!=="none").forEach(c=>
    asm(`Controls factor — ${c.label}`,p.controlsFactors[c.id],p.controlsFactors.source));
  asm("Incentive rate",p.incentive.rate,p.incentive.label+" — "+p.incentive.source,"INC_RATE");
  asm("Incentive cap (fraction of cost)",p.incentive.capPctOfCost??1,p.incentive.label,"INC_CAP");
  asm("Measure life (yrs)",p.measureLifeYrs,"Profile EUL","EUL");
  asm("Hours-of-use basis","—",p.houSource);
  if(p.mode==="8760") asm("Peak demand definition","—",
    `Avg savings kW, months ${p.peakWindow.months.join("/")}, hours ${p.peakWindow.hourStart}:00–${p.peakWindow.hourEnd}:00, weekdays`);
  else asm("Coincidence factors","by space type",p.coincidenceFactor.source);
  asm("Blended rate ($/kWh, economics only)",+$("rate").value,"Customer rate — payback only, not savings");
  gap();

  /* ---- INPUTS ---- */
  section("INPUTS");
  head(["#","Space / location","Space type","Existing fixture","Ex W","Qty","Proposed fixture","Pr W","Controls","HOU","HOU src","Cost $"]);
  const inputsStart=r;
  LINES.forEach((l,i)=>{
    const row=line([i+1,l.space,SCHEDULES[l.spaceType].label,l.exCode,l.exW,l.qty,l.prCode,l.prW,
      CONTROL_OPTIONS.find(c=>c.id===l.control).label,l.hou,l.houProv.toUpperCase(),l.cost]);
    row.getCell(11).fill={type:"pattern",pattern:"solid",fgColor:{argb:provFill[l.houProv]}};
  });
  gap();

  /* ---- CALCULATIONS ---- */
  section("CALCULATIONS");
  head(["#","Space","Ex kW","Pr kW","Ctrl SF","Eff HOU","IE kWh","kWh saved","","Notes"]);
  const calcStart=r;
  LINES.forEach((l,i)=>{
    const ir=inputsStart+i, n=r;
    const ie=ieFor(p,l.spaceType,ieOn);
    const row=line([
      {formula:`A${ir}`},{formula:`B${ir}`},
      {formula:`E${ir}*F${ir}/1000`},
      {formula:`H${ir}*F${ir}/1000`},
      p.controlsFactors[l.control]||0,
      {formula:`J${ir}`},
      ie.kwh,
      {formula:`(C${n}*F${n}-D${n}*F${n}*(1-E${n}))*G${n}`}
    ]);
    row.getCell(10).value = p.mode==="8760"?"Annual-equivalent check; hourly detail on 8760 tab":"";
  });
  const totRow=line(["","TOTAL","","","","","",{formula:`SUM(H${calcStart}:H${calcStart+LINES.length-1})`}],{bold:true});
  totRow.getCell(8).name="TOT_KWH";

  /* ---- 8760 tab (values) ---- */
  if(p.mode==="8760"&&res.hourlySave){
    const hs=wb.addWorksheet("8760");
    hs.columns=[{width:7},{width:6},{width:12},{width:12},{width:12}];
    const th={font:{bold:true,color:{argb:"FFFFFFFF"}},fill:{type:"pattern",pattern:"solid",fgColor:{argb:"FF1B2733"}}};
    hs.addRow(["Day","Hour","Existing kW","Proposed kW","Savings kW"]).eachCell(c=>Object.assign(c,th));
    const rows=[];
    for(let i=0;i<8760;i++) rows.push([Math.floor(i/24)+1,i%24,
      +res.hourlyEx[i].toFixed(4),+res.hourlyPr[i].toFixed(4),+res.hourlySave[i].toFixed(4)]);
    hs.addRows(rows);
    hs.views=[{state:"frozen",ySplit:1}];
  }

  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download=($("projname").value||"lighting_calc").replace(/\W+/g,"_")+"_onesheet.xlsx"; a.click();
}
