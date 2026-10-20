# Changelog

These versions describe application milestones. They are separate from the approved measurement dataset revision and the JSON schema version.

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
