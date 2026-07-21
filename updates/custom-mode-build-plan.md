# MeasureWorks Custom Mode Build Plan

**Repository:** `SDonohueRI/MeasureWorks-Lighting-Beta`  
**Date:** 2026-07-21  
**Status:** Proposed  
**Related context:** `MEASUREWORKS.md`, `updates/lighting-framework-expansion-scope.md`, `updates/custom-mode-screen-layout-spec.md`, `updates/custom-mode-implementation-spec.md`

---

## 1. Purpose

This document translates the Custom Mode scope and implementation spec into a sequenced engineering plan suitable for AI-authored development.

The goal is to break the work into discrete tasks that:
- preserve the existing calculator mode
- reduce implementation ambiguity
- encourage modular code changes
- support iterative validation
- make it easier to review AI-generated changes in smaller pieces

---

## 2. Delivery target

Phase 1 delivery should add a working **Custom Mode** to MeasureWorks Lighting with:

- Existing Calculator Mode preserved
- a visible entry point into Custom Mode
- single-screen custom workspace
- zone-based project modeling
- baseline/proposed/controls/scheduling inputs
- live results sidebar
- separate full-results view
- minimal but coherent shared-engine expansion

---

## 3. Implementation strategy

The work should be sequenced so that application structure and shared state are stabilized before detailed UI and calculation behaviors are layered on.

### Recommended order of work

1. protect and preserve existing behavior
2. define shared state model for Custom Mode
3. build Custom Mode shell and routing/display toggle
4. implement zone/project editing UI
5. implement engine support for baseline/proposed calculations
6. implement controls/economics aggregation
7. implement live sidebar and full results view
8. integrate profile defaults and warnings
9. polish UX interactions and regression-check existing mode

This order is intentional and should be followed unless implementation realities require small adjustments.

---

## 4. Workstream overview

The work is organized into five practical workstreams:

1. **Mode integration and app structure**
2. **Custom Mode state and data model**
3. **UI workspace implementation**
4. **Engine and calculation support**
5. **Results, warnings, and regression validation**

---

## 5. Workstream 1 — Mode integration and app structure

### Goal
Add Custom Mode without breaking the current calculator.

### Tasks

#### 1.1 Identify current app entry and rendering flow
- locate current HTML entry points
- identify where current calculator UI is assembled
- identify where a mode switch can be introduced with minimal disruption

#### 1.2 Preserve Existing Calculator Mode explicitly
- isolate current calculator rendering path
- avoid tightly coupling new Custom Mode UI into current calculator logic
- ensure existing mode remains callable independently

#### 1.3 Add mode switching mechanism
- create app-level mode state
- add a visible button/control to switch into Custom Mode
- add a visible control to return to Existing Calculator Mode
- ensure switching modes does not cause fatal UI reset or broken state

#### 1.4 Establish layout containers
- add structural containers for:
  - top project bar
  - main workspace
  - right sidebar
  - full results view

### Deliverables
- visible Custom Mode entry point
- mode switching works without app failure
- existing calculator still loads

### Acceptance checks
- current calculator still renders
- custom mode can open
- user can switch back successfully

---

## 6. Workstream 2 — Custom Mode state and data model

### Goal
Create a stable project state structure before building deep UI behavior.

### Tasks

#### 2.1 Define project state factory
- create a default Custom Mode project object
- include project metadata, defaults, zones, results, warnings

#### 2.2 Define zone state factory
- create a default zone object
- include baseline, proposed, controls, economics, notes, results, warnings

#### 2.3 Implement state mutation helpers
- add zone
- duplicate zone
- delete zone
- update project field
- update zone field
- toggle inherited/override values

#### 2.4 Ensure serializable state
- avoid circular references
- keep state exportable/debuggable
- keep results as derived or clearly recomputable values

### Deliverables
- one coherent in-memory project model
- reusable helpers for project and zone operations

### Acceptance checks
- a new Custom Mode session initializes valid default state
- adding, duplicating, and deleting zones updates state correctly
- state can be inspected in a consistent object shape

---

## 7. Workstream 3 — UI workspace implementation

### Goal
Build the single-screen Custom Mode workspace around the shared state model.

### Tasks

