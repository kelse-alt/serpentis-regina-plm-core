# GitHub development handoff

## Current milestone

**v0.1.0** is a reviewable three-world entrance, separate from the measurement/intake application. The founder requested that GitHub document the work and deliver the interactive preview.

The GitHub location for this milestone is the private `kelse-alt/serpentis-regina-plm-core` repository, branch `codex/portal-entrance-v0.1.0`, under the new `portal/` directory. Existing PLM application files are outside this change. The portal release tag is `portal-v0.1.0`; it is distinct from the PLM application's version tags. Source upload and draft-release delivery must each be verified separately.

| World | Source model | Current destination |
|---|---|---|
| Amaya Kelsea — The Designer | Mother | Introduction panel |
| Serpentis Regina — The Bespoke | Maiden | Introduction panel with a link to the live atelier |
| KLS — Procurement & Consulting | Crown | Introduction panel |

The original GLB files are in `public/models`. Their source identities and hashes are documented in [SOURCES.md](SOURCES.md). The source blueprint establishes the three-head entrance; do not replace it with an assumed client-account dashboard.

## Files to preserve

- `src/worlds.js`: world identities, confirmed model assignments, introductory copy and real destination.
- `src/main.js`: model loading, materials, plinths, rotation, entry transitions and controls.
- `src/style.css` and `index.html`: responsive composition and accessible page/dialog structure.
- `public/models`: the three original model copies.
- `package.json` and `package-lock.json`: pinned tooling and repeatable installation.
- `scripts`: standalone packaging and meaningful browser checks.
- `README.md`, `SOURCES.md`, `CHANGELOG.md` and this handoff: scope, provenance and development record.

Do not commit dependency caches, generated `dist`, local artifacts, client information or the audited technical-document collection. The generated standalone HTML is a release asset, rather than an additional source model or workbook.

## Repeatable workflow

1. Work inside `portal/`. Make one coherent source change and explain the resulting behavior in its commit message.
2. Install with `npm ci --cache .npm-cache` when dependencies need refreshing. Preserve the lockfile unless intentionally updating dependencies.
3. Run `npm run build`. For functional checks, start `npm run preview` and run `python3 scripts/check_portal.py` using Python Playwright and Chromium.
4. Generate the one-file preview with `npm run standalone`; then run `python3 scripts/check_standalone.py` in the same browser-capable environment.
5. Review the actual desktop/mobile rendering and confirm the three model copies still match the source hashes.
6. Commit portal source and documentation together on the dedicated branch. Use `portal-` release tags to mark verified entrance milestones, with concise changes, test evidence and remaining limits.
7. Attach the generated `Serpentis-Regina-Portal.html`, a preview screenshot and an identified source archive to the intended private draft release. Verify the remote asset and signed-in download link before saying delivery succeeded.

Repository/release upload, a downloadable preview, and a hosted live website are separate outcomes. Report only those verified. GitHub upload does not change Squarespace, establish GitHub Pages access or deploy the portal.

## Validation baseline

The production build and seven browser check groups passed for this milestone. The single-file check confirmed all three models, rotation, entry/close, finish switching and same-document navigation with no additional network requests or page errors. The cloud browser forbids direct `file://` navigation, so that check used one locally served HTML document with embedded assets and disabled networking after load. Physical-device performance and a comprehensive accessibility review remain outstanding.

The large original models remain uncompressed. The production JavaScript bundle is about 159 KB gzipped; Vite reports the larger uncompressed engine bundle as an optimization opportunity. Do not describe the entrance as production-optimized from these checks alone.

## Next work

- Review the entrance's material finish, scale, lighting and transition with the founder.
- Obtain the remaining KLS and linked brand-system content before expanding those worlds.
- Define and implement the complete Amaya and KLS mini-sites from their actual sources.
- Evaluate optimized model derivatives while retaining originals and visual fidelity.
- Select and verify a hosting/integration route separately from file delivery; preserve the functioning Squarespace customer journey.
- Keep future client-account, intake and PLM data workflows behind their own explicit access design. Existing local apps do not yet provide hosted multiuser authorization.
