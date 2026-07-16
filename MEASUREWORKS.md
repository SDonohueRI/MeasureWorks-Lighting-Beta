# MeasureWorks — Framework Context & Design Record

**Module:** MeasureWorks Lighting (v0.1 prototype)
**Purpose of this document:** Single source of truth for what MeasureWorks is, the decisions behind it, and the conventions every future module must follow. Keep in the repo root; update it when decisions change. Written to serve both as team onboarding/reference and as context for AI-assisted development sessions.

---

## 1. What MeasureWorks is

MeasureWorks is a family of energy-savings calculators built on one shared framework, developed by a program-implementation consultancy serving utility clients across the US. Each module targets one measure technology (Lighting is first; HVAC, refrigeration, etc. may follow) and keeps a **familiar IO layout** across modules so users never relearn the tool.

**Two workflows, one engine:**
- **Vendor/rebate intake** — contractors piggybacking on utility programs want to know their incentive. Needs locked-down defaults, strong validation, defensible outputs.
- **Audit mode** — engineers working directly with customers on upgrade design. Needs flexibility, space-by-space inventory, overrides with documentation.

**Users are engineers.** The tool never blocks them — it flags. Every input carries context (definition, source, units) to reduce uncertainty, not gates.

## 2. Core architectural decisions (settled)

| Decision | Choice | Rationale |
|---|---|---|
| Deployment | Static HTML/CSS/JS, no server | Runs from GitHub Pages, intranet, or a shared drive; no IT dependency; all data stays in the user's browser |
| Multi-client support | **Program profiles**: swappable data packages, never code | CA (stringent) to Midwest (flexible) coast-to-coast; engine designed to the most demanding case, simple profiles hide complexity |
| Measure path | Custom-measure focus | Prescriptive/deemed can be layered on later |
| 8760 support | The 8760 is the fundamental calc object; annual math is either a summary of it or a simpler flat mode per profile | Xcel and similar clients require hourly output for all custom measures |
| Interactive effects | Profile-defined factors, user-toggleable, may vary by space type | Not all clients use them; Xcel varies them by building type |
| Wattage tables | Editable data, per client, versioned | Tables vary by client and update annually |
| Excel export | Live editable formulas, consistent format with the web UI | Reviewers must be able to trace and edit the math |
| Excel library | **ExcelJS** for writing (rich styling + formulas, free); SheetJS reserved for future file *imports* | SheetJS CE styling is limited |
| Governance | Profiles distributed as JSON via repo commits; localStorage used only for draft/crash recovery | One source of truth; no silently divergent assumptions across the team |

## 3. Three-layer architecture

1. **Core engine** (`engine.js`) — pure functions, no DOM. Line-item structure (existing → proposed → delta), annual and 8760 math, sanity checks, economics. Reused by future modules.
2. **Program profiles** (`profiles.js`, one file per client in production) — pure data: mode, peak window or CFs, IE factors (flat or by space type), controls factors, incentive rules, EUL, wattage-table reference, source citations. Guarded by `schemaVersion` (currently 1).
3. **Presentation** (`ui.js`, exports) — web grid and Excel outputs mirroring one canonical layout.

### Module map

```
index.html                  app shell, styles, favicon (embedded data URI)
favicon.svg                 brand icon source (see §8)
js/engine.js                calculation core (pure functions)
js/schedules.js             schedule library + 8760 generation (calendar-aware)
js/profiles.js              program profiles (data only)
js/wattage-tables.js        fixture code → watts tables (data + lookup)
js/ui.js                    grid, autocomplete, provenance, chart, save/load
js/import-paste.js          clipboard TSV/CSV import with column auto-mapping
js/settings.js              PROFILE_SCHEMA + schema-driven profile editor
js/export-excel.js          multi-tab workbook export
js/export-excel-single.js   single-sheet workbook export
```

A single-file build (all JS inlined) is generated for distribution/preview; the modular repo is the source of truth.

## 4. Calculation methods

**Line item:** existing fixture (code/watts/qty) → proposed fixture → controls → space type → HOU → cost.

**8760 mode** (`profile.mode = "8760"`):
- Schedules stored compactly as 24-hr weekday/weekend fraction-on profiles per space type; full 8760 generated on demand (calendar-aware; currently 2026, Jan 1 = Thursday).
- Controls reshape the hourly profile (occupancy scales occupied hours; daylighting reduces 9:00–16:00).
- HOU overrides scale the shape so annual hours match the override.
- Hourly savings = Σ lines (kW_exist × shape_exist − kW_prop × shape_prop), IE kW factor applied per line.
- Peak kW = average savings over the profile's peak window (months/hours/weekdays) — coincidence becomes a derived output.

**Annual mode** (`profile.mode = "annual"`):
- kWh = (kW_ex − kW_pr×(1−controlsSF)) × HOU × IE_kwh, per line.
- Peak kW = ΔkW × coincidence factor (by space type) × IE_kw, per line.

**Interactive effects:** per line via `ieFor(profile, spaceType, ieOn)` — uses `interactiveEffects.byType[spaceType]` when `variesBySpaceType` is true, else flat `kwhFactor`/`kwFactor` as fallback. Toggle default set per profile, user-overridable per project.

**Incentive:** `perKWh` or `perKW` rate, capped at `capPctOfCost × project cost`. Economics (payback) use a customer blended rate, kept separate from program assumptions.

