import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevelopment, normalizeDevelopment, previewComponentWorkbook, applyComponentWorkbook, compareObservation } from '../src/garment-development.mjs';

const cell = (value, formula = null, type = typeof value === 'string' ? 'inlineStr' : 'n') => ({ value, formula, type });
const sheet = (name, cells) => ({ name, cells, merges: [] });
const workbook = () => ({ fileName: 'synthetic-component-example.xlsx', sha256: 'a'.repeat(64), sheets: [
  sheet('BODICE-SPEC', { A11: cell('B1'), B11: cell('  Across chest\n(front)  '), D11: cell('Lay flat; measure edge to edge.'), E11: cell(32), F11: cell('±'), G11: cell(-1),
    A12: cell('B2'), B12: cell('Body length'), D12: cell('Shoulder to hem'), E12: cell(45), H12: cell(0, 'E12-G12'),
    A20: cell('TOTAL'), A30: cell('B1', 'A11'), A40: cell('BF-01') }),
  sheet('SLEEVE-SPEC', { A15: cell('S1'), B15: cell('Sleeve length'), D15: cell('Measure along sleeve seam') }),
  sheet('BODY REF-MANNEQUIN', { A11: cell('BF01'), B11: cell('Reference only'), E11: cell(95) }),
  sheet('MASTER', { A11: cell('M1'), E11: cell(22), F11: cell(2, 'E11-20') }),
] });

function imported() {
  const blank = createDevelopment();
  return applyComponentWorkbook(blank, previewComponentWorkbook(workbook(), blank));
}

function addSample(development, id = 'sample-one') {
  development.samples.push({ id, label: 'Synthetic sample', round: 'Round 1', notes: '' });
  for (const component of development.components) for (const row of component.rows) row.observations[id] = { general: null, front: null, back: null, left: null, right: null };
}

test('component import preserves exact authored definitions and raw formulas without inventing specifications', () => {
  const source = workbook(), before = structuredClone(source), blank = createDevelopment();
  assert.deepEqual(normalizeDevelopment(blank), blank);
  const preview = previewComponentWorkbook(source);
  assert.deepEqual(preview.summary, { components: 2, rows: 3, added: 3, changed: 0, retired: 0 });
  assert.ok(preview.warnings.some(warning => warning.includes('± and Adj')));
  assert.ok(preview.warnings.some(warning => warning.includes('formula-backed POM')));
  const result = applyComponentWorkbook(blank, JSON.parse(JSON.stringify(preview)));
  assert.equal(result.components[0].rows[0].description, '  Across chest\n(front)  ');
  assert.equal(result.components[0].rows[0].method, source.sheets[0].cells.D11.value);
  for (const component of result.components) for (const row of component.rows) {
    for (const field of ['targetCm', 'toleranceMinusCm', 'tolerancePlusCm', 'proposedDeltaCm']) assert.equal(row[field], null);
    assert.deepEqual(row.observations, {});
  }
  assert.equal(result.source.sheets[0].cells.H12.formula, 'E12-G12');
  assert.deepEqual(result.source, source);
  assert.deepEqual(source, before);
  assert.deepEqual(blank, createDevelopment());
  result.source.sheets[0].cells.A11.value = 'independent';
  assert.equal(source.sheets[0].cells.A11.value, 'B1');
});

