# Serpentis Regina — PLM Core

A fashion technical-design workroom for six-tab tech packs, separate client measurement intake, reusable measurement sessions, and a controlled house fit-form register. It connects practical garment development with beginner JavaScript learning. Working records remain local to the browser/app.

## Use the iPhone app — v0.7.1

Open the [Serpentis Regina Workroom](https://kelse-alt.github.io/serpentis-regina-plm-core/workroom/)
in iPhone Safari, then choose **Share → Add to Home Screen → Add**. Keep
**Open as Web App** enabled if shown. Open the new icon online once and wait
for **Export → Install & app info** to report **Offline ready on this device**.

The installed web app keeps the existing six-sheet workflow, house design,
local autosave and named revisions. Updates wait for an explicit action after
valid entries are saved. Safari, the Home Screen app and desktop browsers may
have separate stores; transfer a current pack with Export/Import JSON.
Read the [iPhone installation and usage guide](docs/iphone-workroom-app.md).

The [pinned style reference panel](docs/pinned-style-reference.md) keeps front/back
images, the Shared Style Record, Pattern Card details and Named Revisions & Restore
available across every worksheet. Use **Hide style / Show style** in the action bar.
On phones, a compact image strip expands into the complete reference panel.

## Desktop and standalone workroom

[Download the current workroom ZIP](https://github.com/kelse-alt/serpentis-regina-plm-core/archive/refs/heads/codex/workroom-iphone-app.zip),
extract it, and open **tech-pack.html**. With Node.js 24+, `npm run techpack`
provides a local HTTP preview.

Set up shared style information once, retain explicit sheet/sample overrides,
and work across the original six worksheets. Recoverable IndexedDB drafts,
separate original-image Blobs, named local revisions with compare/restore,
portable JSON backups, fractional-inch entry, validated spreadsheet paste,
undo/redo and task comparison views support daily workroom use. Save/Export
actions remain available on phones. Existing house colors, assets, formulas
and the approved reference stay intact.

Read the [daily workflow guide](docs/workroom-daily-workflow.md) before moving
existing drafts. Version-1 packs migrate to the separate tech-pack schema 2;
locally named revisions are not authenticated approvals or maker releases.
The [master-library strategy](docs/master-library-strategy.md) describes future
house terminology, POM/methods and reusable standards; it does not import
past-job documents or provide a new master measurement dataset.

## Separate client intake — workroom edition

**Without installing anything:** [download the workroom ZIP](https://github.com/kelse-alt/serpentis-regina-plm-core/archive/refs/heads/codex/client-intake-workroom-style.zip), extract the folder, and open **client-intake.html** in your browser.

The intake follows the supplied Remote Bespoke Dress workbook's fields, measuring
instructions and required markers. Its current workroom edition matches the
mannequin sheet's Obsidian/Ruby/Electric house style, Barlow Condensed type,
standalone head seal, ash chart text, and neutral borders. It is designed for
fashion technical designers, pattern makers, and seamstresses.
It starts with blank client and project information and **34 RC POMs**, of which
**19 are required**. Choose **CM** (the workbook default) or **IN**, enter values,
save/reopen partial drafts, import/export JSON, download CSV, or print a blank or
filled sheet.

Client details, reference notes, and saved drafts have their own tabs beside the
chart. Search by POM, measurement, or method; filter to all, required, or missing
required measurements. POM codes and headings stay visible while scrolling.
Print always includes all 34 POMs and the original source notes in the selected
unit, then restores the working screen. On phones, the context panel opens for
editing and closes to return to measurements.

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

Historical source palette, retained as provenance rather than active UI colors:
brand red `#E4002B`, royal blue `#1E22AA`, section red `#EE2737`,
reference green `#1FA824`, burgundy `#612028`, dark table `#0F1720`, table red
`#ED2637`, blush entries `#FFF4F4`, text `#101820`, and white `#FFFFFF`.

This public portfolio includes the actual founder-approved **SR-FORM-001 v1** dataset: **20 points of measure (POMs)** in inches, original measuring instructions, and manufacturer references where supplied. The founder authorized publication of these records and the repository's existing history on **2026-10-20**.

## What works today

- Develop the six-tab tech pack with shared style data, recoverable local drafts, named revisions, CM/IN entry, spreadsheet paste and complete export/print.
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

The latest [workroom refinement](docs/case-1-workroom-refinement.md) is designed
for fashion technical designers, pattern makers, and seamstresses. It preserves
every existing color while giving the chart more space, keeping POM identifiers
visible during horizontal scrolling, repeating active units in numeric headings,
clarifying selected filters, providing search recovery and enlarged original
photographs, and printing all 20 measurements regardless of on-screen filters.
The screen's working state is restored after printing.

The mannequin report keeps **Ruby text inside Electric Blue fills**, including
all toolbar filter/Print buttons in every state. The wordmark uses Electric
text; CASE/identity metadata and the delta formula use Slytheren. The main
title and division remain Obsidian on Ruby with transparent metadata overlays.
Chart values and methods retain matte ash text and neutral outlines; green
is limited to the requested metadata/formula and Front/Back caption fills.

A native **UNIT** dropdown switches MFR, Actual Form, and delta displays between
inches and centimeters using **1 in = 2.54 cm**, up to six decimal places with
trailing zeros trimmed. Calculations always start from canonical inches, and
Print/PDF reflects the selected unit. Approved data and source instructions,
including their inch landmarks, remain unchanged.

Barlow Condensed type, the standalone original head seal, and aligned workbook
photographs remain in place. Only the measurement chart scrolls; the upper
page and chart headings stay fixed. Its six columns use **MFR** and
**ACTUAL FORM**, with **Delta = ACTUAL FORM − MFR**.

Run `npm run sheet` to generate the self-contained browser report. Its photos,
fonts, and scripts are embedded, so no external requests are needed. The
approved baseline data and calculation rule are preserved. This report is a
browser preview, separate from the live Squarespace portal.

See the [latest design review](docs/case-1-centimeters.md),
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

## Six-tab workbook coverage

Extract the project ZIP and open **[tech-pack.html](tech-pack.html)**. The complete supplied workbook now has coordinated Pattern Card, Wash Specs, Fit & Comments, Graded Specs, Measurement Master and Mannequin Reference tabs in the established house style. Choose garment units, enter specifications, attach local drawings, save/reopen packs, download/import JSON, export sheet CSV and print the current sheet or all six. The approved mannequin measurements remain read-only.

See [the original workroom guide](docs/tech-pack-workroom.md) for source sections, formulas and unresolved workbook details; use the [v0.6 daily workflow](docs/workroom-daily-workflow.md) for current storage and editing behavior. The original Drive workbook is unchanged. New garment tables start blank; source example values never become approved specs.

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
| `npm run techpack` | Preview the offline six-tab app at localhost:3003 |
| `npm run techpack:build` | Build the blank, self-contained tech-pack.html |
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
| **v0.5.0** | Six source tabs, garment specs, graded grids, local images, pack save/import/export and complete printing | Core, source and browser acceptance | Packaged tech-pack workroom |
| **v0.6.0** | Shared style record, schema migration, recoverable drafts/revisions and faster specification entry | See current validation evidence | Daily workroom workflow |
| **v0.7.0** | Installable iPhone/web app, scoped offline caching and explicit save-first application updates | See iPhone guide and current browser evidence | Hosted workroom distribution |
| **v0.4.0** | Workbook-based 34-POM client intake, CM/IN, saved drafts, and import/export/print | Intake calculation/API and existing suites | Separate client intake |

Application versions, measurement revisions, and JSON schema versions describe different things. **v0.7.0** adds the installable iPhone/web distribution; tech-pack drafts retain schema 2 with version-1 migration. **SR-FORM-001 v1** remains the approved measurement dataset; **`schemaVersion: "1.0"`** describes that baseline JSON format. The separate client-intake template has its own identity and revision. Application changes do not revise approved house measurements.

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

This is a local technical-design prototype with measurement registers, client intake and six-tab tech packs. Approved baseline data stays read-only. Pack images, recoverable drafts and named revision snapshots remain local; JSON backups provide manual transfer. Revision names/authors are not authenticated production approvals. A house terminology/POM library, structured fittings, BOM/construction modules, maker releases, remote submissions, multiuser editing, accounts/permissions, live spreadsheet synchronization and automatic grading remain future work. The existing approved revision is never silently overwritten.
