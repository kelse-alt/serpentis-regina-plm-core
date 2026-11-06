import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { evaluateReading } from '../src/dwilla-fitting.mjs';
import { createDwilla, normalizeDwilla, createSyntheticDwillaDictionary, startDwillaFitting, saveDwillaSnapshot, advanceDwillaFitting, reopenDwillaSnapshot, dwillaSummary, validateDwillaPhotoImage, verifyDwillaHistory, DWILLA_LIMITS } from '../src/dwilla-workroom.mjs';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/b9sAAAAASUVORK5CYII=';
const blank = () => createDwilla(createSyntheticDwillaDictionary());
const first = () => startDwillaFitting(blank(), { sampleKey: 'sample-a', sampleId: 'SYNTHETIC-001', sampleRevision: 'proto-1', patternRevision: 'pattern-1', unit: 'IN', date: '2026-11-06' });
const reading = (id = 'reading-a', value = 10, context = 'front-left') => ({ id, pomCode: 'M01', context, value, unit: 'IN', condition: 'unwashed', observer: 'Synthetic observer', landmarkIds: [] });
const action = () => ({ id: 'action-a', pomCode: 'M01', text: 'SYNTHETIC correction request', author: 'Synthetic designer', status: 'open', nextPatternRevision: 'pattern-2', resolution: null });
const photo = () => ({ id: 'photo-a', name: 'synthetic.png', type: 'image/png', dataUrl: png, pomCode: 'M01', actionId: 'action-a', note: 'Synthetic issue photo', markers: [{ number: 1, x: 0.25, y: 0.75, note: 'Synthetic marker' }] });

test('preserves exact private dictionary labels and keeps 20 body references separate from 60 garment POMs', () => {
  const dictionary = createSyntheticDwillaDictionary();
  dictionary.definitions[0].description = '  literal  SOURCE TEXT\t';
  dictionary.definitions[0].howToMeasure = 'Original landmark wording in inches does not set a unit.';
  dictionary.sourceSheets = { SYNTHETIC: { A1: { raw: 'None', type: 's', formula: null } } };
  const state = createDwilla(dictionary);
  assert.deepEqual(state.dictionary, dictionary);
  assert.notEqual(state.dictionary, dictionary);
  assert.equal(state.dictionary.definitions.length, 60);
  assert.equal(state.dictionary.fitFormReference.measurements.length, 20);
  assert.throws(() => startDwillaFitting(state, { sampleId: 'S', sampleRevision: 'r1', patternRevision: 'p1', unit: null, date: '2026-11-06' }), /IN or CM/);
  assert.equal(state.samples.length, 0);
});

test('missing measurements never become zero or automatic passes; zero and repeated contextual readings persist', () => {
  const state = first();
  assert.equal(dwillaSummary(state).missingDefinitions, 60);
  state.draft.fitting.readings.push(reading('reading-a', 0), reading('reading-b', 0.1), reading('reading-c', 12, 'back-right'));
  const summary = dwillaSummary(state);
  assert.equal(summary.measuredDefinitions, 1);
  assert.equal(summary.missingDefinitions, 59);
  assert.equal(summary.readings.length, 3);
  assert.ok(summary.readings.every(item => item.status === 'missing-target' && item.delta === null));
  assert.equal(normalizeDwilla(state).draft.fitting.readings[0].value, 0);
  state.draft.fitting.readings[0].value = null;
  assert.throws(() => normalizeDwilla(state), /finite, non-negative/);
});

test('uses contextual target matches and inclusive asymmetric tolerances from the PR22 evaluator', () => {
  const state = first();
  state.draft.fitting.readings.push(reading('reading-a', 10.2), reading('reading-b', 10.2, 'back'));
  state.draft.fitting.specs.push({ pomCode: 'M01', context: 'front-left', target: 10, tolerance: { minus: 0.1, plus: 0.2 }, authority: 'Synthetic test only' });
  assert.equal(dwillaSummary(state).readings[0].status, 'within-tolerance');
  assert.equal(dwillaSummary(state).readings[1].status, 'missing-target');
  assert.equal(evaluateReading(reading('r', 9.9), state.draft.fitting.specs[0]).status, 'within-tolerance');
  assert.equal(evaluateReading(reading('r', 10.201), state.draft.fitting.specs[0]).status, 'out-of-tolerance');
  state.draft.fitting.specs[0].tolerance = null;
  assert.equal(dwillaSummary(state).readings[0].status, 'missing-tolerance');
  state.draft.fitting.specs[0].target = null;
  assert.equal(dwillaSummary(state).readings[0].status, 'missing-target');
});

