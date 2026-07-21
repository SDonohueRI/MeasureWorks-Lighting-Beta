# MeasureWorks Custom Mode Implementation Specification

**Repository:** `SDonohueRI/MeasureWorks-Lighting-Beta`  
**Date:** 2026-07-21  
**Status:** Proposed  
**Related context:** `MEASUREWORKS.md`, `updates/lighting-framework-expansion-scope.md`, `updates/custom-mode-screen-layout-spec.md`

---

## 1. Purpose

This document defines the implementation-ready requirements for adding **Custom Mode** to MeasureWorks Lighting while preserving the existing calculator mode.

It is intended to be specific enough for AI-assisted implementation and should be treated as the primary delivery spec for the next development phase.

This document covers:
- product behavior
- UI requirements
- field-level input requirements
- data model expectations
- calculation expectations
- shared framework impacts
- acceptance criteria
- phase boundaries

---

## 2. Objective

Implement a new **Custom Mode** for MeasureWorks Lighting that:

- preserves the current calculator mode and keeps it user-accessible
- adds a single-screen engineering workspace for flexible lighting project modeling
- supports multiple zones/spaces in one project
- supports multiple baseline types and input methods
- supports controls and scheduling inputs in the same workspace
- shows live project-level summary results in a sidebar
- provides a separate full-results view
- extends shared engine/profile/reference structures rather than embedding client-specific logic in the UI

---

## 3. Constraints

The implementation must respect the following constraints:

- static HTML/CSS/JS only; no backend/server work
- preserve compatibility with the existing calculator mode
- keep `engine.js` pure and client-agnostic
- keep client/program differences profile-driven where possible
- warnings must remain non-blocking
- outputs must remain traceable and reviewer-friendly
- annual-mode calculations are required in Phase 1
- 8760 compatibility must be preserved in data model and architecture even if not fully expanded in Phase 1
- do not introduce hidden state that cannot be exported or reconstructed from project data

---

## 4. Decisions already made

The following decisions are already established and should not be reopened during implementation unless explicitly directed:

1. The tool will have **two user modes**:
   - Existing Calculator Mode
   - Custom Mode
2. Custom Mode is a **single-screen workspace**, not a wizard.
3. All major custom inputs should be accessible in one working view.
4. Project modeling in Custom Mode is **zone-based**.
5. Sidebar results must update in near real time.
6. Sidebar metrics must include at minimum:
   - kW savings
   - kWh savings
   - cost savings
   - rebate
   - payback
7. Full detailed outputs should have a **separate view**.
8. Custom Mode should support multiple project pathways through a **single unified data model**, not separate advanced calculators.
9. Shared profiles and shared references should absorb global client requirements where practical.
10. Current calculator mode should remain visible and usable throughout the transition.

---

## 5. In-scope functionality for Phase 1

Phase 1 implementation must support the following:

### 5.1 Modes
- Existing Calculator Mode remains available
- Custom Mode entry point is visible and usable

### 5.2 Project modeling
- one project at a time in browser state
- multiple zones per project
- project defaults with per-zone overrides

### 5.3 Baseline support
- existing baseline
- code baseline
- custom baseline

### 5.4 Input methods
- fixture inventory input
- connected load input
- LPD input

### 5.5 Controls support
- occupancy controls
- daylight controls
- lumen level trim / high-end trim
- scheduling adjustment
- custom notes for unsupported nuance

### 5.6 Outputs
- baseline connected load
- proposed connected load
- kW savings
- annual kWh savings
- annual cost savings
- rebate
- simple payback
- zone-level summaries
- project-level totals
- warnings summary

### 5.7 Full results view
- zone-by-zone output table or equivalent
- baseline vs proposed summary
- warnings/assumptions section
- export-ready structure for future use

---

## 6. Explicitly out of scope for Phase 1

The following may be stubbed, minimally represented, or deferred:

- detailed user-authored 8760 schedule editing UI
- advanced jurisdiction-specific code libraries
- full HVAC interactive-effects detail by building subtype
- exterior-lighting-specific logic beyond generic support
- multi-scenario comparison manager
- cloud persistence or multi-user collaboration
- import workflows
- complete Excel parity redesign

If a placeholder is needed for future compatibility, prefer a data structure or UI note rather than a fake completed feature.

---

## 7. User stories

### 7.1 Existing-mode user
As a current user, I can continue using the current calculator without needing to learn the new Custom Mode immediately.

### 7.2 Custom-mode user
As an engineer, I can switch into Custom Mode and model a project with multiple spaces on one screen.

### 7.3 Flexible baseline user
As a user, I can choose whether each zone compares against existing, code, or custom baseline assumptions.

### 7.4 Flexible input user
As a user, I can describe baseline or proposed conditions using fixtures, connected load, or LPD.

