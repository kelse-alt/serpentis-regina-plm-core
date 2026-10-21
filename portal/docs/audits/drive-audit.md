# Serpentis Regina: Drive source audit

Read-only first-pass source review, October 21, 2026. Both founder-supplied folders became accessible after sharing was updated. Originals were downloaded outside the Git checkouts; no Drive documents, repository sources or live website pages were edited or published.

## Coverage and limits

- 3D RENDERINGS: three GLBs and one reference JPG downloaded.
- 01_TECHNICAL DESIGN: nine folders traversed, 54 file/shortcut entries listed, 53 files downloaded (about 182 MB), one deleted/unavailable shortcut.
- Technical files comprise ten workbooks, eight PDFs and 35 PDF-compatible Illustrator files.
- The workbook scan inspected 105 worksheets and 3,438 formula cells, including cached error checks.
- Text extraction succeeded for all 43 PDF-compatible documents, representing 94 pages. Four documents have essentially no extractable text; this is not evidence that their drawings are empty. Representative image-only flats were rendered and visually inspected.
- Model structure was inspected and all three actual GLBs loaded in a local WebGL review. Drag rotation was exercised. A desktop screenshot records the result.

This is an inventory, structural/formula review, representative content/visual review and implementation-readiness audit. It is not a page-by-page approval of every garment specification, a full spreadsheet recalculation, an editability test in Illustrator, a production fit approval, or a mobile performance certification. Reading a formula and seeing no cached error does not prove its outputs under every input.

Source-by-source results: /workspace/drive-source-inventory.md. Raw metadata and extracted cells/text: /workspace/audit-sources/technical-design/inventory.json and document-analysis.json. Download hashes preserve provenance for these local copies. Exported Google Sheets files are point-in-time XLSX derivatives, not live synchronization.

## What this work demonstrates

The founder's practice extends beyond a measurement-entry app. The files document technical fashion design across flats, construction specifications, garment details, before/after-wash measurements, alpha/numeric grading, fit diagnosis, sample-stage corrections and controlled tech-pack workflows. This provides concrete material for Amaya Kelsea's Technical portfolio and requirements for future PLM features, while the bespoke-facing world uses a different customer voice.

### Technical portfolio

Six named portfolio PDFs cover technical flats and construction, scrub construction, blouse fit review, dress pre-production review, dress first-fit review and bridal construction. They demonstrate both visual specification and fit correction, including bilingual measurement descriptions and sample-stage records. Preserve each document's actual context and attribution; do not describe every file as a Serpentis Regina house standard.

### Construction callouts

Five garment folders contain 32 assets: Drawstring Boyfriend Short, Balloon Utility Crop, Cocoon Sleeve Franca, Joni Utility Jacket and Shrunken Noor Jacket. Contents distinguish full-body flats, front/back details, interior construction, pocket details, measuring instructions and label placement.

Potential future structured data should link a garment/style to view, component, stitch/construction instruction, measurement location, revision and source drawing. Do not flatten these into a generic image gallery and lose the relationship between a full flat and its numbered detail sheets.

### Grade-rule libraries and working templates

Alpha rules cover twelve garment categories; numeric rules cover fourteen. Separate alpha and numeric execution templates contain style setup, graded specifications, POM diagram keys, size-set review, fit comments and revision history.

The numeric guide explicitly defines a grade step as an adjacent two-number size step (for example, 4 to 6), not a raw numeric difference. Width rules distinguish finished-flat measurements from circumference. Tolerance is independent of grade; zero grade does not require zero tolerance. Material condition, fit classification, size breaks, pattern geometry and size-set review remain explicit controls.

Software implication: represent ordered size labels, base size, POM scope, units, material/measurement condition, fit class, grade step, tolerance and exceptions separately. Keep size-label position separate from numeric arithmetic; do not convert 4→6 into two grade steps.

### Multiple tech-pack structures

The available sources do not define one automatically authoritative “latest template” merely by filename:

| Source family | Observed structure | Implication |
|---|---|---|
| V1 DRAFT | 16 worksheets: cover/style setup, flats, colorways, BOM, construction, POM diagram, grading, labels/care, packaging, QA, fit comments, revisions, approvals, and two original measurement tabs | Broad style-development pack; source labels identify it as a draft |
| V.001_SERPENTIS REGINA | 16 worksheets with setup-driven measurement and grade formulas plus production/document controls | Another substantive workflow, not an interchangeable filename alias |
| V.002 / TECH PACK MASTER V2 | Six worksheets: pattern card, BW/AW spec, fit/comments, graded specs and two original measurement tabs | Focused pattern/sample/wash workflow; it is not a superset of every V1 function |
| Illustrator tech packs | Populated style-specific design/construction/trim examples in PDF-compatible AI documents | Preserve as examples with provenance; do not treat filled examples as blank universal templates |

