# Serpentis Regina — Portal Version 2.1: The Abyss

Version 2.1 refines the approved black, heads-only entrance with smoother shading and a glossy clear-coated finish. The three large heads, logo palette and reveal-on-interaction layout remain the same.

## Amaya Google Drive route

The current build connects Mother / **Amaya Kelsea** to the founder's [Google Drive folder](https://drive.google.com/drive/folders/1NWWe-fKklVC0gDS5jVu3IcHMhTCRxe7s). Reveal the head's information, then choose **Open Google Drive**. The link opens in the complete browser window, including when the portal is embedded in Squarespace.

Google Drive controls folder access. A signed-out check redirected to Google Sign-In, so public folder access has not been verified. For public viewing, the owner can choose **Share → General access → Anyone with the link → Viewer** in Google Drive.

The route is published on `portal-site`. Live desktop and emulated-mobile checks confirmed the revealed button opens the exact Drive folder in the full window; the atelier route and KLS introduction remain intact. See [live verification](docs/validation/amaya-drive-live.json).

## Squarespace connection build

The connection build preserves that appearance and prepares it for the existing Squarespace `/landing-portal` page. Relative assets work at the GitHub project URL; the atelier link opens `/home` in the complete browser window. See the [installation guide](integrations/SQUARESPACE.md) and [copyable Squarespace embed](integrations/squarespace.html).

The portal is live at [www.serpentisregina.com](https://www.serpentisregina.com/), backed by [GitHub Pages](https://kelse-alt.github.io/serpentis-regina-plm-core/index.html?v=2.1). The owner enabled Pages, installed the embed and made it the Squarespace homepage. Live desktop/mobile checks confirmed all three heads, full-screen framing and top-window navigation into the real `/home` atelier. See [live Squarespace verification](docs/validation/squarespace-live.json) and [live file hashes](docs/validation/pages-live.json).

The current visitor view works and the owner has removed the placeholder content. The remaining placement cleanup is to move the fragment from page-header injection into the page Code Block, following the [installation guide](integrations/SQUARESPACE.md).

Run `npm run pages:prepare` to assemble only the built portal under `artifacts/pages-site/`. The Amaya route source branch is `codex/amaya-drive-link`, continuing the connection work from `codex/portal-squarespace-connection`. The embedded browser checks use `npm run check:squarespace` and record their limits in `docs/validation/squarespace-integration.json`.

The cross-origin embed checks passed on desktop and emulated mobile: real nested-path assets, all three heads, viewport fit, reveal/rotation and full-window atelier navigation. Unrelated-page and editor controls remained visible in the fixtures. Live files were verified separately. Actual Squarespace installation and its authenticated editor require account-side checks.

The downloads below preserve the approved versions before this navigation change. The Squarespace site is changed only when its owner installs the embed and changes its homepage setting.

## Saved previews

- [Download Version 2.1](downloads/Portal-Entrance-Version-2.1.html): open the file on GitHub, click **Download raw file** (the downward-arrow icon), then open the saved HTML in Chrome or Edge.
- [Viewing instructions](downloads/README.md)
- [Version 2.1 source](https://github.com/kelse-alt/serpentis-regina-plm-core/tree/codex/portal-entrance-v0.2.1/portal)
- [Preserved Version 2](https://github.com/kelse-alt/serpentis-regina-plm-core/tree/portal-v0.2.0/portal) · [Preserved Version 1](https://github.com/kelse-alt/serpentis-regina-plm-core/tree/portal-v0.1.0/portal)

The one-file preview embeds the code, styles and three models. Following the live atelier link requires internet access. The Squarespace site has not been changed.

## Surface polish

The previous contour shader amplified small variations in the models' lighting normals. Version 2.1 applies mild, angle-aware smoothing to a separate normal buffer, shared across each head's material sections to avoid seams. Vertex positions, triangles, sculpted details and the original GLB files stay intact.

A nonmetallic physical material adds clearcoat and soft neutral studio reflections. The lighting texture is generated locally and is never shown as a backdrop or extra object. Pearl-gray `#b8b8b8`, rose `#b68294` and magenta `#b00046` remain the source palette. The finish is an interpretation of the website logo; the supplied GLBs do not contain its original texture or material capture.

## Entrance behavior

- Mother → **Amaya Kelsea**; Maiden → **Serpentis Regina**; Crown → **KLS**.
- Only the three heads appear initially, against black. Desktop uses three columns; mobile keeps all three within one viewport as three rows.
- Hover or keyboard focus reveals information beneath a head. Click/tap pins or toggles it; Escape dismisses it. Dragging rotates the head.
- Amaya Kelsea reveals **Open Google Drive** for the founder's folder. Serpentis Regina retains **Enter the atelier** for `/home`. Both open in the complete browser window. KLS retains its introduction without an external destination; full Amaya/KLS mini-sites remain separate work.
- Reduced-motion preferences and unavailable-WebGL access are supported.

## Run and rebuild

Use Node.js 24+ and npm inside `portal/`:

```sh
npm ci --cache .npm-cache
npm run dev
```

For production review and the single-file build:

```sh
npm run build
npm run preview
npm run standalone
```

Development uses loopback port 8034; production preview uses 8035 unless overridden. The identified delivery copy is `downloads/Portal-Entrance-Version-2.1.html`. Keep the older Version 1 and Version 2 downloads unchanged.

## Verification

The Version 2.1 production build, all six browser check groups and actual-model surface checks passed. Desktop, information-reveal and mobile screenshots were visually reviewed. Embedded HTML verification passed: all three models loaded and offline interactions worked without additional resource requests or page errors. The uploaded GitHub HTML was downloaded and verified byte-for-byte against the tested artifact.

Run the actual-model surface checks, then the browser checks against the production preview:

```sh
npm run check:surface
npm run check:browser
npm run check:standalone
```

Browser checks require Python Playwright and Chromium in the cloud environment. Set `PORTAL_CHECK_URL` when using a preview port other than 8035. The original Version 2.1 screenshots and records use the `portal-v2.1` prefix under `docs/previews/` and `docs/validation/`; the connection build's checks default to `portal-squarespace` so older evidence remains intact.

Surface checks assess normal smoothness, retained carved ridges, shared section normals and unchanged source geometry. Browser checks cover actual model loading, black heads-only framing, desktop/mobile fit, reveal/dismissal, rotation, touch/keyboard access, the atelier link, fallback access and embedded HTML.

The managed cloud browser blocks direct `file://` navigation. Standalone verification serves one local HTML document with additional resource requests blocked. Physical-device GPU performance and a complete accessibility audit remain outstanding. The models total about 11 MB and 455,000 triangles.

## Source and version record

See [SOURCES.md](SOURCES.md), [CHANGELOG.md](CHANGELOG.md), [the development handoff](GITHUB_HANDOFF.md), [model provenance](docs/portal-assets.json) and [the audit record](docs/README.md). `src/worlds.js` holds identities and source models; `src/main.js` handles interaction, `src/surface.js` handles normal polish and `src/finish.js` defines the glossy material and lighting.

Version 2.1 uses branch `codex/portal-entrance-v0.2.1` and milestone tag `portal-v0.2.1`. Earlier designs remain preserved by `portal-v0.1.0` and `portal-v0.2.0`, separate from PLM application versions. No client records or raw technical portfolio documents are included.
