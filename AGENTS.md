# Serpentis Regina — Codex Project Instructions

## Project identity and scope

**Standing audience, reaffirmed October 22, 2026:** Design every technical-design surface for fashion technical designers, pattern makers, and seamstresses. Prioritize precise POM identification, original measuring methods, unambiguous active units, legible comparisons, usable reference photographs, keyboard access, and complete working printouts. Keep form-reference comparisons distinct from garment specifications, ease, grading, and tolerances. The founder authorized the workroom refinements while explicitly requiring **no changes to any existing colors or their assignments**.

**Audience expanded October 23, 2026:** The founder, fashion designers, pattern makers, seamstresses, machinists and garment technologists are the working users. Preserve precise style/sample/pattern identity, source methods, measurement context and reliable recovery while applying the established house design. Build practical daily workflows before adding production-release or hosted collaboration claims.

You are collaborating with the founder of **Serpentis Regina**, a fashion house, to learn JavaScript by building practical technical-design software. This is the public learning and progress repository: `kelse-alt/serpentis-regina-plm-core`. The project aims to evolve from a controlled mannequin fit-form registry to reusable measurement calculations, tech packs, grading/fit workflows, and eventually an internal PLM-style interface.

**Publication authorization:** On 2026-10-20, the founder explicitly requested public GitHub access to the actual house records and their complete Git history. The original private-only instructions are superseded for this repository and its existing approved dataset. Preserve that history and the approved measurements. Work in small, reviewable commits or pull requests. A future live website, unrelated client material, credentials, and future datasets need their own appropriate scope; this authorization does not make the application production-ready.

## Where the ChatGPT conversation left off (October 20, 2026)
The founder is a **beginner learning JavaScript step by step**, through a "Syren Coding Academy" course built around real fashion-tech workflows.

Completed hands-on exercises:
1. **Variables**: `const`, `let`, strings vs numbers, subtraction, `console.log()`, avoiding duplicate declarations.
2. **Objects**: `{}`, named properties, commas, `record.houseStandard` dot notation.
3. **Arrays**: `[]`, zero-based indices, arrays of measurement objects.
4. **Loops**: `for (const record of measurements) { ... }`, matching braces and iterating multiple measurements.
5. **Functions**: declarations, parameters vs arguments, passing objects and calling a function from a loop.
6. **Calculation exercise**: `const difference = record.houseStandard - record.manufacturerReference;`, reusing `showDifference(record)` for waist and bust records.

The last completed beginner exercise was **Coding Challenge 11**: calling `showDifference(waistRecord)` and `showDifference(bustRecord)`, yielding `0.75` and `0.25`. A further challenge to combine the comparison function with a `for...of` loop was introduced but not submitted. The user requested a working private measurement sheet before proceeding; the previous assistant committed the private implementation to this repository.

Teaching style: **Notion-friendly, ADHD-friendly, visually organized, warm, feminine/pink/serpent ("🎀 🐍 💗"), but clear and technically precise**. Keep one small concept and exercise at a time. Explain exactly what the code does. Prefer short runnable snippets, clear expected outputs, and gradual progression rather than dumping architecture. Encourage understanding instead of merely generating code. Ask for user's own attempts before declaring a concept mastered.

## Source-of-truth and proprietary data
- **Approved house fit form:** `SR-FORM-001`, manufacturer-designated size 8, **20 POMs**, inches.
- Approved data: `data/house-fit-forms/SR-FORM-001.v1.json`.
- Source-sheet labels and measuring instructions: `data/house-fit-forms/SR-FORM-001-methods.v1.json`.
- Original sheet provenance: `MEASUREMENT SHEET_SERPENTIS REGINA`, tab `BODY REF-MANNEQUIN-SIZE 8-V1`. Do not edit the source sheet without asking.
- The measured **actual mannequin form** values are the approved **house standards**; manufacturer-stated measurements are comparison references only.
- `difference = houseStandard - manufacturerReference`: positive means the house is larger; negative means smaller; zero means equal.
- Missing manufacturer reference is **`null`**, not zero. No computed delta in this case.
- Difference is **not** a garment fit tolerance, pass/fail judgment, ease allowance, or grading rule. Garment specs are separate.
- The original live Google Sheet retains an older "Pending Verification" label; the versioned approved record holds the newer approval status. Do not silently reconcile provenance or fabricate measurement dates/approval signatures.
- Before manufacturing use, validate fit-form identity, source methods, and approval trace.

