# GitHub development handoff — Portal Version 2.1

## Squarespace connection preparation

The current connection work is on `codex/portal-squarespace-connection`. It keeps the approved Version 2.1 appearance, uses relative asset/model URLs and changes the atelier destination to `https://www.serpentisregina.com/home` with `target="_top"`. The archived `portal-v0.2.1` tag and download remain unchanged.

The deploy-only branch is `portal-site`, assembled by `npm run pages:prepare` from `portal/`. It contains only the built portal, original models, `.nojekyll` and a deployment fingerprint. The source repository's other applications are outside that website branch. See [the Squarespace handoff](integrations/SQUARESPACE.md) for activation and embed installation. Connection verification is recorded separately in `docs/validation/squarespace-integration.json`.

## Current direction

The founder approved Version 2's black, heads-only entrance and requested a smoother, glossier surface. Preserve the three large heads, black background, logo palette and information beneath a head only on touch, hover or focus. No visible props, plinths, headings, controls or other page furniture are part of the composition.

| World | Head | Current content |
|---|---|---|
| Amaya Kelsea — The Designer | Mother | Inline introduction |
| Serpentis Regina — The Bespoke | Maiden | Inline introduction and actual atelier link |
| KLS — Procurement & Consulting | Crown | Inline introduction |

## Surface implementation

`src/surface.js` polishes a copied normal buffer with four angle-aware passes. Each model's material primitives share their complete position/normal buffers; smoothing their indices together prevents section seams. Original-normal gating and a 20-degree normal-rotation cap protect strongly carved ridges. Positions, triangle indices, source normal buffers and original GLB bytes must remain intact.

`src/finish.js` uses a nonmetallic `MeshPhysicalMaterial`: roughness `0.25`, clearcoat `0.85`, clearcoat roughness `0.19`. Pearl-gray `#b8b8b8`, rose `#b68294` and magenta `#b00046` remain the logo palette. A local procedural HDR texture provides broad neutral studio reflections without extra visible scene objects or a visible environment backdrop. Keep the renderer background black.

The GLBs contain no original logo texture/material capture. Describe the result as a logo-inspired palette and polished finish; do not claim pixel identity or removal of every sculpted surface feature.

## GitHub locations

- Private repository: `kelse-alt/serpentis-regina-plm-core`; source under `portal/`.
- Branch: `codex/portal-entrance-v0.2.1`; milestone tag `portal-v0.2.1`.
- [Version 2.1 source](https://github.com/kelse-alt/serpentis-regina-plm-core/tree/codex/portal-entrance-v0.2.1/portal) and [Version 2.1 download](https://github.com/kelse-alt/serpentis-regina-plm-core/blob/codex/portal-entrance-v0.2.1/portal/downloads/Portal-Entrance-Version-2.1.html).
- [Draft PR #3](https://github.com/kelse-alt/serpentis-regina-plm-core/pull/3) compares the surface polish with Version 2. The [delivery record](docs/validation/portal-v2.1-github-delivery.json) records the verified download and unchanged earlier artifacts.
- [Preserved Version 2](https://github.com/kelse-alt/serpentis-regina-plm-core/tree/portal-v0.2.0/portal); [Version 2 review PR #2](https://github.com/kelse-alt/serpentis-regina-plm-core/pull/2).
- [Preserved Version 1](https://github.com/kelse-alt/serpentis-regina-plm-core/tree/portal-v0.1.0/portal), commit `6fedc025eb6cfcc60a6fab1c94a7d4e75666f6a2`.

Keep both older HTML downloads byte-for-byte unchanged. Existing PLM application files are outside this entrance change.

## Verification workflow

1. Work inside `portal/`. Keep identity data in `src/worlds.js`, interaction in `src/main.js`, surface polish in `src/surface.js`, material/lighting in `src/finish.js` and composition in `src/style.css`.
2. Use `npm ci --cache .npm-cache`, then `npm run check:surface` and `npm run build`.
3. Start `npm run preview` and run `npm run check:browser`. Set `PORTAL_CHECK_URL` for a port override, such as `http://127.0.0.1:8036/`.
4. Run `npm run standalone` and `npm run check:standalone`; verify the identified Version 2.1 delivery copy after packaging.
5. Review `docs/previews/portal-v2.1-desktop.png`, `portal-v2.1-mobile.png` and `portal-v2.1-info.png`. Record outcomes with the `portal-v2.1` prefix under `docs/validation/`.
6. Commit source, screenshots, validation and the identified HTML snapshot together. Use a scoped `portal-` milestone tag and reviewable PR.
7. Fetch the uploaded HTML through authenticated GitHub content retrieval and compare its SHA-256 before claiming delivery succeeded.

The Version 2.1 production build, all six browser check groups and actual-model surface checks passed. Desktop, information-reveal and mobile screenshots were visually reviewed. Embedded HTML verification passed: all three models loaded and offline interactions worked without additional resource requests or page errors. The uploaded GitHub HTML was downloaded and verified byte-for-byte against the tested artifact.

The managed cloud browser forbids direct `file://` navigation; embedded-preview checks use one allowed locally served document with additional resource requests blocked. Physical mobile GPU performance and full accessibility certification remain unverified. Older Version 1/2 passing records are historical evidence, not Version 2.1 results.

## Delivery boundary

The working delivery route is the existing private repository's versioned `downloads/` folder. Users sign in, open the HTML file view, click **Download raw file**, and open the saved HTML in Chrome or Edge. GitHub's separate release-upload host previously rejected authentication; this working repository route needs no new credentials.

Repository delivery does not deploy a live website. Preserve the Squarespace site and keep dependency caches, generated `dist`, raw technical documents, client records and credentials out of source commits.
