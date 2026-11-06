/** Browser-safe DWILLA fitting state. Original dictionaries and photographs stay device-local. */
import { GROUP_CODES, validateDictionary, createFitting, validateFitting, progressFitting, fittingSummary } from './dwilla-fitting.mjs';

export const DWILLA_LIMITS = { backupBytes: 100 * 1024 * 1024, dictionaryBytes: 12 * 1024 * 1024, photoBytes: 5 * 1024 * 1024, photosPerSession: 12, snapshots: 100, samples: 64 };
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const SESSION_KEYS = ['id', 'sampleKey', 'patternRevision', 'fitting', 'configurations', 'actions', 'photos'];
const FITTING_KEYS = ['schemaVersion', 'styleId', 'dictionaryVersion', 'sourceSha256', 'sampleId', 'sampleRevision', 'unit', 'date', 'stage', 'predecessor', 'readings', 'specs', 'landmarks', 'notes', 'decision'];
const uuid = prefix => `${prefix}-${globalThis.crypto.randomUUID()}`;
const clone = value => structuredClone(value);
function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Object.keys(value).some(key => BAD_KEYS.has(key))) throw Error(`${label} must be a plain record with safe keys.`);
}
function exact(value, keys, label) {
  object(value, label);
  if (Object.keys(value).length !== keys.length || Object.keys(value).some(key => !keys.includes(key))) throw Error(`${label} contains unknown or missing fields.`);
}
function text(value, label, maximum = 4000, required = false) {
  if (typeof value !== 'string' || value.length > maximum || value.includes('\0') || (required && !value.trim())) throw Error(`${label} must be ${required ? 'nonempty ' : ''}text of at most ${maximum} characters.`);
  return value;
}
function id(value, label) {
  text(value, label, 128, true);
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw Error(`${label} contains unsupported characters.`);
  return value;
}
function list(value, label, maximum) {
  if (!Array.isArray(value) || value.length > maximum) throw Error(`${label} must be a list of at most ${maximum} records.`);
  return value;
}
function unique(values, label) {
  if (new Set(values).size !== values.length) throw Error(`${label} must be unique.`);
}
function safeJson(value, label, maximum) {
  let nodes = 0;
  const visit = (item, depth) => {
    if (++nodes > 300000 || depth > 30) throw Error(`${label} is too complex.`);
    if (item === null || typeof item === 'boolean') return;
    if (typeof item === 'string') { text(item, label, 100000); return; }
    if (typeof item === 'number') { if (!Number.isFinite(item)) throw Error(`${label} contains an invalid number.`); return; }
    if (Array.isArray(item)) { if (item.length > 100000) throw Error(`${label} has too many records.`); item.forEach(x => visit(x, depth + 1)); return; }
    object(item, label);
    Object.values(item).forEach(x => visit(x, depth + 1));
  };
  visit(value, 0);
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > maximum) throw Error(`${label} exceeds its size limit.`);
}
function hash(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw Error(`${label} must be a SHA-256 fingerprint.`);
}
function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw Error('Invalid fitting snapshot time.');
}

