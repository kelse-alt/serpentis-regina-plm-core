# Component workbook workflow — v0.8.0

Import a garment component workbook into the existing workroom without replacing
its six base worksheets, approved BF form reference, or separate RC client intake.
Imported definitions and local working measurements remain distinct.

**Verified and live:** Workroom v0.8.0 is published at the existing address.
Check the version in **Export → Install & app info**. For an existing installed
copy, choose **Save & update app** when offered before trying component import.

## Open the current build

Use the matching project ZIP's `tech-pack.html`. With Node.js 24+, build and preview
the current source from the repository root:

```bash
npm run techpack:build
npm run techpack
```

Open the local address printed in the terminal. The installable workroom remains
at its existing `/workroom/` address; a source update does not by itself deploy it.
Keep a current JSON backup before changing devices or updating an installed app.

## Import and review

1. Open the intended working pack. Save or export its current state first.
2. Choose **Export → Import component workbook (.xlsx)** and select the local file
   (up to 20 MB). Reading the file does not upload it or change the original.
3. Review the preview: component sheets, authored POM codes, original labels,
   methods, and additions/changes/retirements. Cancel leaves the pack unchanged.
4. The optional shared-style checkbox starts **unchecked**. Enable it only to copy
   recognized source values into currently blank shared-style fields. Existing
   local values are never overwritten by this option.
5. Choose **Apply**. The **Components** tab appears after a successful import.

The importer recognizes worksheets ending in `-SPEC`. It reads authored POM codes
from column **A**, original labels from **B**, and measuring methods from **D**.
It preserves the source cells, formulas, merges, filename, and SHA-256 separately
as local source notes; it does not calculate workbook formulas. Formula-backed
codes are not treated as authored definitions.

The supplied workbook's review target is **nine worksheets**, **four components**,
and **60 authored POMs** (32 / 11 / 11 / 6). Its original file stays outside Git.
The distributed application contains no filled copy of that workbook.

Even when source numeric cells are filled, initial local targets, tolerance limits,
sample actuals, and proposals stay blank. The source's `±` and `Adj` labels are not
silently interpreted as tolerance rules or approved changes. Imported images are
not supported; attach reference images separately through the existing image tools.

## Develop measurements

Choose garment **CM** or **IN** before entering numbers. No garment unit is assumed.
The app stores canonical centimeters and formats the selected unit; the existing
fractional-inch entry behavior remains available. Blank values remain missing,
while an entered zero remains a real value.

Select a component and create a working sample with a name, round/version, and
notes. Each sample keeps **general, front, back, left, and right** observations
independently. Switching the visible sample or side does not delete other entries.

| Field or result | Meaning |
|---|---|
| Working target | The local measurement you are developing for this POM |
| Sample actual | An observation for the selected sample and side |
| Delta | Sample actual − working target |
| Tolerance − / + | Explicit non-negative distances below/above the target |
| Proposed adjustment | A signed, unapproved change to the working target |
| Proposed target | Working target + proposed adjustment; not applied automatically |

Tolerance assessment requires the target, actual, and **both** tolerance limits.
An omitted limit is not zero. Being inside configured tolerance does not approve
a garment. Proposals remain separate from targets and do not revise them.

One small JavaScript example to execute and inspect:

```js
const actual = 10.5;
const target = 10;
const delta = actual - target;
console.log(delta); // 0.5, displayed as +0.5
```

The same function repeats that operation for the selected POM/sample/side. Follow
one observed result before moving to another concept; prediction quizzes can wait.

## Reimport without losing local work

Import a revised XLSX into the same pack and review the changes again. Component
sheet identity plus authored POM code identifies a matching row. Its local targets,
tolerances, proposals, notes, and all sample/side observations are retained.

Changed labels/methods retain prior definitions with source rows and source hashes.
Removed POMs/components remain as retired rows with their local values. Reappearing
identities can reactivate. Renaming a sheet or changing a POM code does not guess
a new correspondence: the old identity is retained and a new row starts blank.

Applying a stale or altered preview is refused. When a changed source file is
applied and local storage is available, the app saves a recovery revision before
replacing the source snapshot. A storage conflict blocks source replacement.
If storage is unavailable, the preview requires **Download current pack backup**
and confirmation that you kept that JSON file before applying. A requested
download is not described as a successful local recovery save.

## Save, export, and publication boundaries

Existing IndexedDB drafts, autosave, named revisions, undo, and recovery remain in
use; no database reset is needed. Older packs remain compatible. New packs keep
tech-pack schema 2; importing components uses schema 3 with development schema 1.

Pack JSON includes the latest raw workbook source and component data, including
earlier definition history. CSV and printing include all components and all entered
sample/side observations, including zero, rather than just the currently visible
sample. CSV also carries definition history; JSON is the complete portable backup.

Raw source notes and exports may contain private workbook metadata. Keep the
original workbook, filled packs, exports, screenshots, and project images local;
do not commit them to public Git or embed them in the application build. Publish
only generic code, sanitized examples, and blank previews. Existing house colors,
artwork, approved BF data, and RC intake rules remain unchanged.

See [daily workroom use](workroom-daily-workflow.md),
[iPhone installation](iphone-workroom-app.md), and the
[future master-library strategy](master-library-strategy.md).

## Verified checks

- **112 Node tests** passed, including XLSX validation, source preservation,
  schema compatibility, independent observations, fractional tolerance boundaries,
  and the existing house/client workflows.
- The supplied workbook's **60 POMs across four components** passed the same
  [nine browser workflow groups](validation/component-workbook-source-check.json)
  as the [invented workbook](validation/component-workbook.json): exact import,
  save/reopen, units, independent samples/sides, gallery preservation, reimport,
  complete JSON/CSV/PDF, phone layout, unavailable storage and conflicts.
- Existing daily editing passed **36 layouts and 38 workflow checks**. Pinned
  style and gallery regressions passed. Chromium passed **19 PWA checks and
  three phone layouts**, including offline reopening and explicit updates.
- [Live HTTPS checks](validation/component-workbook-live.json) confirm all eight
  files match the tested build and all ten portal files remain unchanged.

Functional browser checks used the identical local hosted build. WebKit is not
installed in this environment; physical iPhone installation and native file-picker
behavior remain untested. Source records, measurements and project images are
excluded from the published evidence.
