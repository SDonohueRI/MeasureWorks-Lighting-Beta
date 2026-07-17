# Skill Guide: Update Program Profiles (Xcel Energy Colorado Custom example)

## Purpose
Use this guide to add a new MeasureWorks program profile or update an existing one without changing core logic. It is optimized for profile/data-only changes and includes a checklist for Xcel Energy Colorado Custom configuration.

This guide reflects the architecture and conventions in `MEASUREWORKS.md`:
- Keep `engine.js` pure and client-agnostic.
- Express client rules as profile data.
- Keep provenance (source/citation), warnings-not-blocking behavior, and version stamping.

---

## Scope and safety

### In scope
- Add a new profile entry.
- Update profile characteristics/defaults.
- Update related data values (incentives, IE defaults, coincidence/peak assumptions, EUL, controls assumptions, schedule linkage, etc.).
- Add/maintain citations and placeholder markings.

### Out of scope (requires logic/schema work)
- Any client-specific branching in `engine.js`.
- New calculation pathways requiring code changes.
- New schema keys not supported by `PROFILE_SCHEMA`.

If an update needs out-of-scope items, split into two PRs:
1. Schema/logic enhancement (Tier 3).
2. Profile/data population (Tier 1/2).

---

## Files typically touched
- `js/profiles.js` (or `js/profiles/<client>.json` when profiles are externalized)
- `js/settings.js` (only if schema-visible defaults/options must be surfaced and already supported)
- Optional supporting data files if profile references them (e.g., schedules/wattage table mappings)

Do **not** edit `js/engine.js` for client-specific behavior.

---

## Required inputs before editing
Collect and document these from program/TRM/custom guidance:

1. Program identity
   - Utility/program name
   - Jurisdiction/state
   - Program year / effective window
   - Internal profile id convention (e.g., `xcel_co_custom`)

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

### Step 3 — Xcel Energy Colorado Custom baseline defaults
Use this as a starting pattern until final TRM/program confirmation:

- Profile id: `xcel_co_custom`
- Display name: `Xcel Energy Colorado Custom`
- Mode: prefer `8760` when hourly custom output is required; otherwise use documented program method.
- Peak definition: program-specific summer weekday window (confirm exact months/hours from source).
- IE: set explicit default and per-space-type behavior per program guidance.
- Incentive: populate current custom incentive basis/rate and cap.
- EUL: set program-approved default(s).
- Coincidence/peak assumptions: explicit, source-cited, and aligned with mode.
- Controls factors: provide explicit defaults and cite source.

> Important: if any value is unconfirmed, mark as placeholder and include citation note such as "Placeholder pending 2026 Xcel CO Custom guidance confirmation.".

### Step 4 — Preserve conventions
- Include/retain citation fields for profile values.
- Keep estimates labeled as estimates pending program review.
- Ensure defaults can be overridden in UI where intended.
- Keep warnings non-blocking; do not introduce hard validation gates in data.

### Step 5 — Versioning and changelog
- Update profile version per project convention (e.g., `2026.1` → `2026.1-e1`).
- Append/update `changeLog` with:
  - date
  - editor
  - summary
  - source documents

### Step 6 — Verify UI/settings compatibility
- Confirm profile appears in selector.
- Confirm schema-driven settings render correctly for the profile fields.
- Confirm no console/runtime errors from malformed shape/keys.

### Step 7 — Functional validation
Validate both happy-path and edge/pathology behavior:
- Existing/proposed line items compute.
- Incentive basis and cap apply as expected.
- IE toggle and by-type behavior work.
- Peak/CF behavior matches selected mode.
- Export includes profile id/version/schema/mode/engine version stamps.
- Warnings fire where expected (but do not block).

### Step 8 — PR prep
Include in PR description:
- Summary of profile additions/changes.
- Source references for defaults.
- Placeholder values needing confirmation.
- Screenshots or sample run outputs (web + export) if available.

---

## Data quality checklist (must pass)

- [ ] Profile id is unique and stable.
- [ ] Version incremented and `changeLog` updated.
- [ ] Mode explicitly set and demand assumptions aligned.
- [ ] Incentive basis/rate/cap complete and non-ambiguous.
- [ ] IE defaults explicit (flat or by space type).
- [ ] EUL/economic defaults set.
- [ ] Citations present for all critical defaults.
- [ ] Placeholder values clearly marked.
- [ ] No client-specific logic added to `engine.js`.
- [ ] Exports carry version/mode/profile stamps.

---

## Xcel Energy Colorado Custom: field checklist template

Use this checklist when creating/updating `xcel_co_custom`:

- [ ] `id`: `xcel_co_custom`
- [ ] `name`: `Xcel Energy Colorado Custom`
- [ ] `version`: `<program-year>.<minor>`
- [ ] `schemaVersion`: `<current schema>`
- [ ] `mode`: `8760` or `annual` (source-cited)
- [ ] `peakWindow` (if 8760): months/hours/weekdays set
- [ ] `coincidenceFactors` (if annual): by-type or flat set
- [ ] `interactiveEffects.enabledDefault`
- [ ] `interactiveEffects.variesBySpaceType`
- [ ] `interactiveEffects.kwhFactor` / `kwFactor` or `byType`
- [ ] `incentive.type` (`perKWh`/`perKW`)
- [ ] `incentive.rate`
- [ ] `incentive.capPctOfCost`
- [ ] `eulYears`
- [ ] `controlsFactors` defaults
- [ ] Citation/source metadata populated
- [ ] Placeholder labels where needed

---

## PR description template

```markdown
## What changed
- Added/updated profile: `xcel_co_custom` (Xcel Energy Colorado Custom)
- Updated defaults for: <list>
- Updated incentive assumptions for: <list>

## Why
Align profile with current program/TRM/custom guidance for Colorado custom lighting calculations.

## Sources
- <Doc name/version/date/section>
- <Doc name/version/date/section>

## Placeholders pending confirmation
- <field>: <placeholder note>
- <field>: <placeholder note>

## Validation performed
- [ ] Web UI profile selection and calculations
- [ ] IE toggle/by-type behavior
- [ ] Incentive cap behavior
- [ ] Export version/profile stamping
- [ ] Non-blocking warnings only
```

---

## Common pitfalls
- Reusing another profile without updating hidden metadata (id/version/mode).
- Mixing annual and 8760 assumptions in one profile.
- Missing or stale citations.
- Incentive cap expressed inconsistently (e.g., percent vs fraction).
- Introducing logic workarounds in data that should be schema/engine changes.

---

## Escalation criteria
Escalate to schema/logic update when you need:
- New profile fields not recognized by settings/editor.
- New baseline methodology (e.g., code-baseline variants) unsupported by current schema.
- New export structures that cannot be represented with existing canonical layout.

When escalating, document the exact data you attempted to represent and why current schema could not express it.
