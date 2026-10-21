# GitHub development handoff — Portal Version 2

## Current direction

The founder's Version 2 instruction supersedes the original gallery presentation: a full-screen black abyss, only three large heads at rest, no plinths or visible page chrome, and information beneath a head only when it is touched, hovered or focused. Keep this interaction model when continuing the entrance.

| World | Head | Current content |
|---|---|---|
| Amaya Kelsea — The Designer | Mother | Inline introduction |
| Serpentis Regina — The Bespoke | Maiden | Inline introduction and the real atelier link |
| KLS — Procurement & Consulting | Crown | Inline introduction |

The surface shader uses the sampled website-logo palette `#b8b8b8`, `#b68294`, `#b00046`. There is no chrome environment, iridescence or teal/violet reflection lighting. GLBs have no original texture maps; describe the result as a sampled palette/finish match, not proven pixel identity across all views.

## GitHub locations

- Repository: private `kelse-alt/serpentis-regina-plm-core`; application source under `portal/`.
- Current branch: `codex/portal-entrance-v0.2.0`; milestone tag `portal-v0.2.0`.
- [Preserved Version 1](https://github.com/kelse-alt/serpentis-regina-plm-core/tree/portal-v0.1.0/portal): tag `portal-v0.1.0`, commit `6fedc025eb6cfcc60a6fab1c94a7d4e75666f6a2`.
- [Version 2 source](https://github.com/kelse-alt/serpentis-regina-plm-core/tree/codex/portal-entrance-v0.2.0/portal) and [Version 2 download](https://github.com/kelse-alt/serpentis-regina-plm-core/blob/codex/portal-entrance-v0.2.0/portal/downloads/Portal-Entrance-Version-2.html).

Do not replace the preserved Version 1 preview when delivering Version 2. Existing PLM application files are outside this entrance change.

## Source and verification workflow

1. Work inside `portal/`; keep model assignments in `src/worlds.js`, rendering/interactions in `src/main.js` and composition in `src/style.css`.
2. Use `npm ci --cache .npm-cache`, then `npm run build` and `npm run preview`.
3. Run `python3 scripts/check_portal_v2.py`. It must exercise actual GLBs, initial heads-only black framing, reveal/dismissal, rotation, desktop/mobile viewport fit, touch/keyboard behavior and unavailable-WebGL access.
4. Run `npm run standalone`, then `python3 scripts/check_standalone_v2.py`. Verify the identified delivery copy after packaging.
5. Review `docs/previews/portal-v2-desktop.png`, `portal-v2-mobile.png` and `portal-v2-info.png`; record outcomes under `docs/validation/`.
6. Commit source, screenshots, validation records and the identified Version 2 HTML snapshot together. Use a scoped `portal-` tag for each verified milestone and a reviewable PR.
7. Fetch the uploaded HTML through authenticated GitHub content retrieval and compare its SHA-256 before claiming delivery succeeded.

The production build, all six Version 2 browser check groups and embedded-preview checks passed. Version 2 evidence is in `docs/validation/portal-v2-checks.json` and `portal-v2-standalone.json`, with reviewed desktop/mobile screenshots under `docs/previews/`. The preserved Version 1 preview and all three original GLBs were checked byte-for-byte against their recorded originals. The managed cloud browser forbids `file://`; embedded-preview verification uses an allowed one-document loopback transport with subsequent resource requests blocked. Physical mobile GPU performance and full accessibility certification remain unverified.

## Delivery boundary

GitHub repository creation and release-asset upload are restricted for this connection; the release-upload host previously returned HTTP 401. The successful route is the existing private repository's versioned `downloads/` folder. Users sign in, open the HTML file view, click **Download raw file**, and open the saved HTML in Chrome or Edge. No new credentials are needed for that working route.

Repository upload and downloadable HTML do not deploy a live website. Preserve the existing Squarespace site. Keep dependency caches, generated `dist`, raw technical documents, client records and credentials out of source commits. The original model files in `public/models` retain their source bytes; runtime materials and presentation may change.
