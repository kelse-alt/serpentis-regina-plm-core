# iPhone workroom app — v0.7.1

Open the [Serpentis Regina Workroom](https://kelse-alt.github.io/serpentis-regina-plm-core/workroom/) in **Safari** on your iPhone. The workroom installs on your Home Screen from Safari and opens in its own app window. It is an installable web app; no App Store download or Apple developer account is needed.

The app contains a [pinned style reference panel](pinned-style-reference.md) with front/back example images and Hide/Show style controls, the six workroom sheets, shared style record, local autosave and named revisions, measurement entry, original photographs and house styling. The separate client intake remains available from the workroom. The public site serves application code, blank templates and authorized house reference/provenance; filled packs and attached project images stay on the device.

## Install on your iPhone

1. Open the workroom link in Safari. If the link opens inside another app, use that app’s option to open it in Safari.
2. Tap **Share**, then **Add to Home Screen**. You may need to scroll through the Share menu.
3. If **Open as Web App** appears, leave it enabled. Tap **Add**.
4. Open **SR Workroom** from the new Home Screen icon while you are online. You can change the icon name during installation. Open **Export → Install & app info** and wait for **Offline ready on this device** before relying on offline use.
5. Start with the shared style record, choose garment units, and enter a working specification. Check the saved status before closing.

After the initial preparation, the cached workroom can reopen without a connection. Reconnect to receive a later application update. Offline preparation caches the public application files; it does not upload your work or create cross-device synchronization.

## Keep working records in the app you use

Drafts, original image Blobs and named revisions are stored locally in the browser/app’s IndexedDB. The separate client intake has its own local draft workflow. Installation does not merge those stores or publish records to GitHub.

An iPhone Home Screen app may have separate storage from a Safari tab. A desktop browser, another browser/profile, a local HTML file and the hosted app can also have separate stores. Begin regular work in the Home Screen app after installing it.

To move an existing pack:

1. In the browser or desktop workroom that holds the pack, open **Export → Download pack JSON**.
2. Save or transfer that JSON file to the iPhone, for example through Files or AirDrop.
3. In the Home Screen workroom, open **Export → Import JSON** and select the file.
4. Check the style, units, measurements and images, then check that the local save completed.

Pack JSON contains the current draft and its original images. Ordinary pack JSON does **not** include named revision history; that history remains in the original browser/app store. A conflicting imported pack identity becomes a separate working copy rather than replacing an existing saved draft. Keep JSON backups before removing the app or clearing website data.

## Receive a new version

Open **Export → Install & app info** to see the **Workroom app** screen, its build (for example, **Workroom v0.7.1**) and offline/update state. Open the app online to allow an update check. When a newer application is ready, choose **Save & update app**. The update waits for that explicit action; it does not automatically reload your working draft while you are editing.

The workroom checks valid entries and confirmed local saving before applying an update. If an entry needs correction, a file operation is still running, or saving cannot be confirmed, resolve that condition before trying again. Keep a portable JSON backup whenever export is available. The update changes application files and preserves local records; it does not create a new measurement approval or revise the approved house data.

The client intake also has an **Install & app info** entry in **Drafts & exports**. Apply updates from the main Workroom: save or export the intake first, then use **Back to Workroom**.

## Give useful revision feedback

Use the app on the actual tasks you want to perform. For each revision, record:

- The sheet and POM/row, or the specific style/revision control.
- What you were trying to do and what happened.
- The change you want, including wording, layout, entry order or comparison behavior.
- The app version from its information screen, iPhone model/iOS version, and whether it was opened from the Home Screen or Safari.

A screenshot can make a visual issue easier to locate. Crop or redact private project/client information before sharing it. Describe the task in your own fashion/workroom language; source-language and master-library decisions remain a separate reviewed workflow.

## Source, hosting and verification

PWA packaging is built with `node scripts/build-workroom-pwa.mjs` into `reports/workroom-pwa/`. Install and offline behavior require an HTTPS host or a supported local development origin; opening the ZIP’s standalone HTML file does not install a service worker.

The hosted app lives only under `/serpentis-regina-plm-core/workroom/`. Its manifest, worker scope and application caches must stay in that subdirectory. Deployment adds the workroom distribution to the existing `portal-site` branch and preserves the live three-head portal and its existing files. Source changes remain documented on the source branch.

The PWA retains application schema 2 and the existing workroom database identity. It preserves the house palette/assignments, Barlow Condensed, original seal and reference artwork, all measurement formulas, and the separation of BF house references, RC intake and garment specifications. No account, remote submission, background synchronization, hosted project database or App Store binary is introduced.

Historical v0.7.0 verification: source commit `f2bc948` passes **86 Node tests**, **36 sheet/viewport combinations** and **38 daily workflow checks**. Chromium 154 and WebKit 26.5 each pass **19 PWA workflow checks**, three phone layouts and simulated keyboard resizing, including real saved images, offline reopening, pending-file/invalid-entry/failed-write update refusal, post-save review races and an actual two-build update. See the [PWA browser evidence](validation/workroom-pwa.json) and [daily regression evidence](validation/workroom-pwa-daily-regression.json). The [blank iPhone preview](previews/workroom-pwa-iphone.png) and [installation screen](previews/workroom-pwa-install.png) contain no filled projects.

Historical v0.7.0 GitHub Pages deployment: `f3f7062`. All eight hosted application files match the tested build byte for byte. Live checks confirm manifest/icon delivery, offline reopening of the workroom and client intake, unchanged portal root bytes, and a worker confined to the workroom. All ten existing portal files are unchanged in the deployment tree. See the [live deployment evidence](validation/workroom-pwa-live.json) and [Pages run](https://github.com/kelse-alt/serpentis-regina-plm-core/actions/runs/40001895455).

These automated checks do not test a physical iPhone, its native Share menu or native keyboard. WebKit used temporary persistent profiles because its Linux ephemeral profile rejects even a bare IndexedDB Blob write; its outage checks refuse HTTP server connections because Playwright’s offline switch causes an internal engine error. The evidence records those limits and the execution proxy certificate workaround used for the live headless check. The founder’s first Home Screen session supplies the device-specific feedback.

Current v0.7.1 adds the pinned style reference panel and passes the fresh checks recorded in [pinned-style validation](validation/pinned-style-reference.json). Use the [pinned-panel guide](pinned-style-reference.md) for Show/Hide controls and the compact phone reference strip.
