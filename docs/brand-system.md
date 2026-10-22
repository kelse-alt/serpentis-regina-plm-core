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

For Case 1, the requested direction is an Obsidian page, Ruby title/header
panels, and balanced Salmon, Electric, and Slytheren accents. Interface colors
come from these five tokens. The measured mannequin data and its delta rule
are separate from the visual system.

## Readable combinations

Electric text on Salmon has a 5.80:1 contrast ratio. Salmon on Obsidian is
9.21:1, and Obsidian on Slytheren is 5.70:1. These combinations support readable
text while keeping the founder's preferred color pairings.

Slytheren against Salmon has only 1.62:1 contrast; use these colors as separated
accents with a readable text color. Obsidian on Ruby is 3.69:1, suitable for
large or bold display lettering rather than small body text.

## Typography proposal and Notion access

The founder linked the
[Brand Bible / Vision page](https://app.notion.com/p/BRAND-BIBLE-VISION-255bab06d9b4801d99def02a9914973b).
On October 22, 2026 it displayed a sign-in requirement, so its font and palette
content could not be read. The verified color values above use the founder's
specifications and workbook evidence.

The redesign proposes **Bodoni Moda 600** for editorial titles and **Barlow
Condensed 500/700** for larger, readable measurement text and emphasis. This
selection is for founder review; it is not a verified Notion font specification.
The original font files and both SIL Open Font License 1.1 files are stored
under [assets/house-sheet/fonts](../assets/house-sheet/fonts). The report embeds
them locally, without remote runtime font requests.

## Shared sculpted-head seal and mannequin photos

The upper-right page seal reuses the original transparent Serpentis Regina
sculpted-head PNG from the existing website. The founder requested the same
seal as a recurring stamp across future pages. It preserves the supplied
artwork and needs no interactive 3D renderer.

The Case 1 front/back mannequin photographs are the original JPEGs extracted
from the workbook's mannequin tab. Their pixels and colors are unchanged.
See the [asset guide](../assets/house-sheet/README.md) and
[asset provenance](../assets/house-sheet/provenance.json) for source URLs,
original drawing anchors, licenses, dimensions, and verified hashes.