## Brand direction — founder instruction, October 22, 2026

- Active interface colors are **Obsidian #101820**, **Ruby #E4002B**, **Slytheren #1FA824**, and **Electric #1E22AA**, recorded in `design/brand-tokens.json`. **Salmon #F4A6A0 is excluded from UI** and retained only in the source palette history. This supersedes the earlier generic pink/ivory direction. Preserve original colors in supplied photographs and sculpted artwork.
- **Standing brand rule, explicitly reaffirmed:** Text painted on **Electric Blue fills MUST be Ruby** (`#1E22AA` / `#E4002B`). This applies to section boxes, table headings, and every toolbar filter/Print button in all states; toolbar buttons now keep permanent Electric fills. **Do not recolor text outside Electric Blue fills red.** Evaluate the actual background behind the text: a dark inset inside a blue section keeps its own text treatment. **Do not use light pink/Salmon in any interface styling.**
- **Case 1 matte treatment applies to the chart body:** Preserve the **ashy matte charcoal/black** lettering already implemented (`#92989D` ink with embedded fine grain), neutral `#293239` borders, and no red outlines. Body measurement values, methods, deltas, and supporting text remain matte ash. Apply only the explicitly requested metadata/formula overrides below; preserve original photographs and the isolated seal.
- **Case 1 title and metadata overrides:** Keep the title box Ruby with Obsidian/black main title and division text. The **SERPENTIS REGINA wordmark uses Electric foreground**. **CASE / 001**, form ID, size, the static **INCHES / CM identity label**, 20-point count, and approval label use **Slytheren foreground**. Metadata sits directly on Ruby; `.brand-line` and `.identity-strip` remain transparent with no separate black panels. The separate dark native UNIT selector shows its selected value in matte ash.
- **Slytheren usage is limited to the requested CASE/identity metadata and delta formula foregrounds, plus the Front/Back photo-caption backgrounds.** This supersedes the earlier captions-only restriction. Do not introduce green table values, buttons, borders, or outlines. The formula remains `Delta = ACTUAL FORM − MFR` and is green.
- Reuse the original Serpentis Regina sculpted head artwork as the upper-right seal on newly designed pages: `assets/house-sheet/serpentis-regina-seal.png`. The head must stand alone on Obsidian beside the title area, with no surrounding metadata in its column. Place all brand, case, form, and approval text inside the title area. Preserve original artwork pixels/colors.
- The founder requested the title match the chart font: **Barlow Condensed 700**. Use Barlow Condensed throughout this report; do not load the earlier Bodoni title font. The Brand Bible at `https://app.notion.com/p/BRAND-BIBLE-VISION-255bab06d9b4801d99def02a9914973b` required sign-in; do not claim its typography was verified.
- Display the original front/back mannequin photos in equally sized, aligned frames that fill the available photo area, using CSS cover and matched positioning without rewriting the original files.
- The founder supplied the full tech pack workbook at `https://docs.google.com/spreadsheets/d/1ALn9OogQy6x4YSEohhlew-NaIdeEdm2F/edit?gid=1422941812#gid=1422941812`. Its mannequin tab matches all 20 approved records and original methods. This is additional provenance; do not rewrite the approved baseline's original source URL or approval metadata.
- **Case 1** starts with the mannequin page, using **MFR**, **ACTUAL FORM**, and **Delta = ACTUAL FORM − MFR**. The other workbook pages will be coded in subsequent steps as directed.
- For this report, only the measurement chart scrolls. Keep the upper page, form photographs, controls, and chart headings in place. Preserve keyboard access, compact-screen usability, and a full print layout.
- The founder removed the reference-status column and repeated “Source:” labels from the visible rows. Keep source labels/methods in the controlled data and provenance, without duplicating them in each visible row.
- **Case 1 display units:** Provide a native UNIT `<select>` with values `in` and `cm`, starting in inches. Convert displayed MFR, Actual Form, and delta values from canonical approved inches using exactly **1 in = 2.54 cm**. Display up to six decimals with trailing zeros trimmed, retain positive delta signs and missing-value dashes, and recompute from canonical inches on every switch to avoid cumulative rounding. Never change approved JSON/SQLite measurements or rewrite source measuring instructions/landmarks. Print/PDF uses the currently selected unit. This report's canonical inches are separate from the client intake's canonical centimeters.

