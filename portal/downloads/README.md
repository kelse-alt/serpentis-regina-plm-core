# Open Portal Version 2

1. Sign in to GitHub with access to this private repository.
2. Open [Portal-Entrance-Version-2.html](Portal-Entrance-Version-2.html).
3. Click **Download raw file** (the downward-arrow icon near the file view's top-right).
4. Open the saved HTML in Chrome or Edge. Allow the three embedded heads a moment to load.

The initial screen is black with only three heads. Hover, focus or tap one to reveal its information below; drag to rotate it. Escape dismisses the information. The Serpentis Regina information links to the live atelier.

No coding-tool installation or separate model download is required. The HTML embeds its styles, code and models. The atelier link still requires internet access. This is a downloadable preview; the live Squarespace site is unchanged.

## Preserved Version 1

[Portal-Entrance-Preview.html](Portal-Entrance-Preview.html) is the unchanged Version 1 delivery copy. Its [tagged source archive](https://github.com/kelse-alt/serpentis-regina-plm-core/tree/portal-v0.1.0/portal) preserves the first design at commit `6fedc025eb6cfcc60a6fab1c94a7d4e75666f6a2`.

## Delivery record

Versioned downloads are used because GitHub's separate release-asset upload service previously rejected authentication, while the repository/Git route works. Rebuild with `npm run standalone` from `portal/`, verify the generated file, then deliberately update the identified Version 2 snapshot. Keep Version 1 intact.

Version 2's production build, desktop/mobile interaction checks and embedded HTML verification passed. See the [validation and screenshot record](../docs/README.md). The managed cloud browser checks the embedded document over loopback with extra requests blocked; direct `file://` opening is restricted in that browser.

The [GitHub delivery verification](../docs/validation/portal-v2-github-delivery.json) records a matching downloaded copy: 15,356,781 bytes, SHA-256 `18dfd85b0d913c2fa2fba25a7962db2838f69e9610d68d23c64ae6905b6effd4`.
