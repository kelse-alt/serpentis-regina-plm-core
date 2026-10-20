/** Local SQLite storage. Approved JSON remains the controlled source. */
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync, openSync, closeSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { loadHouseData, buildMeasurementRows, compareRecord, writeMeasurementSheet } from './house-measurement-sheet.mjs';

export const DATABASE_PATH = fileURLToPath(new URL('../storage/serpentis-regina.sqlite', import.meta.url));
const FORM_ID = 'SR-FORM-001';
const REVISION = 'v1'; // Dataset revision; schemaVersion describes the JSON format instead.
const fingerprint = text => createHash('sha256').update(text).digest('hex');

export function openHouseDatabase(databasePath = DATABASE_PATH) {
  if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
    // Create new files privately, while leaving any existing database intact.
    try { closeSync(openSync(databasePath, 'ax', 0o600)); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  const database = new DatabaseSync(databasePath);
  try {
    database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS form_versions (
        form_id TEXT NOT NULL,
        revision TEXT NOT NULL,
        form_json TEXT NOT NULL,
        methods_json TEXT NOT NULL,
        form_hash TEXT NOT NULL,
        methods_hash TEXT NOT NULL,
        PRIMARY KEY (form_id, revision)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS measurements (
        form_id TEXT NOT NULL,
        revision TEXT NOT NULL,
        position INTEGER NOT NULL CHECK (position > 0),
        pom_code TEXT NOT NULL,
        description TEXT NOT NULL,
        source_label TEXT NOT NULL,
        how_to_measure TEXT NOT NULL,
        house_standard REAL NOT NULL,
        manufacturer_reference REAL,
        PRIMARY KEY (form_id, revision, pom_code),
        UNIQUE (form_id, revision, position),
        FOREIGN KEY (form_id, revision) REFERENCES form_versions (form_id, revision)
      ) STRICT;
    `);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

export function readHouseForm(database, formId = FORM_ID, revision = REVISION) {
  const stored = database.prepare('SELECT form_json, methods_json, form_hash, methods_hash FROM form_versions WHERE form_id = ? AND revision = ?').get(formId, revision);
  if (!stored) throw Error('Approved form not found in database. Run npm run db:import first.');
  if (fingerprint(stored.form_json) !== stored.form_hash || fingerprint(stored.methods_json) !== stored.methods_hash) {
    throw Error('Stored source snapshot fingerprint mismatch.');
  }
  const form = JSON.parse(stored.form_json);
  const sourceMethods = JSON.parse(stored.methods_json);
  const rows = database.prepare(`
    SELECT pom_code AS pomCode, description, house_standard AS houseStandard,
      manufacturer_reference AS manufacturerReference,
      source_label AS sourceLabel, how_to_measure AS howToMeasure
    FROM measurements WHERE form_id = ? AND revision = ? ORDER BY position
  `).all(formId, revision).map(record => compareRecord(record));
  if (!isDeepStrictEqual(rows, buildMeasurementRows(form, sourceMethods))) {
    throw Error('Stored measurements do not match the approved source snapshot.');
  }
  return { form, sourceMethods, rows };
}

export function importHouseForm(database, form, sourceMethods, revision = REVISION) {
  const rows = buildMeasurementRows(form, sourceMethods);
  if (form.formId !== FORM_ID || revision !== REVISION || rows.length !== 20) {
    throw Error('This importer supports the approved SR-FORM-001 v1 baseline of 20 POMs.');
  }
  if (form.source?.document !== sourceMethods.sourceDocument ||
      form.source?.tab !== sourceMethods.sourceTab ||
      form.approval.sourceRevision !== form.source?.tab) {
    throw Error('Source provenance mismatch.');
  }
  // Hash JSON content, so whitespace-only source formatting is not a new revision.
  const formJson = JSON.stringify(form);
  const methodsJson = JSON.stringify(sourceMethods);
  const formHash = fingerprint(formJson);
  const methodsHash = fingerprint(methodsJson);
  database.exec('BEGIN IMMEDIATE');
  try {
    const existing = database.prepare('SELECT 1 FROM form_versions WHERE form_id = ? AND revision = ?').get(form.formId, revision);
    if (existing) {
      const stored = readHouseForm(database, form.formId, revision);
      if (!isDeepStrictEqual(stored.form, form) || !isDeepStrictEqual(stored.sourceMethods, sourceMethods)) {
        throw Error('Approved revision already exists with different content; refusing to overwrite it.');
      }
      database.exec('COMMIT');
      return { status: 'unchanged', total: rows.length };
    }
    database.prepare('INSERT INTO form_versions VALUES (?, ?, ?, ?, ?, ?)')
      .run(form.formId, revision, formJson, methodsJson, formHash, methodsHash);
    const saveMeasurement = database.prepare(`
      INSERT INTO measurements (
        form_id, revision, position, pom_code, description, source_label,
        how_to_measure, house_standard, manufacturer_reference
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    let position = 1;
    // The same familiar for...of loop now saves one POM per turn.
    for (const record of rows) {
      saveMeasurement.run(form.formId, revision, position, record.pomCode,
        record.description, record.sourceLabel, record.howToMeasure,
        record.houseStandard, record.manufacturerReference);
      position += 1;
    }
    readHouseForm(database, form.formId, revision);
    database.exec('COMMIT');
    return { status: 'imported', total: rows.length };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

async function main(command) {
  if (command === 'import') {
    const { form, sourceMethods } = await loadHouseData();
    const database = openHouseDatabase();
    try {
      const result = importHouseForm(database, form, sourceMethods);
      console.log(`${form.formId} ${REVISION}: ${result.total} POMs ${result.status}.`);
      console.log(`Local database: ${DATABASE_PATH}`);
    } finally { database.close(); }
  } else if (command === 'sheet') {
    const database = new DatabaseSync(DATABASE_PATH, { readOnly: true });
    try {
      const { form, rows } = readHouseForm(database);
      await writeMeasurementSheet(form, rows);
    } finally { database.close(); }
  } else {
    throw Error('Use npm run db:import or npm run sheet:db.');
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
}