## Files and entry points
- `src/house-measurement-sheet.mjs`: Node.js script that reads the 20 POMs, computes signed deltas, outputs `console.table`, and generates an offline HTML measurement-sheet report.
- `tests/house-measurement-sheet.test.mjs`: test suite for references, comparisons, and report.
- `docs/lesson-in-action-measurement-sheet.md`: teaching companion mapping variables, objects, arrays, loops and functions to program features.
- `package.json` scripts: `npm run sheet` and `npm test` (Node.js 24+, including built-in SQLite).
- `reports/*.html` and `storage/*.sqlite*` are ignored in Git because they are reproducible local outputs; approved source records are versioned in Git.
- `docs/architecture.md`: staged PLM architecture and source-of-truth policy.

**Important:** Verify current repository reality and actually run `npm test` / `npm run sheet` in Codex before claiming tests pass or a report works. Inspect and fix any issues you find; don't assume prior chat results prove runtime execution.

## Immediate next work in Codex
1. Inspect this repository's README, sources, JSON, and test suite.
2. Run the tests and report generator. Correct failures, and validate all **20** POM records and original source-method labels. Preserve a clear distinction between the actual house standard and missing manufacturer references. Confirm locally generated HTML is usable and remains uncommitted.
3. Show the founder the program's structure in beginner-friendly terms, mapping each familiar JavaScript concept to real lines.
4. Keep the separate `kelse-alt/serpentis-regina-tech-design-lab` examples synthetic so readers can distinguish those examples from the actual approved register published here.
5. Later educational topics: `return` versus `console.log`, missing-data validation, tests, UI, and versioned tech-pack data.

## Collaboration and safeguards
The founder authorized publication of this repository's actual approved records and Git history. Do not invent data changes or apply that authorization to unrelated third-party information. No credentials in code; no unrequested cloud deployment, network analytics, or external CDNs in reports. Favor accessible, elegant, print-friendly table design using the founder's designated brand palette and clear POM columns.

Explain *why* code changes are needed. Do not jump ahead of the learner, and distinguish source facts from assumptions. Use `AGENTS.md` as transferable context rather than treating this as the entire original chat transcript.

## Current local database and teaching step

- `src/house-measurement-database.mjs` imports the existing approved SR-FORM-001 v1 JSON into a local SQLite database, retaining approval/provenance and all 20 POMs with exact source labels/methods.
- Run `npm run db:import`, then `npm run sheet:db`. The database is `storage/serpentis-regina.sqlite`, with database/sidecar files ignored by Git. No extra packages or service are required; Node.js 24+ is required.
- JSON remains the controlled approved source. Re-importing identical content is a no-op; conflicting content in the same revision is refused. Do not use direct SQL updates to revise an approved measurement.
- The founder requested teaching alongside actual execution. Demonstrate what each line does with observed output before asking prediction questions. Keep each explanation small, starting with one object per loop turn.
- Public work and publication are now authorized as described above; keep the actual register distinct from the separate technical-design lab's synthetic examples.

## New measurement generator (v0.3.0)

- `npm run generator` starts the local entry application; `npm run generator:build` creates `reports/measurement-sheet-generator.html` for standalone use.
- The same 20 POMs and methods are reused. New entries are unapproved measurement sessions, never approved baseline replacements.
- The founder selected **new measurement minus approved house standard** as the default delta. Manufacturer/custom reference modes are also available. Label the formula and selected reference clearly; the original baseline report still uses house minus manufacturer.
- `src/measurement-session.mjs` is shared by the browser/server, with no Node-only imports. Empty measurements/references remain null, and deltas are calculated only when both exist.
- Server-mode sessions persist separately in `measurement_sessions` within the local SQLite file. Standalone HTML uses browser storage; these stores are distinct, and downloads provide backups.
- New user-entered sessions are local data; the earlier publication authorization covers the existing approved dataset, not automatic publication of future session data.
- v0.3.1 includes a prebuilt `measurement-sheet-generator.html` at the repository root for users downloading a source ZIP. Rebuild it with `npm run generator:build` when web/shared source changes; CI checks that generated file is current. It includes only the baseline template, never saved user sessions.

## Client measurement intake (v0.4.0)