test('saved snapshots preserve revisions, trace and exact original image bytes when working draft changes', async () => {
  const state = first();
  state.draft.fitting.readings.push(reading());
  state.draft.actions.push(action());
  state.draft.photos.push(photo());
  const saved = await saveDwillaSnapshot(state);
  assert.equal(state.snapshots.length, 0);
  const snapshot = saved.snapshots[0];
  assert.equal(snapshot.fingerprint, createHash('sha256').update(JSON.stringify(snapshot.session.fitting)).digest('hex'));
  saved.draft.fitting.readings[0].value = 11;
  saved.draft.photos[0].markers[0].note = 'changed draft';
  assert.equal(snapshot.session.fitting.readings[0].value, 10);
  assert.equal(snapshot.session.photos[0].markers[0].note, 'Synthetic marker');
  assert.equal(snapshot.session.photos[0].dataUrl, png);
  const reopened = reopenDwillaSnapshot(saved, snapshot.id);
  assert.equal(reopened.draft.fitting.readings[0].value, 10);
  assert.equal(reopened.draft.patternRevision, 'pattern-1');
  assert.equal(reopened.samples[0].revision, 'proto-1');
  assert.equal(reopened.snapshots.length, 1);
});

test('requires named/rationalized progression; carries open actions and preserves first fitting without production approval', async () => {
  const state = first();
  state.draft.actions.push(action());
  state.draft.fitting.notes.push({ pomCode: 'M01', text: 'Synthetic unresolved fit note', author: 'Synthetic observer', status: 'open' });
  state.draft.fitting.readings.push(reading());
  state.draft.photos.push(photo());
  state.draft.configurations[0].name = 'Synthetic wearing A';
  state.draft.configurations[0].mobility = 'Synthetic observed limitation';
  const next = { sampleKey: 'sample-b', sampleId: 'SYNTHETIC-001', sampleRevision: 'proto-2', patternRevision: 'pattern-2', date: '2026-11-07' };
  await assert.rejects(advanceDwillaFitting(state, next), /explicit advance decision/);
  state.draft.fitting.decision = { action: 'advance', author: 'Synthetic designer', reason: 'Request another prototype to inspect unresolved correction.' };
  await assert.rejects(advanceDwillaFitting(state, { ...next, patternRevision: 'pattern-1' }), /next pattern revision/);
  await assert.rejects(advanceDwillaFitting(state, { ...next, sampleRevision: 'proto-1' }), /new sample revision/);
  const advanced = await advanceDwillaFitting(state, next);
  assert.equal(advanced.draft.fitting.stage, 'second-fitting');
  assert.equal(advanced.draft.fitting.decision, null);
  assert.deepEqual(advanced.draft.fitting.readings, []);
  assert.equal(advanced.draft.actions[0].status, 'open');
  assert.equal(advanced.draft.fitting.notes[0].status, 'open');
  assert.equal(advanced.draft.configurations[0].name, 'Synthetic wearing A');
  assert.equal(advanced.draft.configurations[0].mobility, '');
  assert.equal(advanced.draft.photos.length, 0);
  assert.equal(advanced.snapshots[0].session.photos[0].dataUrl, png);
  assert.equal(advanced.snapshots[0].session.patternRevision, 'pattern-1');
  assert.equal(advanced.draft.patternRevision, 'pattern-2');
  assert.equal(advanced.draft.fitting.predecessor, advanced.snapshots[0].fingerprint);
  assert.equal(advanced.samples.length, 2);
  assert.ok(!JSON.stringify(advanced).includes('production-approved'));
});

test('restores a complete portable JSON state with dictionary, samples, history and attachments into empty data', async () => {
  let state = first();
  state.draft.actions.push(action()); state.draft.photos.push(photo());
  state = await saveDwillaSnapshot(state);
  const emptyState = blank();
  assert.equal(emptyState.snapshots.length, 0);
  const restored = normalizeDwilla(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored, state);
  assert.equal(restored.draft.photos[0].markers[0].x, 0.25);
  assert.equal(restored.snapshots[0].session.photos[0].dataUrl, png);
});

