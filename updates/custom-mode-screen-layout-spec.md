# MeasureWorks Custom Mode Screen Layout Specification

**Repository:** `SDonohueRI/MeasureWorks-Lighting-Beta`  
**Date:** 2026-07-21  
**Status:** Proposed  
**Related context:** `MEASUREWORKS.md`, `updates/lighting-framework-expansion-scope.md`

---

## 1. Purpose

This document defines the proposed screen layout and interaction structure for **Custom Mode** in MeasureWorks Lighting.

Custom Mode is intended to be a **single-screen engineering workspace** that supports flexible lighting project modeling without forcing users through a guided wizard. It should preserve the original MeasureWorks principles of:

- static browser-based deployment
- non-blocking warnings
- engineer-oriented flexibility
- profile-driven assumptions
- traceable outputs
- compatibility with annual and 8760-oriented calculation paths

This specification focuses on layout, information architecture, and interaction behavior rather than underlying calculation logic.

---

## 2. UX goals

Custom Mode should:

- keep all major project inputs accessible in one working screen
- allow nonlinear editing of assumptions and zones
- provide real-time summary feedback while modeling
- keep high-value metrics constantly visible
- avoid splitting project types into separate calculators
- support dense engineering inputs without becoming visually overwhelming
- preserve access to deeper outputs in a dedicated review view

---

## 3. Primary page structure

Custom Mode should use a **three-region application layout**:

1. **Top project bar**
2. **Main modeling workspace**
3. **Right results sidebar**