#### 3.1 Build top project bar
Implement:
- project name field
- profile selector
- calc mode display/selector
- warning/status indicator
- view full results action
- return to existing mode action

#### 3.2 Build project defaults panel
Implement editable fields for:
- default schedule
- electric rate
- demand rate if exposed
- interactive effects toggle
- notes or compact project settings

#### 3.3 Build zone manager
Implement:
- zone list/summary rows
- add zone
- duplicate zone
- delete zone
- expand/collapse zone editor

#### 3.4 Build zone editor shell
Each zone editor should include sections for:
- identity
- baseline
- proposed
- controls
- scheduling
- economics
- warnings/notes
- inline results summary

#### 3.5 Build conditional field behavior
Show/hide relevant inputs depending on:
- baseline method
- proposed method
- controls enabled
- inherited vs overridden schedule/rate/default values

#### 3.6 Build inline summaries
Collapsed sections should present useful summaries so the page remains scannable.

### Deliverables
- working single-screen workspace
- editable project and zone structure
- zone cards with major sections visible

### Acceptance checks
- user can enter project defaults
- user can add multiple zones and edit each section
- field reveal logic matches input choices

---

## 8. Workstream 4 — Engine and calculation support

### Goal
Provide the minimum Phase 1 calculations needed for real-time results.

### Tasks

#### 4.1 Audit current engine capabilities
- identify current existing/proposed calculation helpers
- determine what can be reused
- isolate calculator-specific logic that should remain in existing mode only

#### 4.2 Implement baseline load derivation helpers
Support:
- fixtures → connected load
- connected load direct input
- LPD × area → connected load

#### 4.3 Implement proposed load derivation helpers
Support:
- fixtures → connected load
- connected load direct input
- LPD × area → connected load
- same-as-baseline support for controls-only scenarios

#### 4.4 Implement annual energy helpers
At minimum support:
- baseline annual kWh
- proposed annual kWh
- annual kWh savings

Use explicit default-hour logic and avoid hidden assumptions.

#### 4.5 Implement control adjustment helpers
Support Phase 1 logic for:
- trim
- occupancy
- daylight
- scheduling

Controls should be combined using consistent structured logic, not simple additive savings.

#### 4.6 Implement economics helpers
Support:
- cost savings
- rebate estimate or placeholder rule
- simple payback

#### 4.7 Implement project aggregation helpers
Aggregate zone-level outputs into project totals for:
- baseline load
- proposed load
- kW savings
- kWh savings
- annual cost savings
- rebate
- payback inputs/totals as appropriate

### Deliverables
- reusable engine helpers for Custom Mode calculations
- project-level aggregate result object

### Acceptance checks
- fixture, connected-load, and LPD zones all calculate coherent loads
- controls affect results in expected directions
- aggregated project totals reflect zone totals

---

## 9. Workstream 5 — Results, warnings, and regression validation

### Goal
Provide transparent outputs while protecting existing behavior.

### Tasks

#### 5.1 Build live results sidebar
Display at minimum:
- kW savings
- kWh savings
- annual cost savings
- rebate
- payback
- warning count
- zone count

#### 5.2 Build inline zone results summaries
Display compact zone-level outputs in each zone card.

#### 5.3 Build full results view
Implement a separate detailed view containing:
- project totals
- zone-level breakdowns
- baseline vs proposed values
- controls/economics summaries
- warnings and notes

#### 5.4 Implement warning generation
Generate warnings for:
- missing required data for chosen input path
- incomplete fixture rows
- LPD without area
- controls enabled without usable values where needed
- payback inputs incomplete
- schedule-dependent calculations missing schedule info

#### 5.5 Regression-check Existing Calculator Mode
- confirm legacy flow still loads
- confirm no critical errors introduced by Custom Mode scripts
- confirm current UI remains accessible

### Deliverables
- real-time sidebar
- full results view
- warning system
- existing mode regression confidence

### Acceptance checks
- editing a relevant value updates sidebar outputs
- full results view reflects current state
- warnings appear but do not block editing
- existing mode still functions after integration

---

## 10. Suggested file/task breakdown

This section is intentionally approximate and should be adapted to the repo structure discovered during implementation.

### Likely files to inspect/update
- `index.html` or current HTML entry file(s)
- `js/ui.js`
- `js/engine.js`
- `js/profiles.js`
- supporting CSS files

