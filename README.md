# Serpentis Regina — PLM Core (PRIVATE)

Confidential, early-stage code and data foundation for Serpentis Regina's house technical-design systems.

## 🎀 House Measurement Sheet — working program

The first private measurement-sheet program is implemented and can display **all 20 approved SR-FORM-001 POMs**, the manufacturer's recorded reference values (where available), **signed differences**, and the **original “how to measure” instructions**. It produces both a terminal table and a beautifully styled, read-only local browser sheet.

Run locally with Node.js 20+:

```bash
npm run sheet
npm test
```

Open the generated `reports/SR-FORM-001-measurement-sheet.html` in your browser. The report is confidential, offline, and excluded from commits via `.gitignore`.

- [Program source](src/house-measurement-sheet.mjs)
- [Seven automated tests](tests/house-measurement-sheet.test.mjs)
- [Guided JavaScript lesson walkthrough](docs/lesson-in-action-measurement-sheet.md)
- [Original measurement methods transcript](data/house-fit-forms/SR-FORM-001-methods.v1.json)

**Calculation:** Delta = approved house standard − manufacturer reference. `null` means the manufacturer reference is absent, so delta stays `null`. These are comparisons, not garment tolerances.

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
