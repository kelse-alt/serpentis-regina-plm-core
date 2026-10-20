# Serpentis Regina — PLM Architecture (working plan)

This PRIVATE repository is intended to grow into the fashion house's own internal product lifecycle management (PLM)-style system.

## Source-of-truth hierarchy
1. Founder-approved actual mannequin values are the **house fit-form standards**.
2. Manufacturer-stated dimensions are retained as **reference comparisons** only.
3. Garment POM specifications, garment ease, tolerances and grade rules are **separate datasets**; do not infer them from body-form reference deltas.
4. Never silently overwrite an approved record. For a revision, create a new version with date, author, reason, previous version ID and approval record.
5. Blank manufacturer values are `null`, never zero.

## Phase 1 — House fit-form register
- `data/house-fit-forms/SR-FORM-001.v1.json` is the first founder-approved baseline captured from the source spreadsheet. 
- Keep original measuring instructions in the controlled source sheet until they can be imported faithfully.
- Before use for manufacturing, verify the sheet version, measurement-method notes, approval trace and fit-form identity.

## Phase 2 — Master tech packs
Extract normalized records from the master Google spreadsheet without editing originals.
Known source tabs:
- `PATTERN CARD`
- `BW-AW-SPEC` (before/after wash sample specs)
- `FIT & COM` (fit comments)
- `GRADED SPECS`
- `00-MEASUREMENT SHEET MASTER`

## Phase 3 — Versioning & grading
Style IDs, stable POM identifiers, approved base specs, numeric/alpha grade rules, tolerances and revision audit trails.

## Phase 4 — Internal web app
Authenticated frontend, roles, validated APIs, protected database, test suite and backups. Do not host confidential datasets on public GitHub Pages.

## IP and access
Private repository access is still cloud access. Keep credentials out of Git, limit collaborators, use encrypted backups, and review permissions.