- **Current client workroom edition, October 22, 2026:** The founder requested
  a new client intake in the same style as the completed mannequin sheet.
  Use the exact active house palette and assignments, Barlow Condensed, the
  original standalone seal, ash chart text, and neutral borders. The source
  template's historical palette/provenance stays intact in JSON but does not
  override current UI styling. Client/reference/draft tabs, POM search and
  required/missing-required filters, fixed headings/POM codes, and complete
  34-POM printing serve the standing technical-design audience. Preserve the
  distinct RC intake workflow: no MFR/Delta, no house-form auto-fill, no approval
  inferred from completeness, no automatic publication of filled records.
  Rebuild the tracked `client-intake.html` after source changes.

- `data/templates/remote-bespoke-client-intake.v1.json` is the sanitized template extracted from the supplied Remote Bespoke Dress workbook's `CLIENT BODY MEASUREMENTS` tab. Preserve original labels, methods, required markers, palette values, and palette source-cell provenance.
- The client template has **34 RC POMs**, **19 required**, with **RC-21 absent**. Do not renumber them or map them onto the approved 20 BF POMs. RC-12/RC-13 retain source questions that need house clarification; never silently resolve them.
- The source contains no comparison reference or delta formula. Do not invent a house/manufacturer baseline or import the existing generator's delta rule into this intake.
- Default unit is **CM**, with **IN** available. Store canonical `valueCm`; display conversions use up to six decimal places without cumulative rounding. Unit switches must not rewrite fixed centimeter landmarks in methods.
- `src/client-intake.mjs` is the shared browser/Node calculation and validation module. `src/client-intake-server.mjs` serves the local app and stores client drafts in the separate ignored `storage/client-intakes.sqlite` database. `client-web/` contains its UI.
- Run `npm run intake` (Node.js 24+, default loopback port 3002). Run `npm run intake:build` via `scripts/build-client-intake.mjs` to build `client-intake.html` and its `reports/` copy. Rebuild the tracked standalone file after source changes. See `docs/client-intake.md` for user instructions.
- Save/reopen permits partial drafts. Completeness checks identity/date/all 19 required measurements; it is not approval. CSV/JSON export, compatible JSON import, and blank/filled print are local features. The separate croquis PDF was not included; reference areas accept notes, not attachments.
- Keep the original XLSX outside the checkout. Never include filled client identities, project values, measurements, exports, database files, or screenshots in public Git, test fixtures, release ZIPs, or prebuilt HTML. The public artifact contains only the sanitized blank template. Earlier publication authorization for the approved house dataset does not authorize publishing future client records.
- Preserve the approved 20-POM source JSON and its existing workflows unchanged. Standalone browser client drafts, local SQLite client intakes, and earlier generator sessions are separate stores; do not claim synchronization or remote client submission.


## Six-tab tech pack workroom (v0.5.0)

- The founder supplied Drive file `1yXo2dRFUFBJXT7fQlsxJkoWVH5pfSSQn` on October 22, 2026 and requested code for every tab using the established house style and technical-design audience. It is an XLSX in Drive, not a native Sheet. Preserve the original file without edits.
- `data/templates/tech-pack-workbook-source.v1.json` retains all six exact tab names, 427 nonempty cells, 67 literal formulas, source hash, original image hashes and section ranges. No filled client record was present. The blank UI schema is `data/templates/tech-pack-workbook.v1.json`.
- `workbook-web/`, `src/tech-pack.mjs` and `scripts/build-tech-pack.mjs` build tracked `tech-pack.html`. Rebuild with `npm run techpack:build` after changes. `npm run techpack` previews the complete offline file at loopback port 3003. Pack persistence is browser storage only, distinct from every existing SQLite app; JSON transfers all six tabs/images.
- Garment units are unspecified in the source. Require a CM/IN choice before garment measurement entry, then use canonical CM and six-decimal display. The approved house viewer remains canonical inches with a separate view-unit selector. Optional local targets and observations never overwrite the approved reference.
- Preserve different formulas: wash Target minus After Wash (source rows11–38,40,43 only; H/N on41–42 remain manual signed entries), master Sample Actual minus Approved Base (source first3 rows; clearly labelled app extension across30), fit style linked to Pattern Card A1, approved house Actual Form minus MFR. Do not introduce automated grading, ease or approval from completed fields.
- Master G31:H33 are unlabelled source examples with no POM/unit, retained only in source notes. Body I31:I33 uses HOUSE TARGET minus blank source DELTA; retain this ambiguity, do not silently replace with target-minus-actual. Pattern column E and eleven graded size names remain unassigned until the user specifies them.
- Filled packs, exports and attached images remain local; only blank screenshots and sanitized templates belong in Git. Print includes every row independent of search, complete metadata, images and active units; the working screen is unchanged after print.