## 5. Conventions every module must follow

- **Canonical layout** — web sections and Excel tabs share names and order: Cover/Project → Inputs → Assumptions → Calculations → (8760) → Results. Single-sheet export flows Results → Project → Assumptions → Inputs → Calculations top-down; 8760 always its own tab.
- **Provenance flags** on defaults: `DEFAULT / OVERRIDE / METERED`, click-to-cycle in UI, color-coded in exports, overrides raise a review flag.
- **Source citations everywhere** — every profile value carries a source string; missing citations are validation warnings. All current TRM values are **placeholders** and marked as such.
- **Non-blocking sanity checks** — warn (proposed ≥ existing watts, HOU > 8760, high hours for space type, 0-W unmatched fixtures, undocumented overrides, cap binding), never block.
- **Version stamping** — profile id + version + schema + mode + engine version on the footer and every export.
- **Profile versioning** — edits require a change note (stored in `changeLog`), auto-bump version (`2026.1` → `2026.1-e1`), export JSON for repo commit; "revert to shipped" always available.
- **Excel formulas live** — Calculations reference Inputs cells and named cells (`TOT_KWH`, `INC_RATE`, `INC_CAP`, `EUL`); 8760 tab is values with its basis cited in Assumptions; in 8760 mode the Calculations tab is an annual-equivalent check and says so.
- **Estimates labeled** — incentives are "estimate pending program review."

## 6. Features shipped in Lighting v0.1

Autocomplete fixture entry from the wattage table · live results panel (kWh, peak kW, incentive, payback) · weekday load-shape chart (existing vs proposed) · paste-from-spreadsheet import (TSV/CSV, header auto-detection, column mapping preview, fuzzy fixture/space-type/controls matching, auto provenance) · schema-driven profile settings editor with validation and wattage-table editing (incl. paste) · project save/load JSON + localStorage autosave · line duplicate/delete · DLC QPL lookup panel **scaffolded but not wired** (`qplLookup()` stub awaits API credentials or a QPL snapshot) · multi-tab and single-sheet Excel exports.

Deliberately rejected: incentive-tier "what-if" nudges (too speculative).

## 7. Sample profiles (placeholder values throughout)

- `xcel_mn` — 8760 mode, summer-weekday 13:00–17:00 peak window, IE **varies by space type**, $/kWh incentive capped at 60% of cost.
- `midamerican_ia` — annual mode, flat CFs by space type, IE off by default, $/kWh capped at 50%.

Target jurisdictions include PG&E/SCE (CA), MidAmerican (IA), I&M (IN/MI), LKE (KY), CenterPoint (IN/TX), Xcel (MN/CO). CA profiles will need the §9 roadmap items.

## 8. Branding

Family favicon pattern: constant blue→orange diagonal gradient (**placeholder hex** `#0072CE` → `#F58220`, base `#5b6770` — replace with official Resource Innovations brand codes) applied to a swappable technology silhouette. Lighting = bulb. Future modules swap only the path. Embedded as SVG data URI in `<head>`; `favicon.svg` is the editable source.

## 9. Roadmap (agreed order)

1. ~~Settings panel / profile schema formalization~~ ✔ done — deliberately sequenced **before** CA work so the schema contract exists first.
2. **CA / LPD phase**: extend `PROFILE_SCHEMA` with baseline mode (existing-condition vs code/LPD W/sf allowances by space type), Title 24 vintage, NTG, EUL/RUL dual-baseline; add code-baseline branch to `engine.js`; LPD allowance table editor reuses the wattage-table editor pattern.
3. Wire QPL lookup when API/snapshot is available.
4. Field-collection Excel template with recognized headers + validation dropdowns; later, SheetJS-based file upload for messy vendor workbooks.
5. Generate settings by-type IE fields and schedule space types from one source when the schedule library becomes editable.
6. Possible: deemed-vs-calculated path comparison; tracking-system CSV export mapping per profile.

## 10. Maintenance tiers (who changes what)

- **Tier 1 — no code (≈90% of changes):** value updates via the settings panel → change note → export JSON → commit to `js/profiles/`.
- **Tier 2 — data-file edits:** new profiles or entries within the existing schema, edited directly in `profiles.js` / `wattage-tables.js` (pure data; syntax errors fail loudly at load, nothing miscalculates silently).
- **Tier 3 — logic changes (rare):** engine/schema changes; requires JS competence or AI assistance. The data/logic separation exists specifically to keep this tier rare.

Distribution: GitHub Pages from `main` (note: public on standard plans — Enterprise Cloud for access-controlled Pages, or host on intranet). Protect `main`; profile changes via PR so the diff is the assumption audit trail.

## 11. Working with AI on this codebase

When resuming AI-assisted development, provide this file plus the relevant module(s). Standing instructions that reflect settled decisions:
- Keep engine functions pure (no DOM); keep profiles data-only; render editor UI from `PROFILE_SCHEMA`, never hardcode parameter forms.
- Never let a client-specific rule into `engine.js` — express it as profile data plus a generic lookup.
- Preserve the canonical IO layout, provenance flags, citation fields, and version stamps in any new feature.
- Sanity checks warn, never block.
- All new TRM-derived values enter as placeholders with a source note until confirmed against the client's TRM.
