# MeasureWorks Lighting Expansion Scope Proposal

**Repository:** `SDonohueRI/MeasureWorks-Lighting-Beta`  
**Date:** 2026-07-20  
**Status:** Proposed  
**Related context:** `MEASUREWORKS.md`

---

## 1. Purpose

This document proposes the next major scope expansion for the MeasureWorks Lighting module. The goal is to preserve the existing calculator workflow while extending the shared MeasureWorks framework to support more complex lighting project types, more flexible baseline methods, and broader client/program requirements.

This proposal is intentionally aligned to the architecture and governance established in `MEASUREWORKS.md`:

- Keep the application deployable as static HTML/CSS/JS with no server dependency.
- Preserve the shared-framework approach across future measure modules.
- Keep `engine.js` pure and client-agnostic.
- Express client/program requirements through profiles and shared data references where possible.
- Preserve the warnings-not-blocking philosophy for engineer users.
- Maintain support for annual and 8760-oriented calculation pathways.
- Preserve traceable outputs, including export-ready logic.

---

## 2. Current state

The current Lighting module is scoped around a simpler lighting upgrade calculator workflow appropriate for early prototype and direct replacement use cases. That workflow remains valuable and should continue to exist.

However, current and anticipated client needs extend beyond fixture-for-fixture replacement and require support for:

- full remodels and redesigns
- LPD-based calculations
- existing, code, and custom baseline methods
- new construction comparisons
- controls-only projects
- combined fixture and controls projects
- broader profile-driven requirements with global framework impact

The next phase should therefore expand the Lighting module within the existing MeasureWorks framework rather than replacing the current tool with an entirely new product concept.

---

## 3. Strategic direction

MeasureWorks Lighting should evolve into a **dual-mode module** built on the shared MeasureWorks framework.

### 3.1 Existing Calculator Mode

The current calculator experience should remain available for users who need a fast and familiar workflow.

Goals:
- preserve the existing user path
- minimize retraining for current users
- maintain quick-entry support for straightforward lighting replacement scenarios
- maintain result continuity during framework transition

### 3.2 Advanced Project Mode

A new framework-based mode should be added to support more flexible, project-oriented modeling.

Goals:
- support engineering-grade project development
- support a broader set of project and baseline types
- support controls modeling beyond simple replacement
- support client/program variability using shared profile-driven logic
- prepare the Lighting module for deeper reuse of shared framework components

### 3.3 Mode transition requirement

The user should be able to start in the existing calculator and explicitly switch to the new framework mode using a visible UI control such as:

- `Switch to Advanced Project Mode`
- `Open Advanced Project Workflow`

This preserves continuity while introducing the expanded framework on the user's terms.

---

## 4. Expanded functional scope

The advanced framework mode should support the following lighting project pathways.

### 4.1 Fixture replacement
- one-for-one replacements
- grouped replacement measures
- direct existing-to-proposed wattage comparisons

### 4.2 Fixture plus controls retrofits
- fixture replacements with occupancy controls
- fixture replacements with daylight dimming
- fixture replacements with lumen level controls / high-end trim
- fixture replacements with scheduling or rescheduling adjustments

### 4.3 Controls-only upgrades
- occupancy/vacancy sensing
- daylight dimming
- scheduling / rescheduling
- lumen level controls / high-end trim
- task tuning or similar setpoint reductions

### 4.4 Remodel / redesign projects
- existing versus redesigned lighting layouts
- space-by-space or zone-by-zone connected load comparisons
- support for non-trivial redesign beyond direct replacement

### 4.5 LPD-based projects
- existing LPD baseline
- code LPD baseline
- custom LPD baseline
- proposed LPD design

### 4.6 New construction
- code-baseline comparison
- target-baseline comparison where supported by profile/program rules
- proposed design modeled by fixture inventory, connected load, or LPD

### 4.7 Mixed-method projects
- support projects where some spaces are modeled by fixtures and others by connected load or LPD
- support controls applied selectively by space or project segment

---

## 5. Baseline framework expansion

The expanded engine should support multiple baseline methods as first-class concepts.

### 5.1 Existing conditions baseline
Use when projects are evaluated against actual installed lighting.

Examples:
- retrofit fixture replacement
- controls added to an existing system
- redesigns compared to current conditions

### 5.2 Code baseline
Use when projects must be evaluated against code-minimum or program-defined standard practice.

Examples:
- major remodel
- gut renovation
- additions
- new construction
- utility custom measure baselines where code is required

### 5.3 Custom baseline
Use when profile rules, engineering judgment, or special conditions require a user-defined baseline.

Examples:
- negotiated custom measure assumptions
- unusual occupancy/use cases
- profile-specific exceptions

### 5.4 Requirement
The user should explicitly select a baseline source in advanced mode:

- Existing
- Code
- Custom

This selection should drive available inputs, defaults, warnings, and reporting labels.

---

## 6. Controls modeling scope

The next version should move beyond treating controls as simple add-on percentages and instead support structured controls logic.

### 6.1 Controls to support
- occupancy controls
- vacancy controls
- daylight dimming
- stepped or continuous dimming where needed later
- lumen level controls / high-end trim
- scheduling / rescheduling
- task tuning or setpoint reduction

### 6.2 Modeling requirements
Controls should be represented so the engine can distinguish between:
- installed power reduction
- effective runtime reduction
- dimming/load-factor reduction
- optional interactive effect implications

### 6.3 Calculation requirement
Controls should not be modeled as naive additive savings percentages. The engine should use a defined order of operations or equivalent structured combination logic to avoid overstating savings.

---

## 7. Shared engine expansion

The MeasureWorks shared engine should be expanded rather than bypassed.

