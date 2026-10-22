# Serpentis Regina brand system

The founder directed all work going forward to use the designated house
palette on October 22, 2026. [design/brand-tokens.json](../design/brand-tokens.json)
is the canonical token file for new and redesigned interface surfaces.
Photographs and original artwork retain their original colors.

## Source palette provenance

The table records source colors. Salmon is retained for historical provenance
only and is **not permitted in current interface styling**.

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

## Current house color rule

**Every Electric Blue fill box uses Ruby text. No Salmon/light pink UI.**
This is the founder's corrected standing rule for new and redesigned interface
surfaces. It supersedes the previous blue-fill/pink-text instruction.

### Current Case 1 application

The Electric/Ruby rule applies to this report's blue-filled regions as well.
**Ruby text is scoped to Electric fills**: section headers, chart headings,
and every toolbar filter/Print button. Toolbar buttons retain that pairing
in all states. Chart values, methods, and deltas keep **ash-charcoal `#92989D`**
and matte grain. Outlines remain **neutral `#293239`**, with no red outlines.

For the current mannequin sheet:

- The title box uses **Ruby fill with Obsidian main title and division text**.
  Metadata strips stay transparent over Ruby, with no separate dark boxes.
- The **SERPENTIS REGINA wordmark uses Electric text**. **CASE / 001**, form ID,
  size, the static **INCHES / CM identity label**, point count, and approval
  label use Slytheren text. The separate dark native UNIT selector retains
  matte ash text for its selected value.
- Section boxes and chart headings use **Electric fill with Ruby text**.
- All toolbar filter/Print buttons keep **Electric fill with Ruby text**,
  including inactive, selected, hovered, and focused states.
- **Slytheren is limited to the requested CASE/identity metadata and delta
  formula foregrounds, plus the two Front/Back caption backgrounds**. Caption
  text stays Obsidian; green is not used for table values, buttons, or borders.
- Body measurements, methods, deltas, Actual Form numbers, and supporting
  details retain ash charcoal on Obsidian and the existing matte treatment.

The measured mannequin data and delta rule are separate from these visual
rules. See the [current Case 1 review](case-1-centimeters.md). Earlier
[brand](case-1-brand-redesign.md) and
[layout](case-1-layout-refinement.md) reviews preserve prior directions;
their conflicting color instructions, including the later
[pink-text review](case-1-house-colors.md) and
[Ruby-text Case 1 layout](case-1-ruby-rule.md) and
[matte-header layout](case-1-matte-ink.md), and
[scoped Ruby review](case-1-scoped-ruby.md) preserve earlier iterations.

## Apply the current combinations

Use Ruby text on Electric fills, preserve matte ash chart text, and apply only
the explicitly requested wordmark/metadata/formula overrides above. Keep the
two photo captions Obsidian on Slytheren. The main title and division retain
Obsidian text directly on Ruby.
Original artwork and photographs retain their source pixels and colors;
this does not authorize Salmon in interface styling.

## Case 1 display units

The native UNIT selector offers `in` and `cm`. All MFR, Actual Form, and delta
values are displayed from the approved inch values using **1 in = 2.54 cm**,
with up to six decimal places and trailing zeros trimmed. Switching units
never rewrites the approved data or original measuring instructions. Missing
references remain dashes, and Print/PDF reflects the selected unit.

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