## Daily workroom workflow (v0.6.0)

- Read `docs/workroom-daily-workflow.md` for current use and `docs/master-library-strategy.md` for the separate future plan. The founder accepted shared style/reliable recovery and revisions/faster specification editing while preserving every current color assignment, original asset and source formula. Do not present a future library, structured fitting system, BOM or production-release workflow as already implemented.
- Tech-pack **schema 2** adds a shared style record: number, description, category, season, baseSize, sampleSize, maker, patternRevision, owner and fabric. `src/tech-pack.mjs` validates/migrates version-1 packs without rewriting original per-sheet values. Blank mapped fields inherit shared values; explicit nonblank overrides win. Preserve conflicting metadata for review, leave ambiguous identifiers blank, and do not guess round/sample/revision semantics.
- Persist recoverable drafts in IndexedDB and original raster bytes in separate Blob records. Keep named revision snapshots immutable; comparing/restoring them must preserve history. Locally entered author names and timestamps are not authenticated signatures or production approval. Keep portable JSON backups, record-by-record legacy recovery and accurate unsaved/storage-conflict states. Browser storage is not cross-device synchronization; the original legacy bytes must remain recoverable.
- Fractional IN entry, previewed atomic rectangular spreadsheet paste, undo/redo and comparison column views are editing tools. Preserve canonical CM, null/zero, signed-column restrictions, per-row manual exceptions and all exact formulas. A rejected paste cannot partially change the pack. Changing view columns must neither delete data nor restrict complete exports. Keep primary Save/Export reachable on phones.
- A future house library must separate garment POM definitions/methods/diagrams, blocks, construction, materials and reviewed tolerance/grade rules. Use stable IDs and definition versions, contextual aliases, explicit measurement state/landmarks, founder decisions and provenance. Style/sample values remain separate; BF house and RC client records are not garment specs. Do not invent master values, ease, tolerances or grading rules.
- Review past-job terminology privately with source/context/method/decision/permission recorded. Access does not authorize public copying; no past-employer/client records, attachments or identifiers in Git/tests/screenshots. Publish only house-owned or specifically authorized definitions. Existing snapshots and future released packs must not silently adopt changed library definitions.

## Installable iPhone workroom (v0.7.0)

- The founder explicitly requested an iPhone-installable app for hands-on revision feedback. This authorizes publishing the sanitized static PWA distribution at `https://kelse-alt.github.io/serpentis-regina-plm-core/workroom/`; it does not authorize publishing filled projects, new client data or private images. Read `docs/iphone-workroom-app.md` for installation and storage boundaries.
- Build the hosted distribution with `scripts/build-workroom-pwa.mjs` into ignored `reports/workroom-pwa/`. Keep the standalone workroom available. The app is installed through Safari **Share → Add to Home Screen**, with offline preparation on the first online Home Screen launch; it is not an App Store binary.
- Keep manifest/start URL, service-worker scope and cached shell assets under `/workroom/`. Deployment adds only that directory to the existing `portal-site` branch; preserve all portal files and behavior. Cache only public static application files, never working records or uploaded project content.
- Preserve schema 2, the existing workroom database identity, exact house color assignments, original art/fonts and measurement formulas. Saved drafts/revisions remain local; Safari and installed iOS apps may use separate stores. Current-pack JSON transfers images and values but does not transfer named revision history.
- Updates require an explicit action and a valid saved working state. Never reload active edits automatically, claim a failed save succeeded, or discard a pending file operation. Keep browser/physical-device evidence distinct; automated WebKit/Chromium or iPhone viewport checks do not prove native Share menu or real-iPhone behavior.

## Pinned style reference (v0.7.1)

