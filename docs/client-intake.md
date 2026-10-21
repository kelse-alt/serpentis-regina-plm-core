# Serpentis Regina — Client Measurement Intake

A working intake form based on the supplied **Remote Bespoke Dress Client
Measurement Sheet**, tab **CLIENT BODY MEASUREMENTS**. It preserves the workbook's
field labels, measuring instructions, required markers, and extracted colorway.

## Open the form

For the ready-to-open version, open **client-intake.html** in your browser. No
Node.js installation or external service is needed for this standalone file.

To run with a separate local SQLite database, use **Node.js 24+** from the
repository root:

```bash
npm run intake
```

Open the local address printed in the terminal; the default port is **3002**.
To rebuild the standalone file from source:

```bash
npm run intake:build
```

The build produces `client-intake.html` and an identical copy in `reports/`.

## Take a client intake

1. Enter the client/project details and measurement date. The distributed form
   starts without any filled client identity or project information.
2. Choose **CM** or **IN**. The workbook's default is **CM**.
3. Follow each POM's original measuring instructions and enter decimal values.
   Leave measurements you do not know blank; a blank does not become zero.
4. Save a partial draft whenever needed, then reopen it to continue. Saving creates
   a new record rather than overwriting an earlier saved intake.
5. Use the completeness check when ready. It checks for a client ID or name, a
   measurement date, and all **19 required measurements**. It does not approve
   measurements or resolve questions in the source methods.
6. Export CSV or JSON, import a compatible intake JSON to continue, or print a
   blank/filled form using the print controls.

The workbook contains **34 RC POMs**, numbered RC-01 through RC-35 with **RC-21
absent**. That gap is preserved. These RC measurements are not mapped to the BF
house-form baseline. The source has no comparison reference or delta formula, so
the intake does not invent a house-standard comparison.

## Units and method notes

Measurements are stored internally as centimeters (`valueCm`). Switching display
units converts from that stored value, rather than repeatedly converting the
rounded display. Display values use up to six decimal places.

A small JavaScript example:

```js
const inches = 10;
const centimeters = inches * 2.54; // 25.4
```

Unit changes do **not** rewrite landmarks in the measuring instructions. A method
that says “10 cm below waist” still means that location when entries are in inches.

**RC-12 and RC-13 retain question-mark annotations from the source.** Confirm those
measuring landmarks with the house; the application flags them without inventing
an answer. The croquis section refers to a separate PDF that was not included.
Croquis/client reference areas accept notes; they do not attach or upload files.

## Saving and keeping copies

- **Local server:** intakes save in `storage/client-intakes.sqlite`, separate from
  the approved house register and its measurement sessions.
- **Standalone HTML:** intakes save in that browser on that device. This storage
  does not automatically synchronize with SQLite. Export JSON as a portable copy;
  browser data can be cleared or unavailable.
- **CSV:** provides a table of the intake metadata, POMs, methods, and values in
  the selected unit. **JSON:** retains the structured draft for reimporting.

Filled client records stay local. Do not commit their database, exports, original
filled workbook, or screenshots to the public repository. The prebuilt form
contains the blank template, not saved clients. This prototype does not provide
remote submissions, accounts, attachment storage, or live Google Sheets syncing.

## Source and colorway

The sanitized [template](../data/templates/remote-bespoke-client-intake.v1.json)
records the workbook sheet/range and palette source cells. Its colors include
brand red `#E4002B`, royal blue `#1E22AA`, reference green `#1FA824`, measurement
burgundy `#612028`, dark table `#0F1720`, and blush entry cells `#FFF4F4`.
Original labels and methods remain traceable; filled workbook values are excluded.
The dark table header uses white labels with the source red as an accent for
readable contrast.

See the shared [calculation/validation module](../src/client-intake.mjs) and
[local intake server](../src/client-intake-server.mjs) for the executable code.
