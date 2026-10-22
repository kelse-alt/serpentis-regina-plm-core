# Serpentis Regina — PLM Core

A fashion technology prototype for client measurement intake, reusable measurement sessions, and a controlled house fit-form register. It connects technical-design practice with beginner JavaScript learning: one measurement object becomes one displayed row and one saved record.

## Start with the client intake — v0.4.0

**Without installing anything:** [download the v0.4.0 ZIP](https://github.com/kelse-alt/serpentis-regina-plm-core/archive/refs/tags/v0.4.0.zip), extract the folder, and open **client-intake.html** in your browser.

The intake follows the supplied Remote Bespoke Dress workbook's fields, measuring
instructions, required markers, and red/blue/green/burgundy/dark/blush colorway.
It starts with blank client and project information and **34 RC POMs**, of which
**19 are required**. Choose **CM** (the workbook default) or **IN**, enter values,
save/reopen partial drafts, import/export JSON, download CSV, or print a blank or
filled sheet.

The completeness check requires a client ID or name, a measurement date, and all
19 required measurements; it does not approve the intake. RC-21 is absent in the
source and remains absent. RC-12/RC-13 retain source questions that need house
clarification. The croquis refers to a separate PDF that was not supplied; the
reference areas accept notes, not file attachments.

Switching units converts from canonical stored centimeters, displaying up to six
decimal places. It does not change fixed centimeter landmarks written in the
measuring methods. The workbook has no comparison reference or delta formula, so
this client form does not invent a comparison with the separate 20-POM house form.

For local SQLite storage, use Node.js 24+ and run `npm run intake`; open the address
printed in the terminal (default port 3002). Run `npm run intake:build` to rebuild
the standalone file. Browser drafts and SQLite records are separate stores.
Filled client records stay local and are not included in the public form or Git
history. See the [client-intake guide](docs/client-intake.md) for the full workflow.

Source palette: brand red `#E4002B`, royal blue `#1E22AA`, section red `#EE2737`,
reference green `#1FA824`, burgundy `#612028`, dark table `#0F1720`, table red
`#ED2637`, blush entries `#FFF4F4`, text `#101820`, and white `#FFFFFF`.

This public portfolio includes the actual founder-approved **SR-FORM-001 v1** dataset: **20 points of measure (POMs)** in inches, original measuring instructions, and manufacturer references where supplied. The founder authorized publication of these records and the repository's existing history on **2026-10-20**.

## What works today

- Capture the separate workbook-based client intake, convert CM/IN, check required-field completeness, and save/export/reopen partial drafts.
- Enter new measurements for the same 20 POMs, calculate deltas immediately, save sessions, reopen them, and export CSV/JSON.
- Generate a local HTML measurement sheet with search, reference filters, and print / Save PDF controls.
- Display all 20 approved house standards alongside their original source labels and measuring methods.
- Calculate signed differences as **house standard − manufacturer reference**.
- Preserve absent references as JavaScript `null` and SQL `NULL`, displaying a dash instead of an invented comparison.
- Import the approved register into a local SQLite database, then generate the same sheet from stored records.
- Reject changes to an already imported revision, detect inconsistent stored records, and roll back failed imports.
- Run automated tests covering baseline rules, new-session calculations, database behavior, and the local API.

## Case 1 — mannequin sheet design review

The mannequin report applies **Ruby text inside Electric Blue fills** to
section headers, chart headings, and blue-filled button states. Body text,
values, methods, and controls outside blue retain matte ash charcoal
(`#92989D`), with neutral outlines (`#293239`) and existing subtle grain.
The Ruby title keeps Obsidian text and transparent metadata. Green remains
limited to the Front/Back caption fills; Salmon remains excluded.

Barlow Condensed type, the standalone original head seal, and aligned workbook
photographs remain in place. Only the measurement chart scrolls; the upper
page and chart headings stay fixed. Its six columns use **MFR** and
**ACTUAL FORM**, with **Delta = ACTUAL FORM − MFR**.

Run `npm run sheet` to generate the self-contained browser report. Its photos,
fonts, and scripts are embedded, so no external requests are needed. The
approved baseline data and calculation rule are preserved. This report is a
browser preview, separate from the live Squarespace portal.

See the [latest design review](docs/case-1-scoped-ruby.md),
[brand system](docs/brand-system.md), and
[previous layout review](docs/case-1-layout-refinement.md).

## Enter new measurements


**Without installing anything:** [download the v0.3.1 ZIP](https://github.com/kelse-alt/serpentis-regina-plm-core/archive/refs/tags/v0.3.1.zip), extract the folder, and open `measurement-sheet-generator.html` in your browser. It starts blank and saves sessions in that browser on that device. Download JSON for a portable copy.

**With local SQLite storage**, use Node.js 24+:

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

Open `measurement-sheet-generator.html` or the identical `reports/measurement-sheet-generator.html` in your own browser. This file
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
| `npm run intake` | Start the client-intake app with separate local SQLite storage |
| `npm run intake:build` | Build the self-contained client-intake HTML with browser storage |
| `npm run generator` | Start the interactive local measurement-entry app with SQLite session storage |
| `npm run generator:build` | Build a downloadable, self-contained HTML generator with browser storage |
| `npm run sheet` | Read approved JSON, print the measurement table, and generate HTML |
| `npm run db:import` | Create `storage/serpentis-regina.sqlite` and import the 20-record v1 register |
| `npm run sheet:db` | Open the database read-only and generate the measurement sheet |

Running `db:import` again with the same content reports **20 POMs unchanged**. It does not add duplicates. Baseline reports can be rebuilt from tracked source records. SQLite databases and sidecars are Git-ignored local storage; newly entered measurement sessions and client drafts cannot be recreated from the baseline files, so export them for portable copies.

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
| **v0.3.0** | New measurement entry, live deltas, saved sessions, exports, and standalone HTML | Baseline, session, and API suites | Generator milestone |
| **v0.3.1** | Ready-to-open HTML included in the downloadable project ZIP | 31 tests + browser acceptance | Packaged 20-POM generator |
| **v0.4.0** | Workbook-based 34-POM client intake, CM/IN, saved drafts, and import/export/print | Intake calculation/API and existing suites | Current packaged application |

Application versions, measurement revisions, and JSON schema versions describe different things. **v0.4.0** is the packaged application version; **SR-FORM-001 v1** is the approved measurement dataset; **`schemaVersion: "1.0"`** describes the baseline JSON format. The separate client-intake template has its own identity and revision. Adding the intake did not revise the approved house measurements.

See the [changelog](CHANGELOG.md) for the development and publication record.

## Explore the code and lesson

- [Measurement-sheet program](src/house-measurement-sheet.mjs)
- [Client-intake workflow](docs/client-intake.md)
- [Sanitized client-intake template and source colors](data/templates/remote-bespoke-client-intake.v1.json)
- [Client-intake calculations and validation](src/client-intake.mjs)
- [Local client-intake server](src/client-intake-server.mjs)
- [SQLite importer and reader](src/house-measurement-database.mjs)
- [Shared new-measurement calculation and validation](src/measurement-session.mjs)
- [Local generator server](src/measurement-generator-server.mjs)
- [Measurement-sheet tests](tests/house-measurement-sheet.test.mjs)
- [Database tests](tests/house-measurement-database.test.mjs)
- [Beginner JavaScript walkthrough](docs/lesson-in-action-measurement-sheet.md)
- [Architecture and source-of-truth policy](docs/architecture.md)

## Prototype scope

This is a local measurement register, session-entry, and client-intake prototype, rather than a complete production PLM system. The approved baseline is read-only, and its importer supports SR-FORM-001 v1. New measurement sessions and client drafts are stored separately. Remote client submissions, attachment storage, multiuser editing, accounts and permissions, live spreadsheet integration, tech-pack generation, grading, and general baseline revision management are future work. The existing approved revision is never silently overwritten.
