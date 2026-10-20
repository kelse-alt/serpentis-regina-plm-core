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
The founder authorized publication of this repository's actual approved records and Git history. Do not invent data changes or apply that authorization to unrelated third-party information. No credentials in code; no unrequested cloud deployment, network analytics, or external CDNs in reports. Favor accessible, elegant, print-friendly table design with a pink/ivory house aesthetic and clear POM columns.

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
