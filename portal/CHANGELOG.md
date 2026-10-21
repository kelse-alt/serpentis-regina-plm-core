# Changelog

## v0.2.1 — Version 2.1: Surface polish — 2026-10-21

The founder approved Version 2's clean black composition and requested a smoother, glossier finish. This edit retains the layout, three-head framing, logo palette and interaction model.

- Added four mild, angle-aware normal-smoothing passes across each model's shared material sections. Original-normal gating and a 20-degree rotation bound retain carved folds. Positions, triangle indices and original GLBs remain unchanged.
- Replaced the simple contour shader with a nonmetallic physical material, clearcoat and locally generated neutral studio reflections. Softer contour transitions reduce the emphasis on small normal variations.
- Kept lighting invisible: the initial screen still contains only three heads against black.
- Added checks using the actual source GLBs to assess smoothness, preserved ridges, shared normals and unchanged geometry/source buffers.
- Identified delivery: `downloads/Portal-Entrance-Version-2.1.html`; branch `codex/portal-entrance-v0.2.1`; milestone tag `portal-v0.2.1`.

The Version 2.1 production build, all six browser check groups and actual-model surface checks passed. Desktop, information-reveal and mobile screenshots were visually reviewed. Embedded HTML verification passed: all three models loaded and offline interactions worked without additional resource requests or page errors. The uploaded GitHub HTML was downloaded and verified byte-for-byte against the tested artifact.

The sculpted forms and jewelry remain; this is a shading/material refinement. Version 1 and Version 2 downloads and tagged archives remain preserved. The live Squarespace site is unchanged.

## v0.2.0 — Version 2: The Abyss — 2026-10-21

The founder requested a direct replacement for the bright gallery layout: a black abyss containing only three enormous heads, with each world's information appearing beneath its head on interaction.

- Removed the plinths, blush background, heading, navigation, footer and finish picker.
- Replaced metallic rainbow reflections with a view-normal pearl-gray/magenta contour finish sampled from the existing website's top-left head logo.
- Made the initial viewport heads-only; hover/focus reveals information and click/tap toggles a pinned reveal. Escape dismisses it, and drag remains rotation rather than selection.
- Kept all three heads within desktop and mobile viewports, with no page scroll.
- Preserved original GLBs and the confirmed Mother/Amaya, Maiden/Serpentis Regina and Crown/KLS mapping.
- Delivery: `downloads/Portal-Entrance-Version-2.html`; branch `codex/portal-entrance-v0.2.0`; milestone tag `portal-v0.2.0`.

Version 1 remains saved at [portal-v0.1.0](https://github.com/kelse-alt/serpentis-regina-plm-core/tree/portal-v0.1.0/portal), commit `6fedc025eb6cfcc60a6fab1c94a7d4e75666f6a2`. Its existing preview file is unchanged.

Version 2's production build and all six browser check groups passed, including real model loading, heads-only black framing, hover/dismissal, drag rotation, keyboard access, touch/mobile fit and unavailable-WebGL fallback. The embedded HTML loaded all three models and supported offline keyboard interactions without external resource requests or page errors. Its record documents the managed browser's direct `file://` restriction. Screenshots and separate Version 2 validation records are in `docs/`. The live Squarespace site is unchanged.

## v0.1.0 — Three-world portal entrance — 2026-10-21

The first working entrance presents the founder's three original sculpted heads in a warm blush setting with marble plinths and reflective colored materials inspired by the existing website logo and supplied artwork.

GitHub milestone tag: `portal-v0.1.0`, scoped separately from the PLM application's releases. Portal source lives under `portal/`.

### Implemented

- Mother enters **Amaya Kelsea**, Maiden enters **Serpentis Regina**, and Crown enters **KLS**, using the founder-confirmed assignments.
- Dragging rotates a head without opening its world. Clicking a head or using its text button opens the matching introduction panel.
- Entry uses a brief enlargement, swirl and fade; reduced-motion preferences bypass that transition.
- Keyboard entry, modal focus containment, Escape/close, and focus return work alongside touch controls.
- Mobile layout stacks the sculptures. Pearl and iridescent finishes are available, and text entry remains usable without WebGL.
- The Serpentis Regina panel links to the current live atelier. Amaya and KLS have introduction panels; their full mini-sites are not implemented in this milestone.
- A standalone HTML build embeds the code, styles and three models for delivery as one downloadable file.

### Validation recorded

- Frozen-lockfile installation and production build succeeded.
- All seven functional browser check groups passed against the production preview, including actual GLB loading, rotation, entry, keyboard behavior, finish switching, 390px mobile overflow and unavailable-WebGL fallback.
- The standalone HTML loaded all three embedded models without additional network requests or page errors. Rotation, entry/close, finish changes and same-document navigation passed with networking disabled after document load.
- The managed cloud browser blocks `file://` navigation. Standalone verification therefore served the single document over loopback HTTP; direct double-click behavior was not independently verified in that browser.
- Model copies retain the downloaded source hashes. Desktop and mobile captures were visually reviewed.

### Scope and limits

The existing Squarespace site has not been changed. New display copy and materials are review-stage interpretations. Detailed KLS content and some linked brand-system sources remain incomplete. Full accessibility certification and performance checks on physical mobile devices remain outstanding; original assets total about 11 MB and 455,000 triangles.

The application includes no client records, technical portfolio documents, original workbooks or credentials. Rotation and presentation materials are applied at runtime; the original neutral-material GLBs are preserved.

### GitHub delivery

Source, audits, screenshots and validation records are versioned on the portal branch and reviewed in PR #1. A private draft release was created. Its asset-upload host rejected authentication, so the standalone preview is versioned under `downloads/` with viewing instructions. No hosted deployment or live-site change has occurred.
