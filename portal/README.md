# Serpentis Regina — The Threshold

First entrance implementation for the founder's three-world website, built from the Notion master blueprint, confirmed GLB assignments, live Squarespace identity and source audit. This project is separate from the existing PLM and educational repositories.

## Run

For viewing without installing tools, download **Serpentis-Regina-Portal.html** and open it in a current Chrome or Edge browser. The single file embeds the code, styles and all three models, so no server or internet connection is needed to view the entrance. Following the atelier link still requires internet access.

To regenerate that file from source, run `npm run standalone` after installing the locked dependencies.

Use Node.js 24+ and npm. Inside the project directory (`portal/` in this repository):

```sh
npm ci --cache .npm-cache
npm run dev
```

For a production build and local production review:

```sh
npm run build
npm run preview
```

The development server uses loopback port 8034; production preview uses port 8035. This project has not been deployed or connected to the live Squarespace configuration.

## What is implemented

- Three actual GLBs: Mother → Amaya Kelsea, Maiden → Serpentis Regina, Crown → KLS.
- Warm blush setting, procedural marble plinths and colored studio reflections. Reflective styling is inspired by the founder's top-left website head and reference artwork. It is a material interpretation for review, not an exact reproduction of a baked texture.
- Drag a head horizontally to rotate it; a click/tap or accessible text button selects its world. Dragging is separate from activation. Touch scrolling remains available.
- Brief expansion, swirl and fade during entry, bypassed for reduced-motion preferences.
- Keyboard-accessible world buttons, native modal focus containment, Escape/close behavior, and focus return.
- Responsive stacked mobile composition, a pearl finish alternative, and functional text controls when WebGL/model loading fails.
- World introduction panels. Serpentis Regina links to the existing live atelier. Amaya and KLS panels identify their future worlds without inventing live destinations, booking flows or service offers.

The full Amaya and KLS mini-sites are outside this entrance milestone. Detailed KLS content and some linked Notion brand-system documents remain unavailable. All new display copy and material styling are review-stage interpretations.

## Source map

`src/worlds.js` holds one object per world: identity, source model, introductory content and optional real destination. `src/main.js` reads those objects and creates each sculpture and entry interaction. `src/style.css` controls the page composition.

Original model assignments and source hashes are recorded in [the asset manifest](docs/portal-assets.json). The copies in `public/models` retain the downloaded bytes. The app changes runtime presentation materials, not original source files. Models export no textures, rigging or animation; rotation and transitions are implemented by the application.

The source brief and audit live in [the portal brief](docs/audits/portal-source-brief.md) and [the Drive audit](docs/audits/drive-audit.md). The visual logo reference is retained only under ignored `artifacts/`; no technical portfolio documents or client data are included in this app.

## Verification

With the production preview running, use the environment's Python Playwright and Chromium:

```sh
python3 scripts/check_portal.py
```

The check exercises actual model loading, rotation without navigation, entry/close for all three worlds, the live destination, finish switching, mobile overflow, reduced-motion behavior and a simulated unavailable-WebGL fallback. Screenshots and the result record are written under ignored `artifacts/`.

This is a functional entrance review, not a complete accessibility or physical mobile GPU performance certification. Original assets total about 11 MB and 455,000 triangles. Optimization of model derivatives and validation on real devices remain relevant before public launch. Browser render loops skip offscreen/hidden scenes; no external fonts, analytics, image services or model hosts are required at runtime.

Current validation: frozen-lockfile installation and the production build succeeded. All seven browser check groups passed against the production preview. The desktop and 390px mobile captures were visually reviewed. GPU work is capped at 30 frames per second, skipped offscreen/when hidden, and rendered on demand with reduced motion. The production JavaScript bundle is about 159 KB gzipped; Vite flags the larger uncompressed 3D-engine bundle for future loading optimization. This milestone is not deployed.
