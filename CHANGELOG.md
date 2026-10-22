# Changelog

These versions describe application milestones. They are separate from the approved measurement dataset revision and the JSON schema version.

## Case 1 layout refinement — 2026-10-22

- Match the title to the existing Barlow Condensed chart font and remove Bodoni from the generated report.
- Give the original head seal a standalone Obsidian region beside the title. Move all brand/case/form/approval text into the title box, retaining green metadata.
- Replace Ruby box fills with Electric Blue and Ruby lettering; remove all Salmon UI styling, using Slytheren and Obsidian for the chart and controls.
- Align both original mannequin photographs in equal frames that fill the photo area using CSS cover. Original image files and approved measurements remain unchanged.

## Case 1 brand redesign — 2026-10-22

- Restyle the existing mannequin report with the founder's Obsidian/Ruby/Salmon/Slytheren/Electric palette, larger bundled Bodoni Moda and Barlow Condensed type, and the original sculpted head seal.
- Display the original front/back mannequin photos extracted unchanged from the supplied tech pack workbook.
- Keep the page heading, form panel, search/filters, and chart headings fixed while the measurement region scrolls vertically and horizontally.
- Use the workbook labels MFR and ACTUAL FORM; remove the reference-status column and duplicate source labels from each row.
- Retain approved values, exact methods, house-minus-manufacturer calculations, missing-data rules, search, filters, and PDF printing. Printed output includes all visible measurement rows and record notes.
- Add shared brand tokens, source/asset documentation, and browser checks for chart scrolling, responsive layouts, offline assets, and complete PDF output. The Notion Brand Bible requires sign-in; the type pairing is a proposal for founder review.

## v0.4.0 — 2026-10-20

### Added

- A client measurement intake based on the supplied Remote Bespoke Dress workbook, preserving its field labels, methods, required markers, and extracted colorway.
- A sanitized 34-POM RC template with 19 required measurements, preserving the source's absent RC-21 and question-mark annotations for RC-12/RC-13.
- CM/IN entry with canonical centimeter storage and six-decimal display conversion, without rewriting fixed-unit measuring landmarks.
- Partial draft save/reopen, a completeness check, CSV/JSON export, compatible JSON import, and blank/filled print controls.
- Separate local SQLite client-intake storage and a self-contained `client-intake.html` with separate browser storage.
- Intake validation, conversion, export, persistence, and API tests alongside the existing baseline and generator suites.

### Source and data handling

- No filled client or project information is included in the distributed template or prebuilt form. The original workbook stays outside the checkout, and saved client records remain local.
- The source contains no delta/reference formula; the intake does not fabricate a comparison with the approved 20-POM house register.
- The croquis refers to a separate PDF that was not provided. Reference areas hold notes; attachment handling is not implemented.
- The approved house measurements and previous generator workflows remain unchanged.

## v0.3.1 — 2026-10-20

- Include a ready-to-open `measurement-sheet-generator.html` in the project ZIP, so the standalone app can be used without installing Node.js or building the source.
- Build both standalone copies from the same source and check the tracked copy stays reproducible.
- Keep the tested v0.3.0 entry, calculation, storage, and export behavior unchanged.

## v0.3.0 — 2026-10-20

### Added

- An interactive general-use generator for new measurements using the same 20 POMs and source methods.
- Live new-measurement-minus-reference deltas, defaulting to the approved house standard, with manufacturer and custom reference choices.
- Separate named, dated measurement sessions with notes, blank-value handling, save/reopen, and CSV/JSON export and print controls.
- SQLite-backed local session storage, separate from immutable approved baseline records.
- A downloadable self-contained HTML generator with browser storage and no external dependencies.
- Shared browser/server validation and calculation tests, plus API persistence and invalid-input tests.

### Changed

- New session entry does not approve, overwrite, or revise existing house standards.
- The original JSON and database report commands retain their original house-minus-manufacturer comparison rule.

## v0.2.0 — 2026-10-20

### Added

- A local SQLite register using Node.js 24+'s built-in `node:sqlite`, with no third-party package or database service.
- `npm run db:import` to store all 20 approved SR-FORM-001 v1 POMs, original labels and methods, approval metadata, and source provenance.
- `npm run sheet:db` to read the stored register and generate the measurement sheet.
- Transactional imports, duplicate prevention, unchanged-import detection, and rejection of different content under an existing approved revision.
- Stored-snapshot fingerprint and row-consistency checks, preserving missing references as SQL `NULL`.
- Nine database tests, bringing the complete test suite to **16 tests**.
- An execution-first beginner database lesson connecting the familiar `for...of` loop to saving measurement records.

### Changed

- Shared report generation between the JSON-backed and database-backed workflows.
- Documented Node.js 24+ as the runtime requirement for the database workflow.
- Updated the project documentation for its public portfolio scope and stated prototype limitations.

### Publication record

The founder authorized public publication of the actual approved house records and the complete existing Git history on **2026-10-20**. Earlier commits describe the repository's private working stage; those descriptions reflect its status at the time. Publication does not alter the approved measurements, their original approval metadata, or the older pending-verification label in the source Sheet.

Database implementation reference: `9bee461`. The current v0.2.0 milestone includes the subsequent publication documentation and application version update.

## v0.1.0 — 2026-10-20

### Added

- A runnable JSON-backed measurement register for the 20 approved SR-FORM-001 POMs.
- Manufacturer comparisons with signed house-minus-manufacturer differences and explicit missing-reference handling.
- A local HTML report with source labels, measuring methods, search, reference filters, and print controls.
- Seven automated tests for the measurement rules and generated report.
- A guided JavaScript lesson covering variables, objects, arrays, loops, functions, and subtraction.
- Project handoff instructions and the staged PLM architecture plan.

Baseline reference: `d0f02b8`. This milestone was developed while the repository was private. The approved dataset remains SR-FORM-001 v1 with JSON `schemaVersion: "1.0"` across both application milestones.
