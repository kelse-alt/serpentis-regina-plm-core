import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GROUP_CODES, validateDictionary, createFitting, validateFitting, evaluateReading, progressFitting, fittingSummary } from '../src/dwilla-fitting.mjs';
import { saveFitting, loadFitting } from '../src/dwilla-store.mjs';
// Synthetic only: no proprietary descriptions, methods or measurements.
export const dictionary = () => ({ schemaVersion: 1, styleId: 'SR-001', dictionaryVersion: 'synthetic-v1', sourceSha256: 'a'.repeat(64),
  definitions: Object.entries(GROUP_CODES).flatMap(([group, codes]) => codes.map(pomCode => ({ group, pomCode, description: `Synthetic ${pomCode}`, howToMeasure: 'Synthetic test method' }))),
  fitFormReference: { measurements: Array.from({ length: 20 }, (_, i) => ({ pomCode: `BF-${String(i + 1).padStart(2, '0')}` })) } });
const draft = d => createFitting(d, { sampleId: 'SYNTHETIC', sampleRevision: 'proto-1', unit: 'IN', date: '2026-11-06' });
test('60 unique garment definitions in four groups remain separate from 20 fit-form POMs', () => {
  const d = dictionary(); assert.equal(validateDictionary(d), d);
  assert.deepEqual(Object.values(GROUP_CODES).map(v => v.length), [32, 11, 11, 6]);
  for (const change of [v => v.definitions.pop(), v => v.definitions[1].pomCode = 'M01', v => v.definitions[0].group = 'skirt', v => v.fitFormReference.measurements.pop(), v => v.definitions[0].howToMeasure = '']) {
    const bad = dictionary(); change(bad); assert.throws(() => validateDictionary(bad));
  }
});
test('new fitting requires explicit units and starts empty without inferred targets or approvals', () => {
  const d = dictionary(); const f = draft(d); assert.equal(f.readings.length, 0); assert.equal(f.specs.length, 0); assert.equal(f.decision, null);
  assert.throws(() => createFitting(d, { sampleId: 's', sampleRevision: '1', date: '2026-11-06' }));
  for (const date of ['2026-02-30', '', 'today']) assert.throws(() => validateFitting({ ...f, date }, d));
});
test('multiple front/back and left/right readings retain landmarks and conditions without averaging', () => {
  const d = dictionary(), f = draft(d);
  f.landmarks = [{ id: 'waist', description: 'Synthetic marked level' }];
  f.readings = ['front', 'back', 'left', 'right'].map((context, i) => ({ id: `r${i}`, pomCode: 'C11', context, value: i, unit: 'IN', condition: 'unwashed', observer: 'Synthetic', landmarkIds: ['waist'] }));
  assert.equal(validateFitting(f, d).readings.length, 4); assert.equal(fittingSummary(f, d).measuredDefinitions, 1);
  for (const change of [v => v.readings[0].pomCode = 'BF-01', v => v.readings[0].value = -1, v => v.readings[0].value = Infinity, v => v.readings[0].unit = 'CM', v => v.readings[0].landmarkIds = ['missing'], v => v.readings[1].id = 'r0']) {
    const bad = structuredClone(f); change(bad); assert.throws(() => validateFitting(bad, d));
  }
});
test('nullable target and asymmetric tolerances distinguish missing information from pass/fail', () => {
  assert.equal(evaluateReading({ value: 0 }, null).status, 'missing-target');
  assert.deepEqual(evaluateReading({ value: 0 }, { target: 0, tolerance: null }), { status: 'missing-tolerance', delta: 0 });
  const s = { target: 10, tolerance: { minus: 0.1, plus: 0.2 } };
  assert.equal(evaluateReading({ value: 9.9 }, s).status, 'within-tolerance');
  assert.equal(evaluateReading({ value: 10.2 }, s).status, 'within-tolerance');
  assert.equal(evaluateReading({ value: 10.21 }, s).status, 'out-of-tolerance');
  assert.throws(() => evaluateReading({ value: 10 }, { target: 10, tolerance: { minus: -1, plus: 0 } }));
});
test('tolerances require explicit authority and duplicate context specs are rejected', () => {
  const d = dictionary(), f = draft(d);
  f.specs = [{ pomCode: 'M01', context: 'front', target: 10, tolerance: { minus: 0.1, plus: 0.2 }, authority: 'Synthetic house decision' }];
  assert.equal(validateFitting(f, d).specs.length, 1);
  f.specs.push(structuredClone(f.specs[0])); assert.throws(() => validateFitting(f, d));
  f.specs.pop(); f.specs[0].authority = ''; assert.throws(() => validateFitting(f, d));
});
test('first to second fitting to review requires explicit decisions and new sample revisions', () => {
  const d = dictionary(), f = draft(d);
  assert.throws(() => progressFitting(f, d, { sampleRevision: 'proto-2', date: f.date, predecessor: 'b'.repeat(64) }));
  f.notes = [{ pomCode: 'M01', text: 'Synthetic fit action', author: 'Synthetic', status: 'open' }];
  f.decision = { action: 'advance', author: 'Synthetic', reason: 'Request revised sample' };
  const second = progressFitting(f, d, { sampleRevision: 'proto-2', date: f.date, predecessor: 'b'.repeat(64) });
  assert.equal(second.stage, 'second-fitting'); assert.equal(second.decision, null); assert.equal(second.notes.length, 1); assert.equal(f.stage, 'first-fitting');
  second.decision = f.decision;
  assert.throws(() => progressFitting(second, d, { sampleRevision: 'proto-2', date: f.date, predecessor: 'b'.repeat(64) }));
  const review = progressFitting(second, d, { sampleRevision: 'proto-3', date: f.date, predecessor: 'b'.repeat(64) });
  assert.equal(review.stage, 'review'); assert.throws(() => progressFitting(review, d, {}));
});
test('immutable private snapshots reopen, reject corruption and never overwrite predecessor', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dwilla-store-'));
  try {
    const d = dictionary(), f = draft(d), sha = saveFitting(dir, f, d);
    assert.equal(saveFitting(dir, f, d), sha); assert.deepEqual(loadFitting(dir, sha, d), f);
    f.notes.push({ pomCode: null, text: 'Synthetic revision', author: 'Synthetic', status: 'open' });
    assert.notEqual(saveFitting(dir, f, d), sha); assert.equal(loadFitting(dir, sha, d).notes.length, 0);
    assert.throws(() => loadFitting(dir, '../secret', d));
    const changed = JSON.parse(readFileSync(join(dir, `${sha}.json`))); changed.unit = 'CM';
    writeFileSync(join(dir, `${sha}.json`), JSON.stringify(changed));
    assert.throws(() => loadFitting(dir, sha, d), /fingerprint/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
