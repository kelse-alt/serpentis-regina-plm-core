# Six-tab tech pack workroom

Open **`tech-pack.html`** from the downloaded project ZIP after extracting it. All six workbook tabs, fonts, the original seal, and both original mannequin photographs are bundled inside this file. No installation or remote service is required. The neighboring `client-intake.html` remains available through the client intake link.

For a local HTTP preview with Node.js 24+, run `npm run techpack` and open `http://127.0.0.1:3003`. Rebuild after changing source with `npm run techpack:build`.

## Working with a pack

1. Give the pack a title in **Pack details & files**. On phones, open that panel to edit the title or reopen a saved pack, then collapse it to return to the sheet.
2. Choose **CM** or **IN** before entering garment measurements. The workbook does not state a garment unit. Measurement inputs stay disabled until a unit is selected. Quantities, text, and references can be entered immediately.
3. Open **Sheet details** for metadata or **Drawings & photographic references** for image slots. The tables stay immediately available on technical sheets. Scroll within the table to compare all columns; headings and POM columns stay visible.
4. **Save pack** saves all six tabs and embedded images in this browser. Use **Download JSON** for a portable backup. **Import JSON** validates and reopens a compatible pack. Browser storage can vary when opening local files and has a capacity limit; if storage cannot save, the app directs you to download JSON.
5. **Sheet CSV** exports all rows on the active sheet, regardless of search. CSV includes metadata, original methods where applicable, active-unit numbers and computed results. It excludes image bytes; JSON includes them.
6. **Print / PDF** prints the current sheet or all six. Print opens every detail section, includes every row independent of search, and retains the selected units. It uses A3 landscape to fit the eleven-size and two-round grids. The working screen stays intact after printing.

Images accept PNG, JPEG or WebP up to 5 MB each. They remain original embedded raster data; the app does not recolor them. Click an attached image or either mannequin photograph to enlarge it. Escape closes the image dialog. The six sheet tabs support Left/Right, Home and End keys.

## Source coverage

Source: [Copy of TECH PACK TEMPLATE — SERPENTIS REGINA — V.002 — V2.xlsx](https://docs.google.com/spreadsheets/d/1yXo2dRFUFBJXT7fQlsxJkoWVH5pfSSQn/edit). The original Excel file is stored in Drive and was read without modification. All six visible tabs are represented. [Source provenance](../data/templates/tech-pack-workbook-source.v1.json) retains all 427 nonempty cells, 67 literal formulas, merged ranges, image hashes, source hash and section maps. The original binary is kept outside the public checkout.

| Source tab | Working surface |
|---|---|
| PATTERN CARD | Style/pattern metadata; 14 main pieces, 5 lining rows, 10 template rows; quantities and piece names; original unlabelled column E; breakdown, placement, 3 template-grading rows; sketch, marker release, revision, pattern/file status and trim notes |
| BW-AW-SPEC | 28 numbered rows plus 4 specs-only rows; separate metadata and target/before/after/delta/adjustment values for both sample rounds; fitting participants and notes |
| FIT & COM | Style linked from Pattern Card; fitting and sample metadata; source header-reference area and sample-image slots; attendees, model, pattern maker and comments |
| GRADED SPECS | Separate 28-row before- and after-wash grids; POM, description, tolerance and 11 editable size names/columns; source fabric/content, lining, pattern, wash and style metadata |
| 00-MEASUREMENT SHEET MASTER | Metadata, front/back flats, 30 rows with all 12 original specification columns |
| BODY REF-MANNEQUIN-SIZE 8-V1 | Approved 20-POM reference, exact original methods and original photos; seven MFR references/thirteen missing; separate local critical/target/status/revision/observation notes |

The app retains the established Obsidian, Ruby, Electric and Slytheren assignments, matte ash chart text, neutral borders, Barlow Condensed and isolated original seal. Historical colors in workbook provenance do not override the current interface.

## Calculations and unresolved source details

- **Wash specs:** `Target − After Wash`, separately for each round. Both values must exist; explicit zero is valid. The 28 numbered rows and specs-only source rows 40 and 43 calculate this difference. Source rows 41 and 42 contain no formulas; their signed delta cells remain editable manual entries. This is not a shrinkage percentage or fit judgment.
- **Measurement master:** `Sample Actual − Approved Base Spec`. The source supplies this formula in its first three rows. The app extends that explicitly labelled calculation to all 30 rows. A user-entered base number does not confer approval.
- **Fit & comments:** Style reads the current Pattern Card style/pattern field; it is not a copied or independently editable value.
- **House mannequin:** `Actual Form − MFR`. Canonical approved values remain inches; the displayed CM conversion is exactly ×2.54. Missing references stay missing. This is the previously established house comparison and is distinct from garment deltas.
- **Source body target formulas:** I31:I33 literally subtract blank source column G (DELTA) from H (HOUSE TARGET). Their intended meaning is unresolved. The app preserves the raw formulas and marks the corresponding target-delta cells unavailable; it does not silently change them to target minus actual form.
- **Source master examples:** The three pairs 20/24.75, 25/37 and 25/24.75 have no assigned POM or unit. They appear in source notes and never prefill a new garment draft.
- Size names, grade increments, ease and approval rules are blank in the source. They are not generated from the mannequin reference. Source column E on the Pattern Card stays explicitly unlabelled.

Garment measurements and optional local house-target entries are canonical CM in JSON. Display switches always start from those canonical values, round only for display to six decimals, and leave source inch/centimetre landmarks in methods unchanged. The reference unit selector controls the mannequin view independently of the garment unit.

## Files and verification

- [Controlled UI schema](../data/templates/tech-pack-workbook.v1.json)
- [Draft validation, numeric conversion and CSV safety](../src/tech-pack.mjs)
- [Browser UI](../workbook-web/app.mjs) and [styles](../workbook-web/app.css)
- [Offline builder](../scripts/build-tech-pack.mjs)
- [Core tests](../tests/tech-pack.test.mjs)
- [Browser checks](../scripts/check-tech-pack-browser.py)

Run `npm test`, `npm run techpack:build`, and `python scripts/check-tech-pack-browser.py --output /workspace/work/tech-pack-validation`. Browser validation needs Python Playwright, pypdf and Chromium at `/usr/bin/chromium`. The checker serves the offline file on a temporary loopback address; its screenshots contain pristine blank drafts only. Synthetic entered values and filled PDFs stay in temporary test storage and are not published. The checked build is also rebuilt in GitHub CI to detect a stale distributed HTML file.

## Local data boundary

All source template content and the existing approved house reference are in the public artifact. Future filled projects, client records, uploaded photos and exported drafts are local user data. The app makes no network requests, spreadsheet writes, remote submissions or automatic Git commits. It does not synchronize with Drive, the separate SQLite intake, or another device. This is a local technical-design prototype, with manual JSON transfer rather than multiuser production collaboration.