test('backup readback verifies fitting fingerprints and rejects an altered saved measurement record', async () => {
  const state = first(); state.draft.fitting.readings.push(reading());
  const saved = await saveDwillaSnapshot(state);
  assert.deepEqual(await verifyDwillaHistory(saved), saved);
  saved.snapshots[0].session.fitting.readings[0].value = 11;
  await assert.rejects(verifyDwillaHistory(saved), /fingerprint does not match/);
});

test('qualitative observations require distinct named wearing configurations and do not add POMs', () => {
  const state = first();
  state.draft.configurations[0].mobility = 'Synthetic mobility observation';
  assert.throws(() => normalizeDwilla(state), /Name the wearing configuration/);
  state.draft.configurations[0].name = 'Wearing one';
  state.draft.configurations[1].name = 'wearing ONE';
  assert.throws(() => normalizeDwilla(state), /names must be unique/);
  state.draft.configurations[1].name = 'Wearing two';
  const normalized = normalizeDwilla(state);
  assert.equal(normalized.dictionary.definitions.length, 60);
  assert.equal(normalized.draft.fitting.readings.length, 0);
});

test('rejects dangling sample/pattern, action/POM links, altered predecessor and unresolved resolution claims', () => {
  for (const mutate of [
    state => { state.draft.sampleKey = 'missing'; },
    state => { state.draft.patternRevision = 'wrong-pattern'; },
    state => { state.draft.actions[0].pomCode = 'BF-01'; },
    state => { state.draft.photos[0].actionId = 'missing'; },
    state => { state.draft.fitting.predecessor = 'a'.repeat(64); },
    state => { state.draft.actions[0].status = 'resolved'; },
    state => { state.draft.actions[0].resolution = { author: 'A', reason: 'B' }; },
    state => { state.draft.photos[0].markers[0].x = 1.1; },
    state => { state.draft.fitting.readings = [reading(), reading()]; },
  ]) {
    const state = first(); state.draft.actions.push(action()); state.draft.photos.push(photo());
    mutate(state);
    assert.throws(() => normalizeDwilla(state));
  }
});

test('rejects malformed records, remote/SVG/falsely labelled images and size/complexity abuse', () => {
  const state = first();
  assert.throws(() => normalizeDwilla({ ...state, secret: 'unknown-field' }), /unknown/);
  for (const invalid of [
    { ...photo(), type: 'image/svg+xml', dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' },
    { ...photo(), dataUrl: 'https://example.com/private.png' },
    { ...photo(), dataUrl: 'data:image/png;base64,YWJjZA==' },
    { ...photo(), dataUrl: 'data:image/png;base64,' + 'A'.repeat(Math.ceil(DWILLA_LIMITS.photoBytes / 3) * 4 + 4) },
  ]) assert.throws(() => validateDwillaPhotoImage(invalid));
  state.draft.actions = Array.from({ length: 501 }, (_, i) => ({ ...action(), id: `action-${i}` }));
  assert.throws(() => normalizeDwilla(state), /at most 500/);
  const malicious = blank();
  malicious.dictionary.sourceSheets = JSON.parse('{"__proto__":{"polluted":true}}');
  assert.throws(() => normalizeDwilla(malicious), /safe keys/);
  assert.equal({}.polluted, undefined);
});

test('undoing working edits cannot erase preserved fitting snapshots or their sample trace',async()=>{
 const { retainDwillaHistory }=await import('../src/dwilla-workroom.mjs');
 const dictionary=createSyntheticDwillaDictionary();
 const previous=startDwillaFitting(createDwilla(dictionary),{sampleKey:'undo-sample',sampleId:'SYNTHETIC-UNDO',sampleRevision:'proto-1',patternRevision:'SYNTHETIC-A',unit:'IN',date:'2026-11-06'});
 const saved=await saveDwillaSnapshot(previous);
 const undone=retainDwillaHistory(saved,previous);
 assert.deepEqual(undone.snapshots,saved.snapshots);
 assert.deepEqual(undone.samples,saved.samples);
 assert.deepEqual(retainDwillaHistory(saved,null),saved);
});
