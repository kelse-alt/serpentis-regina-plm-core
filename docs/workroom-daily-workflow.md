# Daily workroom workflow — v0.6.0

This edition develops the six-tab workroom into a daily editing workflow for
the founder, designers, pattern makers, seamstresses, machinists and garment
technologists. The six original worksheets, house style, original assets and
distinct measurement formulas remain in place.

Download the [current branch ZIP](https://github.com/kelse-alt/serpentis-regina-plm-core/archive/refs/heads/codex/workroom-style-revisions.zip),
extract it, and open **tech-pack.html**. With Node.js 24+, use
`npm run techpack` for a local HTTP preview or `npm run techpack:build` after
source changes. The app requires no remote service. Browser storage belongs
to the browser/profile and origin used to open the app; keep JSON backups when
moving between a local file, local server, browser or device.

## 1. Set up the style once

Use the shared style record for style number, description, category, season,
base size, sample size, maker, pattern revision, owner and fabric. Garment unit
selection is shared by garment sheets; the mannequin reference has its own
view-unit control. Not every legacy field has the same meaning as a shared
field: reference-pattern numbers, stages, dates and revision notes are not
automatically equated. Blank sample-size and season fields in both wash rounds
inherit shared defaults; an explicit override stays independent in each round.

Relevant sheet headings and documents read the same current record instead of
asking you to retype it. Explicit sheet/sample overrides retain intentional
differences; an override is not silently replaced by a later shared edit.
A blank mapped sheet field inherits the shared value; a nonblank field is an
explicit override. Review and clear that override when you want shared edits
to apply there again.

For example, one style can have a shared fabric and sample size while a later
wash round records its own sample context. A historical named revision keeps
its original values when the working draft changes.

New packs use tech-pack **schema version 2**. Version-1 JSON and local drafts
are migrated without inventing garment specifications or silently resolving
conflicting per-sheet metadata. Review retained overrides before consolidating
them into the shared style record. The original approved house dataset and
its schema/revision are separate from this application schema.
Conflicting legacy Pattern Card identifiers leave the shared style number
blank for review; owner and pattern revision are not guessed from unrelated
old fields.

## 2. Save, recover and compare work

Valid edits autosave to a recoverable draft in **IndexedDB**. Read the actual
save status before closing the app. **Save** deliberately persists the current
draft; named revisions are separate immutable local snapshots for milestones
such as an internal fitting or pattern revision.

- Reopen a saved draft to continue all six sheets.
- Create a named revision with the relevant local author/reason information.
- Compare revisions to review changed fields and measurements.
- Review a restore comparison, then confirm it. The app preserves the current
  draft as a recovery snapshot before restoring the selected revision. Earlier
  snapshots and their original images remain unchanged.
- Download JSON for a portable pack backup and import compatible JSON to
  reopen it. Pack JSON contains the current draft and images; named revision
  history remains on this device. A conflicting imported pack ID creates a
  separate working copy, preserving the existing saved draft. Local autosave
  does not create cross-device synchronization.

An author name is locally entered information, not an authenticated signature.
A named snapshot is not production approval or an issued maker release.

Original raster images are stored as separate **Blob** records, retaining
their bytes and colors. Portable JSON reconstructs the embedded references.
Browser storage still has capacity and availability limits. If a save fails,
the app must report that failure and offer JSON download rather than claiming
the draft is safely saved.

Legacy localStorage drafts are checked individually. Valid records can migrate
while incompatible records remain recoverable; one invalid record must not
hide the valid saved list. The old localStorage bytes are retained. A recovery
download preserves incompatible source records for investigation. Cross-tab
conflicts require reopening the newer draft instead of silently overwriting it.

## 3. Enter and compare specifications efficiently

Choose garment **CM** or **IN** before entering garment measurements. IN entry
accepts decimal and fractional values such as `1/2` and `24 3/8`; the latter is
**61.9125 canonical CM**. CM entry remains decimal. Negative entries are allowed
only in fields designed for signed values. Quantities are not converted as
lengths. Empty measurements remain missing and explicit zero stays zero.

For spreadsheet data, choose the starting editable cell, paste a rectangular
range, and review the preview before applying it. Pasting follows the visible
editable columns and skips calculated/read-only cells. The complete range must
validate before it is applied; invalid or out-of-bounds cells identify their
paste row/column and do not partly overwrite the table. Per-row manual wash
delta exceptions remain editable. Check the destination rows/columns in the
preview, especially with search or a comparison view active. Destinations stay
in the same columns throughout a range; encountering a locked cell on another
row rejects the range rather than shifting values into a different spec.

Undo/redo supports recovering editing mistakes, including an applied paste.
Column comparison views reduce the columns shown for a task while retaining
the full underlying worksheet. A view change does not delete specifications
or make a filtered screen the whole export. Use the visible mobile Save/Export
actions for JSON backup, worksheet CSV or complete printing. On phones, open
Style, revisions & files to select working columns; on desktop, use Columns
in the sheet toolbar. Multi-line text can instead be kept in a single cell
from the paste preview.

## Measurements and presentation remain controlled

- Garment values remain canonical CM with display conversion only. The
  approved BF mannequin record remains canonical inches with its independent
  reference-unit selector. RC client intake remains a separate workflow.
- Wash delta remains **Target − After Wash**, including the original manual
  exceptions. Master delta remains **Sample Actual − Approved Base**. House
  delta remains **Actual Form − MFR**. Missing operands do not become zero.
- Body target formulas I31:I33, unlabelled Pattern Card column E, source
  example measurements and unspecified grading/ease decisions remain
  unresolved source content. Editing conveniences do not settle them.
- Preserve every current interface color assignment: Electric fills use Ruby
  text; table text remains matte ash; no Salmon UI or red outlines. Original
  photographs, seal, fonts and artwork keep their source bytes/colors.
- Print still includes complete selected worksheets, active units and record
  details independently of search or comparison-column views.

The [original workroom guide](tech-pack-workroom.md) documents worksheet source
coverage and formula provenance. Its v0.5 saving behavior is superseded by this
guide. The [master-library strategy](master-library-strategy.md) is a future
design plan: a terminology/POM library, structured fittings, BOM, construction
modules and authenticated production-release workflow are not delivered here.

## Check the build

Run `npm test` and `npm run techpack:build`; inspect the generated blank app and
the current browser validation evidence before recording a passing result.
Publish only blank previews and authorized house templates. Filled packs,
past-job source files, client identities and private images remain local.

[Desktop preview](previews/workroom-daily-desktop.png) ·
[Comparison preview](previews/workroom-daily-master.png) ·
[Phone preview](previews/workroom-daily-mobile.png) ·
[Shared style preview](previews/workroom-daily-style.png) ·
[Browser evidence](validation/workroom-daily.json)

## Verification for this revision

All 82 application tests, 36 sheet/viewport combinations and 38 browser
workflow checks pass. Checks cover style inheritance and explicit overrides,
legacy migration/recovery, original-image Blob round trips, fractional entry,
invalid raw values, atomic paste, undo/redo, named revisions, guarded restore,
delayed save/open races, JSON transfer, complete CSV/PDF output and unavailable
storage fallback. Current-sheet printing retains all 30 master rows and all
columns; all-sheet printing retains all 190 source rows. Browser evidence and
previews contain blank templates and non-identifying results only.
