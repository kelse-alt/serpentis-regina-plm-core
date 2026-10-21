# Serpentis Regina — Portal Version 2: The Abyss

Version 2 opens on a full-screen black background with only the founder's three large heads visible. Touch, hover or keyboard-focus a head to reveal its information beneath it. There are no plinths, page headings, footer or finish controls.

- [Download Version 2](downloads/Portal-Entrance-Version-2.html): open the file on GitHub, click **Download raw file** (the downward-arrow icon), then open the saved HTML in Chrome or Edge.
- [Viewing instructions](downloads/README.md)
- [Version 2 source on GitHub](https://github.com/kelse-alt/serpentis-regina-plm-core/tree/codex/portal-entrance-v0.2.0/portal)
- [Preserved Version 1](https://github.com/kelse-alt/serpentis-regina-plm-core/tree/portal-v0.1.0/portal)

The one-file preview embeds the code, styles and three models. The entrance can run without separate asset requests; following the live atelier link requires internet access. This is a downloadable preview. The Squarespace site has not been changed.

## Version 2 behavior

- Mother → **Amaya Kelsea**; Maiden → **Serpentis Regina**; Crown → **KLS**.
- The surface uses a pearl-gray and magenta contour shader sampled from the head logo in the live site's top-left corner. The palette is `#b8b8b8`, `#b68294` and `#b00046`; chrome, iridescence and rainbow reflections are removed.
- Heads occupy the desktop viewport side by side. Mobile keeps all three in one viewport as three rows.
- Hover or focus reveals information; click/tap pins or toggles it. Escape dismisses it. Dragging rotates a head without selecting it.
- The Serpentis Regina information includes the actual atelier link. Amaya and KLS retain source-based introductions; their full mini-sites are separate work.
- Reduced-motion preferences and unavailable-WebGL access are supported. Original GLB bytes are preserved.

The supplied GLBs contain no original texture maps or material capture. The shader matches the sampled logo palette and finish; it is not a claim of pixel-identical reproduction of every rotating head.

## Run and rebuild

Use Node.js 24+ and npm inside `portal/`:

```sh
npm ci --cache .npm-cache
npm run dev
```

For a production review and single-file build:

```sh
npm run build
npm run preview
npm run standalone
```

Development uses loopback port 8034; production preview uses 8035 unless overridden. The generated standalone file is local output; the identified Version 2 delivery copy is `downloads/Portal-Entrance-Version-2.html`.

## Verification

The production build, all six Version 2 browser check groups and the embedded HTML checks passed. Run the browser checks against the production preview:

```sh
python3 scripts/check_portal_v2.py
python3 scripts/check_standalone_v2.py
```

The checks cover actual model loading, black heads-only framing, desktop/mobile fit, reveal and dismissal, rotation, touch/keyboard behavior, the real atelier link, fallback access and the embedded preview. See the [desktop screenshot](docs/previews/portal-v2-desktop.png), [revealed information](docs/previews/portal-v2-info.png), [mobile screenshot](docs/previews/portal-v2-mobile.png), [browser results](docs/validation/portal-v2-checks.json) and [embedded HTML results](docs/validation/portal-v2-standalone.json). No page errors or external asset requests were observed.

The managed cloud browser blocks direct `file://` navigation. Standalone checks use one locally served HTML document and block additional resource requests; they do not independently certify double-click behavior in that browser. Physical-device GPU performance and a complete accessibility audit remain outstanding. The originals total about 11 MB and 455,000 triangles.

## Source and version record

See [SOURCES.md](SOURCES.md), [CHANGELOG.md](CHANGELOG.md), [the development handoff](GITHUB_HANDOFF.md), [model provenance](docs/portal-assets.json) and [the audit record](docs/README.md). `src/worlds.js` holds the three identities and source models; `src/main.js` loads them and implements the shader and interaction.

Version 1 is preserved by `portal-v0.1.0` at commit `6fedc025eb6cfcc60a6fab1c94a7d4e75666f6a2`. Version 2 uses branch `codex/portal-entrance-v0.2.0` and milestone tag `portal-v0.2.0`, separate from the PLM application's version tags. No client records or raw technical portfolio documents are included in the portal.
