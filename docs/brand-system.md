# Serpentis Regina brand system

The founder directed all work going forward to use the designated house
palette on October 22, 2026. [design/brand-tokens.json](../design/brand-tokens.json)
is the canonical token file for new and redesigned interface surfaces.
Photographs and original artwork retain their original colors.

## Verified interface palette

| Token | Hex | Source |
|---|---|---|
| Obsidian | `#101820` | Founder: Pantone Black 6 CP, RGB 16, 24, 32. |
| Ruby | `#E4002B` | Founder: Pantone 185 CP, RGB 228, 0, 43. |
| Salmon | `#F4A6A0` | Workbook `PATTERN CARD!G5` fill and `BW-AW-SPEC!B10:F10` fills. |
| Slytheren | `#1FA824` | Workbook `BODY REF-MANNEQUIN-SIZE 8-V1!A9` and `G9` front/back body-map header fills. |
| Electric | `#1E22AA` | Workbook `BODY REF-MANNEQUIN-SIZE 8-V1!I1` fill and `PATTERN CARD!B5` font color. |

Salmon, Slytheren, and Electric are the names supplied by the founder; the
workbook provides the corresponding exact RGB styles. Obsidian and Ruby also
appear in the workbook. The palette evidence comes from the
[supplied tech pack workbook](https://docs.google.com/spreadsheets/d/1ALn9OogQy6x4YSEohhlew-NaIdeEdm2F/edit?gid=1422941812#gid=1422941812),
whose exported XLSX SHA-256 is
`2fc52c4d87a69dd064b01126a2ada6b90a816deecc212a13f16fc0ac6bb38b33`.

The latest Case 1 direction uses Obsidian, Electric, Ruby, and Slytheren.
**Salmon/light pink is removed from this sheet's interface**. It remains in
the documented house palette for provenance, while the report excludes it
through `houseMeasurementSheet.excludedColors` in the token file. Original
artwork retains its pixels and colors.

Title and section boxes use **Electric fills with Ruby lettering**. Slytheren
is used for chart text, controls, borders, and metadata; Actual Form numbers
use Ruby on Obsidian. The measured mannequin data and delta rule are separate
from the visual system. The earlier Salmon layout is preserved in the
[previous design review](case-1-brand-redesign.md).

## Readable combinations

Slytheren on Obsidian and Obsidian on Slytheren have 5.70:1 contrast, supporting
the main chart text, controls, and metadata. Ruby on Obsidian has 3.69:1 and is
used for the large, bold actual-form numbers. The founder's requested
Ruby/Electric pairing has 2.32:1; it is reserved for display/section headings,
not measurement body text. The earlier Salmon pairings are no longer used.

## Typography and Notion access

The founder linked the
[Brand Bible / Vision page](https://app.notion.com/p/BRAND-BIBLE-VISION-255bab06d9b4801d99def02a9914973b).
On October 22, 2026 it displayed a sign-in requirement, so its font and palette
content could not be read. The verified color values above use the founder's
specifications and workbook evidence.

The founder requested that the title match the existing chart font. The
report now uses **Barlow Condensed 500/700** throughout, with a bold uppercase
title. The earlier Bodoni proposal is no longer loaded. This direction comes
from the founder's design comments, not a verified Notion font specification.
The font files and licenses are stored under
[assets/house-sheet/fonts](../assets/house-sheet/fonts), and Barlow is embedded
locally without remote runtime requests.

## Shared sculpted-head seal and mannequin photos

The upper-right page seal reuses the original transparent Serpentis Regina
sculpted-head PNG from the existing website. The founder requested the same
seal as a recurring stamp across future pages. In the latest layout it stands
alone on Obsidian beside the title box; all brand, case, form, and approval
text is inside the title box, with no metadata in the seal's region. It
preserves the supplied artwork and needs no interactive 3D renderer.

The Case 1 front/back mannequin photographs are the original JPEGs extracted
from the workbook's mannequin tab. Their pixels and colors are unchanged.
Equal-height frames and matching CSS cover positioning fill the photo panel
and align both images' top and bottom edges; this is display cropping only.
See the [asset guide](../assets/house-sheet/README.md) and
[asset provenance](../assets/house-sheet/provenance.json) for source URLs,
original drawing anchors, licenses, dimensions, and verified hashes.