/** Validate an original raster without changing its bytes; SVG and remote URLs are refused. */
export function validateDwillaPhotoImage(photo) {
  text(photo.name, 'Photo name', 255, true);
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(photo.type)) throw Error('Fit photos must be PNG, JPEG or WebP.');
  const prefix = `data:${photo.type};base64,`;
  if (typeof photo.dataUrl !== 'string' || !photo.dataUrl.startsWith(prefix)) throw Error('Fit photos must contain embedded original image data.');
  const encoded = photo.dataUrl.slice(prefix.length);
  if (!encoded.length || encoded.length % 4 !== 0 || encoded.length > Math.ceil(DWILLA_LIMITS.photoBytes / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw Error('Fit photos must contain valid base64 data no larger than 5 MB.');
  const bytes = encoded.length / 4 * 3 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
  if (bytes > DWILLA_LIMITS.photoBytes) throw Error('Each fit photo must be no larger than 5 MB.');
  const header = globalThis.atob(encoded.slice(0, 24));
  const valid = photo.type === 'image/png' ? header.startsWith('\x89PNG\r\n\x1a\n')
    : photo.type === 'image/jpeg' ? header.startsWith('\xff\xd8\xff')
    : header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP';
  if (!valid) throw Error('Fit photo bytes do not match the declared image type.');
  return photo;
}

function normalizeCore(fitting, dictionary) {
  exact(fitting, FITTING_KEYS, 'Fitting');
  for (const [key, maximum] of [['readings', 4000], ['specs', 1000], ['landmarks', 200], ['notes', 500]]) list(fitting[key], key, maximum);
  for (const reading of fitting.readings) {
    exact(reading, ['id', 'pomCode', 'context', 'value', 'unit', 'condition', 'observer', 'landmarkIds'], 'Reading');
    id(reading.id, 'Reading ID'); text(reading.context, 'Reading context', 240, true); text(reading.observer, 'Observer', 160, true);
    if (typeof reading.value !== 'number' || !Number.isFinite(reading.value) || reading.value < 0 || reading.value > 1e9) throw Error('Reading must be a finite, non-negative number.');
    list(reading.landmarkIds, 'Reading landmarks', 200); unique(reading.landmarkIds, 'Reading landmarks');
  }
  for (const spec of fitting.specs) {
    exact(spec, ['pomCode', 'context', 'target', 'tolerance', 'authority'], 'Working spec');
    text(spec.context, 'Spec context', 240, true); text(spec.authority, 'Spec authority', 2000, true);
    if (spec.target !== null && (typeof spec.target !== 'number' || !Number.isFinite(spec.target) || spec.target < 0 || spec.target > 1e9)) throw Error('Target must be a non-negative number or null.');
    if (spec.tolerance !== null) {
      exact(spec.tolerance, ['minus', 'plus'], 'Tolerance');
      if (Object.values(spec.tolerance).some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e9)) throw Error('Both tolerance limits must be finite non-negative numbers.');
    }
  }
  for (const landmark of fitting.landmarks) { exact(landmark, ['id', 'description'], 'Landmark'); id(landmark.id, 'Landmark ID'); }
  for (const note of fitting.notes) { exact(note, ['pomCode', 'text', 'author', 'status'], 'Fit note'); text(note.author, 'Note author', 160, true); }
  if (fitting.decision !== null) { exact(fitting.decision, ['action', 'author', 'reason'], 'Decision'); text(fitting.decision.author, 'Decision author', 160, true); }
  return validateFitting(fitting, dictionary);
}

