# 🎀 Serpentis Regina — JavaScript Lessons in Action

**Project:** SR-FORM-001 · 20 approved mannequin POMs · Public founder-authorized portfolio.

We are building a useful fashion technology application while learning JavaScript one small step at a time. The actual records and repository history are public with founder authorization. The approved measurements stay unchanged as we add code around them.

## Start by running the working program

From the repository root, using **Node.js 24+**:

```bash
npm test
npm run sheet
```

The first command runs **16 tests**: 7 for the measurement sheet and 9 for the database. The second reads the approved form and source methods, displays all 20 POMs in the terminal, and creates:

```text
reports/SR-FORM-001-measurement-sheet.html
```

Open that file locally in a browser. Try **All**, **Compared**, **No reference**, and the search field. **Print / Save PDF** uses the browser's print controls. The viewer works without external libraries or services; generating it does not deploy a website.

Now run the database workflow:

```bash
npm run db:import
npm run sheet:db
```

The first command saves the approved register in `storage/serpentis-regina.sqlite`. The second reads those stored rows and generates the same HTML sheet. There are no extra packages to install and no database service to start.

These outputs are Git-ignored because they can be regenerated. The tracked JSON files remain the approved source.

## 🐍 One idea: a loop handles one object at a time

In `src/house-measurement-sheet.mjs`, find:

```js
for (const record of form.measurements) {
```

Read it as: **“Take one measurement object from the collection, work on it, then move to the next.”**

| Turn through the loop | What `record` refers to |
|---|---|
| First | The BF-01 measurement object |
| Second | The BF-02 measurement object |
| Third | The BF-03 measurement object |
| Continuing | Each remaining object, through BF-20 |

`form.measurements` is the whole array. `record` is the one object being handled during the current turn. Inside the real loop, `compareRecord(record)` applies the same comparison procedure to that object.

The database program reuses this idea:

```js
for (const record of rows) {
```

Inside that loop, `saveMeasurement.run(...)` saves the current object's fields as one database row. The operation stays the same; the object changes. You do not need to memorize SQL yet.

**Learning rhythm:** run the code with the teacher, inspect what happened, then explain one small part in your own words. Prediction exercises can wait until the executed example feels familiar.

## Your lesson map

| Familiar idea | Code to find | Its job in this application |
|---|---|---|
| Variables | `const rows = []` | Give our collection a name |
| Objects | `record.houseStandard` | Read one property from the current measurement |
| Arrays | `form.measurements` | Hold all 20 measurement objects |
| Loops | `for (const record of form.measurements)` | Handle those objects one at a time |
| Functions | `compareRecord(record)` | Reuse one comparison procedure |
| Subtraction | `record.houseStandard - record.manufacturerReference` | Calculate house minus manufacturer |
| Display | `console.table()` and `buildHtml()` | Present the records in the terminal and browser |
| Storage | `saveMeasurement.run(...)` | Save one object's fields in SQLite |

Reading files, validation, HTML generation, transactions, and testing are supporting features. You can use the application before learning every detail of them.

## Measurement rules the code protects

- **House standard:** the physically measured mannequin value approved for the register.
- **Manufacturer reference:** a comparison value, only when one was supplied.
- **Delta:** house standard − manufacturer reference, in inches. Positive means the house form is larger; negative means it is smaller.
- **Dash (—):** no reference was supplied, so no difference is calculated. Missing data is not zero.
- **How to measure:** the original source instructions are preserved alongside each POM.

These comparisons do not set garment ease, tolerances, grading rules, or fit pass/fail judgments.

For example, the existing BF-09 comparison is `14.25 - 14.5 = -0.25`. BF-04 has a house standard of **32.875 in**, but no manufacturer reference: its reference and delta both display **—**. The code preserves both cases without changing either house standard.

## What the database adds

Run the importer a second time:

```bash
npm run db:import
```

It reports **20 POMs unchanged**, instead of adding another 20 copies. Missing references stay SQL `NULL`. Different content cannot overwrite the already imported approved v1, and a failed import cannot leave half of the register saved.

The reader also checks that the stored source snapshots and rows remain consistent. These checks protect the saved copy; they do not approve new measurements.

## Application version is not measurement version

The original **v0.1.0** application generated the JSON-backed report and had 7 tests. **v0.2.0** adds SQLite and brings the suite to 16 tests.

The approved dataset is still **SR-FORM-001 v1**. Its **`schemaVersion: "1.0"`** describes the JSON format. Adding a database did not create a new set of measurements.

## Source reconciliation

The original Google Sheet retains the older “House Reference-Pending Verification” label. The approved status displayed by this program comes from the versioned record. The application does not edit the Sheet or invent an approval signature. Verify fit-form identity, methods, and approval trace before manufacturing use.

## 💗 Review together before moving on

Start with just this question after running the program: **On the second turn through the loop, what does `record` refer to?**

When ready, explore one follow-up at a time:

1. Find where `compareRecord(record)` is called. Which object is being passed to the function?
2. Follow a missing manufacturer reference from JSON `null` to the browser's dash.
3. Run the importer twice and explain why the second run says “unchanged.”

Future lessons can introduce `return` versus `console.log`, reading database rows, and explicit revision management. The current focus is understanding the working register we have already executed.
