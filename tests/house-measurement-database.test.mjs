import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadHouseData, buildMeasurementRows } from '../src/house-measurement-sheet.mjs';
import { openHouseDatabase, importHouseForm, readHouseForm } from '../src/house-measurement-database.mjs';

const { form, sourceMethods } = await loadHouseData();
const expectedRows = buildMeasurementRows(form, sourceMethods);

function withDatabasePath(run) {
  const directory = mkdtempSync(join(tmpdir(), 'sr-house-database-test-'));
  try {
    return run(join(directory, 'house-measurements.sqlite'));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function withDatabase(run) {
  return withDatabasePath(path => {
    const database = openHouseDatabase(path);
    try {
      return run(database);
    } finally {
      database.close();
    }
  });
}

function assertCounts(database, versions, measurements) {
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM form_versions').get().total, versions);
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM measurements').get().total, measurements);
}

test('a reopened local database preserves all approved values, methods, and provenance', () => {
  withDatabasePath(path => {
    let database;
    const originalForm = structuredClone(form);
    const originalMethods = structuredClone(sourceMethods);
    try {
      database = openHouseDatabase(path);
      assert.deepEqual(importHouseForm(database, form, sourceMethods), { status: 'imported', total: 20 });
      database.close();
      database = undefined;

      database = openHouseDatabase(path);
      const saved = readHouseForm(database);
      assert.deepEqual(saved.form, form);
      assert.deepEqual(saved.sourceMethods, sourceMethods);
      assert.deepEqual(saved.rows, expectedRows);
      assertCounts(database, 1, 20);
      assert.deepEqual(form, originalForm, 'import must not mutate the approved form object');
      assert.deepEqual(sourceMethods, originalMethods, 'import must not mutate the source methods');
    } finally {
      database?.close();
    }
  });
});

test('SQLite keeps missing references as NULL and retains every original measurement field', () => {
  withDatabase(database => {
    importHouseForm(database, form, sourceMethods);
    const stored = database.prepare(`
      SELECT pom_code, description, source_label, how_to_measure,
             house_standard, manufacturer_reference
      FROM measurements
      WHERE form_id = ? AND revision = ?
      ORDER BY position
    `).all(form.formId, 'v1');

    assert.equal(stored.length, 20);
    assert.equal(stored.filter(row => row.manufacturer_reference === null).length, 13);
    assert.equal(stored.filter(row => row.manufacturer_reference !== null).length, 7);
    for (const [index, row] of stored.entries()) {
      const expected = expectedRows[index];
      assert.equal(row.pom_code, expected.pomCode);
      assert.equal(row.description, expected.description);
      assert.equal(row.source_label, expected.sourceLabel);
      assert.equal(row.how_to_measure, expected.howToMeasure);
      assert.equal(row.house_standard, expected.houseStandard);
      assert.equal(row.manufacturer_reference, expected.manufacturerReference);
    }
    for (const row of readHouseForm(database).rows) {
      if (row.manufacturerReference === null) {
        assert.equal(row.difference, null);
        assert.equal(row.hasReference, false);
      }
    }
  });
});

test('importing the same approved version again changes nothing and creates no duplicates', () => {
  withDatabase(database => {
    importHouseForm(database, form, sourceMethods);
    const before = readHouseForm(database);
    assert.deepEqual(importHouseForm(database, form, sourceMethods), { status: 'unchanged', total: 20 });
    assertCounts(database, 1, 20);
    assert.deepEqual(readHouseForm(database), before);
  });
});

test('equivalent JSON objects with a different key order are the same approved import', () => {
  function reorderKeys(value) {
    if (Array.isArray(value)) return value.map(reorderKeys);
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reorderKeys(item)]));
    }
    return value;
  }

  withDatabase(database => {
    importHouseForm(database, form, sourceMethods);
    assert.deepEqual(importHouseForm(database, reorderKeys(form), reorderKeys(sourceMethods)), {
      status: 'unchanged', total: 20,
    });
    assertCounts(database, 1, 20);
    assert.deepEqual(readHouseForm(database).rows, expectedRows);
  });
});

