/** Garment fittings are separate from the approved mannequin and client intake. */
export const GROUP_CODES = {
  main: Array.from({ length: 32 }, (_, i) => `M${String(i + 1).padStart(2, '0')}`),
  cutout: [...['CF', 'CB'].flatMap(p => Array.from({ length: 5 }, (_, i) => `${p}${String(i + 1).padStart(2, '0')}`)), 'C11'],
  silkShell: Array.from({ length: 11 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`),
  skirt: Array.from({ length: 6 }, (_, i) => `K${String(i + 1).padStart(2, '0')}`),
};
const units = ['IN', 'CM'];
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
function requireText(value, name) {
  if (typeof value !== 'string' || !value.trim() || value.length > 4000) throw Error(`Invalid ${name}`);
}
export function validateDictionary(d) {
  if (d?.schemaVersion !== 1 || d.styleId !== 'SR-001') throw Error('Unsupported dictionary');
  requireText(d.dictionaryVersion, 'dictionary version');
  if (!/^[a-f0-9]{64}$/.test(d.sourceSha256)) throw Error('Missing source fingerprint');
  const expected = Object.entries(GROUP_CODES).flatMap(([group, codes]) => codes.map(pomCode => ({ group, pomCode })));
  if (d.definitions?.length !== 60) throw Error('Require 60 garment definitions');
  expected.forEach((p, i) => {
    const v = d.definitions[i];
    if (v.pomCode !== p.pomCode || v.group !== p.group) throw Error('POM sequence/group mismatch');
    requireText(v.description, 'description'); requireText(v.howToMeasure, 'method');
  });
  if (d.fitFormReference?.measurements?.length !== 20 || d.fitFormReference.measurements.some((v, i) => v.pomCode !== `BF-${String(i + 1).padStart(2, '0')}`)) throw Error('Require separate 20-POM fit form');
  return d;
}
export function createFitting(d, { sampleId, sampleRevision, unit, date }) {
  validateDictionary(d);
  requireText(sampleId, 'sample identity'); requireText(sampleRevision, 'sample revision');
  if (!units.includes(unit)) throw Error('Confirm IN or CM explicitly');
  return validateFitting({ schemaVersion: 1, styleId: d.styleId, dictionaryVersion: d.dictionaryVersion,
    sourceSha256: d.sourceSha256, sampleId, sampleRevision, unit, date,
    stage: 'first-fitting', predecessor: null, readings: [], specs: [], landmarks: [], notes: [], decision: null }, d);
}
export function validateFitting(f, d) {
  validateDictionary(d);
  if (f?.schemaVersion !== 1 || f.styleId !== d.styleId || f.dictionaryVersion !== d.dictionaryVersion || f.sourceSha256 !== d.sourceSha256) throw Error('Dictionary identity/revision mismatch');
  requireText(f.sampleId, 'sample identity'); requireText(f.sampleRevision, 'sample revision');
  if (!units.includes(f.unit) || !['first-fitting', 'second-fitting', 'review'].includes(f.stage)) throw Error('Invalid unit/stage');
  if (typeof f.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f.date) || !Number.isFinite(Date.parse(f.date)) || new Date(f.date).toISOString().slice(0, 10) !== f.date) throw Error('Invalid fitting date');
  const codes = new Set(d.definitions.map(v => v.pomCode));
  for (const key of ['readings', 'specs', 'landmarks', 'notes']) if (!Array.isArray(f[key])) throw Error(`Invalid ${key}`);
  const landmarkIds = new Set();
  for (const l of f.landmarks) {
    requireText(l.id, 'landmark ID'); requireText(l.description, 'landmark description');
    if (landmarkIds.has(l.id)) throw Error('Duplicate landmark');
    landmarkIds.add(l.id);
  }
  const specKeys = new Set();
  for (const s of f.specs) {
    if (!codes.has(s.pomCode)) throw Error('Unknown spec POM');
    requireText(s.context, 'spec context'); requireText(s.authority, 'spec authority');
    const key = JSON.stringify([s.pomCode, s.context]);
    if (specKeys.has(key)) throw Error('Duplicate spec'); specKeys.add(key);
    if (s.target !== null && !finite(s.target)) throw Error('Invalid target');
    if (s.tolerance !== null && (!finite(s.tolerance.minus) || !finite(s.tolerance.plus))) throw Error('Invalid tolerance');
  }
  const ids = new Set();
  for (const r of f.readings) {
    if (!codes.has(r.pomCode)) throw Error('Unknown garment POM');
    requireText(r.id, 'reading ID'); requireText(r.context, 'reading context'); requireText(r.observer, 'observer');
    if (ids.has(r.id)) throw Error('Duplicate reading ID'); ids.add(r.id);
    if (!finite(r.value) || r.unit !== f.unit || !['unwashed', 'before-wash', 'after-wash', 'not-applicable'].includes(r.condition)) throw Error('Invalid reading value/unit/condition');
    if (!Array.isArray(r.landmarkIds) || r.landmarkIds.some(id => !landmarkIds.has(id))) throw Error('Unknown landmark reference');
  }
  for (const n of f.notes) {
    if (n.pomCode !== null && !codes.has(n.pomCode)) throw Error('Unknown note POM');
    requireText(n.text, 'fit note'); requireText(n.author, 'note author');
    if (!['open', 'resolved'].includes(n.status)) throw Error('Invalid note status');
  }
  if (f.decision !== null) {
    if (!['revise', 'advance', 'hold'].includes(f.decision.action)) throw Error('Invalid decision');
    requireText(f.decision.author, 'decision author'); requireText(f.decision.reason, 'decision reason');
  }
  if (f.predecessor !== null && (typeof f.predecessor !== 'string' || !/^[a-f0-9]{64}$/.test(f.predecessor))) throw Error('Invalid predecessor');
  return structuredClone(f);
}
export function evaluateReading(reading, spec) {
  if (!finite(reading.value)) throw Error('Invalid reading');
  if (!spec || spec.target === null) return { status: 'missing-target', delta: null };
  if (!finite(spec.target)) throw Error('Invalid target');
  const delta = reading.value - spec.target;
  if (spec.tolerance === null) return { status: 'missing-tolerance', delta };
  if (!finite(spec.tolerance.minus) || !finite(spec.tolerance.plus)) throw Error('Invalid tolerance');
  // Epsilon handles binary arithmetic at the exact inclusive tolerance boundary.
  const epsilon = Number.EPSILON * Math.max(1, Math.abs(reading.value), Math.abs(spec.target)) * 4;
  return { status: delta >= -spec.tolerance.minus - epsilon && delta <= spec.tolerance.plus + epsilon ? 'within-tolerance' : 'out-of-tolerance', delta };
}
export function fittingSummary(f, d) {
  validateFitting(f, d);
  return { stage: f.stage, measuredDefinitions: new Set(f.readings.map(r => r.pomCode)).size,
    totalDefinitions: 60, openNotes: f.notes.filter(n => n.status === 'open').length,
    readings: f.readings.map(r => ({ id: r.id, pomCode: r.pomCode, context: r.context,
      ...evaluateReading(r, f.specs.find(s => s.pomCode === r.pomCode && s.context === r.context)) })) };
}
export function progressFitting(f, d, { sampleRevision, date, predecessor }) {
  validateFitting(f, d);
  if (f.stage === 'review' || f.decision?.action !== 'advance') throw Error('An explicit advance decision is required');
  if (sampleRevision === f.sampleRevision) throw Error('Use a new sample revision');
  if (typeof date === 'string' && date < f.date) throw Error('Next fitting cannot precede the previous fitting');
  return validateFitting({ ...structuredClone(f), sampleRevision, date, predecessor,
    stage: f.stage === 'first-fitting' ? 'second-fitting' : 'review',
    readings: [], decision: null }, d);
}