### 7.5 Controls user
As a user, I can apply controls assumptions to a zone and immediately see their effect on savings metrics.

### 7.6 Review user
As a user, I can view simple real-time results while editing and open a separate detailed results view when I need a fuller breakdown.

### 7.7 Repetition-reduction user
As a user, I can duplicate zones and reuse defaults so I do not have to re-enter similar information repeatedly.

---

## 8. Screen behavior requirements

### 8.1 Mode access
- Existing Calculator Mode should remain the default or at least directly accessible.
- Custom Mode should be reachable from a visible control/button.
- Returning from Custom Mode to Existing Mode should not break the page.

### 8.2 Custom Mode layout
Custom Mode must include:
- top project bar
- main modeling workspace
- live results sidebar

### 8.3 Editing behavior
- users may edit any zone in any order
- users may change baseline method after entering data
- users may change proposed method after entering data
- users may edit controls or scheduling at any time
- calculations should recompute after relevant edits

### 8.4 Results behavior
- sidebar metrics update whenever a relevant input changes
- zone summaries update whenever a relevant input changes
- full results view reflects current workspace state

### 8.5 Warnings behavior
- warnings should appear inline and/or in summary areas
- warnings must not block calculation or editing
- warnings should be associated with the relevant zone when possible

---

## 9. Field-level input specification

This section defines the minimum Phase 1 fields that should exist in Custom Mode.

### 9.1 Project-level fields

| Field | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `project.name` | string | yes | `Untitled Project` | Editable |
| `project.profileId` | string | yes | current/default profile | Must map to profile data |
| `project.calcMode` | enum | yes | `annual` | Allow `annual`, preserve room for `8760` |
| `project.notes` | string | no | empty | Freeform |
| `project.defaults.scheduleId` | string | no | profile default if available | Inheritable |
| `project.defaults.electricRate` | number | no | profile default or blank | Used for cost savings |
| `project.defaults.demandRate` | number | no | profile default or blank | Optional Phase 1 use |
| `project.defaults.interactiveEffectsEnabled` | boolean | no | profile default | Preserve even if limited |
| `project.defaults.rebateMode` | enum/string | no | profile default | Can be display-only if profile-driven |

### 9.2 Zone-level identity fields

| Field | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `zone.id` | string | yes | generated | Stable in UI state |
| `zone.name` | string | yes | `Zone N` | Editable |
| `zone.spaceType` | string | no | blank | Should support profile/default mapping later |
| `zone.floorArea` | number | conditional | blank | Required for LPD method |
| `zone.daylightEligible` | boolean | no | false | Used by controls/warnings |
| `zone.scheduleId` | string | no | inherited | Override-capable |
| `zone.scheduleInherited` | boolean | yes | true | Explicit inheritance flag |
| `zone.notes` | string | no | empty | General zone notes |

### 9.3 Baseline fields

| Field | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `zone.baseline.source` | enum | yes | `existing` | `existing`, `code`, `custom` |
| `zone.baseline.method` | enum | yes | `fixtures` | `fixtures`, `connectedLoad`, `lpd` |
| `zone.baseline.connectedLoadKw` | number | conditional | blank | Used when method is connected load |
| `zone.baseline.lpd` | number | conditional | blank | Used when method is LPD |
| `zone.baseline.fixtureRows` | array | conditional | empty | Used when method is fixtures |
| `zone.baseline.referenceNote` | string | no | empty | Citation/source note |

### 9.4 Proposed fields

| Field | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `zone.proposed.method` | enum | yes | `fixtures` | `fixtures`, `connectedLoad`, `lpd` |
| `zone.proposed.connectedLoadKw` | number | conditional | blank | Used when method is connected load |
| `zone.proposed.lpd` | number | conditional | blank | Used when method is LPD |
| `zone.proposed.fixtureRows` | array | conditional | empty | Used when method is fixtures |
| `zone.proposed.sameAsBaseline` | boolean | no | false | Useful for controls-only cases |
| `zone.proposed.referenceNote` | string | no | empty | Documentation |

### 9.5 Fixture row fields

| Field | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `id` | string | yes | generated | Row identifier |
| `label` | string | no | empty | Fixture description |
| `quantity` | number | yes | 1 | Integer preferred |
| `inputWatts` | number | yes | blank | Watt input per fixture |

Phase 1 fixture rows may remain simple and should not require a full fixture catalog implementation.

### 9.6 Controls fields

| Field | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `zone.controls.occupancy.enabled` | boolean | no | false | |
| `zone.controls.occupancy.factor` | number | no | profile/default or blank | Represents runtime reduction factor or savings factor depending engine design |
| `zone.controls.daylight.enabled` | boolean | no | false | |
| `zone.controls.daylight.factor` | number | no | profile/default or blank | |
| `zone.controls.trim.enabled` | boolean | no | false | |
| `zone.controls.trim.percent` | number | no | 0 | Percent power reduction |
| `zone.controls.scheduling.enabled` | boolean | no | false | |
| `zone.controls.scheduling.factor` | number | no | profile/default or blank | Runtime adjustment |
| `zone.controls.customNote` | string | no | empty | Explanation of special case |

