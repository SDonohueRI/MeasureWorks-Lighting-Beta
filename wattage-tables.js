/* wattage-tables.js — fixture code → input watts lookup, per client.
   Editable data. code = shorthand engineers type; desc powers autocomplete;
   watts = total input watts incl. ballast/driver. Values below are typical
   placeholders — replace with the client's approved table. */

const WATTAGE_TABLES = {
  std_v1: {
    label: "Standard table v1 (placeholder values)",
    fixtures: [
      // Fluorescent / HID existing
      { code:"2L4FT32-T8",  desc:"2-lamp 4ft T8 32W, electronic ballast", watts:59  },
      { code:"3L4FT32-T8",  desc:"3-lamp 4ft T8 32W, electronic ballast", watts:89  },
      { code:"4L4FT32-T8",  desc:"4-lamp 4ft T8 32W, electronic ballast", watts:112 },
      { code:"2L4FT40-T12", desc:"2-lamp 4ft T12 40W, magnetic ballast",  watts:96  },
      { code:"2L8FT59-T8",  desc:"2-lamp 8ft T8 59W",                     watts:110 },
      { code:"CFL-2X26",    desc:"2x26W CFL downlight",                   watts:52  },
      { code:"MH-250",      desc:"250W metal halide + ballast",           watts:295 },
      { code:"MH-400",      desc:"400W metal halide + ballast",           watts:458 },
      { code:"HPS-250",     desc:"250W high pressure sodium + ballast",   watts:295 },
      { code:"HPS-400",     desc:"400W high pressure sodium + ballast",   watts:465 },
      { code:"INC-60",      desc:"60W incandescent A-lamp",               watts:60  },
      { code:"HAL-90",      desc:"90W halogen PAR38",                     watts:90  },
      // LED proposed
      { code:"LED-TROFFER-2X4-40", desc:"LED 2x4 troffer 40W (DLC)",      watts:40  },
      { code:"LED-TROFFER-2X4-32", desc:"LED 2x4 troffer 32W (DLC Prem)", watts:32  },
      { code:"LED-TROFFER-2X2-25", desc:"LED 2x2 troffer 25W (DLC)",      watts:25  },
      { code:"LED-TLED-2L",  desc:"2-lamp TLED retrofit 2x12.5W (Type B)",watts:25  },
      { code:"LED-HB-150",   desc:"LED high bay 150W (DLC)",              watts:150 },
      { code:"LED-HB-100",   desc:"LED high bay 100W (DLC)",              watts:100 },
      { code:"LED-WP-40",    desc:"LED wallpack 40W (DLC)",               watts:40  },
      { code:"LED-AREA-110", desc:"LED area/parking 110W (DLC)",          watts:110 },
      { code:"LED-DL-10",    desc:"LED downlight retrofit 10W",           watts:10  },
      { code:"LED-A19-9",    desc:"LED A19 lamp 9W (ES)",                 watts:9   }
    ]
  }
};

function findFixture(tableId, text){
  const t = WATTAGE_TABLES[tableId]; if(!t || !text) return null;
  const q = text.trim().toUpperCase();
  return t.fixtures.find(f => f.code === q)
      || t.fixtures.find(f => f.code.startsWith(q))
      || t.fixtures.find(f => f.desc.toUpperCase().includes(q))
      || null;
}
