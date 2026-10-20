import test from 'node:test';
import assert from 'node:assert/strict';
import { loadHouseData, buildMeasurementRows } from '../src/house-measurement-sheet.mjs';
import { createMeasurementSession, parseMeasurement, calculateDelta, formatDelta, validateMeasurementSession, summarizeSession, sessionToCsv } from '../src/measurement-session.mjs';

const { form, sourceMethods } = await loadHouseData();
const template = { formId: form.formId, revision: 'v1', unit: form.unit, measurements: buildMeasurementRows(form, sourceMethods) };
const fresh = mode => createMeasurementSession(template, { name: 'Test session', measurementDate: '2026-10-20', referenceMode: mode });

test('new sessions use the same 20 POMs, methods, and house references without pre-filling new measurements', () => {
  const original = structuredClone(template);
  const session = fresh();
  assert.equal(session.measurements.length, 20);
  assert.equal(session.referenceMode, 'house');
  for (const [index, record] of session.measurements.entries()) {
    const baseline = template.measurements[index];
    assert.equal(record.pomCode, baseline.pomCode);
    assert.equal(record.sourceLabel, baseline.sourceLabel);
    assert.equal(record.howToMeasure, baseline.howToMeasure);
    assert.equal(record.reference, baseline.houseStandard);
    assert.equal(record.measured, null);
  }
  session.measurements[0].measured = 100;
  assert.deepEqual(template, original);
});

test('delta is new measurement minus reference, with positive, negative, zero, and missing results', () => {
  assert.equal(calculateDelta('10.5', 10), 0.5);
  assert.equal(calculateDelta(9.5, 10), -0.5);
  assert.equal(calculateDelta(10, 10), 0);
  assert.equal(calculateDelta('', 10), null);
  assert.equal(calculateDelta(10, null), null);
  assert.equal(calculateDelta(0, 10), -10);
  assert.equal(calculateDelta(10.0015, 10), 0.002);
  assert.equal(formatDelta(0.5), '+0.5');
  assert.equal(formatDelta(-0.5), '-0.5');
  assert.equal(formatDelta(0), '0');
  assert.equal(formatDelta(null), '—');
});

test('decimal parsing preserves missing values and rejects invalid or negative measurements', () => {
  assert.equal(parseMeasurement(' '), null);
  assert.equal(parseMeasurement('0'), 0);
  assert.equal(parseMeasurement(' 32.875 '), 32.875);
  for (const bad of [-1, 'NaN', Infinity, undefined, true, '0x10', '12 inches', '1/2', [], {}]) {
    assert.throws(() => parseMeasurement(bad));
  }
});

test('manufacturer and custom modes keep absent references null', () => {
  const manufacturer = fresh('manufacturer');
  assert.equal(summarizeSession(manufacturer).missingReferences, 13);
  const custom = fresh('custom');
  assert.ok(custom.measurements.every(record => record.reference === null));
  custom.measurements[0].measured = 10;
  custom.measurements[0].reference = 9.5;
  assert.equal(calculateDelta(validateMeasurementSession(custom, template).measurements[0].measured, 9.5), 0.5);
});

test('validation permits partial measurement sessions while protecting preset baseline values and methods', () => {
  const session = fresh();
  session.measurements[0].measured = 0;
  session.measurements[0].sourceLabel = '<script>untrusted</script>';
  const normalized = validateMeasurementSession(session, template);
  assert.equal(normalized.measurements[0].measured, 0);
  assert.equal(normalized.measurements[0].sourceLabel, template.measurements[0].sourceLabel);
  assert.deepEqual(summarizeSession(normalized), { total: 20, measured: 1, compared: 1, missingReferences: 0 });
  session.measurements[0].reference += 1;
  assert.throws(() => validateMeasurementSession(session, template), /Preset references/);
});

test('validation rejects empty, malformed, mismatched, or duplicate-POM sessions', () => {
  assert.throws(() => validateMeasurementSession(fresh(), template), /at least one/);
  const valid = fresh();
  valid.measurements[0].measured = 10;
  for (const edit of [
    s => { s.name = ''; }, s => { s.name = 'a'.repeat(121); },
    s => { s.measurementDate = '2026-02-30'; }, s => { s.unit = 'cm'; },
    s => { s.templateRevision = 'other'; }, s => { s.referenceMode = 'other'; },
    s => { s.measurements.pop(); }, s => { s.measurements[1].pomCode = s.measurements[0].pomCode; },
    s => { s.measurements[1].pomCode = 'UNKNOWN'; }, s => { s.measurements[0].measured = 'bad'; },
    s => { s.note = 'x'.repeat(4001); },
  ]) {
    const invalid = structuredClone(valid);
    edit(invalid);
    assert.throws(() => validateMeasurementSession(invalid, template));
  }
});

test('CSV retains all 20 rows, missing cells, numeric negative deltas, and neutralizes free-text formulas', () => {
  const session = fresh('custom');
  session.name = '=HYPERLINK("example")';
  session.note = '+formula';
  session.measurements[0].measured = 9.5;
  session.measurements[0].reference = 10;
  const csv = sessionToCsv(validateMeasurementSession(session, template));
  assert.equal(csv.trim().split('\r\n').length, 21);
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes("'+formula"));
  assert.ok(csv.includes(',10,9.5,-0.5,'));
  assert.ok(csv.includes('BF-20'));
});