### 9.7 Economics fields

| Field | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `zone.economics.installCost` | number | no | blank | Used in payback |
| `zone.economics.rebateOverride` | number | no | blank | Optional override |
| `zone.economics.rateOverride` | number | no | blank | Optional custom energy rate |

### 9.8 Derived result fields

These should be computed, not manually entered:

- baseline connected load kW
- proposed connected load kW
- connected load delta kW
- annual kWh baseline
- annual kWh proposed
- annual kWh savings
- annual cost savings
- rebate estimate
- simple payback

---

## 10. Data model / state schema

Phase 1 should use a unified in-memory project structure that can be serialized.

### 10.1 Proposed shape

```json name=custom-mode-project-schema.json
{
  "project": {
    "name": "Untitled Project",
    "profileId": "string",
    "calcMode": "annual",
    "notes": "",
    "defaults": {
      "scheduleId": "string|null",
      "electricRate": null,
      "demandRate": null,
      "interactiveEffectsEnabled": true,
      "rebateMode": "profile"
    },
    "zones": [
      {
        "id": "zone-1",
        "name": "Zone 1",
        "spaceType": "",
        "floorArea": null,
        "daylightEligible": false,
        "scheduleId": null,
        "scheduleInherited": true,
        "notes": "",
        "baseline": {
          "source": "existing",
          "method": "fixtures",
          "connectedLoadKw": null,
          "lpd": null,
          "fixtureRows": [],
          "referenceNote": ""
        },
        "proposed": {
          "method": "fixtures",
          "connectedLoadKw": null,
          "lpd": null,
          "fixtureRows": [],
          "sameAsBaseline": false,
          "referenceNote": ""
        },
        "controls": {
          "occupancy": { "enabled": false, "factor": null },
          "daylight": { "enabled": false, "factor": null },
          "trim": { "enabled": false, "percent": 0 },
          "scheduling": { "enabled": false, "factor": null },
          "customNote": ""
        },
        "economics": {
          "installCost": null,
          "rebateOverride": null,
          "rateOverride": null
        },
        "results": {},
        "warnings": []
      }
    ],
    "results": {},
    "warnings": []
  }
}
```

### 10.2 State rules

- project defaults are separate from zone overrides
- each zone contains complete editable modeling data
- results and warnings may be stored as derived state or recomputed on demand
- the shape should remain exportable and inspectable

---

## 11. Calculation requirements

This section defines the minimum Phase 1 calculation behavior.

### 11.1 Baseline connected load
Baseline connected load must be derived as follows:

- if method = `fixtures`: sum(quantity × inputWatts) / 1000
- if method = `connectedLoad`: use entered connected load kW
- if method = `lpd`: require floor area and calculate `(lpd × area) / 1000`

### 11.2 Proposed connected load
Proposed connected load must be derived similarly:

- if method = `fixtures`: sum(quantity × inputWatts) / 1000
- if method = `connectedLoad`: use entered connected load kW
- if method = `lpd`: require floor area and calculate `(lpd × area) / 1000`
- if `sameAsBaseline = true`: proposed connected load may initialize from baseline, then controls still apply operationally

### 11.3 Control adjustments
Phase 1 must support structured control effects on proposed conditions.

Minimum expected behavior:
- trim reduces proposed connected load directly
- occupancy may reduce effective runtime or annual energy
- daylight may reduce effective runtime or annual energy
- scheduling may reduce effective runtime or annual energy

### 11.4 Control combination requirement
Do not simply add all control percentages together. Use a consistent structured combination approach, such as sequential factors applied to annual energy.

### 11.5 Annual energy calculation
At minimum for Phase 1, annual kWh should be computable from:

- baseline connected load × baseline annual hours
- proposed connected load × proposed annual hours × applicable control factors

If profile/default annual hours are not yet mature, implement a clear placeholder/default strategy rather than ambiguous hidden behavior.

### 11.6 Annual cost savings
Annual cost savings should use:
- project default electric rate
- zone rate override if present
- profile default if project value absent and profile data supports it

### 11.7 Rebate
Phase 1 rebate may be simplified but must be explicit.

Priority order:
1. zone rebate override if present
2. profile-based rebate rule if implemented and available
3. otherwise blank/zero with clear labeling

### 11.8 Simple payback
Simple payback should be computed from:
- total install cost minus rebate, divided by annual cost savings
- if annual cost savings is zero or missing, payback should be blank or flagged, not infinite text noise

### 11.9 Aggregation
Project totals must be the sum of zone-level results where applicable.

---

## 12. Warning requirements

