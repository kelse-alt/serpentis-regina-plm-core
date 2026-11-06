# DWILLA SR-001 implementation review — 2026-11-06

## Scope and result

Implemented on `feature/dwilla-sr001-integration` from main commit
`c0f0c8eda017e0c702d137a1ff02c31c920094f1`. No merge, production change or
deployment is included. The source Drive workbook was read without any write
operation. Its downloaded bytes retained the same SHA-256 after extraction.

The source describes a two-way dress with a mesh bodice, cutouts, silk shell and
skirt, sample size 8. Target market, fit intent, production size range and garment
units remain confirmation items. This output is working software and a private
source audit, not a production-approved tech pack.

| Source group | Definitions checked |
| --- | ---: |
| Main garment / mesh | 32 |
| Cutout | 11 |
| Silk shell | 11 |
| Skirt | 6 |
| **Garment total** | **60** |
| Separate fit-form reference | 20 |

An independent read using openpyxl compared all 60 codes, descriptions and
how-to-measure strings, including original spelling and whitespace, against the
standard-library OOXML extraction. It also checked all E:O source fields for each
garment row and E:L for all 20 fit-form rows. Shared formula translations were
checked against the independent reader. All passed. There are 64 formula-bearing
garment cells and no populated numeric garment values in the audited E:O fields.
Blank formula caches are not literal `None` text or numeric zero.

The unassigned master-sheet examples are retained privately, without treating
them as garment targets. Source fit notes and attendees remain private and are
not interpreted as proof of fitting completion. The workbook's pending fit-form
status remains separate from the repository's approved house record.

## Delivered architecture

- `scripts/import-dwilla.py`: read-only bounded OOXML import, complete code order
  checks, exact source cells, formula metadata, exclusive private output writes.
- `src/dwilla-fitting.mjs`: dictionary/session validation, contextual readings,
  landmark references, explicit units, targets/tolerances and fitting progression.
- `src/dwilla-store.mjs`: immutable content-addressed private snapshots with
  fingerprint verification when reopened.
- `scripts/dwilla.mjs`: local init, validate, save, show and advance commands.
- [Operating guide](dwilla-integration.md): record schema, examples and minimal
  Samsung/Termux checkout instructions.

The existing 20-POM approved JSON, measurement generator, SQLite registry and
34-POM client intake are unchanged. Garment data is kept in separate private JSON
records, avoiding an unrequested migration of those established stores.

## Validation

The baseline had 48 passing tests. After implementation, all 56 tests passed
(48 existing and 8 new). New tests exercise 60+20 definitions, literal source
strings, whitespace, zero and missing cells, normal/shared formulas, exclusive
outputs, invalid revisions, multiple readings, landmark references, units,
nullable targets, asymmetric tolerance boundaries, explicit sample progression,
immutable persistence and corruption detection.

The existing house report command, database import and repeated idempotent import,
database-backed report, standalone generator build and client-intake build also
passed. Rebuilding both tracked HTML artifacts produced no changes. Public CI
can run the synthetic tests without access to the proprietary workbook. Python 3
and Node 24+ are required; no new third-party runtime package is needed.

## Author review

Reviewed the changed code, private-data boundaries, failure paths and tests.
Independent source verification caught shared formula followers that initially
looked like blank cells; the importer now retains their shared origin and OOXML
attributes, with a regression test. Code-count validation was also tightened to
reject unexpected additional measurement codes. Dates cannot progress backwards.
No private workbook, extracted descriptions/measurements, fit identities,
credentials or generated fitting snapshots belong in the proposed commit.

This is an author self-review, not independent reviewer approval. GitHub review
and CI status are reported on the pull request; no approval is fabricated.

## Limitations and next decisions

1. Confirm garment units, fit intent, landmarks and the meaning of ambiguous source
   headings before entering targets or tolerances. No missing values are invented.
2. Record first-fitting measurements and fit actions privately. An explicit advance
   decision requests the next sample; it does not approve production or resolve
   open notes. The review state still requires a separate house approval process.
3. The workflow currently uses local JSON/CLI editing. A touchscreen fitting UI,
   authenticated API, SQL garment tables, grade rules and live Drive sync are not
   included. Those should be separate reviewed features.
4. All readings in one fitting use one explicitly confirmed unit. Cross-unit
   conversion must be documented in a separate revision; automatic conversion is
   not implemented. Contexts must distinguish front/back, left/right and wash
   conditions when targets differ.
5. Import version names are house-managed; exclusive output files prevent
   overwriting, but there is no global dictionary revision registry. Fingerprints
   detect accidental changes, not hostile filesystem access. Private backups are
   necessary; ignored directories are not encrypted.
6. The original XLSX remains the complete visual source. The extraction retains
   cell content and style IDs, not embedded images, full formatting definitions or
   a round-trip authoring representation. Formula calculation is not implemented.

Do not merge, host or deploy this branch until the founder approves the result.