test('changed measurements or measuring methods cannot overwrite an imported version', () => {
  withDatabase(database => {
    importHouseForm(database, form, sourceMethods);
    const before = readHouseForm(database);

    const changedForm = structuredClone(form);
    changedForm.measurements[0].houseStandard += 0.125;
    assert.throws(() => importHouseForm(database, changedForm, sourceMethods));
    assert.deepEqual(readHouseForm(database), before);

    const changedMethods = structuredClone(sourceMethods);
    changedMethods.methods[0].howToMeasure += ' Test-only changed instruction.';
    assert.throws(() => importHouseForm(database, form, changedMethods));
    assert.deepEqual(readHouseForm(database), before);

    const changedApproval = structuredClone(form);
    changedApproval.approval.note += ' Test-only changed approval metadata.';
    assert.throws(() => importHouseForm(database, changedApproval, sourceMethods));

    const changedMethodsMetadata = structuredClone(sourceMethods);
    changedMethodsMetadata.note += ' Test-only changed source metadata.';
    assert.throws(() => importHouseForm(database, form, changedMethodsMetadata));
    assert.deepEqual(readHouseForm(database), before);
    assertCounts(database, 1, 20);
  });
});

test('reading or reimporting a damaged stored measurement fails rather than hiding the change', () => {
  withDatabase(database => {
    importHouseForm(database, form, sourceMethods);
    database.prepare(`
      UPDATE measurements SET house_standard = house_standard + 0.125
      WHERE form_id = ? AND revision = ? AND pom_code = ?
    `).run(form.formId, 'v1', form.measurements[0].pomCode);

    assert.throws(() => readHouseForm(database), /do not match the approved source snapshot/);
    assert.throws(() => importHouseForm(database, form, sourceMethods), /do not match the approved source snapshot/);
    assertCounts(database, 1, 20);
  });
});

test('changed stored approval or source metadata is detected by its snapshot fingerprint', () => {
  const cases = [
    ['form_json', () => {
      const changed = structuredClone(form);
      changed.approval.note += ' Test-only damaged approval metadata.';
      return changed;
    }],
    ['methods_json', () => {
      const changed = structuredClone(sourceMethods);
      changed.note += ' Test-only damaged source metadata.';
      return changed;
    }],
  ];

  for (const [column, damagedSnapshot] of cases) {
    withDatabase(database => {
      importHouseForm(database, form, sourceMethods);
      database.prepare(`UPDATE form_versions SET ${column} = ? WHERE form_id = ? AND revision = ?`)
        .run(JSON.stringify(damagedSnapshot()), form.formId, 'v1');

      assert.throws(() => readHouseForm(database), `${column} fingerprint must detect metadata damage`);
      assert.throws(() => importHouseForm(database, form, sourceMethods), `${column} damage must not be silently overwritten`);
      assertCounts(database, 1, 20);
    });
  }
});

test('unapproved, invalid, incomplete, or mismatched source data creates no partial import', () => {
  const cases = [
    ['unapproved form', input => { input.form.approval.status = 'PENDING'; }],
    ['invalid measurement', input => { input.form.measurements[0].houseStandard = NaN; }],
    ['undefined reference', input => { input.form.measurements[0].manufacturerReference = undefined; }],
    ['source document mismatch', input => { input.sourceMethods.sourceDocument = 'OTHER DOCUMENT'; }],
    ['source tab mismatch', input => { input.sourceMethods.sourceTab = 'OTHER TAB'; }],
    ['approval revision mismatch', input => { input.form.approval.sourceRevision = 'OTHER REVISION'; }],
    ['incomplete approved baseline', input => {
      input.form.measurements.pop();
      input.sourceMethods.methods.pop();
    }],
  ];

  for (const [label, modify] of cases) {
    withDatabase(database => {
      const input = structuredClone({ form, sourceMethods });
      modify(input);
      assert.throws(() => importHouseForm(database, input.form, input.sourceMethods), label);
      assertCounts(database, 0, 0);
    });
  }
});

test('a storage failure during the second measurement rolls back the whole import', () => {
  withDatabase(database => {
    database.exec(`
      CREATE TRIGGER reject_second_measurement
      BEFORE INSERT ON measurements
      WHEN (SELECT COUNT(*) FROM measurements) = 1
      BEGIN
        SELECT RAISE(ABORT, 'Test-only measurement storage failure');
      END;
    `);

    assert.throws(() => importHouseForm(database, form, sourceMethods), /Test-only measurement storage failure/);
    assertCounts(database, 0, 0);

    database.exec('DROP TRIGGER reject_second_measurement');
    assert.deepEqual(importHouseForm(database, form, sourceMethods), { status: 'imported', total: 20 });
    assert.deepEqual(readHouseForm(database).rows, expectedRows);
    assertCounts(database, 1, 20);
  });
});