Warnings should be generated for likely problem states such as:

- LPD selected without area
- fixtures selected with no fixture rows
- fixture row missing quantity or watts
- proposed and baseline incomplete
- controls enabled without associated factors where required
- cost/payback inputs incomplete
- schedule missing where annual energy depends on it

Warnings should be:
- visible near relevant inputs when practical
- included in zone summaries if relevant
- included in project summary/sidebar counts
- non-blocking

---

## 13. Profile and shared reference requirements

Phase 1 should not require complete profile redesign, but must leave clear extension points.

### 13.1 Minimum profile integration
Support using profile data for:
- default project profile selection
- optional default schedule
- optional default rate
- optional default control factors
- optional rebate behavior

### 13.2 Shared references to prepare for
Custom Mode should be implemented so these can grow later without major rework:
- space types
- schedule definitions
- control-factor defaults
- code/LPD references
- warning thresholds

---

## 14. Likely repository touchpoints

The exact file structure may evolve, but Phase 1 implementation will likely touch:

- `js/engine.js`
- `js/ui.js`
- `js/profiles.js`
- current HTML entry points/templates
- new JS/CSS files for custom mode layout and state management as needed
- export/results rendering files if currently separated

Implementation should prefer modular additions over making one existing file excessively large.

---

## 15. Recommended implementation order

The coding work should proceed in roughly this order:

1. preserve and isolate Existing Calculator Mode behavior
2. define Custom Mode state model and seed/default data
3. build Custom Mode page shell/layout
4. implement top project bar
5. implement zone manager
6. implement zone editor sections
7. implement baseline/proposed calculation helpers in engine
8. implement controls/economics calculations
9. implement live results sidebar aggregation
10. implement full results view
11. connect profile defaults
12. add warnings and inline summaries
13. polish copy/duplicate/apply-default interactions

---

## 16. Acceptance criteria

The feature should be considered Phase 1 complete when all of the following are true:

### 16.1 Existing-mode safety
- Existing Calculator Mode still loads and is usable.
- Adding Custom Mode does not remove or break current primary functionality.

### 16.2 Custom Mode access
- A user can open Custom Mode from the app UI.
- A user can return from Custom Mode without crashing the app.

### 16.3 Project editing
- A user can create a project and edit project-level defaults.
- A user can add at least three zones.
- A user can duplicate and delete zones.

### 16.4 Baseline and proposed input support
- A user can model a zone using fixtures.
- A user can model a zone using connected load.
- A user can model a zone using LPD.
- A user can choose existing, code, or custom baseline source.

### 16.5 Controls support
- A user can enable occupancy, daylight, trim, and scheduling controls.
- Changing a control input updates zone/project results.

### 16.6 Live results
- The sidebar shows kW, kWh, cost savings, rebate, and payback.
- Sidebar values update after relevant edits without requiring manual refresh.

### 16.7 Full results
- A user can open a full results view.
- The full results view displays zone-level and project-level information.

### 16.8 Warning behavior
- Missing or incomplete zone inputs surface warnings.
- Warnings do not block editing or calculation.

### 16.9 State integrity
- The Custom Mode project state can be represented by one coherent object model.
- Calculated values derive from user-entered state rather than hidden UI-only values.

---

## 17. Example project scenarios

These examples should be used as implementation sanity checks.

### 17.1 Fixture replacement retrofit
- baseline source: existing
- baseline method: fixtures
- proposed method: fixtures
- controls: none

Expected behavior:
- connected load calculated from fixture rows
- savings derived from baseline vs proposed load

### 17.2 Controls-only office upgrade
- baseline source: existing
- baseline method: fixtures
- proposed same as baseline
- controls: occupancy + scheduling + trim

Expected behavior:
- proposed connected load may start from baseline
- trim changes connected load effect
- occupancy/scheduling affect annual energy

### 17.3 New construction classroom
- baseline source: code
- baseline method: LPD
- proposed method: fixtures
- controls: daylight + occupancy

Expected behavior:
- baseline load derived from LPD × area
- proposed load derived from fixture rows
- controls affect proposed annual energy

### 17.4 Remodel with custom baseline
- baseline source: custom
- baseline method: connected load
- proposed method: LPD
- controls: trim

Expected behavior:
- baseline load uses entered kW
- proposed load uses area × LPD
- trim reduces proposed energy or connected load per chosen logic

---

## 18. Summary recommendation

This implementation spec should be used as the direct foundation for AI-authored development work on Custom Mode.

The Phase 1 goal is not to solve every future edge case. The goal is to implement a stable, extensible, framework-aligned Custom Mode with:
- a single-screen modeling workspace
- multiple zones
- baseline/proposed flexibility
- controls and scheduling inputs
- live sidebar metrics
- a separate full-results view
- shared engine/profile-aware structure suitable for further iteration
