# DWILLA SR-001 — private garment development workflow

Category: two-way dress with mesh bodice, cutouts, silk outer shell and skirt.
Source sample base: size 8. Market/fit intent and production size range require
house confirmation; no grade rule, tolerance or missing spec is inferred.
This is a working development integration, not an approved production tech pack.

## Architecture and privacy

The existing Node 24 modules, built-in SQLite house registry, measurement sessions
and client intake remain unchanged. This feature adds an isolated garment layer:

1. Python 3 standard-library OOXML reader → private versioned dictionary JSON.
2. Shared JavaScript validator and fitting calculations → local fitting drafts.
3. Content-addressed immutable JSON snapshots → `storage/dwilla/`.

No dependency installation, server, external CDN, deployment, or cloud upload is
needed. Importer and CLI refuse outputs inside the checkout outside `private/`.
The original XLSX is read only. Workbook formulas are preserved, never executed;
shared formula followers retain the origin expression, origin cell and exact
OOXML attributes. Excel remains the authority for formula calculation.

`private/`, `storage/dwilla/`, XLSX/XLSM files and Python caches are ignored. This
is accidental-publication protection, not encryption or access control. Never
force-add private files. Public tests use wholly synthetic labels and values.
Dictionary descriptions, fit attendees, source cells and workbook data stay local.

## Import

Place the workbook outside the repository; copy its path into this command:

```bash
python3 scripts/import-dwilla.py /path/to/original.xlsx --revision v1 --output private/dwilla.v1.json
```

The importer checks the style and every code in order, requires all four groups
(32 main, 11 cutout, 11 silk shell, 6 skirt) and the separate 20 BF references.
It preserves source spelling/whitespace, exact code, method, cell coordinates,
raw values/types, formula expressions/attributes and cell style IDs. Every sheet's
cell content is retained privately, including fit notes and unassigned master
examples. Images, formatting definitions and charts remain in the original XLSX;
this JSON is not a lossless workbook replacement.

Use a new output filename and revision for a changed workbook. Existing outputs
are never overwritten. The source SHA-256 identifies the imported bytes; it is
not a digital approval signature. Revision labels are house-managed, not a global
revision registry. Identical imports to a different path can create duplicate
copies; the importer does not synchronize Google Drive.

## Definition and fitting records

The private dictionary has `schemaVersion`, `dictionaryVersion`, `styleId`,
`sourceSha256`, `definitions`, `fitFormReference`, `sourceSheets` and `warnings`.
Definitions retain `sourceFields` E:O without assigning ambiguous source headings
to spec/actual/tolerance semantics. `target`, `tolerance` and `unit` start null.
`landmarkReferences` starts empty with `landmarkStatus: requires-review`; the
exact measuring method remains authoritative. Add confirmed landmarks to a fitting
and reference their IDs on readings. Do not treat an inch landmark as proof of the
whole sheet's measurement unit.

The imported BF reference preserves its original pending-verification provenance;
it does not replace or downgrade the repository's separately approved house JSON.
Body-form deltas are never garment tolerances, ease or grade rules.

Create a first-fitting draft after confirming the unit (IN or CM):

```bash
npm run dwilla -- init private/dwilla.v1.json private/first-fitting.json SAMPLE-001 proto-1 IN 2026-11-06
```

Dates, IDs and unit in this example are user-supplied inputs, not source facts.
Edit the draft JSON locally. The CLI deliberately has no hosted/browser UI yet.
For touchscreen editing, use Termius's editor or a local text editor. All readings
in one fitting use its explicitly chosen unit; no automatic conversion occurs.
Never relabel IN readings as CM: start a separate correctly converted revision
and retain the conversion rationale in a note.

Synthetic example additions (not DWILLA specs):

```json
{
  "landmarks": [{"id":"marked-waist","description":"Confirmed marked reference level"}],
  "readings": [{"id":"reading-1","pomCode":"M01","context":"front-left-unwashed","value":10,"unit":"IN","condition":"unwashed","observer":"Your name","landmarkIds":["marked-waist"]}],
  "specs": [{"pomCode":"M01","context":"front-left-unwashed","target":null,"tolerance":null,"authority":"Awaiting house confirmation"}],
  "notes": [{"pomCode":"M01","text":"Confirm reference before setting target","author":"Your name","status":"open"}],
  "decision": null
}
```

Copy the arrays/decision into the generated draft, retaining its identity fields.
Use distinct reading IDs for repeats and distinct contexts for front/back,
left/right or wash conditions requiring different targets. Do not average the
two readings of a panel into one spec. Specs match by POM and exact context;
use the same context for repeated readings against one target. Tolerance format
is `{"minus":0.1,"plus":0.2}` in the session unit; enter only confirmed values
with an authority/rationale. Missing targets or tolerances remain unresolved,
never passing by default. Delta is reading minus target; limits are inclusive.

```bash
npm run dwilla -- validate private/dwilla.v1.json private/first-fitting.json
npm run dwilla -- save private/dwilla.v1.json private/first-fitting.json
```

Save returns a snapshot ID. Use it to reopen a summary:

```bash
npm run dwilla -- show private/dwilla.v1.json SNAPSHOT_ID
```

To request a second sample, set an explicit decision on the first-fitting draft:
`{"action":"advance","author":"Your name","reason":"Request revised sample"}`.
Save it again, then use the new snapshot ID:

```bash
npm run dwilla -- advance private/dwilla.v1.json SNAPSHOT_ID private/second-fitting.json proto-2 2026-11-10
```

Progression requires a new sample revision and explicit decision. Readings reset;
specs, landmarks and open/resolved notes carry forward. The prior snapshot remains
unchanged and its ID becomes the predecessor. Repeat from second fitting to
`review`. Review is a handoff state, not production approval. `hold` and `revise`
decisions can be saved without advancing. Open notes are reported; they do not
block a deliberate advance because a revised sample may be needed to resolve them.
Progression does not assert all 60 POMs were measured, resolve notes automatically,
or infer that the workbook's existing fit instruction proves a completed fitting.

## Validation and limitations

Run `npm test` (Node 24+ and Python 3 required). Synthetic tests cover all 60 codes,
the separate 20 references, raw strings/blanks/zero, ordinary/shared formulas,
exclusive outputs, units, repeated readings, landmarks, tolerances, invalid
records, explicit progression, immutable snapshots and corruption detection.
The proprietary workbook is intentionally absent from CI; exact source acceptance
is an additional private audit, not a claim that public CI reads the real workbook.

This is a local CLI/module workflow. There is no new fitting UI, API, SQLite
migration, live Drive sync, grading system, approval signature, user authentication
or deployment. JSON snapshots detect accidental modification, not malicious
rewriting by someone with filesystem access. Back up `private/` and
`storage/dwilla/` privately. Review units, ambiguous columns, landmarks, fit intent,
targets and tolerances with the house before manufacturing use.

## Samsung / Termux

The cloud work does not need access to the phone. To inspect the feature branch
in the existing clone without changing its current checkout:

```bash
cd ~/syren-ai-lab/plm-core
git fetch origin feature/dwilla-sr001-integration
git worktree add ../plm-dwilla --detach origin/feature/dwilla-sr001-integration
cd ../plm-dwilla
npm test
```

Node 24+ and Python 3 are prerequisites (`node --version`, `python3 --version`).
The private dictionary is delivered separately; place it in `private/` or rerun
the import from the original downloaded workbook. Never commit that data.
