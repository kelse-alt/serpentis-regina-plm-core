# Changelog

## v0.7.0 — Installable iPhone workroom — 2026-10-23

- Package the workroom as a Home Screen web app with installation metadata, original-head icons, scoped offline caching and application information/update controls.
- Host the public application under the existing GitHub Pages `/workroom/` subdirectory while preserving the three-head portal. Filled records and attached project images remain device-local; schema 2 and existing measurement rules are unchanged.
- Apply updates only after an explicit request and valid confirmed saving. Document Safari installation, separate iOS/browser stores, current-pack JSON transfer, offline preparation and device feedback.

## v0.6.0 — Daily style and revision workflow — 2026-10-23

- Add a shared style record with explicit sheet/sample overrides and migrate version-1 tech-pack drafts to schema 2 without changing approved house records.
- Add recoverable IndexedDB autosave, original-image Blob storage, named immutable local revisions with compare/restore, isolated legacy-record recovery and portable JSON backups. These snapshots do not confer authentication or production approval.
- Add fractional-inch input, previewed atomic spreadsheet paste, undo/redo, task comparison views and visible mobile Save/Export actions while preserving house colors, original assets, units, formulas and complete printing.
- Document a future curated master-library strategy for reviewed house terminology and reusable definitions. No past-job documents, master measurements, grading rules, BOM or production-release engine are imported or invented.

## v0.5.0 — Six-tab tech pack workroom — 2026-10-22

- Implement every tab of the supplied V2 workbook in the established house style: Pattern Card, both wash rounds, Fit & Comments, before/after graded grids, garment Measurement Master and approved mannequin reference.
- Add unit-aware editable tables, local raster references, browser pack saves, validated JSON transfer, sheet CSV, keyboard tabs, POM search and complete current/all-sheet printing.
- Preserve all original source cells/formulas separately; leave unassigned garment examples blank and expose unresolved body-target formula semantics. Approved measurements and prior intake/generator workflows are unchanged.


These versions describe application milestones. They are separate from the approved measurement dataset revision and the JSON schema version.

## Case 1 metadata colors and centimeter display — 2026-10-22

- Apply Electric text to the wordmark and Slytheren text to CASE/identity metadata and the delta formula; retain the Ruby title with Obsidian title/division text and transparent overlays.
- Keep all toolbar filter/Print buttons permanently Electric with Ruby text; preserve matte ash chart text, neutral outlines, and original assets/layouts.
- Add a native inches/centimeters selector. Convert MFR, Actual Form, and deltas from canonical inches at exactly 2.54 cm/in, showing up to six trimmed decimal places; print the selected unit. Preserve approved measurements, missing references, and original source instructions. See the [current review](docs/case-1-centimeters.md).

## Case 1 Ruby text scoped to blue fills — 2026-10-22

- Restore Ruby text only on Electric Blue section headers, chart headings, and blue-filled selected/hovered buttons, applying the house Electric/Ruby rule to Case 1.
- Preserve matte ash text outside blue, neutral outlines, Ruby title with Obsidian text/direct metadata, two green caption fills, original assets, layout, and all measurement rules. See the [current review](docs/case-1-scoped-ruby.md).

## Case 1 matte ink refinement — 2026-10-22

- Replace previously Ruby text with ash charcoal `#92989D` and red outlines with neutral `#293239`; add subtle embedded grain to selected text for the matte treatment.
- Keep the Ruby title fill, Obsidian title/metadata, two green photo-caption fills, original assets, layout, and measurement rules unchanged.
- Record this as a Case 1 exception; retain the general Electric-fill/Ruby-text house standard for other surfaces. See the [current review](docs/case-1-matte-ink.md).

## Case 1 corrected Ruby rule — 2026-10-22

- Correct the standing house rule: every Electric Blue fill box uses Ruby text. Remove Salmon/light pink from all active interface styling, including chart text, controls, borders, and deltas.
- Keep the Ruby title with Obsidian text and transparent metadata overlays; restrict Slytheren to the two Front/Back caption backgrounds.
- Preserve layout, type, original artwork/photos, approved measurements, and calculation rules. See the [current review](docs/case-1-ruby-rule.md).

## Case 1 house color rule (superseded) — 2026-10-22

Historical direction only; the corrected Ruby rule above replaces its pink-text guidance.

- Establish the latest house standard: every Electric Blue fill box uses Salmon pink text. This supersedes the earlier Salmon removal.
- Restore a Ruby title fill with Obsidian title text; keep metadata transparent directly over Ruby, without separate dark boxes.
- Restrict Slytheren to the two Front/Back caption backgrounds. Use Salmon for the earlier green interface text, controls, metadata, and borders elsewhere; retain Ruby Actual Form numbers.
- Preserve the approved layout, Barlow Condensed type, standalone original seal, aligned photos, chart-only scrolling, measurements, and delta calculation. See the [current review](docs/case-1-house-colors.md).

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