test('reimport uses sheet/code identity, preserves local values and all sample sides, and retires removed POMs', () => {
  const development = imported();
  addSample(development);
  addSample(development, 'sample-two');
  const row = development.components[0].rows[0], originalId = row.id;
  Object.assign(row, { targetCm: 40, toleranceMinusCm: 0.5, tolerancePlusCm: 0.75, proposedDeltaCm: -1, notes: 'Keep local fit note' });
  row.observations['sample-one'] = { general: 39.5, front: 20, back: 19.5, left: 0, right: null };
  row.observations['sample-two'].general = 41;
  const before = structuredClone(development), changed = workbook();
  changed.sha256 = 'b'.repeat(64);
  const cells = changed.sheets[0].cells;
  delete cells.A11; delete cells.B11; delete cells.D11;
  cells.A19 = cell('B1'); cells.B19 = cell('Revised description'); cells.D19 = cell('Revised measuring method');
  delete cells.A12;
  changed.sheets = changed.sheets.filter(sourceSheet => sourceSheet.name !== 'SLEEVE-SPEC');
  const preview = previewComponentWorkbook(changed, development, { unit: 'cm' });
  assert.equal(preview.summary.changed, 1);
  assert.equal(preview.summary.retired, 2);
  assert.ok(preview.changes.some(change => change.type === 'method-changed' && change.rowId === originalId));
  const result = applyComponentWorkbook(development, preview, { unit: 'cm' });
  const updated = result.components[0].rows.find(candidate => candidate.id === originalId);
  assert.equal(updated.sourceRow, 19);
  assert.equal(updated.method, 'Revised measuring method');
  assert.equal(updated.description, 'Revised description');
  assert.deepEqual(updated.definitionHistory, [{ description: row.description, method: row.method, sourceRow: 11, sourceSha256: 'a'.repeat(64) }]);
  for (const field of ['targetCm', 'toleranceMinusCm', 'tolerancePlusCm', 'proposedDeltaCm', 'notes', 'observations']) assert.deepEqual(updated[field], row[field]);
  assert.equal(result.components[0].rows.find(candidate => candidate.code === 'B2').retired, true);
  assert.equal(result.components.find(component => component.name === 'SLEEVE-SPEC').rows[0].retired, true);
  assert.equal(result.components.find(component => component.name === 'SLEEVE-SPEC').rows[0].sourceSha256, 'a'.repeat(64));
  assert.deepEqual(development, before);
  const restoredWorkbook = workbook();
  restoredWorkbook.sha256 = 'c'.repeat(64);
  restoredWorkbook.sheets[1].cells.D15 = cell('Revised sleeve method after retirement');
  const restored = applyComponentWorkbook(result, previewComponentWorkbook(restoredWorkbook, result, { unit: 'in' }), { unit: 'in' });
  assert.ok(restored.components.every(component => component.rows.every(candidate => !candidate.retired)));
  assert.equal(restored.components[0].rows[0].targetCm, 40);
  assert.equal(restored.components[0].rows[0].definitionHistory.length, 2);
  assert.equal(restored.components[0].rows[0].definitionHistory[1].method, 'Revised measuring method');
  assert.equal(restored.components[0].rows[0].definitionHistory[1].sourceSha256, 'b'.repeat(64));
  assert.equal(restored.components[1].rows[0].definitionHistory[0].sourceSha256, 'a'.repeat(64));
});

test('preview is atomic and rejects stale working values, source edits, duplicate codes and missing components', () => {
  const development = imported();
  const preview = previewComponentWorkbook(workbook(), development);
  development.components[0].rows[0].notes = 'Changed while preview was open';
  assert.throws(() => applyComponentWorkbook(development, preview), /stale/);
  const fresh = previewComponentWorkbook(workbook(), development);
  fresh.components[0].rows[0].method = 'Unreviewed mutation';
  assert.throws(() => applyComponentWorkbook(development, fresh), /preview changed/);
  const duplicate = workbook(); duplicate.sheets[0].cells.A99 = cell('B1');
  assert.throws(() => previewComponentWorkbook(duplicate), /duplicate authored POM/);
  const unrelated = workbook(); unrelated.sheets = unrelated.sheets.filter(sourceSheet => !sourceSheet.name.endsWith('-SPEC'));
  assert.throws(() => previewComponentWorkbook(unrelated), /No authored component POMs/);
});

test('sample/round and general/front/back/left/right values stay independent with actual-minus-target deltas', () => {
  const development = imported(); addSample(development); addSample(development, 'sample-two');
  const row = development.components[0].rows[0];
  Object.assign(row, { targetCm: 40, proposedDeltaCm: -0.5 });
  row.observations['sample-one'] = { general: 40.5, front: 20, back: 20.5, left: 0, right: null };
  row.observations['sample-two'].general = 39;
  assert.deepEqual(compareObservation(row, 'sample-one', 'general'), { actualCm: 40.5, targetCm: 40, deltaCm: 0.5, toleranceStatus: 'not-set', lowerCm: null, upperCm: null, proposedTargetCm: 39.5 });
  row.toleranceMinusCm = 0;
  assert.equal(compareObservation(row, 'sample-one', 'general').toleranceStatus, 'not-set');
  row.tolerancePlusCm = 0.5;
  assert.equal(compareObservation(row, 'sample-one', 'general').toleranceStatus, 'within');
  assert.equal(compareObservation(row, 'sample-two', 'general').toleranceStatus, 'outside');
  assert.equal(compareObservation(row, 'sample-one', 'left').deltaCm, -40);
  assert.equal(compareObservation(row, 'sample-one', 'right').deltaCm, null);
  assert.equal(compareObservation(row, 'sample-one', 'front').actualCm, 20);
  assert.equal(compareObservation(row, 'sample-one', 'back').actualCm, 20.5);
  assert.equal(compareObservation(row, 'unknown').toleranceStatus, 'missing');
  assert.throws(() => compareObservation(row, 'sample-one', 'both'));
  const before = structuredClone(row);
  for (let index = 0; index < 20; index++) {
    const inView = normalizeDevelopment(development, 'in');
    assert.equal(inView.components[0].rows[0].targetCm, 40);
    assert.equal(normalizeDevelopment(inView, 'cm').components[0].rows[0].observations['sample-one'].left, 0);
  }
  assert.deepEqual(row, before);
  assert.throws(() => normalizeDevelopment(development), /Choose CM or IN/);
});

