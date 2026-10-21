# Source and review notes — Version 2.1

## Controlling direction

The founder approved Version 2's clean black composition and requested a smoother, glossier finish. Version 2.1 changes surface shading and material response while preserving the three-head layout, logo palette and information-on-interaction behavior.

The subsequent navigation instruction assigns the founder's Google Drive folder to Mother / Amaya Kelsea. Its information reveals **Open Google Drive**, opening the folder in the complete browser window. The existing Serpentis Regina `/home` route and KLS introduction remain unchanged.

- Master blueprint: https://app.notion.com/p/SERPENTIS-REGINA-COM-255bab06d9b4802fb8dcfc4d396f6446
- Existing atelier and top-left head-logo reference: https://www.serpentisregina.com/
- Founder-supplied 3D folder: https://drive.google.com/drive/folders/1HLX5S5KM13apPqvJSkcgrytp5rNggKm1
- Founder-specified Amaya destination: https://drive.google.com/drive/folders/1NWWe-fKklVC0gDS5jVu3IcHMhTCRxe7s
- [Version 2 archive](https://github.com/kelse-alt/serpentis-regina-plm-core/tree/portal-v0.2.0/portal) preserves the approved layout and its original surface treatment.
- [Version 1 archive](https://github.com/kelse-alt/serpentis-regina-plm-core/tree/portal-v0.1.0/portal) preserves the earlier gallery design and evidence.

## Palette, material and surface diagnosis

The logo supplies pearl-gray `#b8b8b8`, rose `#b68294` and magenta `#b00046`. Version 2.1 retains that palette with a nonmetallic physical material, clearcoat and soft neutral studio reflections generated locally. Lighting remains invisible against the black background.

Inspection found all three heads to be closed manifold meshes, with no duplicate or degenerate triangles. Small variations in their lighting normals were amplified by Version 2's steep contour shading; its simple specular highlight also provided little gloss. Version 2.1 uses four mild, angle-aware smoothing passes on a copied normal buffer shared across the material sections. Original-normal gating and a 20-degree rotation cap preserve strongly carved folds. Vertex positions, triangles, original normal buffers and source files remain unchanged; sculpted forms and jewelry remain present.

The GLBs contain no original logo texture maps or material capture. The PNG establishes the intended palette, while the founder's latest feedback establishes the desired glossy finish. Pixel-identical reproduction across rotating views cannot be established from the PNG alone. Model inspection does not rule out every possible nonlocal self-intersection.

## Confirmed model originals

| World | Source name | SHA-256 |
|---|---|---|
| Amaya Kelsea | (KELSEA) Mother head.glb | 96767a86c1632e6d3019e88cc78e1a8a3f31a78a74bbbdacee30f6af9a3f4804 |
| Serpentis Regina | (SERPENTIS REGINA) Maiden head.glb | 74e7f062d930ed9ba3bd1786dca7550c23dd191d387fba11cb2c6171546aafaa |
| KLS | Crown Head.glb | 60a6313b5276baf5ca7d7e57268dd419fd81d9510b0bf663f094e1ab86af636d |

The founder confirmed all three assignments. Original files in `public/models` remain intact; normal polish, material appearance, display scale and rotation are applied at runtime.

## Verification and scope

The Version 2.1 production build, all six browser check groups and actual-model surface checks passed. Desktop, information-reveal and mobile screenshots were visually reviewed. Embedded HTML verification passed: all three models loaded and offline interactions worked without additional resource requests or page errors. The uploaded GitHub HTML was downloaded and verified byte-for-byte against the tested artifact.

Actual-model checks assess source-buffer preservation, shared normals, reduced local normal variation and retained carved ridges. Version 2.1 screenshot/validation files use the `portal-v2.1` prefix. Existing Version 1 and Version 2 evidence remains historical.

Introductions retain Amaya's design/technical practice, Serpentis Regina's bespoke atelier and KLS procurement/consulting. The current route build links Amaya to the founder-specified Google Drive folder and Serpentis Regina to `https://www.serpentisregina.com/home`; KLS has no external destination. Full Amaya/KLS mini-sites remain separate work.

The signed-out Drive check redirected to Google Sign-In and did not establish public folder access. Google Drive sharing settings control visitor access; the owner can enable **Anyone with the link → Viewer** if public viewing is desired. No folder listing, download or permission change was performed during this check.

The route is published on `portal-site`. Live desktop and emulated-mobile checks confirmed the revealed button opens the exact Drive folder in the full window; the atelier route and KLS introduction remain intact. See [live verification](docs/validation/amaya-drive-live.json).

The portal includes no filled client records, raw technical portfolio documents, original workbooks, credentials or analytics. The saved surface-polish download predates the Squarespace connection and Amaya route. The current portal is served through GitHub Pages; remaining Squarespace Code Block placement cleanup is documented in the [installation guide](integrations/SQUARESPACE.md).