- On October 26, 2026 the founder requested a fixed, optionally hidden reference sidebar with actual garment images above the Shared Style Record, Pattern Card information and Named Revisions & Restore. Use original front/back mannequin photos for the example and label their identity clearly. Keep all existing color assignments.
- The sidebar persists across six worksheet tabs, with independent image header and information scroll. Its Pattern Card fields/piece tables and the full-width Pattern Card tab are synchronized editors of the same existing pack data, never separate records. Resolve event destinations from their editor's sheet identity, including paste and image operations; the active worksheet can differ from the pinned Pattern Card.
- Hide/Show style is a device-local view preference and never a pack edit. On phones the native-collapsed panel keeps a compact image strip; expanded information and full hiding are separate controls. Keep Save/Hide/Undo/Redo/Export reachable.
- Show existing Master front/back references if provided, otherwise the Pattern Card reference, otherwise the clearly labelled house-example pair. Never mix a supplied single style image with a mannequin fallback or auto-fill garment specifications from the photos.
- Preserve input validity, raw unfinished text and errors when refreshing images or shared metadata. Validate sidebar editors as well as the main worksheet and reveal every hidden/collapsed ancestor before focusing invalid input. Keep mirrored error IDs unique. Refresh linked Fit style immediately after Pattern Card style changes.
- Keep schema 2 and database identity, previous drafts, original image bytes and named revisions. Complete print/CSV/JSON uses source data, without duplicate sidebar rows. PWA updates remain explicit and save-first. Deploy only sanitized static workroom files under the existing workroom subdirectory and preserve the portal.

## Pattern reference gallery (v0.7.2)

- Preserve multiple Pattern Card sketches/photos as a gallery while showing one selected image at a time. Previous/Next and Displayed photo must update the pinned preview across worksheets and on phones. A gallery takes priority; existing single-image packs keep their fallback behavior.
- Retain every original image byte, order and selected position in local drafts, JSON, undo/redo and named revisions. Remove displayed photo affects only that image, and invalid upload batches must leave the gallery unchanged. Print the selected image; complete JSON retains all images.
- Read `docs/reference-gallery.md` and retain its source/model/storage behavior. Do not collapse gallery arrays into a single-image field when adding component schema 3; preserve gallery representation and selected position in both ordinary schema-2 packs and component packs, using the same IndexedDB identity. Keep the pinned panel and existing house color assignments unchanged.

## Local component workbook workflow (v0.8.0)

- Read `docs/component-workbook-workflow.md`. Import locally through Export → Import component workbook (.xlsx), review a preview, then Apply. `src/workbook-xlsx.mjs` reads the local source; `src/garment-development.mjs` validates definitions/working values; `workbook-web/development-view.mjs` renders component entry and complete printing. The Components tab exists only after import. Rebuild tracked `tech-pack.html` with `npm run techpack:build` after source changes.
- Recognize authored POM codes in column A of `*-SPEC` sheets, labels in B, methods in D. Retain exact source text, formulas, merges, source rows and SHA-256 locally. Do not calculate source formulas, infer source `±`/`Adj` semantics, or copy filled numeric source cells into working targets, tolerances, actuals or proposals. Leave units unassigned until explicit CM/IN selection; working values stay canonical CM and support the existing fractional-inch input.
- Shared-style import defaults are unchecked and opt-in, fill only blank mapped fields, and never replace local nonblank values. Imported source/raw metadata can be private; it belongs only in local pack JSON, not public builds or fixtures. The supplied review workbook has nine sheets/four components/60 POMs (32/11/11/6), but do not publish its staff/style/POM text or filled workbook.
- Sample labels, rounds and notes identify independent general/front/back/left/right observations. Delta is actual minus target; tolerance assessment needs target, actual and both explicit non-negative limits. Zero is not missing. Proposed signed changes and derived proposed targets are unapproved and must not automatically alter a working target or produce a negative target. Never infer garment specifications from the BF mannequin or RC client data.
- Reimport matches component-sheet/POM identity, preserves all local working values and observations, retains removed rows/components as retired, and keeps prior labels/methods with their source hashes. Refuse stale/altered previews. When a changed source is applied with local storage available, preserve a recovery revision before replacement. The latest raw source is in JSON; workbook images are not imported and can only be added separately through existing reference-image controls.
- Keep original six sheets, BF/RC data, source formulas, brands/assets, previous drafts/revisions and the same IndexedDB identity intact. Ordinary new packs remain tech-pack schema 2; imported component packs use schema 3 with development schema 1. Do not reset local storage. CSV and print must include all components and every nonblank sample/side observation, including zero; JSON preserves complete local source/definition history, and CSV also carries definition history.
- Validate node, browser, migration/reimport and PWA update workflows before claiming v0.8.0 is complete or hosted. Earlier v0.7.0 evidence is historical, not current proof. Publish no filled workbook, private source metadata, saved pack, screenshot or attachment, and preserve the existing three-head portal when preparing any workroom deployment.
