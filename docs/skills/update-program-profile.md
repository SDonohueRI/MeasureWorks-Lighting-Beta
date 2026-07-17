# Skill Guide: Update Program Profiles (Program-Agnostic)

## Purpose
Use this guide to add or update a MeasureWorks program profile without changing core logic. It is designed to be utility/program agnostic and centered on traceable defaults, source alignment, and gap identification between tool inputs and state/program guidance.

This guide reflects the architecture and conventions in `MEASUREWORKS.md`:
- Keep `engine.js` pure and client-agnostic.
- Express client/program rules as profile data.
- Keep provenance (source/citation), warnings-not-blocking behavior, and version stamping.

---

## Scope and safety

### In scope
- Add a new profile entry.
- Update profile characteristics/defaults.
- Update related data values (incentives, IE defaults, coincidence/peak assumptions, EUL, controls assumptions, schedule linkage, etc.).
- Add/maintain citations and placeholder markings.
- Perform guidance-to-input coverage and gap checks.

### Out of scope (requires logic/schema work)
- Any client-specific branching in `engine.js`.
- New calculation pathways requiring code changes.
- New schema keys not supported by `PROFILE_SCHEMA`.

If an update needs out-of-scope items, split into two PRs:
1. Schema/logic enhancement (Tier 3).
2. Profile/data population (Tier 1/2).

---

## Naming conventions (required)

### Human-readable profile name
Use:
`<State> - <Utility> - <Program Year>`

Examples:
- `Colorado - Xcel Energy - 2026`
- `Iowa - MidAmerican - 2026`

### Machine-readable profile id
Use lowercase snake case:
`<state>_<utility>_<programyear>`

Rules:
- Lowercase letters/numbers/underscores only.
- Replace spaces and punctuation with underscores.
- Use common utility abbreviation only if already established in repository conventions.

Examples:
- `colorado_xcel_energy_2026`
- `iowa_midamerican_2026`

> Keep `id` stable once published. If assumptions change, bump version and log the change; do not rename id unless absolutely necessary.

---

## Files typically touched
- `js/profiles.js` (or `js/profiles/<program>.json` when profiles are externalized)
- `js/settings.js` (only if schema-visible defaults/options must be surfaced and already supported)
- Optional supporting data files if profile references them (e.g., schedules/wattage table mappings)

Do **not** edit `js/engine.js` for program-specific behavior.

---

## Required inputs before editing
Collect and document these from state/program/TRM/custom guidance:

1. Program identity
   - State
   - Utility/program name
   - Program year / effective window
   - Profile name/id per naming conventions above

2. Calculation mode and demand method
   - `mode`: `"8760"` or `"annual"`
   - If `8760`: peak window definition (months/hours/weekdays)
   - If `annual`: coincidence factor strategy (flat vs by space type)

3. Interactive effects (IE)
   - IE enabled default (on/off)
   - IE kWh and kW factors
   - Whether IE varies by space type

4. Incentive structure
   - Incentive basis (`perKWh` or `perKW`)
   - Rate value(s)
   - Cap percent of project cost
   - Any required estimate labels/disclaimers

5. Measure life / economics
   - EUL
   - Any economics defaults used in results/payback assumptions

6. Controls assumptions
   - Occupancy/daylighting factors by applicable space/control type

7. Provenance and citations
   - Source doc title/version/date/section for every non-obvious default
   - Placeholder flag where value is provisional

---

## Guidance coverage and gap analysis (required)
Before finalizing profile defaults, perform a structured comparison between:
- **Current tool/profile inputs** (what MeasureWorks currently captures), and
- **State/program guidance inputs** (what guidance requires, allows, or references).

### A. Build an input inventory
Create two lists:
1. Tool input inventory (current fields, toggles, assumptions used in calculations/export).
2. Guidance input inventory (all inputs/constraints in state/program guidance).

### B. Classify each item
For each inventory item, assign one status:
- `MATCHED` — reflected in current tool/profile and aligned.
- `MISSING_IN_TOOL` — required/relevant in guidance but not represented in current tool/profile.
- `MISSING_IN_GUIDANCE` — used by tool/profile but not addressed by guidance.
- `PARTIAL_MISMATCH` — represented but definition, units, bounds, or method do not align.

### C. Record disposition
For every non-`MATCHED` item, record disposition:
- `ADOPT_NOW` — can be implemented in profile data immediately.
- `PLACEHOLDER` — keep temporary value pending clarification.
- `DEFER_SCHEMA` — needs schema/logic change.
- `NOT_APPLICABLE` — justified exclusion.

Include rationale and citation for each disposition.

### D. Gate for merge
Profile updates should not merge unless:
- All non-matched items are documented with disposition and rationale.
- High-impact `MISSING_IN_TOOL` items are either addressed or explicitly deferred via issue/roadmap note.

---

## Standard implementation workflow

### Step 1 — Branch and change note
- Create a feature branch.
- Draft a concise change note describing: what changed, why, source basis, and risk.

### Step 2 — Add or update profile entry
In `js/profiles.js` (or profile data file):
- Add new profile object or clone nearest compatible profile and adapt.
- Set profile metadata: id, display name, version, schema version, mode.
- Populate defaults and assumptions.
- Ensure any by-space-type structures match known space type keys.

