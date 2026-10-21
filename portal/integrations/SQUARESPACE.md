# Connect the portal to Squarespace

The prepared entrance uses the approved Version 2.1 appearance. GitHub Pages serves the interactive portal; Squarespace displays it on the existing `/landing-portal` page. The Serpentis Regina atelier remains at `/home`.

The working address used by the embed is:

https://kelse-alt.github.io/serpentis-regina-plm-core/index.html?v=2.1

GitHub Pages is enabled, the build succeeded, HTTPS is enforced and the custom domain is cleared. The founder confirmed this address loads successfully. The explicit `index.html` path avoids a browser's remembered redirect from the earlier custom-domain attempt. The Squarespace embed has not yet been installed.

The repository is public and the tested `portal-site` branch is published. All nine hosting files were checked against their local staged bytes. The owner enabled Pages after this connection's activation attempt returned HTTP 403. See [the delivery record](../docs/validation/squarespace-delivery.json) and [PR #4](https://github.com/kelse-alt/serpentis-regina-plm-core/pull/4).

## 1. Confirm the hosting settings

These settings are already active; use them when reviewing or restoring the hosting configuration:

1. Open the repository's [Pages settings](https://github.com/kelse-alt/serpentis-regina-plm-core/settings/pages).
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch **portal-site**, folder **/(root)**, then save.
4. Wait for GitHub to show the published address, then open it and check all three heads.

The branch contains the built portal and its three models. Its site folder does not include the PLM application's measurement records, reports or database files. The source repository's visibility is a separate setting: GitHub Pages on a free plan uses a public repository; eligible paid plans can also use private repositories. Pages and repository settings need the owner's GitHub account when the connected integration lacks the required permissions.

Once enabled, each new commit to `portal-site` updates the hosted entrance. Keep source changes on review branches and publish only an approved portal build to that branch.

## 2. Install the Squarespace embed

Use a Squarespace plan that permits iframe/custom HTML embeds. Menu labels can vary with the editor version.

1. In Squarespace **Pages**, open the existing **LANDING PORTAL** page at `/landing-portal`.
2. Replace its placeholder sections with **one blank section** containing **one Code Block**. Keep the separate atelier page and its `home` URL slug intact.
3. Open [squarespace.html](squarespace.html), copy the entire fragment and paste it into the Code Block. Use HTML mode and turn off the option that displays code as text.
4. Save the page. Open `/landing-portal` in a private browser window to view the visitor version; the editor may pause iframe previews.

The snippet fills the visitor's viewport with a black, borderless iframe. It removes the landing page's header, footer, grid gaps and content padding. Every CSS selector is scoped to `body#collection-6a8bb66559785a1838e75235`, the collection ID inspected on `/landing-portal` on 2026-10-21. Other pages retain their layout and navigation. If that page is replaced or duplicated, inspect its new collection ID and update every selector before use.

Common Squarespace editing classes are excluded from the visitor layout rules. The iframe stays in normal document flow, and its height is reduced while editing; the snippet does not hide or overlay the editor toolbar. An authenticated Squarespace editor session still needs to be checked in the actual account.

## 3. Check the route before making it the homepage

On a computer and a phone:

- The initial view contains only the three heads against black, with no outer spacing, header, footer or page scroll.
- Hover, focus or tap a head to reveal its information. Drag to rotate it; Escape dismisses the information.
- Choose **Enter the atelier** under Serpentis Regina. The complete browser window should navigate to `https://www.serpentisregina.com/home`.
- Open `/home` directly and confirm the existing atelier and its navigation still work.

The connection build points the atelier link to `/home` and gives it `target="_top"` so it leaves the embedded frame. Keeping the destination as `/` after the portal becomes the homepage would send visitors back into the portal. The iframe is intentionally unsandboxed so the user-activated top-level navigation can work.

Amaya and KLS retain their current introduction panels. The existing `/kelsea` and `/kls-procurment` pages contained template content when inspected; they are not connected as live destinations in this integration.

## 4. Make the reviewed entrance the homepage

Once `/landing-portal` passes the visitor checks, open that page's settings in Squarespace and choose **Set as Homepage**. Confirm the change, then revisit `https://www.serpentisregina.com/` and test **Enter the atelier** again.

The root address will show the portal, while `/home` remains the atelier destination. Keep the earlier homepage available so its own page settings can restore it if needed. The tagged Version 2.1 source and older downloadable portal previews remain preserved on GitHub.

This handoff prepares the connection. Publishing the Pages branch, installing the Code Block and changing the Squarespace homepage are separate steps; their completion must be verified rather than inferred from this document.
