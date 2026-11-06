# DWILLA Workroom implementation review — November 6, 2026

## Result and review boundary

Implemented the next fitting increment inside the existing Serpentis Regina Workroom on local branch `feature/dwilla-workroom-fitting`, version 0.10.0. The existing navigation, shared style record, component sample list, IndexedDB identity, named revisions, original images, six worksheets and explicit PWA update workflow are retained.

No GitHub push, public PR, merge, Site change or Workroom deployment was performed. The prepared [PR description](dwilla-workroom-pr.md) requests review against the editable Workroom source branch. The founder requires publication approval before public changes, and separate merge/deployment approval.

## Established current state

- The initial local `work` checkout was the older v0.4.0 implementation at `c0f0c8eda017e0c702d137a1ff02c31c920094f1`, with 48 passing tests when local loopback server permissions were available.
- The editable deployed Workroom source was found on `codex/workroom-brand-hierarchy-v0.9.2` at `276053f53195987172373f7498d07a5f6c076499`. Despite the branch name, this is v0.9.5, including the final blue/pink section headers.
- `portal-site` at `b8f03c3a2253071781ef763dfaf36da788b58745` contains the matching compiled public distribution, not editable source. Its Pages deployment had succeeded.
- PR [#22](https://github.com/kelse-alt/serpentis-regina-plm-core/pull/22) was open and unmerged, head `976246a01e3528d162d1d011bcb22278029dfdb2`, with successful historical CI. Its importer, fitting module, filesystem snapshot store and CLI were cherry-picked locally into the current Workroom source. Documentation/package conflicts retained current Workroom functionality. The combined baseline passed 126 tests.
- The shell Git proxy was unavailable. Read-only GitHub connector reads reconstructed and SHA-verified the exact source commits, trees, blobs and ancestry locally; Git connectivity checks passed. No remote ref was mutated.

## Integrated behavior

The seventh **Fittings** tab connects SR-001 to the selected Workroom style. New fitting samples appear in the existing working-sample list. Existing samples can also be selected by stable key; their producing pattern revision must be identified explicitly.

Pack schema 4 adds a private dictionary, sample/revision/pattern trace, editable fitting draft and append-only fitting snapshots. Older schema 1/2/3 packs retain existing normalization and storage behavior. The four source POM groups remain 32 main, 11 cutout, 11 silk shell and six skirt definitions. The 20 BF references remain separate.

Touch controls use explicit per-fitting IN/CM units, decimal entry, original measuring methods, observer, context and condition. Repeats and front/back or left/right contexts are independent records. Missing measurements, targets and tolerances remain missing; zero is a measurement. Actual minus target and inclusive asymmetric tolerance checks reuse PR #22. Neither completeness nor a tolerance result approves production.

Each sample preserves its producing pattern revision. Fit actions record their author, POM and intended correction revision; resolution requires explicit author/evidence. Fitting progression records a decision author/reason, creates the next sample revision with an explicit next pattern, resets readings and carries unresolved actions. Earlier snapshots retain their original sample/pattern trace. Global Undo/Redo retains saved fitting history and sample links. Unrecorded old-sample entries block progression.

Two house-named wearing configurations record mobility, closure access, cutout stability and mesh/silk interaction as qualitative observations. They do not create POMs or specifications.

Original PNG/JPEG/WebP bytes use the existing local Blob store. Separate photo notes and numbered markers link to the fitting, POM and alteration action. Markers do not rewrite the image. The complete print record includes current and saved fittings, every recorded reading and method, context/unit/observer, targets, actions, decisions, configurations, photos and markers, plus the separate body references.

## Privacy and source verification

The provided Drive item is an XLSX. It was read without any write operation and downloaded outside the checkout. The read-only importer generated an ignored private dictionary. Independent `openpyxl` reads matched every garment code, description and measuring instruction exactly, including spelling/whitespace, and all 20 separate BF labels/methods. The dictionary was accepted unchanged by the browser-state validator. No unit, target, tolerance, grade rule or approval was inferred. The source file was not modified.

The private dictionary contains approximately 1.1 MiB of source context and is absent from tracked source, public fixtures, compiled HTML and screenshots. Public demonstrations use explicitly synthetic text and values. The approved existing house baseline remains unchanged. Real use still requires importing the private dictionary into the user's own Workroom browser; see the [operating guide](dwilla-workroom.md).

The normal standalone build uses CSP `connect-src 'none'`; browser acceptance observed no external requests or photo uploads. IndexedDB data is private to its browser profile/origin, device-local and unencrypted. This is not an account or authentication layer; same-origin code, extensions and device access remain outside that boundary. The separate cloud app was not modified and fitting synchronization was not added. Safari and installed PWA stores may differ.

## Backup and recovery

**Export → Download complete private backup** includes saved packs, private dictionaries, sample/fitting history, original images and immutable named revisions. **Restore backup into empty store** validates the whole archive and fitting fingerprints, then writes one atomic IndexedDB transaction. A populated destination is refused. Existing records are not merged or overwritten.

Limits are 12 MiB per dictionary, 5 MiB per photo, 12 photos per fitting, 64 samples, 100 fitting snapshots, and 100 MiB per portable backup with at most 100 drafts/1,000 named revisions. Backups contain sensitive unencrypted records; they must be kept privately. Current-pack JSON remains available separately. No browser-to-device or CLI-store synchronization is claimed.

## Validation and evidence

**149 local tests passed**, with no failures or skips. Sixteen grouped Chromium browser checks passed. It covers the full synthetic acceptance flow, empty-store recovery, original-image byte equality, malformed recovery refusal, named history/gallery compatibility, touchscreen dimensions and complete printing. Node tests cover source import, exact counts, null/zero, context/repeats, tolerance boundaries, sample/pattern links, unsafe data, escaping, partial specification editing and history preservation.

The baseline report, idempotent SQLite import/report, generator and client-intake builds passed without changes to their tracked standalone artifacts. Standalone Workroom, PWA and optional cloud builds passed; these commands build files locally and do not deploy. No new third-party runtime dependency was introduced.

Synthetic screenshots:

- [iPad fitting workspace](dwilla-workroom-screenshots/01-ipad-fitting-workspace.png)
- [Original photo and linked numbered annotation](dwilla-workroom-screenshots/02-ipad-private-photo-annotation.png)
- [Landscape second fitting](dwilla-workroom-screenshots/03-ipad-landscape-second-fitting.png)
- [Phone second fitting](dwilla-workroom-screenshots/04-phone-second-fitting.png)
- [Empty-store backup recovery](dwilla-workroom-screenshots/05-empty-store-backup-recovery.png)

The synthetic test scripts and full logs remain in the cloud workspace's `work/` directory. Sanitized browser evidence is included beside these screenshots. No real source dictionary, filled house fitting, client record or private photo is included in the proposed public changes.

## Limits

Browser automation used installed Chromium at 1024×1366 and 1366×1024 iPad-sized viewports and 390×844 phone size. This does not verify physical iPad Safari, touchscreen keyboard/photo picker, Termius/Termux behavior, Safari eviction/retention, Home Screen installation, or installed-PWA store separation. Those checks require the actual devices. The cloud environment did not attempt to access the Samsung's private Wi-Fi address.

Author names and dates are user assertions, not authenticated signatures. This is a working development fitting flow, not manufacturing approval, grading or production release. The original PR remains open; current branch CI cannot run until publication is approved.
