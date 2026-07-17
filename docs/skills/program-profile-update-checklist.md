# Program Profile Update Checklist (Operational)

Use this as a fast execution checklist when adding or updating a MeasureWorks program profile.

---

## 1) Naming + identity

- [ ] Profile display name matches: `<State> - <Utility> - <Program Year>`
- [ ] Profile id matches: `<state>_<utility>_<programyear>`
- [ ] Profile id is unique and stable (no unnecessary renames)
- [ ] Program year/effective window documented

---

## 2) Source collection

- [ ] Gather state/program/TRM/custom guidance docs
- [ ] Capture source metadata (doc name, version, date, section/page)
- [ ] Mark uncertain values as placeholders with explicit notes

---

## 3) Populate or update profile data

- [ ] Set metadata (`id`, `name`, `version`, `schemaVersion`, `mode`)
- [ ] Set demand method assumptions:
  - [ ] `8760` peak window (months/hours/weekdays) **or**
  - [ ] `annual` coincidence strategy (flat/by-type)
- [ ] Set Interactive Effects defaults:
  - [ ] enabled default
  - [ ] flat factors or by-space-type factors
- [ ] Set incentive structure:
  - [ ] type (`perKWh` / `perKW`)
  - [ ] rate(s)
  - [ ] cap percent of cost
- [ ] Set EUL/economic defaults
- [ ] Set controls assumptions defaults
- [ ] Ensure by-type keys align with known space types

---

## 4) Guidance Coverage & Gap Analysis (required)

Build both inventories:
- [ ] Tool/Profile input inventory (current modeled inputs)
- [ ] Guidance input inventory (required/allowed inputs from docs)

Classify each item:
- [ ] `MATCHED`
- [ ] `MISSING_IN_TOOL`
- [ ] `MISSING_IN_GUIDANCE`
- [ ] `PARTIAL_MISMATCH`

For each non-matched item, assign disposition:
- [ ] `ADOPT_NOW`
- [ ] `PLACEHOLDER`
- [ ] `DEFER_SCHEMA`
- [ ] `NOT_APPLICABLE`

- [ ] Provide rationale + citation for each non-matched item
- [ ] High-impact missing-in-tool items are either addressed now or explicitly deferred with tracking note/issue

---

## 5) Conventions + safety

- [ ] No program-specific logic added to `engine.js`
- [ ] Citation/provenance fields are present for critical defaults
- [ ] Warnings remain non-blocking (no hard gates introduced)
- [ ] Estimate language preserved where required

---

## 6) Versioning + change log

- [ ] Bump profile version per repo convention
- [ ] Update `changeLog` with:
  - [ ] date
  - [ ] editor
  - [ ] summary
  - [ ] sources

---

## 7) Validation

- [ ] Profile appears in selector
- [ ] Settings render correctly (schema-driven)
- [ ] No console/runtime shape/key errors
- [ ] Core calculation sanity checks pass:
  - [ ] line-item existing/proposed math
  - [ ] IE behavior (toggle + by-type)
  - [ ] incentive basis/rate/cap behavior
  - [ ] demand behavior aligns to mode
- [ ] Exports include stamps (`profile id/version/schema/mode/engine version`)
- [ ] Warnings appear where expected and do not block

---

## 8) PR readiness

- [ ] PR summary includes what changed + why
- [ ] Sources listed with citations
- [ ] Placeholder list included
- [ ] Guidance Coverage & Gap table included
- [ ] Validation checklist included

---

## Quick pass/fail gate

**Ready to merge only if all are true:**
- [ ] Naming convention is correct
- [ ] Guidance coverage/gap analysis is complete
- [ ] All critical defaults are source-backed or clearly placeholdered
- [ ] No engine-level program-specific logic introduced
- [ ] Validation + export/version stamping checks pass
