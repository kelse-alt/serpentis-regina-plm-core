# Open Portal Version 2.1

1. Sign in to GitHub with access to this private repository.
2. Open [Portal-Entrance-Version-2.1.html](Portal-Entrance-Version-2.1.html).
3. Click **Download raw file** (the downward-arrow icon near the file view's top-right).
4. Open the saved HTML in Chrome or Edge. Allow the three embedded heads a moment to load.

Version 2.1 adds smoother shading and a glossy clear-coated finish to the approved black entrance. Only the three heads appear initially. Hover, focus or tap one to reveal its information below; drag to rotate it. Escape dismisses the information. Serpentis Regina links to the live atelier.

No coding-tool installation or separate model download is required. The HTML embeds styles, code, models and locally generated reflection lighting. The atelier link requires internet access. This is a downloadable preview; the live Squarespace site is unchanged.

## Preserved versions

- [Version 2 HTML](Portal-Entrance-Version-2.html) and its [tagged source archive](https://github.com/kelse-alt/serpentis-regina-plm-core/tree/portal-v0.2.0/portal) preserve the approved black layout before surface polish.
- [Version 1 HTML](Portal-Entrance-Preview.html) and its [tagged source archive](https://github.com/kelse-alt/serpentis-regina-plm-core/tree/portal-v0.1.0/portal) preserve the first gallery design.

Both earlier delivery files remain unchanged.

## Delivery record

The Version 2.1 production build, all six browser check groups and actual-model surface checks passed. Desktop, information-reveal and mobile screenshots were visually reviewed. Embedded HTML verification passed: all three models loaded and offline interactions worked without additional resource requests or page errors. The uploaded GitHub HTML was downloaded and verified byte-for-byte against the tested artifact.

Versioned downloads are used because GitHub's separate release-asset upload service previously rejected authentication, while the repository/Git route works. Rebuild with `npm run standalone` from `portal/`, verify the generated HTML, then deliberately update the Version 2.1 snapshot. Keep older downloads intact.

See the [validation and screenshot record](../docs/README.md). The managed cloud browser checks the embedded document over loopback with extra requests blocked; direct `file://` opening is restricted in that browser. Older Version 1/2 verification records describe those earlier files.

The [Version 2.1 delivery verification](../docs/validation/portal-v2.1-github-delivery.json) records 15,359,078 bytes with SHA-256 `9bc773e83f1e4604af65691d5b83e7c2be8c4b6c6327beb7c4423a2fb1b6dfb8`.