### Likely new files to add
- `js/customModeState.js`
- `js/customModeUI.js`
- `js/customModeResults.js`
- `js/customModeWarnings.js`
- `css/customMode.css`

If the current repo uses a different structure, preserve existing conventions rather than forcing these exact filenames.

---

## 11. AI execution guidance

To improve outcomes from AI-authored coding work, implementation should preferably happen in smaller reviewable increments rather than one large monolithic change.

### Recommended AI task slicing

#### Task A — App structure and mode switching
Goal:
- add Custom Mode shell without deep calculations

#### Task B — State model and zone CRUD
Goal:
- implement project/zone state object and editing helpers

#### Task C — Workspace UI sections
Goal:
- render project defaults, zone manager, and editable zone sections

#### Task D — Engine calculation helpers
Goal:
- baseline/proposed load, annual energy, controls, cost, rebate, payback

#### Task E — Sidebar and full results view
Goal:
- wire live outputs and detailed outputs view

#### Task F — Warnings and polish
Goal:
- add warnings, summaries, inheritance indicators, cleanup

This slicing is likely to produce better AI results than asking for the entire feature in one pass.

---

## 12. Phase 1 milestone checklist

The build should be considered Phase 1 implementation-ready when the following items are all complete:

- [ ] Existing Calculator Mode still works
- [ ] Custom Mode entry exists
- [ ] Custom Mode layout shell exists
- [ ] Project state model implemented
- [ ] Zone CRUD implemented
- [ ] Baseline methods implemented
- [ ] Proposed methods implemented
- [ ] Controls implemented at Phase 1 level
- [ ] Sidebar metrics implemented
- [ ] Full results view implemented
- [ ] Warning generation implemented
- [ ] Basic profile defaults connected
- [ ] Manual regression review completed for existing mode

---

## 13. Manual validation plan

The following manual checks should be run after implementation.

### Scenario 1 — Fixture replacement
- add one zone
- baseline = fixtures
- proposed = fixtures
- verify connected load changes correctly
- verify sidebar totals update

### Scenario 2 — Controls only
- add one zone
- baseline = fixtures
- proposed same as baseline
- add trim + occupancy + scheduling
- verify energy changes without invalid app behavior

### Scenario 3 — Code baseline LPD
- add one zone
- baseline = code LPD
- proposed = fixtures
- verify area-based baseline load calculation

### Scenario 4 — Multi-zone aggregation
- add three zones using different input methods
- verify project totals equal sum of zone results

### Scenario 5 — Missing data warnings
- create incomplete fixture row
- choose LPD without area
- verify warnings appear and editing remains possible

### Scenario 6 — Existing mode regression
- return to existing calculator
- confirm current flow still renders and behaves normally

---

## 14. Risks and mitigation

### Risk 1 — Custom Mode grows too large in one change
**Mitigation:** implement in sequenced slices with review points.

### Risk 2 — Existing calculator behavior is accidentally broken
**Mitigation:** preserve explicit existing-mode path and regression-test after each major step.

### Risk 3 — Calculation logic becomes too UI-coupled
**Mitigation:** place reusable math and derivations in engine/helpers, not DOM logic.

### Risk 4 — One-screen UX becomes visually overwhelming
**Mitigation:** use collapsible sections, inline summaries, and defaults with overrides.

### Risk 5 — Profile integration causes early complexity explosion
**Mitigation:** support minimal profile defaults first, keep extension points clear, defer full profile expansion details.

---

## 15. Recommended next action for AI coding

The first AI coding task should be:

> Add Custom Mode application structure and state scaffolding while preserving Existing Calculator Mode.

That first task should include:
- mode switch UI
- Custom Mode shell layout
- default project state
- zone add/duplicate/delete helpers
- placeholder sidebar and workspace sections

This is the best first cut because it establishes the structure the rest of the implementation will rely on.

---

## 16. Summary recommendation

This build plan should be used as the execution roadmap for AI-authored development.

The work should proceed in sequenced layers:
- protect existing mode
- define Custom Mode state
- build workspace UI
- add engine calculations
- add live results and warnings
- validate and polish

This approach gives the highest chance of producing maintainable, reviewable code with minimal regression risk.