### Step 3 — Populate defaults from guidance
- Enter values exactly as specified where guidance is explicit.
- Where guidance is ambiguous/missing, use placeholders with clear notes.
- Keep units, basis, and interpretation explicit in fields/comments/source notes.

### Step 4 — Run guidance gap check
- Complete the required guidance coverage and gap analysis section above.
- Capture results in PR description (or a short companion markdown note) with citations.

### Step 5 — Preserve conventions
- Include/retain citation fields for profile values.
- Keep estimates labeled as estimates pending program review.
- Ensure defaults can be overridden in UI where intended.
- Keep warnings non-blocking; do not introduce hard validation gates in data.

### Step 6 — Versioning and changelog
- Update profile version per project convention (e.g., `2026.1` → `2026.1-e1`).
- Append/update `changeLog` with:
  - date
  - editor
  - summary
  - source documents

### Step 7 — Verify UI/settings compatibility
- Confirm profile appears in selector.
- Confirm schema-driven settings render correctly for the profile fields.
- Confirm no console/runtime errors from malformed shape/keys.

### Step 8 — Functional validation
Validate both happy-path and edge/pathology behavior:
- Existing/proposed line items compute.
- Incentive basis and cap apply as expected.
- IE toggle and by-type behavior work.
- Peak/CF behavior matches selected mode.
- Export includes profile id/version/schema/mode/engine version stamps.
- Warnings fire where expected (but do not block).

### Step 9 — PR prep
Include in PR description:
- Summary of profile additions/changes.
- Source references for defaults.
- Placeholder values needing confirmation.
- Guidance coverage/gap table and dispositions.
- Screenshots or sample run outputs (web + export) if available.

---

## Data quality checklist (must pass)

- [ ] Profile name follows `<State> - <Utility> - <Program Year>`.
- [ ] Profile id follows `<state>_<utility>_<programyear>` and is stable.
- [ ] Version incremented and `changeLog` updated.
- [ ] Mode explicitly set and demand assumptions aligned.
- [ ] Incentive basis/rate/cap complete and non-ambiguous.
- [ ] IE defaults explicit (flat or by space type).
- [ ] EUL/economic defaults set.
- [ ] Citations present for all critical defaults.
- [ ] Placeholder values clearly marked.
- [ ] Guidance coverage/gap analysis completed.
- [ ] Non-matched guidance items have dispositions + rationale.
- [ ] No program-specific logic added to `engine.js`.
- [ ] Exports carry version/mode/profile stamps.

---

## Guidance coverage template (paste into PR)

```markdown
## Guidance Coverage & Gap Analysis

| Input / Requirement | In State/Program Guidance? | In Tool/Profile Today? | Status | Disposition | Notes / Source |
|---|---|---|---|---|---|
| <example: Peak window definition> | Yes | Yes | MATCHED | n/a | <source citation> |
| <example: NTG factor> | Yes | No | MISSING_IN_TOOL | DEFER_SCHEMA | <why + issue link> |
| <example: IE kwFactor> | No/Not explicit | Yes | MISSING_IN_GUIDANCE | PLACEHOLDER | <basis + note> |
| <example: Incentive cap basis> | Yes | Partial | PARTIAL_MISMATCH | ADOPT_NOW | <correction details> |
```

Status values: `MATCHED`, `MISSING_IN_TOOL`, `MISSING_IN_GUIDANCE`, `PARTIAL_MISMATCH`.
Disposition values: `ADOPT_NOW`, `PLACEHOLDER`, `DEFER_SCHEMA`, `NOT_APPLICABLE`.

---

## PR description template

```markdown
## What changed
- Added/updated profile: `<State> - <Utility> - <Program Year>` (`<state>_<utility>_<programyear>`)
- Updated defaults for: <list>
- Updated incentive assumptions for: <list>

## Why
Align profile with current state/program/TRM/custom guidance.

## Sources
- <Doc name/version/date/section>
- <Doc name/version/date/section>

## Placeholders pending confirmation
- <field>: <placeholder note>
- <field>: <placeholder note>

## Guidance Coverage & Gap Analysis
<insert completed table from template>

## Validation performed
- [ ] Web UI profile selection and calculations
- [ ] IE toggle/by-type behavior
- [ ] Incentive cap behavior
- [ ] Export version/profile stamping
- [ ] Non-blocking warnings only
```

---

## Common pitfalls
- Reusing another profile without updating metadata (name/id/version/mode).
- Mixing annual and 8760 assumptions in one profile.
- Missing or stale citations.
- Incentive cap expressed inconsistently (e.g., percent vs fraction).
- Skipping gap analysis when guidance introduces inputs not currently modeled.
- Introducing logic workarounds in data that should be schema/engine changes.

---

## Escalation criteria
Escalate to schema/logic update when you need:
- New profile fields not recognized by settings/editor.
- New baseline methodology unsupported by current schema.
- New export structures that cannot be represented with existing canonical layout.
- Guidance-required inputs currently absent from tool data model.

When escalating, document the exact guidance requirement, the missing model capability, and the proposed schema/logic addition.
