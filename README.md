# Serpentis Regina — PLM Core (PRIVATE)

Confidential, early-stage code and data foundation for Serpentis Regina's house technical-design systems.

## 🎀 House Measurement Sheet — working program

The first private measurement-sheet program is implemented and can display **all 20 approved SR-FORM-001 POMs**, the manufacturer's recorded reference values (where available), **signed differences**, and the **original “how to measure” instructions**. It produces both a terminal table and a beautifully styled, read-only local browser sheet.

Run locally with Node.js 24+ (the database uses Node's built-in SQLite):

```bash
npm run sheet
npm test
```

Open the generated `reports/SR-FORM-001-measurement-sheet.html` in your browser. The report is confidential, offline, and excluded from commits via `.gitignore`.

- [Program source](src/house-measurement-sheet.mjs)
- [Measurement-sheet tests](tests/house-measurement-sheet.test.mjs)
- [Guided JavaScript lesson walkthrough](docs/lesson-in-action-measurement-sheet.md)
- [Original measurement methods transcript](data/house-fit-forms/SR-FORM-001-methods.v1.json)

**Calculation:** Delta = approved house standard − manufacturer reference. `null` means the manufacturer reference is absent, so delta stays `null`. These are comparisons, not garment tolerances.

## Private local database

The approved JSON files remain the controlled source. SQLite stores a local copy of
the approved v1 register, including all 20 POMs, exact source labels and methods,
approval metadata, and provenance. No extra packages or database service are needed.

```bash
npm run db:import
npm run sheet:db
npm test
```

`db:import` creates `storage/serpentis-regina.sqlite`. Repeating the import with the
same content leaves the 20 records unchanged. Different content under the same
approved revision is rejected instead of overwriting it. All rows are saved in one
transaction, so an interrupted/failed import cannot leave a partial register.

`sheet:db` opens the database read-only and generates the same private HTML report
from its stored rows. Missing manufacturer references remain SQL `NULL`; signed
differences are calculated when reading rather than stored as separate standards.
The database, SQLite sidecar files, and HTML report are Git-ignored and must remain private.

- [Database implementation](src/house-measurement-database.mjs)
- [Database persistence tests](tests/house-measurement-database.test.mjs)

## Current controlled baseline
- [Approved House Fit Form SR-FORM-001 v1](data/house-fit-forms/SR-FORM-001.v1.json)
- [Architecture and source-of-truth policy](docs/architecture.md)

The house's actual mannequin measurements are **approved**. These values take precedence over manufacturer references for the fit form. Manufacturer differences are not product manufacturing tolerances.

**Provenance:** Recorded from `MEASUREMENT SHEET_SERPENTIS REGINA`, tab `BODY REF-MANNEQUIN-SIZE 8-V1`, following founder approval on 2026-10-20. The original Google Sheet has not been edited by this repository setup.

## Planned modules
1. House form measurement registry and revision history
2. Digital style records and master tech-pack structure
3. Graded specifications and fit-sample revisions
4. Secure internal PLM-style dashboard and integrations

Do not make this repository public or share any files without an explicit IP review.
