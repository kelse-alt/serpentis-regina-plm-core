# 🎀 Serpentis Regina — JavaScript Lessons in Action

**Project:** SR-FORM-001 · Approved house mannequin measurement register · **PRIVATE**.

## How to execute

From the private repository root, using Node.js 20+:

```bash
npm run sheet
npm test
```

- `npm run sheet` reads the existing approved `data/house-fit-forms/SR-FORM-001.v1.json` and the original measurement methods in `data/house-fit-forms/SR-FORM-001-methods.v1.json`.
- JavaScript displays all **20 POMs** in your terminal, with manufacturer references, approved house standards and signed differences.
- It creates `reports/SR-FORM-001-measurement-sheet.html`. Open this file locally in any browser for a pink, searchable, filterable, printable measurement register.
- `npm test` runs seven automated tests, including positive/negative/zero deltas and missing manufacturer references.

**Confidentiality:** Generated HTML contains proprietary house measurements and is Git-ignored. Do not place it in a public repository or deploy it to a public site. The HTML viewer does not call external services.

## Your lesson map

| Lesson | Code to find | What it does |
|---|---|---|
| 01 · Variables | `const rows = []` | Stores our collection |
| 02 · Objects | `{ pomCode, houseStandard, manufacturerReference }` | Holds one measurement record |
| 03 · Arrays | `form.measurements` | Collects the 20 fit-form objects |
| 04 · Loops | `for (const record of form.measurements)` | Processes every record |
| 05 · Functions | `compareRecord(record)` | Uses one procedure for many measurements |
| 06 · Subtraction | `record.houseStandard - record.manufacturerReference` | Computes house minus manufacturer |
| Display | `console.table()` and `buildHtml()` | Shows the table in terminal and browser |

You have already learned the core ideas behind this program. Professional features like reading files, validating data, creating HTML and running tests are included as a preview; you do not need to memorize them yet.

## Measurement rules

- **House standard:** the physically measured form values approved for the private registry, **not** a manufacturer claim.
- **Manufacturer reference:** size-8 manufacturer's reference only when explicitly recorded.
- **Delta:** house standard − manufacturer reference, in inches. Positive means house is larger.
- **Dash (—):** reference not supplied. Never invent a zero or calculate a difference in that situation.
- **How to measure:** original source-sheet instructions preserved alongside the approved house values.
- These deltas are **not** grading, garment POM tolerances, ease, fit adjustments, or pass/fail judgments.

**Source reconciliation note:** The live Google Sheet still shows the older “House Reference-Pending Verification” status. The approved status displayed in the program comes from the versioned private record. The code does not edit the original Sheet. Verify methods and approval trace before production use.

## Four exercises before the public synthetic sample

1. Find the `for...of` loop. What does `record` mean inside it?
2. Find `compareRecord(record)`. Which information is the *parameter*?
3. Predict BF-09: `14.25 - 14.5 = -0.25`.
4. Why does BF-04 display **32.875 in** as the house standard but **—** for the manufacturer reference and delta?

**Next:** Create a distinct adaptation using **synthetic values only** for the public `serpentis-regina-tech-design-lab` repository. Do not copy this private source-data file into public GitHub.
