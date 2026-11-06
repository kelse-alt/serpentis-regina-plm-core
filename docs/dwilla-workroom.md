# DWILLA fitting in the existing Workroom

This increment extends the existing Serpentis Regina Workroom. SR-001 uses the same shared style record, navigation, local draft store and named revision system as the six-tab tech pack. It does not replace the Workroom or create a second application.

## Source and review state

The editable Workroom base is `codex/workroom-brand-hierarchy-v0.9.2` at `276053f53195987172373f7498d07a5f6c076499` (the v0.9.5 source). The matching public distribution is on `portal-site` at `b8f03c3a2253071781ef763dfaf36da788b58745`; that branch contains built files.

PR [#22](https://github.com/kelse-alt/serpentis-regina-plm-core/pull/22) was verified open and unmerged on November 6, 2026. Its head is `976246a01e3528d162d1d011bcb22278029dfdb2`. Its importer and fitting modules were integrated locally into `feature/dwilla-workroom-fitting`; this does not merge the public PR. Historical CI for that head passed. This increment needs its own current validation.

Nothing in this guide authorizes pushing, opening a public PR, merging or deploying. The founder requested review of the concrete local result before public publication and separate approval for merge or deployment.

## Prepare the private dictionary

The public implementation contains synthetic examples only. The 60 garment definitions and their exact descriptions and measuring instructions enter the browser through a private import. The 20 fit-form reference measurements remain a separate reference; they are not garment targets.

1. Download the original [Drive workbook](https://docs.google.com/spreadsheets/d/1yXo2dRFUFBJXT7fQlsxJkoWVH5pfSSQn/edit) as an `.xlsx` without changing the source. Keep the downloaded workbook outside the repository.
2. From the feature checkout, run Python 3's read-only importer:

   ```sh
   python3 scripts/import-dwilla.py /path/to/original.xlsx --revision v1 --output private/dwilla.v1.json
   ```

3. Open the Workroom, open **Fittings**, and import that private dictionary JSON. Check `sourceSha256` and `dictionaryVersion` in that private JSON before recording a real fitting.

The importer verifies the style, all four garment groups and their code sequence: 32 main, 11 cutout, 11 silk shell and six skirt definitions. It preserves source text and source-cell provenance. It does not evaluate spreadsheet formulas or infer units, targets, tolerances, landmarks or approvals from the workbook. It creates the output exclusively and will not overwrite an existing revision file. For a changed source, use a new revision and output path.

The `private/` directory is ignored by Git. Ignoring a file is an accidental-publication safeguard, not encryption or access control. Never move proprietary dictionary JSON, source workbooks, filled backups or photographs into tracked files, public fixtures or generated HTML.

## Run locally

Use Node.js 24 or newer and Python 3. From the feature checkout:

```sh
npm test
npm run techpack:build
npm run techpack
```

Open `http://127.0.0.1:3003` in a browser on the **same machine** as the server. The generated `tech-pack.html` is the standalone Workroom; it includes no private dictionary or saved fitting records. Use a stable browser origin for persistent work, because changing host, port, browser or profile selects a different store.

On the founder's Samsung, the existing checkout is `~/syren-ai-lab/plm-core`. Updating that device is a later step after publication approval; no public fetch command for the new unpublished feature is available yet. Samsung loopback is not the iPad's loopback. An iPad cannot reach a Samsung server bound to `127.0.0.1` by using that URL. Cloud development and verification do not require access to the Samsung's private Wi-Fi address.

## Record a fitting

1. Open or create the SR-001 style in the existing Workroom. Import the private dictionary in Fittings, or use the clearly labelled synthetic demonstration for review.
2. Select the sample ID, sample revision and the pattern revision that produced it.
3. Start a first fitting with its date and explicit **IN** or **CM** unit. Record the observer with each reading. The dictionary does not establish a garment unit. Keep a fitting's readings in its confirmed unit; later fitting stages follow the explicit progression workflow.
4. Choose a measurement group and POM. Read its exact imported method. Record the context, such as front/back or left/right and wearing configuration, before adding a decimal reading. Add repeated readings as separate records rather than replacing an earlier result.
5. Enter a target and tolerance only when the house has supplied them, with the authority for that specification. An empty measurement stays missing. A zero reading is a real value. No target means no delta; no complete tolerance means no tolerance judgment. A result within tolerance is not approval.
6. Add fit issues and alteration actions with author and reason. Name both wearing configurations using your own house terms, then record qualitative observations for mobility, closure access, cutout stability and the interaction of mesh and silk shell under each named configuration. These observations do not create new POMs.
7. Attach a local photo when needed and add notes or numbered markers linked to the relevant POM, fitting and alteration action. Preserve the original image; markers are separate annotation records.
8. Save and check the displayed save state. Reopen the saved pack and fitting to confirm the readings, contexts, actions and photographs are present.
9. Record an explicit decision with author and reason before requesting the next sample revision. Identify its intended next pattern revision. Prior fitting snapshots and the originating sample's pattern revision stay unchanged; unresolved actions carry forward as unresolved. A next-sample request is not production approval.

The browser stores entered names and dates as user assertions. They are not authenticated signatures, independently verified events or an approval history inferred from the source workbook.

## Where the data lives

Normal Workroom builds save to IndexedDB under `serpentis-regina.workroom.v2`, scoped to the current browser origin and profile. Fitting data is part of the existing style pack. Pack schema 4 adds the private dictionary, sample and pattern traceability, working fitting draft and preserved fitting snapshots; older packs continue through the existing normalization path.

Original raster photo bytes stay in the existing local image store. Annotations reference those images and do not rewrite them. Private photo attachments are local imports, not uploads to GitHub, Google Drive or a hosted server. The public application shell and its service-worker cache contain no entered records or photos.

The normal standalone build blocks network connections through its Content Security Policy. This protects against accidental application submission; it does not authenticate people with access to the device. There is no account layer, application encryption or automatic cross-device synchronization. Browser extensions, other same-origin code, shared profiles and people with access to the device remain outside that privacy boundary. Use a private, trusted browser profile and protect the device.

Safari and an installed iOS/iPadOS PWA may use separate stores. A private browsing session may discard records. Browser storage can be cleared or evicted. The separately maintained cloud Workroom is a different storage mode; this increment does not add fitting synchronization to it or transfer local drafts automatically.

## Backup and recovery

A current-pack JSON export transfers that pack. **Export → Download complete private backup** preserves the dictionary, samples, fitting draft and snapshots, original attachments, saved drafts and named revision history across the local directory. Keep a directory backup before changing browser profiles, origins, devices or storage.

Backups are sensitive, unencrypted files. Store them in a private location with the same care as the original workbook and photos. Do not commit, attach to a public PR or send them as demo fixtures. A download request is not proof that a file was saved; verify that the file exists before relying on it.

Test recovery into a separate, empty browser profile or store:

1. Save current work and download a directory backup. Keep the original browser store intact.
2. Open a separate empty profile at the same application version. Use **Export → Restore backup into empty store** to import the directory backup. Restore requires an empty store so it cannot silently overwrite existing work.
3. Reopen the restored style and fitting. Check sample/pattern links, readings, open actions, original photos, markers and named revision history.
4. Only treat the backup as tested after the restored records are usable. Keep the original store until recovery is confirmed. Do not clear your only copy to make an empty store.

The directory backup format is `serpentis-regina-workroom-backup`, version 1. It accepts at most 100 MiB of UTF-8 JSON, 100 saved drafts and 1,000 named revisions. Import validates the entire archive before committing the restore. A populated destination is refused; malformed input or a failed transaction must leave the destination unchanged. This backup does not synchronize another open browser or migrate the separate CLI filesystem snapshot store automatically.

## Review and validation record

The acceptance flow uses synthetic data: open Workroom → select DWILLA → select sample and pattern revision → start fitting → add contextual repeated measurements → add issue and photo annotation → save → reopen → request next sample revision → export and restore into an empty store.

Current local result: **149 tests pass**. The full synthetic Chromium flow and empty-store recovery pass, including original photo-byte equality, POM/action markers, named history/gallery compatibility, partial target/tolerance editing, unfinished-entry progression blocking and Undo/Redo history retention. Sixteen grouped browser checks report no browser errors; the full-flow network trace records no external requests. All visible fitting controls meet 44px touch targets at 1024×1366, 1366×1024 and 390×844 viewports with no page overflow. Standalone, PWA and cloud builds and the existing generator/intake/SQLite workflows pass. The linked original XLSX was independently checked: all 60 garment labels/methods and 20 separate BF reference labels/methods match exactly; source bytes remain unchanged and the dictionary is ignored privately. See the [implementation report and synthetic screenshots](dwilla-implementation-report.md). Public CI for this new branch has not run because publication is awaiting approval. The earlier PR's CI is historical evidence. Real Samsung/iPad interaction, native iPadOS photo-picker behavior, physical keyboard absence, Safari storage retention and installed-PWA store separation require real-device verification; viewport automation alone cannot establish those behaviors.