### 3.1 High-level wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Top Project Bar                                                             │
│ Project | Profile | Calc Mode | Status | Save | Export | View Results       │
├───────────────────────────────────────────────────────┬──────────────────────┤
│ Main Modeling Workspace                               │ Results Sidebar      │
│                                                       │                      │
│ Project Defaults                                      │ kW Saved             │
│ Zone Manager                                          │ kWh Saved            │
│ Expanded Zone Editor(s)                               │ Cost Savings         │
│ Assumptions / Notes                                   │ Rebate               │
│                                                       │ Payback              │
│                                                       │ Warnings             │
│                                                       │ View Full Results    │
└───────────────────────────────────────────────────────┴──────────────────────┘
```

---

## 4. Top project bar

The top project bar should remain visible at all times while working in Custom Mode.

### 4.1 Purpose

The top bar anchors project identity, global configuration, and key actions without forcing the user away from the modeling workspace.

### 4.2 Required elements

- **Project name**
- **Program profile selector**
- **Calculation mode indicator**
  - annual
  - 8760
  - profile-driven if applicable
- **Project status / warnings summary**
- **Save / export actions**
- **View full results action**
- **Return to Existing Calculator Mode action**

### 4.3 Optional elements

- scenario name or version label
- last saved timestamp
- draft/autosave indicator
- profile/schema/engine version badge

### 4.4 Behavior

- The top bar should stay pinned while the user scrolls.
- Actions in the top bar should not interrupt editing unexpectedly.
- Warning count should be visible but non-blocking.

---

## 5. Main modeling workspace

The main workspace is the primary editing surface for Custom Mode.

### 5.1 Content areas

The workspace should contain the following major sections:

1. **Project defaults panel**
2. **Zone manager**
3. **Zone editor area**
4. **Assumptions / notes panel**

These sections should all be accessible within the same page view.

### 5.2 Layout recommendation

The main workspace should use a vertically stacked layout with strong section headers and optional collapsible panels.

This is preferable to tabs that hide too much information or force users to navigate away from active inputs.

---

## 6. Project defaults panel

This panel contains project-wide settings that reduce repetitive per-zone entry.

### 6.1 Purpose

Allow users to define defaults once and override only when necessary.

### 6.2 Recommended fields

- default schedule type
- default operating hours basis
- default electric rate
- default demand rate if supported
- default rebate assumptions or profile basis
- interactive effects toggle
- default baseline source if useful
- project-level notes

### 6.3 Interaction behavior

- Defaults should apply automatically to new zones.
- Existing zones may either inherit updated defaults or retain overrides based on explicit user action.
- Show whether each zone is inheriting or overriding a project default.

### 6.4 UI pattern

Use a collapsible card/panel labeled **Project Defaults** with a compact summary when collapsed.

Example collapsed summary:

`Schedule: Office Standard | Rate: $0.14/kWh | IE: On | Rebate: Profile Default`

---

## 7. Zone manager

The Zone Manager is the control center for all modeled spaces.

### 7.1 Purpose

Provide a quick overview of all zones and enable fast project manipulation.

### 7.2 Required actions

- add zone
- duplicate zone
- delete zone
- reorder zones
- expand/collapse zone details
- optionally group/filter zones later

### 7.3 Recommended zone summary row fields

Each zone row should display:

- zone name
- space type
- floor area
- baseline source
- baseline method
- proposed method
- controls summary
- current kW or kWh contribution
- warning indicator

### 7.4 Interaction pattern

A zone summary row should be selectable and expandable. Expanding a zone reveals its editable details inline or immediately below the row.

### 7.5 Bulk actions

Support the following where practical:

- duplicate selected zone
- apply schedule to multiple zones
- copy controls from one zone to another
- copy baseline structure
- apply defaults to selected zones

---

## 8. Zone editor

The Zone Editor is the core modeling component of Custom Mode.

Each zone should expose all major editable categories within the same screen.

### 8.1 Zone editor sections

Each zone should include the following sections:

1. Zone identity
2. Baseline
3. Proposed
4. Controls
5. Scheduling
6. Economics / overrides
7. Warnings / notes
8. Inline zone results summary

### 8.2 Recommended structure

Use collapsible subsections within each zone card. This keeps the workspace dense but manageable.

---

## 9. Zone identity section

### 9.1 Fields

- zone name
- space type
- floor area
- daylight eligible yes/no
- schedule group
- optional building/floor tag later

### 9.2 Notes

This section should remain compact and always visible near the top of the zone card.

---

## 10. Baseline section

### 10.1 Purpose

Define the comparison basis for the zone.

### 10.2 Required selectors

- baseline source
  - existing
  - code
  - custom
- baseline method
  - fixtures
  - connected load
  - LPD

### 10.3 Conditional field behavior

Fields displayed should depend on the selected baseline method.

#### A. Fixtures method
Show fields such as:
- fixture rows
- quantity
- wattage
- optional fixture description/type

#### B. Connected load method
Show fields such as:
- total connected watts or kW
- optional notes/citation

#### C. LPD method
Show fields such as:
- area
- LPD value
- code/source reference when relevant

### 10.4 UI requirements

- support adding multiple fixture rows where needed
- allow copying baseline values to proposed values when useful
- display inline summary when collapsed

Example summary:

`Baseline: Existing | Fixtures | 1.82 kW connected load`

---

## 11. Proposed section

### 11.1 Purpose

Define the design or condition being compared to the baseline.

### 11.2 Required selectors

- proposed method
  - fixtures
  - connected load
  - LPD

### 11.3 Conditional field behavior

Displayed fields should mirror the selected proposed method.

### 11.4 Optional shortcuts

- copy baseline to proposed
- inherit baseline quantities and edit only wattage
- set proposed equal to baseline for controls-only cases

### 11.5 Collapsed summary example

`Proposed: Fixtures | 1.06 kW connected load`

---

## 12. Controls section

### 12.1 Purpose

Capture post-installation control strategies and operational modifiers.

### 12.2 Recommended inputs

- occupancy control type
- vacancy control type if distinct
- daylight dimming yes/no or type
- lumen level trim percentage
- task tuning or setpoint reduction
- schedule reduction or rescheduling factor
- custom adjustment factor

### 12.3 UI pattern

Controls should be grouped by type and should clearly indicate whether they affect:
- power
- runtime
- dimming/load factor

### 12.4 Summary example

`Controls: Occupancy + Daylight + Trim 15%`

---

## 13. Scheduling section

### 13.1 Purpose

Allow users to define or override schedule behavior in the same workspace.

### 13.2 Recommended inputs

- inherited/default schedule selector
- custom annual hours override
- custom schedule reference
- 8760-linked schedule reference where applicable
- notes on schedule assumptions

### 13.3 Interaction behavior

- show when a zone is inheriting the project default schedule
- allow override without hiding the inherited value
- indicate if the schedule has implications for controls logic or 8760 mode

### 13.4 Summary example

`Schedule: Office Standard (Inherited)`

---

## 14. Economics / overrides section

### 14.1 Purpose

Support immediate financial feedback in the live sidebar while keeping cost assumptions editable.

### 14.2 Recommended inputs

- install cost
- maintenance cost adjustments later if supported
- rebate override if allowed
- simple payback notes
- custom rate override if needed

### 14.3 Behavior

These inputs should feed the live sidebar metrics in real time.

---

## 15. Warnings / notes section

### 15.1 Purpose

Keep the tool non-blocking while still surfacing engineering concerns.

### 15.2 Content

- unusual LPD values
- unusual operating hours
- missing source/citation prompts
- aggressive controls assumptions
- inconsistent baseline/proposed combinations
- user notes/documentation comments

### 15.3 UI behavior

Warnings should be visible, styled clearly, and never function as hard blockers unless a future requirement explicitly demands it.

---

## 16. Inline zone results summary

Each zone should provide a compact live result summary without requiring the user to go to the full outputs view.

### 16.1 Suggested metrics

- baseline connected load
- proposed connected load
- kW saved
- annual kWh saved
- annual cost savings
- rebate contribution if available

### 16.2 Purpose

This gives users quick local feedback while the sidebar shows project-level totals.

---

## 17. Results sidebar

The results sidebar should remain visible during editing and update in real time.

### 17.1 Primary purpose

Provide immediate decision-support metrics while the user edits the model.

### 17.2 Required metrics

- **kW saved**
- **kWh saved**
- **annual cost savings**
- **estimated rebate**
- **simple payback**

### 17.3 Secondary information

- baseline total connected load
- proposed total connected load
- warning count
- zone count
- profile name

### 17.4 Required actions

- open full results view
- export
- optionally show assumptions summary

### 17.5 Behavior

- updates should feel immediate
- layout should remain compact and scannable
- sidebar should stay pinned while the main workspace scrolls

---

## 18. Full results view

The full results should have a dedicated view separate from the main Custom Mode workspace.

### 18.1 Purpose

Avoid overloading the modeling workspace while still providing transparent and review-ready outputs.

### 18.2 Recommended contents

- project summary
- project totals
- zone-by-zone breakdowns
- baseline vs proposed comparisons
- control impacts
- economics and payback details
- rebate logic and outputs
- warnings and assumptions summary
- profile/schema/engine metadata for traceability

### 18.3 Relationship to workspace

The full results view should be reachable from:
- the top project bar
- the results sidebar

The user should be able to return to the Custom Mode workspace without losing context.

---

## 19. Responsiveness and display behavior

### 19.1 Desktop priority

Custom Mode should be optimized first for desktop/laptop use since this is an engineering workspace.

### 19.2 Smaller screens

On narrower screens:
- the results sidebar may collapse into a slide-out panel or docked bottom tray
- the zone cards should remain vertically stacked
- the top bar should preserve key actions and status visibility

### 19.3 Mobile note

Mobile should not be the primary design target for Custom Mode, though basic access may still be supported.

---

## 20. Interaction principles

### 20.1 Nonlinear editing

Users must be able to:
- move between zones freely
- change schedule after entering controls
- revise baseline after reviewing outputs
- compare zones without resetting state

### 20.2 Progressive disclosure

Use collapsible sections and conditional field reveal instead of separate pages or hidden workflow steps.

### 20.3 Repetition reduction

Support:
- duplicate zone
- copy settings
- apply-to-many behavior
- project defaults with local overrides

### 20.4 Feedback

- show live summaries as users edit
- show warnings near relevant inputs and in aggregate
- avoid interruptive modal flows for ordinary editing

---

## 21. Proposed component list

A likely first-pass component structure could include:

- `CustomModePage`
- `ProjectTopBar`
- `ProjectDefaultsPanel`
- `ZoneManager`
- `ZoneSummaryRow`
- `ZoneEditorCard`
- `BaselineSection`
- `ProposedSection`
- `ControlsSection`
- `ScheduleSection`
- `EconomicsSection`
- `WarningsSection`
- `InlineZoneResults`
- `ResultsSidebar`
- `FullResultsView`

This is not a required implementation, but it aligns with the intended screen behavior.

---

## 22. Summary recommendation

Custom Mode should be implemented as a **single-screen engineering workspace** with:

- a persistent top project bar
- a central modeling canvas for project defaults and zone editing
- a live right-hand results sidebar
- a separate full results view for detailed review and export

This layout best supports nonlinear engineering workflows, rapid scenario testing, visible assumptions, and real-time feedback while remaining aligned with the broader MeasureWorks framework direction.