function normalizeSession(session, state) {
  exact(session, SESSION_KEYS, 'Fitting session');
  id(session.id, 'Fitting ID'); id(session.sampleKey, 'Sample key'); text(session.patternRevision, 'Pattern revision', 240, true);
  const sample = state.samples.find(item => item.key === session.sampleKey);
  if (!sample || sample.id !== session.fitting?.sampleId || sample.revision !== session.fitting?.sampleRevision || sample.patternRevision !== session.patternRevision) throw Error('Fitting sample and pattern trace do not match the sample record.');
  const fitting = normalizeCore(session.fitting, state.dictionary);
  const codes = new Set(state.dictionary.definitions.map(row => row.pomCode));
  const configurations = list(session.configurations, 'Wearing configurations', 2).map(configuration => {
    exact(configuration, ['id', 'name', 'mobility', 'closureAccess', 'cutoutStability', 'meshShell'], 'Wearing configuration');
    id(configuration.id, 'Configuration ID');
    for (const key of ['name', 'mobility', 'closureAccess', 'cutoutStability', 'meshShell']) text(configuration[key], `Configuration ${key}`, key === 'name' ? 240 : 4000);
    return clone(configuration);
  });
  if (configurations.length !== 2) throw Error('DWILLA requires two qualitative wearing configurations.');
  unique(configurations.map(item => item.id), 'Configuration IDs');
  for (const configuration of configurations) {
    if (['mobility', 'closureAccess', 'cutoutStability', 'meshShell'].some(key => configuration[key].trim()) && !configuration.name.trim()) throw Error('Name the wearing configuration before recording its observations.');
  }
  unique(configurations.filter(item => item.name.trim()).map(item => item.name.trim().toLowerCase()), 'Wearing configuration names');
  const actions = list(session.actions, 'Alteration actions', 500).map(action => {
    exact(action, ['id', 'pomCode', 'text', 'author', 'status', 'nextPatternRevision', 'resolution'], 'Alteration action');
    id(action.id, 'Action ID');
    if (action.pomCode !== null && !codes.has(action.pomCode)) throw Error('Unknown action POM.');
    text(action.text, 'Action text', 4000, true); text(action.author, 'Action author', 160, true); text(action.nextPatternRevision, 'Next pattern revision', 240);
    if (!['open', 'resolved'].includes(action.status)) throw Error('Invalid alteration action status.');
    if (action.status === 'open' && action.resolution !== null) throw Error('An open action cannot have a resolution.');
    if (action.status === 'resolved') {
      exact(action.resolution, ['author', 'reason'], 'Action resolution');
      text(action.resolution.author, 'Resolution author', 160, true); text(action.resolution.reason, 'Resolution reason', 4000, true);
    }
    return clone(action);
  });
  unique(actions.map(item => item.id), 'Action IDs');
  const photos = list(session.photos, 'Fit photos', DWILLA_LIMITS.photosPerSession).map(photo => {
    exact(photo, ['id', 'name', 'type', 'dataUrl', 'pomCode', 'actionId', 'note', 'markers'], 'Fit photo');
    id(photo.id, 'Photo ID'); validateDwillaPhotoImage(photo);
    if (photo.pomCode !== null && !codes.has(photo.pomCode)) throw Error('Unknown photo POM.');
    if (photo.actionId !== null && !actions.some(action => action.id === photo.actionId)) throw Error('Unknown photo alteration action.');
    text(photo.note, 'Photo note', 4000);
    const markers = list(photo.markers, 'Photo markers', 100).map(marker => {
      exact(marker, ['number', 'x', 'y', 'note'], 'Photo marker');
      if (!Number.isInteger(marker.number) || marker.number < 1 || marker.number > 100 || ![marker.x, marker.y].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1)) throw Error('Photo marker number or position is invalid.');
      text(marker.note, 'Marker note', 2000);
      return clone(marker);
    });
    unique(markers.map(item => item.number), 'Photo marker numbers');
    return { ...clone(photo), markers };
  });
  unique(photos.map(item => item.id), 'Photo IDs');
  return { id: session.id, sampleKey: session.sampleKey, patternRevision: session.patternRevision, fitting, configurations, actions, photos };
}

/** Strict import validation; dictionaries remain exact private source records. */
export function normalizeDwilla(input) {
  exact(input, ['schemaVersion', 'dictionary', 'samples', 'draft', 'snapshots'], 'DWILLA workspace');
  if (input.schemaVersion !== 1) throw Error('Unsupported DWILLA workspace version.');
  safeJson(input.dictionary, 'Private dictionary', DWILLA_LIMITS.dictionaryBytes);
  validateDictionary(input.dictionary);
  const dictionary = clone(input.dictionary);
  const samples = list(input.samples, 'Samples', DWILLA_LIMITS.samples).map(sample => {
    exact(sample, ['key', 'id', 'revision', 'patternRevision'], 'Sample');
    id(sample.key, 'Sample key'); text(sample.id, 'Sample ID', 240, true); text(sample.revision, 'Sample revision', 240, true); text(sample.patternRevision, 'Pattern revision', 240, true);
    return clone(sample);
  });
  unique(samples.map(item => item.key), 'Sample keys');
  unique(samples.map(item => JSON.stringify([item.id, item.revision])), 'Sample identity/revision pairs');
  const state = { schemaVersion: 1, dictionary, samples, draft: null, snapshots: [] };
  state.snapshots = list(input.snapshots, 'Fitting snapshots', DWILLA_LIMITS.snapshots).map(snapshot => {
    exact(snapshot, ['id', 'savedAt', 'session', 'fingerprint'], 'Fitting snapshot');
    id(snapshot.id, 'Snapshot ID'); timestamp(snapshot.savedAt); hash(snapshot.fingerprint, 'Snapshot fingerprint');
    return { id: snapshot.id, savedAt: snapshot.savedAt, session: normalizeSession(snapshot.session, state), fingerprint: snapshot.fingerprint };
  });
  unique(state.snapshots.map(item => item.id), 'Snapshot IDs');
  const seen = new Set();
  for (const snapshot of state.snapshots) {
    if (snapshot.session.fitting.predecessor !== null && !seen.has(snapshot.session.fitting.predecessor)) throw Error('Fitting predecessor must refer to an earlier saved fitting.');
    seen.add(snapshot.fingerprint);
  }
  state.draft = input.draft === null ? null : normalizeSession(input.draft, state);
  if (state.draft?.fitting.predecessor !== null && state.draft && !seen.has(state.draft.fitting.predecessor)) throw Error('Draft predecessor must refer to a saved fitting.');
  if (new TextEncoder().encode(JSON.stringify(state)).byteLength > DWILLA_LIMITS.backupBytes) throw Error('DWILLA workspace exceeds the 100 MB backup limit.');
  return state;
}