test('strict bounded JSON rejects unsupported keys, units, malformed source, sample identities and numeric data', () => {
  for (const edit of [
    value => { value.extra = true; }, value => { value.schemaVersion = 2; },
    value => { value.components[0].rows[0].targetCm = -1; },
    value => { value.components[0].rows[0].proposedDeltaCm = Infinity; },
    value => { value.components[0].rows[0].tolerancePlusCm = '0.5'; },
    value => { value.components[0].rows[0].id = 'row-position-11'; },
    value => { value.components[0].rows[0].sourceRow = 0; },
    value => { value.components[0].rows[0].retired = 'false'; },
    value => { value.components[0].rows[0].sourceSha256 = ''; },
    value => { value.components[0].rows[0].definitionHistory = [{ description: '', method: '', sourceRow: 11, sourceSha256: 'invalid' }]; },
    value => { value.components[0].rows[0].definitionHistory = [{ description: '', method: '', sourceRow: 11, sourceSha256: 'a'.repeat(64), extra: true }]; },
    value => { Object.assign(value.components[0].rows[0], { targetCm: 1, proposedDeltaCm: -2 }); },
    value => { value.components[0].rows[0].observations.unknown = { general: 1, front: null, back: null, left: null, right: null }; },
    value => { value.components[0].rows[0].observations['sample-one'].general = NaN; },
    value => { delete value.components[0].rows[0].observations['sample-one'].left; },
    value => { value.samples.push({ ...value.samples[0] }); },
    value => { value.samples[0].round = 1; },
    value => { value.source.sha256 = 'invalid'; },
    value => { value.source.sheets[0].cells.A0 = cell('bad'); },
    value => { value.source.sheets[0].cells.A1 = { value: 'extra', formula: null, type: 'str', extra: 1 }; },
    value => { value.source.sheets[0].merges.push('A1:<script>'); },
    value => { value.source.sheets[0].cells.A1 = cell({ nested: true }); },
    value => { value.source.sheets.push(structuredClone(value.source.sheets[0])); },
    value => { Object.assign(value, JSON.parse('{"__proto__":{"polluted":true}}')); },
  ]) {
    const development = imported(); addSample(development); edit(development);
    assert.throws(() => normalizeDevelopment(development, 'cm'));
  }
  assert.throws(() => normalizeDevelopment(imported(), 'CM'));
  const development = imported(); addSample(development);
  const normalized = normalizeDevelopment(JSON.parse(JSON.stringify(development)), 'cm');
  assert.deepEqual(normalized, development);
  normalized.samples[0].label = 'Independent clone';
  assert.equal(development.samples[0].label, 'Synthetic sample');
});

test('fractional-inch tolerance endpoints use full precision while displayed deltas remain rounded', () => {
  const development = imported(); addSample(development);
  const row = development.components[0].rows[0], toleranceCm = 2.54 / 3;
  Object.assign(row, { targetCm: 10, toleranceMinusCm: toleranceCm, tolerancePlusCm: toleranceCm });
  for (const actual of [10 - toleranceCm, 10 + toleranceCm]) {
    row.observations['sample-one'].general = actual;
    assert.equal(compareObservation(row, 'sample-one').toleranceStatus, 'within');
  }
  for (const actual of [10 - toleranceCm - 0.000001, 10 + toleranceCm + 0.000001]) {
    row.observations['sample-one'].general = actual;
    assert.equal(compareObservation(row, 'sample-one').toleranceStatus, 'outside');
  }
  row.targetCm = 0; row.proposedDeltaCm = -0.1;
  assert.throws(() => compareObservation(row, 'sample-one'), /cannot be negative/);
});

test('definition history is bounded and a failed reimport leaves the original draft intact', () => {
  const development = imported(), row = development.components[0].rows[0];
  row.definitionHistory = Array.from({ length: 100 }, () => ({ description: 'Previous definition', method: 'Previous method', sourceRow: 11, sourceSha256: 'd'.repeat(64) }));
  const before = structuredClone(development), revised = workbook();
  revised.sheets[0].cells.D11 = cell('Changed method requires another history entry');
  const preview = previewComponentWorkbook(revised, development);
  assert.throws(() => applyComponentWorkbook(development, preview), /at most 100/);
  assert.deepEqual(development, before);
});
