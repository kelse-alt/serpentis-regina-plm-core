# Serpentis Regina — PLM Core

A fashion technology prototype that turns a house mannequin measurement sheet into a controlled, searchable fit-form register. It connects technical-design practice with beginner JavaScript learning: one approved measurement object becomes one displayed row and one SQLite record.

This public portfolio includes the actual founder-approved **SR-FORM-001 v1** dataset: **20 points of measure (POMs)** in inches, original measuring instructions, and manufacturer references where supplied. The founder authorized publication of these records and the repository's existing history on **2026-10-20**.

## What works today

- Enter new measurements for the same 20 POMs, calculate deltas immediately, save sessions, reopen them, and export CSV/JSON.
- Generate a local HTML measurement sheet with search, reference filters, and print / Save PDF controls.
- Display all 20 approved house standards alongside their original source labels and measuring methods.
- Calculate signed differences as **house standard − manufacturer reference**.
- Preserve absent references as JavaScript `null` and SQL `NULL`, displaying a dash instead of an invented comparison.
- Import the approved register into a local SQLite database, then generate the same sheet from stored records.
- Reject changes to an already imported revision, detect inconsistent stored records, and roll back failed imports.
- Run automated tests covering baseline rules, new-session calculations, database behavior, and the local API.

## Enter new measurements

```bash
npm run generator
```

The terminal prints the local address to open in a browser. The generator starts
with all 20 POMs and their original measuring instructions, blank new measurements,
and the approved house standard as the default reference.

1. Give the measurement session a name and date.
2. Enter decimal inches in **New measurement**. Each delta updates immediately.
3. Select **Save as new session** to keep a separate record, then reopen it from the saved-session list.
4. Download CSV or JSON, or use **Print / Save PDF**.

**Generator delta = new measurement − selected reference.** The reference selector
offers the approved house standard (default), manufacturer values, or custom
references. Blank measurements and absent references stay missing; they do not
become zero. These new sessions are observations, not changes to the approved
baseline or fit pass/fail judgments. Saving again creates another record rather
than overwriting a saved session.

For a standalone HTML application without Node.js running:

```bash
npm run generator:build
```

Open `reports/measurement-sheet-generator.html` in your own browser. This file
includes every script, style, and POM template it needs. Its sessions save in that
browser on that device, separately from the SQLite app; use the JSON download as
a portable backup. If browser storage is unavailable, the app reports that it
cannot save and still offers downloads. There are no external services or assets.

The local server binds only to this computer. New session data is stored locally
and is not automatically committed, uploaded, or deployed as a website.

## Run it locally

Use **Node.js 24+**. SQLite comes from Node's built-in `node:sqlite` module; there are **no third-party packages to install** and no database service to start.

From the repository root:

```bash
node --version
npm test
npm run sheet
npm run db:import
npm run sheet:db
```

Open `reports/SR-FORM-001-measurement-sheet.html` locally in a browser. Both sheet commands write this same report: `sheet` reads the approved JSON; `sheet:db` reads SQLite. The HTML uses no external libraries or services. This repository does not deploy a live website.

| Command | Purpose |
|---|---|
| `npm test` | Run all baseline, database, session-calculation, and API tests |
| `npm run generator` | Start the interactive local measurement-entry app with SQLite session storage |
| `npm run generator:build` | Build a downloadable, self-contained HTML generator with browser storage |
| `npm run sheet` | Read approved JSON, print the measurement table, and generate HTML |
| `npm run db:import` | Create `storage/serpentis-regina.sqlite` and import the 20-record v1 register |
| `npm run sheet:db` | Open the database read-only and generate the measurement sheet |

Running `db:import` again with the same content reports **20 POMs unchanged**. It does not add duplicates. The generated database, SQLite sidecars, and HTML report are Git-ignored because they can be rebuilt from the tracked source records.

## Measurement rules and provenance

The physically measured mannequin values are the **approved house standards**. Manufacturer dimensions are comparison references. A positive difference means the house form is larger; a negative difference means it is smaller. These differences do not define garment ease, manufacturing tolerances, grading rules, or fit pass/fail judgments.

The controlled inputs are:

- [Approved fit-form record](data/house-fit-forms/SR-FORM-001.v1.json)
- [Original source labels and measuring instructions](data/house-fit-forms/SR-FORM-001-methods.v1.json)

Their provenance is `MEASUREMENT SHEET_SERPENTIS REGINA`, tab `BODY REF-MANNEQUIN-SIZE 8-V1`, with founder approval recorded on 2026-10-20. The source Sheet retains an older pending-verification label; the approved designation comes from the versioned record. This application does not edit or synchronize the Sheet. Manufacturing use still requires checking fit-form identity, measurement methods, and the approval trace.

## Milestones

| Application milestone | Working capability | Test coverage | Reference |
|---|---|---|---|
| **v0.1.0** | JSON-backed terminal and HTML measurement sheet | 7 tests | Baseline at `d0f02b8` |
| **v0.2.0** | SQLite import, persistence checks, and database-backed HTML | 16 tests | Database implementation at `9bee461` |
| **v0.3.0** | New measurement entry, live deltas, saved sessions, exports, and standalone HTML | Baseline, session, and API suites | Current application milestone |

Application versions, measurement revisions, and JSON schema versions describe different things. **v0.3.0** is the application milestone; **SR-FORM-001 v1** is the approved measurement dataset; **`schemaVersion: "1.0"`** describes the baseline JSON format. Adding measurement sessions did not revise the approved measurements.

See the [changelog](CHANGELOG.md) for the development and publication record.

## Explore the code and lesson

- [Measurement-sheet program](src/house-measurement-sheet.mjs)
- [SQLite importer and reader](src/house-measurement-database.mjs)
- [Shared new-measurement calculation and validation](src/measurement-session.mjs)
- [Local generator server](src/measurement-generator-server.mjs)
- [Measurement-sheet tests](tests/house-measurement-sheet.test.mjs)
- [Database tests](tests/house-measurement-database.test.mjs)
- [Beginner JavaScript walkthrough](docs/lesson-in-action-measurement-sheet.md)
- [Architecture and source-of-truth policy](docs/architecture.md)

## Prototype scope

This is a local measurement register and session-entry prototype, rather than a complete production PLM system. The approved baseline is read-only, and its importer supports SR-FORM-001 v1. The generator records new sessions separately. Multiuser editing, accounts and permissions, live spreadsheet integration, tech-pack generation, grading, and general baseline revision management are future work. The existing approved revision is never silently overwritten.
