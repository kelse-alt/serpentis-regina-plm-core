# Serpentis Regina — Codex Project Instructions

## Project identity and scope
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

- `data/templates/remote-bespoke-client-intake.v1.json` is the sanitized template extracted from the supplied Remote Bespoke Dress workbook's `CLIENT BODY MEASUREMENTS` tab. Preserve original labels, methods, required markers, palette values, and palette source-cell provenance.
- The client template has **34 RC POMs**, **19 required**, with **RC-21 absent**. Do not renumber them or map them onto the approved 20 BF POMs. RC-12/RC-13 retain source questions that need house clarification; never silently resolve them.
- The source contains no comparison reference or delta formula. Do not invent a house/manufacturer baseline or import the existing generator's delta rule into this intake.
- Default unit is **CM**, with **IN** available. Store canonical `valueCm`; display conversions use up to six decimal places without cumulative rounding. Unit switches must not rewrite fixed centimeter landmarks in methods.
- `src/client-intake.mjs` is the shared browser/Node calculation and validation module. `src/client-intake-server.mjs` serves the local app and stores client drafts in the separate ignored `storage/client-intakes.sqlite` database. `client-web/` contains its UI.
- Run `npm run intake` (Node.js 24+, default loopback port 3002). Run `npm run intake:build` via `scripts/build-client-intake.mjs` to build `client-intake.html` and its `reports/` copy. Rebuild the tracked standalone file after source changes. See `docs/client-intake.md` for user instructions.
- Save/reopen permits partial drafts. Completeness checks identity/date/all 19 required measurements; it is not approval. CSV/JSON export, compatible JSON import, and blank/filled print are local features. The separate croquis PDF was not included; reference areas accept notes, not attachments.
- Keep the original XLSX outside the checkout. Never include filled client identities, project values, measurements, exports, database files, or screenshots in public Git, test fixtures, release ZIPs, or prebuilt HTML. The public artifact contains only the sanitized blank template. Earlier publication authorization for the approved house dataset does not authorize publishing future client records.
- Preserve the approved 20-POM source JSON and its existing workflows unchanged. Standalone browser client drafts, local SQLite client intakes, and earlier generator sessions are separate stores; do not claim synchronization or remote client submission.
