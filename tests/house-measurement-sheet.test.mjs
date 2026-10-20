import test from 'node:test';
import assert from 'node:assert/strict';
import { loadHouseData, compareRecord, buildMeasurementRows, summarizeRows, buildHtml, formatDifference } from '../src/house-measurement-sheet.mjs';

const { form, sourceMethods } = await loadHouseData();
const rows = buildMeasurementRows(form, sourceMethods);

const byCode = code => rows.find(row => row.pomCode === code);

test('all 20 approved mannequin standards and original how-to-measure instructions are displayed', () => {
  assert.equal(form.approval.status, 'APPROVED');
  assert.equal(rows.length, 20);
  assert.equal(new Set(rows.map(row => row.pomCode)).size, 20);
  for (const row of rows) assert.ok(row.howToMeasure && row.sourceLabel);
});

test('positive waist and bust differences use house minus manufacturer', () => {
  assert.equal(byCode('BF-01').difference, 0.25);
  assert.equal(byCode('BF-02').difference, 0.75);
  assert.equal(formatDifference(byCode('BF-02').difference), '+0.75');
});

test('negative and zero differences are preserved', () => {
  assert.equal(byCode('BF-09').difference, -0.25);
  assert.equal(byCode('BF-03').difference, 0);
  assert.equal(byCode('BF-13').difference, 1.5);
});

test('missing manufacturer references remain null, never zero', () => {
  assert.equal(byCode('BF-04').houseStandard, 32.875);
  assert.equal(byCode('BF-04').manufacturerReference, null);
  assert.equal(byCode('BF-04').difference, null);
  assert.equal(formatDifference(null), '—');
  assert.deepEqual(summarizeRows(rows), { total: 20, compared: 7, missingReferences: 13, different: 4 });
});

test('calculations do not modify the original record', () => {
  const original = { pomCode: 'BF-99', houseStandard: 4.5, manufacturerReference: 5 };
  const result = compareRecord(original);
  assert.equal(result.difference, -0.5);
  assert.deepEqual(original, { pomCode: 'BF-99', houseStandard: 4.5, manufacturerReference: 5 });
});

test('invalid numbers and mismatched fit-form identifiers are rejected', () => {
  assert.throws(() => compareRecord({ pomCode: 'BF-01', houseStandard: 3, manufacturerReference: undefined }), /Invalid manufacturer/);
  assert.throws(() => buildMeasurementRows({ ...form, formId: 'OTHER' }, sourceMethods), /identity/);
});

test('the offline HTML report includes confidential standards, measurement methods, and source caveat', () => {
  const html = buildHtml(form, rows);
  assert.match(html, /<table aria-label="House mannequin measurement register">/);
  assert.match(html, /BF-20/);
  assert.match(html, /32\.875/);
  assert.match(html, /Measure from shoulder point down arm to wrist reference/);
  assert.match(html, /earlier pending-verification status/);
  assert.match(html, /PRIVATE HOUSE DATA/);
  assert.doesNotMatch(html, /https:\/\/cdn\./);
});
