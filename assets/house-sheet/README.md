# House measurement sheet assets

These assets support Case 1, the mannequin-versus-manufacturer measurement sheet.
The [brand tokens](../../design/brand-tokens.json) define the interface palette;
[the brand guide](../../docs/brand-system.md) records its sources and use.

| Asset | Origin and use |
|---|---|
| [mannequin-front.jpg](mannequin-front.jpg) | Original embedded front-view photo from the supplied workbook's mannequin tab, anchored at C10. |
| [mannequin-back.jpg](mannequin-back.jpg) | Original embedded back-view photo from the same tab, anchored at H10. |
| [serpentis-regina-seal.png](serpentis-regina-seal.png) | Original transparent sculpted-head logo from the existing Squarespace website, reused as the page seal. |
| [bodoni-moda-600.ttf](fonts/bodoni-moda-600.ttf) | Proposed editorial title font, weight 600. |
| [barlow-condensed-500.ttf](fonts/barlow-condensed-500.ttf) | Proposed reading/table font, weight 500. |
| [barlow-condensed-700.ttf](fonts/barlow-condensed-700.ttf) | Proposed emphasis and table-heading font, weight 700. |

The two mannequin photos were extracted byte-for-byte from
`BODY REF-MANNEQUIN-SIZE 8-V1` in the
[founder-supplied tech pack workbook](https://docs.google.com/spreadsheets/d/1ALn9OogQy6x4YSEohhlew-NaIdeEdm2F/edit?gid=1422941812#gid=1422941812).
The seal is byte-identical to the image served by the live website on
October 22, 2026. These are original photographs and artwork, with their original
colors retained. The workbook itself is not included.

The seal is a supplied PNG of the sculpted 3D artwork, rather than a new render
or an interactive WebGL model. The founder requested this same upper-right
stamp across future pages.

Bodoni Moda and Barlow Condensed are proposals for review. The linked Notion
Brand Bible requires sign-in, so its typography could not be verified. Fonts
are stored locally for embedding; the generated report needs no remote font
service. Both families use the SIL Open Font License 1.1:

- [Bodoni Moda license](fonts/Bodoni-Moda-OFL.txt)
- [Barlow Condensed license](fonts/Barlow-Condensed-OFL.txt)

[provenance.json](provenance.json) records repository-relative asset paths,
source URLs, workbook drawing anchors, dimensions, byte counts, and SHA-256
hashes. Source URLs are attribution and provenance, not runtime dependencies.