### 7.1 Existing principles to preserve
- pure calculation functions in `engine.js`
- line-item orientation of existing → proposed → delta
- annual and 8760-compatible logic
- sanity checks
- economics support
- export-ready result structure

### 7.2 New engine capabilities
The engine should be enhanced to support:

#### A. Baseline abstraction
- existing baseline objects
- code baseline objects
- custom baseline objects

#### B. Multiple input methods
- fixture inventory
- connected load totals
- LPD inputs
- profile-driven default references

#### C. Zone/space modeling
- multiple spaces/zones per project
- repeat/copy structures for similar spaces
- zone-level results with project-level rollup

#### D. Structured controls layers
- occupancy-based adjustments
- daylight adjustments
- trim reductions
- scheduling adjustments
- future extensibility for more control categories

#### E. Shared result model
Outputs should be structured so they can support:
- current UI summaries
- future advanced UI summaries
- Excel export
- profile-driven reporting requirements

#### F. Framework extensibility
The updated engine patterns should be usable by future MeasureWorks modules beyond lighting where appropriate.

---

## 8. Shared framework and reference updates

Client requirements often have global impact and should be reflected in shared framework components where possible.

### 8.1 Program profiles
Profiles should expand beyond basic incentive and demand settings to support broader calculation behavior and assumptions.

Proposed profile expansion areas include:
- allowed or preferred baseline types
- annual versus 8760 mode requirements
- code baseline references or configuration
- controls default assumptions
- space-type-specific control factors
- interactive effects defaults and by-type variants
- demand method definitions
- result labels, disclaimers, and export stamps
- default schedules or schedule references
- profile-specific warning guidance

### 8.2 Shared assumptions/references
The framework should define or expand reusable references for:
- space types
- operating schedules
- controls default assumptions
- LPD/code references
- building/space-type mappings
- warning thresholds and reasonability checks
- documentation/citation metadata

### 8.3 Schema and versioning
Shared structures should remain versioned and traceable.

This likely includes versioned handling for:
- profile schema
- schedule/reference schema
- control definition structures
- baseline definition structures
- result metadata structures

### 8.4 Governance requirement
Where a client requirement affects core assumptions, structure, or reporting behavior across the framework, the update should be implemented in shared references, shared schema, or profiles rather than ad hoc lighting-only logic unless there is a clear reason not to.

---

## 9. User experience scope

The expanded framework should remain easy to use while exposing deeper flexibility when needed.

### 9.1 Existing mode UX
The current calculator workflow should remain available with minimal disruption.

### 9.2 Advanced mode UX
The new mode should use a guided workflow rather than one oversized form.

Suggested major sections:
1. Project setup
2. Profile and baseline selection
3. Space/zone definition
4. Baseline lighting input
5. Proposed lighting input
6. Controls configuration
7. Results and assumptions review
8. Export

### 9.3 Simplicity requirement
Advanced mode should still favor usability through:
- defaults where appropriate
- clear labels and definitions
- repeatable space templates/copy behavior
- visible warnings instead of hard blocking
- expandable advanced settings instead of overwhelming first-pass entry

---

## 10. Backward compatibility and migration

The current lighting calculator should be preserved as an active supported mode, not treated as obsolete upon release of the expanded framework.

### 10.1 Compatibility goals
- preserve the current workflow
- preserve confidence for existing users
- avoid breaking existing use cases
- maintain output comparability where current logic is still applicable

### 10.2 Migration approach
Recommended phased approach:
1. preserve current mode as-is in the UI
2. add explicit transition into advanced mode
3. expand engine abstractions and shared references
4. align current mode to the updated engine over time where feasible
5. maintain parity checks for current scenarios during migration

---

## 11. Reporting and output implications

The expanded framework should continue to support traceable and review-friendly outputs.

Outputs should clearly communicate:
- project mode
- baseline source
- profile used
- major control assumptions
- annual versus 8760 calculation path
- warnings and engineering notes
- version stamps for profile/schema/engine where applicable

Exports should remain aligned with the existing MeasureWorks philosophy of reviewer traceability and editable logic where exported to Excel.

---

## 12. Non-functional requirements

The following constraints remain in force for this expansion:

- no server dependency introduced by this scope
- browser-based static deployment remains supported
- `engine.js` remains pure and testable
- profile-driven client specificity remains the preferred pattern
- warnings remain non-blocking
- exported logic remains traceable
- annual and 8760 compatibility remains a design consideration
- framework decisions should favor reuse by future measure modules where practical

---

## 13. Recommended phased implementation scope

### Phase 1 — Framework-ready lighting expansion MVP
- preserve existing calculator mode
- add visible switch to advanced project mode
- support multi-zone projects in advanced mode
- support baseline selection: existing / code / custom
- support multiple input methods: fixtures / connected load / LPD
- support core controls: occupancy, scheduling, daylight dimming, lumen level trim
- expand profile structure for baseline and controls assumptions
- expand shared references for schedules, space types, and controls defaults
- update outputs to identify baseline source, mode, and assumptions

### Phase 2 — Deeper framework maturity
- richer 8760 schedule editing and hourly control treatment
- deeper code/jurisdiction reference support
- more advanced controls interactions
- additional export/reporting formats by client need
- expanded shared references for future non-lighting modules
- additional profile-driven reporting and compliance behaviors

---

## 14. Summary recommendation

MeasureWorks Lighting should be expanded as a framework-aligned dual-mode module.

The current calculator experience should remain available and familiar. A new advanced project mode should be added to support remodels, LPD workflows, code baselines, new construction, controls-only projects, and mixed-method lighting projects.

These changes should be implemented primarily through:
- shared engine expansion
- profile/schema enhancement
- shared references and assumptions libraries
- careful preservation of the existing workflow

This approach best fits the architecture, governance, and long-term framework vision documented in `MEASUREWORKS.md`.