The V1 DRAFT Google Sheet export and V1 DRAFT XLSX have matching worksheet cell-content hashes. The V2 Google Sheet export and V.002 XLSX likewise match on worksheet names, cell values and formulas. This comparison does not prove identical formatting, images, permissions, validation rules or future synchronization. Keep both source identities; do not delete or overwrite apparent duplicates.

## Findings to preserve or resolve before coding data workflows

1. **Delta direction is workflow-specific.** The current approved-house app uses house minus manufacturer; new sessions use measurement minus selected reference. The V2 BW-AW-SPEC formula uses target minus after-wash actual. Grade execution templates use sample measurement minus target. These can coexist, but each formula and label must be explicit. A global function named simply `delta` without a defined direction would be ambiguous.
2. **A fit-review source demonstrates why missing data must remain missing.** In the first page of the blouse fit review, Back Body Length from HPS has a blank target, actual 26½ and displayed delta 26½. Treat this as a source anomaly needing context, not a valid computed comparison to import automatically. Do not invent a zero target or silently repair the original document.
3. **Drafts are not approvals.** Placeholder fields, working-template labels, style/fit-approval notes and release controls remain visible. A calculated graded size is not automatically an approved production spec. Preserve revision, sample stage and approval status as separate records.
4. **Duplicate displayed column labels require stable identities.** Grade-rule tables include two RELAXED columns. The numeric control notes explicitly acknowledge the duplicated layout. Use source column identity and seek intended distinctions when implementing a normalized schema; never load them into an object where the second identical label silently overwrites the first.
5. **Stored formula checks passed, calculation validation remains outstanding.** No explicit Excel error cells, broken `#REF!` formulas or cached error cells were found in the ten downloaded workbooks. The files were not recalculated in Excel/Sheets under controlled test inputs; formula-domain behavior and production correctness remain unverified.
6. **One source shortcut is unavailable.** The grading folder lists an item as “Original item deleted.” It was recorded as unavailable, not counted among the 53 successful downloads. Its original content and role cannot be inferred.
7. **Study sources are not automatically publishing assets.** Some portfolio examples carry other company/style references, sample imagery and production context. Keep local review copies separate from public website assets; select any eventual public excerpts and attribution deliberately. No portfolio PDFs, AI files or technical workbooks were copied into a public site or Git commit during this audit.

## The three portal models

Founder-confirmed mapping: Mother → Amaya Kelsea; Maiden → Serpentis Regina; Crown → KLS.

| Asset | Download size | Triangles | Observed runtime |
|---|---:|---:|---|
| (KELSEA) Mother head.glb | 3,519,276 bytes | 144,738 | Loaded in WebGL |
| (SERPENTIS REGINA) Maiden head.glb | 3,973,076 bytes | 163,602 | Loaded in WebGL |
| Crown Head.glb | 3,557,760 bytes | 146,356 | Loaded in WebGL |

All three are GLB 2.0 exports from Nomad, contain a single scene/node with multiple mesh primitives, and have no external buffer/image dependencies, required decoder extensions, texture maps, vertex color attributes, rigs or embedded animation. They use a neutral near-white material with low roughness. Different baked node transforms and bounds require runtime centering and consistent presentation scale; the review viewer applies those without modifying originals.

The separate IMG_8942.JPG is colorful rendered artwork. Its color/lighting appearance is not contained in these GLBs. The website can supply materials, lighting and code-driven rotation/transitions, but should not promise that the exported files already reproduce the reference artwork. Three uncompressed heads together are about 11 MB and 454,696 triangles; optimize web derivatives and test mobile devices before declaring the final entrance fast.

Machine-readable confirmed assignments, original names, Drive IDs, hashes and local paths: /workspace/portal-assets.json. Browser result: /workspace/audit-sources/model-browser-result.json. Screenshot: /workspace/audit-sources/original-models.png. Review implementation: /workspace/audit-tools/model-review.html, using pinned Three.js 0.186.1. It is an asset-inspection tool, not the finished portal design.

## How these sources map into the website work

- The master blueprint establishes the three-world entrance and each world's distinct purpose.
- The confirmed heads supply the actual entrance geometry.
- The current Squarespace site supplies the working Serpentis Regina customer-facing destination and existing booking integration.
- The construction/fit/technical portfolio sources substantiate Amaya's capabilities; they can guide portfolio organization without publishing every raw file.
- The grading, measurement and tech-pack systems inform future structured PLM workflows. They do not need to become public client forms merely because they are source material.
- The two JavaScript repositories supply tested measurement and intake logic and a documented coding journey.
- KLS's detailed service content, inaccessible Notion brand/database sources and linked active projects remain incomplete. Model assignment is confirmed; those remaining content gaps should not be filled with invented business offerings.

The audit has progressed from repository-only understanding to a connected inventory of the website, accessible blueprint, technical practice and actual 3D assets. Full portal design and implementation should use this source mapping and retain the unresolved editorial/source questions explicitly.
