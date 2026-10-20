# Serpentis Regina — PLM Core Architecture

The current application is a public fashion technology portfolio prototype: a controlled mannequin measurement register with a local HTML viewer and SQLite storage. The founder authorized publication of the actual approved records and existing Git history on 2026-10-20. A broader product lifecycle management (PLM) system remains a development direction.

## Current data flow

```text
Approved form JSON + source-methods JSON
                  |
       validate and compare all 20 POMs
                  |
          +-------+--------+
          |                |
     HTML report     SQLite v1 snapshot
                           |
                  validate stored records
                           |
                       HTML report
```

`npm run sheet` follows the JSON-to-report path. `npm run db:import` stores the approved snapshot. `npm run sheet:db` opens SQLite read-only and follows the database-to-report path. Both report commands use the same comparison and HTML-building code.

## Source-of-truth hierarchy

1. Founder-approved actual mannequin measurements are the house fit-form standards.
2. Manufacturer-stated dimensions are comparison references only. Missing references remain `null`, never zero.
3. Original source labels and measuring instructions are preserved alongside each POM.
4. Garment specifications, ease, tolerances, and grade rules are separate datasets. They cannot be inferred from mannequin comparison deltas.
5. An approved revision must not be silently overwritten. A future revision needs an explicit identity, reason, provenance, and approval record; the current importer does not yet implement that workflow.

The controlled inputs are `data/house-fit-forms/SR-FORM-001.v1.json` and `data/house-fit-forms/SR-FORM-001-methods.v1.json`. SQLite is a reproducible local copy, not a replacement approval authority. Neither report generation nor database import changes the JSON files or the original Google Sheet.

## Local database

Node.js 24+ supplies SQLite through `node:sqlite`; no external package or database server is required.

| Table | Responsibility |
|---|---|
| `form_versions` | Store the form identity and dataset revision, complete source snapshots, and their SHA-256 fingerprints |
| `measurements` | Store ordered POM records, approved values, nullable references, exact source labels, and measuring methods |

The form identity and revision connect the tables. Unique keys prevent duplicate POMs or positions within a revision. Validation checks approval status, form identity, units, complete methods, the 20-POM baseline, and matching source provenance before import.

An import saves the form and all measurement rows in one transaction. A storage failure rolls back the whole import. Repeating equivalent source content leaves the stored revision unchanged; different content for the same identity is rejected. JSON object-key order does not create a new measurement revision.

On read, the application checks source-snapshot fingerprints and compares stored rows against their approved snapshot. Differences are calculated from the read values rather than saved as additional standards. These checks detect stored inconsistencies; they do not constitute a new approval or a digital signature.

The generated database, SQLite sidecar files, and HTML are ignored by Git because they are rebuildable outputs. The report is local and uses no third-party scripts, fonts, analytics, or network APIs.

## Three distinct versions

| Version | Meaning |
|---|---|
| Application **v0.2.0** | The program milestone that adds SQLite to the original report workflow |
| Dataset **SR-FORM-001 v1** | The approved measurement baseline currently accepted by the importer |
| JSON **`schemaVersion: "1.0"`** | The structure of the form source document |

The database schema's ability to identify revisions does not mean the application supports importing arbitrary future revisions. Its current import boundary is SR-FORM-001 v1 with 20 POMs.

## Provenance and approval

The records originate from `MEASUREMENT SHEET_SERPENTIS REGINA`, tab `BODY REF-MANNEQUIN-SIZE 8-V1`. The JSON records founder approval on 2026-10-20. The original Sheet retains an earlier pending-verification label, while the versioned record carries the approved status. The application preserves that distinction and does not alter the Sheet.

Publication authorization is separate from measurement approval. The founder authorized public sharing of these actual records and the repository history on 2026-10-20; that does not change the measurement values or create a new approval signature. Before manufacturing use, verify the form identity, source methods, and approval trace.

## Future development

The next stages are plans, not implemented capabilities:

1. Explicit revision management with reasons, authorship, predecessor records, and approvals.
2. Style records and master tech packs, keeping garment specifications separate from body-form references.
3. Fit-sample comments, before/after-wash specifications, graded sizes, tolerances, and documented grade rules.
4. A web application with authenticated editing, roles, validated APIs, backups, and operational monitoring.

The current prototype has no multiuser editing, login system, live Sheet synchronization, hosted application, or production PLM deployment.