export function createDwilla(dictionary) {
  return normalizeDwilla({ schemaVersion: 1, dictionary, samples: [], draft: null, snapshots: [] });
}

/** Explicit sample/pattern identity and units; no source value becomes a target. */
export function startDwillaFitting(input, { sampleKey = uuid('sample'), sampleId, sampleRevision, patternRevision, unit, date }) {
  const state = normalizeDwilla(input);
  if (state.draft) throw Error('Save and retain the current fitting before starting another; use Reopen fitting to edit it.');
  const sample = { key: sampleKey, id: sampleId, revision: sampleRevision, patternRevision };
  const prior = state.samples.find(item => item.key === sampleKey);
  if (prior && JSON.stringify(prior) !== JSON.stringify(sample)) throw Error('A sample key already identifies another sample or pattern revision.');
  if (!prior) state.samples.push(sample);
  state.draft = { id: uuid('fitting'), sampleKey, patternRevision,
    fitting: createFitting(state.dictionary, { sampleId, sampleRevision, unit, date }),
    configurations: ['A', 'B'].map(name => ({ id: `configuration-${name.toLowerCase()}`, name: '', mobility: '', closureAccess: '', cutoutStability: '', meshShell: '' })),
    actions: [], photos: [] };
  return normalizeDwilla(state);
}

export async function dwillaFingerprint(fitting) {
  const bytes = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(fitting))));
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Optional asynchronous readback verification for imported/recovered history. This is not an approval signature. */
export async function verifyDwillaHistory(input) {
  const state = normalizeDwilla(input);
  for (const snapshot of state.snapshots) {
    if (await dwillaFingerprint(snapshot.session.fitting) !== snapshot.fingerprint) throw Error('A saved fitting fingerprint does not match its measurement record. Keep the original backup for recovery.');
  }
  return state;
}

/** Append a content-addressed fitting record; the mutable draft remains on screen. */
export async function saveDwillaSnapshot(input) {
  const state = normalizeDwilla(input);
  if (!state.draft) throw Error('Start or reopen a fitting before saving a snapshot.');
  state.snapshots.push({ id: uuid('snapshot'), savedAt: new Date().toISOString(), session: clone(state.draft), fingerprint: await dwillaFingerprint(state.draft.fitting) });
  return normalizeDwilla(state);
}

/** Reopen a saved fitting as a working copy. The saved record never changes. */
export function reopenDwillaSnapshot(input, snapshotId) {
  const state = normalizeDwilla(input);
  const snapshot = state.snapshots.find(item => item.id === snapshotId);
  if (!snapshot) throw Error('This fitting snapshot was not found.');
  state.draft = clone(snapshot.session);
  return state;
}

