# Draft pull request — not published

**Title:** Integrate private DWILLA fittings into the existing Workroom

**Head:** `feature/dwilla-workroom-fitting`
**Proposed base:** `codex/workroom-brand-hierarchy-v0.9.2` (v0.9.5 editable Workroom source)

The existing Workroom can import garment components and save tech packs, but DWILLA's fitting workflow from PR #22 is only available through CLI/modules. This change adds a Fittings workspace to the existing shared style, navigation, draft store and revision system so an iPad user can measure a traced sample, record fit actions and annotated local photos, save/reopen, and request the next sample revision.

The local branch includes PR #22's importer and reusable fitting modules, plus the Workroom integration. PR #22 was open and unmerged when checked on November 6, 2026. Review its dependency explicitly; do not assume it is already on main. The public `portal-site` branch holds compiled deployment files and is not the proposed source-review base.

## Result

- Pack schema 4 retains the private dictionary, sample/pattern traceability, working fitting draft and preserved fitting snapshots alongside existing style and component data.
- Touch-sized controls provide exact imported methods, explicit units, decimal contextual readings and repeats, with missing/zero and incomplete target/tolerance states handled separately.
- Two named wearing configurations have qualitative mobility, closure, cutout and mesh/silk observations. These observations are not invented POMs.
- Authored fit issues/actions and decisions carry unresolved work into the next sample request without rewriting prior samples, fitting snapshots or pattern provenance. Advancing a sample does not approve production.
- Local original images and separate linked annotations reuse the existing private browser storage boundary. A directory backup/recovery workflow includes the full directory and attachments and validates recovery into an empty store.

The source workbook stays unchanged. Private definitions, source-cell contents, real measurements, staff/client records and photos are excluded from public source, fixtures, generated HTML and screenshots. Review evidence uses synthetic records. Private dictionary import is documented in `docs/dwilla-workroom.md`.

## Validation

- `npm test`: **149 passing tests** on Node 24, including existing workflows and new fitting/backup/privacy checks.
- Full synthetic Chromium flow plus recovery, print, existing shared-sample/gallery/named-revision, Undo/Redo and entry-guard checks pass. Sixteen grouped browser checks; no browser errors or external requests in the full-flow trace.
- iPad 1024×1366/1366×1024 and phone 390×844: no page overflow; visible fitting controls at least 44px.
- Workroom/PWA/cloud builds pass; generator/intake artifacts remain unchanged; SQLite/report workflows pass.
- Independent read-only XLSX verification matches all 60 garment codes/labels/methods and 20 separate BF references; actual dictionary remains ignored privately, absent from generated HTML.
- [Implementation report and five synthetic screenshots](dwilla-implementation-report.md).

Physical iPad Safari, native photo picker/keyboard, Samsung Termux and installed-PWA behavior are unverified. Current GitHub CI awaits approved publication; no remote result is claimed for this branch.

## Storage and limits

Normal Workroom records remain browser/profile/origin-local in the existing IndexedDB database; they do not synchronize between devices or with the CLI filesystem store. Safari and installed PWA storage may differ. Exports are sensitive, unencrypted private files. No account or application encryption layer is added. Physical Samsung/iPad behavior requires real-device validation beyond viewport testing.

## Publication boundary

This document is a prepared PR description only. The founder must approve public pushing/PR publication after reviewing the concrete result. Merge and Workroom deployment each require separate approval. This branch must not publish private source data or alter the Site audience, existing public portal, or production deployment as part of local review.