/** Editing history may undo a working draft, but cannot erase saved fitting records. */
export function retainDwillaHistory(current, previous) {
  const saved = normalizeDwilla(current);
  if (!saved.snapshots.length) return previous === null ? null : normalizeDwilla(previous);
  if (previous === null) return saved;
  const next = normalizeDwilla(previous);
  if (next.dictionary.sourceSha256 !== saved.dictionary.sourceSha256 || next.dictionary.dictionaryVersion !== saved.dictionary.dictionaryVersion) throw Error('Undo cannot replace the dictionary behind preserved fittings.');
  const samples = new Map(saved.samples.map(sample => [sample.key, sample]));
  for (const sample of next.samples) if (!samples.has(sample.key)) samples.set(sample.key, sample);
  const snapshots = new Map(saved.snapshots.map(snapshot => [snapshot.id, snapshot]));
  for (const snapshot of next.snapshots) if (!snapshots.has(snapshot.id)) snapshots.set(snapshot.id, snapshot);
  return normalizeDwilla({ ...next, samples: [...samples.values()], snapshots: [...snapshots.values()] });
}

/** Request a revised sample. The advance decision is not production approval. */
export async function advanceDwillaFitting(input, { sampleKey = uuid('sample'), sampleId, sampleRevision, patternRevision, date }) {
  let state = normalizeDwilla(input);
  if (!state.draft) throw Error('Start or reopen the fitting to request the next sample.');
  if (patternRevision === state.draft.patternRevision) throw Error('Identify the next pattern revision explicitly.');
  if (sampleId !== state.draft.fitting.sampleId) throw Error('A revised sample must retain the sample ID and use a new sample revision.');
  state = await saveDwillaSnapshot(state);
  const previous = state.snapshots.at(-1);
  const fitting = progressFitting(previous.session.fitting, state.dictionary, { sampleRevision, date, predecessor: previous.fingerprint });
  const sample = { key: sampleKey, id: sampleId, revision: sampleRevision, patternRevision };
  if (state.samples.some(item => item.key === sampleKey)) throw Error('The next sample needs a new sample key.');
  state.samples.push(sample);
  state.draft = { id: uuid('fitting'), sampleKey, patternRevision, fitting,
    configurations: previous.session.configurations.map(configuration => ({ ...configuration, mobility: '', closureAccess: '', cutoutStability: '', meshShell: '' })),
    actions: previous.session.actions.filter(action => action.status === 'open').map(action => clone(action)), photos: [] };
  return normalizeDwilla(state);
}

export function dwillaSummary(input) {
  const state = normalizeDwilla(input);
  if (!state.draft) return { measuredDefinitions: 0, totalDefinitions: 60, missingDefinitions: 60, openActions: 0, readings: [] };
  const summary = fittingSummary(state.draft.fitting, state.dictionary);
  return { ...summary, missingDefinitions: summary.totalDefinitions - summary.measuredDefinitions,
    openActions: state.draft.actions.filter(action => action.status === 'open').length };
}

/** This factory contains invented labels only. It never represents DWILLA source specifications. */
export function createSyntheticDwillaDictionary() {
  return { schemaVersion: 1, dictionaryVersion: 'synthetic-demo-v1', styleId: 'SR-001', sourceSha256: 'd'.repeat(64), approval: 'SYNTHETIC DEMO — NOT FOR MANUFACTURING',
    definitions: Object.entries(GROUP_CODES).flatMap(([group, codes]) => codes.map(pomCode => ({ pomCode, group,
      description: `SYNTHETIC ${pomCode} demonstration measurement`, howToMeasure: `SYNTHETIC instruction for ${pomCode}: measure between the marked demonstration landmarks without distorting the material.`, unit: null, target: null, tolerance: null }))),
    fitFormReference: { referenceId: 'SYNTHETIC-BODY-REFERENCE', approval: 'synthetic-only', measurements: Array.from({ length: 20 }, (_, index) => ({ pomCode: `BF-${String(index + 1).padStart(2, '0')}`, description: 'SYNTHETIC separate body-form reference', howToMeasure: 'SYNTHETIC reference instruction; no garment tolerance implied.' })) } };
}
