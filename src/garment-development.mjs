/** Local garment development: imported definitions are separate from working values. */
const SIDES = ['general', 'front', 'back', 'left', 'right'];
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const LOCAL_NUMBERS = ['targetCm', 'toleranceMinusCm', 'tolerancePlusCm', 'proposedDeltaCm'];
const ROW_KEYS = ['id', 'code', 'description', 'method', 'retired', 'sourceRow', 'sourceSha256', 'definitionHistory', ...LOCAL_NUMBERS, 'notes', 'observations'];
const MAX_NUMBER = 1e9;
const SOURCE_WARNING = 'Workbook measurement values remain source notes; enter working targets after selecting CM/IN. The source ± and Adj labels are not interpreted as tolerance or proposed change.';

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error(`${label} must be an object.`);
  if (Object.keys(value).some(key => UNSAFE_KEYS.has(key))) throw Error(`${label} contains an unsafe key.`);
  return value;
}

function exact(value, keys, label) {
  object(value, label);
  if (Object.keys(value).length !== keys.length || Object.keys(value).some(key => !keys.includes(key))) throw Error(`${label} must contain exactly the known fields.`);
}

function text(value, label, max = 2000) {
  if (typeof value !== 'string' || value.length > max || value.includes('\0')) throw Error(`${label} must be text of at most ${max} characters.`);
  return value;
}

function number(value, label, signed = false) {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > MAX_NUMBER || (!signed && value < 0)) throw Error(`${label} must be ${signed ? 'a finite signed' : 'a non-negative'} number or blank.`);
  return Object.is(value, -0) ? 0 : value;
}

function array(value, label, max) {
  if (!Array.isArray(value) || value.length > max) throw Error(`${label} must be a list of at most ${max} entries.`);
  return value;
}

function requireUnit(unit) {
  if (unit !== null && !['cm', 'in'].includes(unit)) throw Error('Choose CM or IN for garment measurements.');
}

function sourceCoordinate(value) {
  const match = /^([A-Z]{1,3})([1-9]\d{0,6})$/.exec(value);
  if (!match || Number(match[2]) > 1048576) return false;
  const column = [...match[1]].reduce((result, letter) => result * 26 + letter.charCodeAt(0) - 64, 0);
  return column <= 16384;
}

/** Validate raw local workbook notes without calculating or rewriting any cell. */
function normalizeWorkbook(input) {
  exact(input, ['fileName', 'sha256', 'sheets'], 'Workbook');
  const fileName = text(input.fileName, 'Workbook filename', 255);
  const sha256 = text(input.sha256, 'Workbook hash', 64);
  if (!/^[a-f0-9]{64}$/i.test(sha256)) throw Error('Workbook hash must be SHA-256.');
  const names = new Set();
  let cellCount = 0, textLength = 0;
  const sheets = array(input.sheets, 'Workbook sheets', 64).map(sheet => {
    exact(sheet, ['name', 'cells', 'merges'], 'Source sheet');
    const name = text(sheet.name, 'Source sheet name', 100);
    if (!name || names.has(name)) throw Error('Workbook sheet names must be nonempty and unique.');
    names.add(name);
    object(sheet.cells, 'Source cells');
    const cells = {};
    for (const [coordinate, cell] of Object.entries(sheet.cells)) {
      if (!sourceCoordinate(coordinate)) throw Error('Workbook contains an invalid cell coordinate.');
      if (++cellCount > 100000) throw Error('Workbook has too many source cells.');
      exact(cell, ['value', 'formula', 'type'], `Source cell ${coordinate}`);
      if (cell.value !== null && !['string', 'number', 'boolean'].includes(typeof cell.value)) throw Error('Source cell values must be plain values.');
      if (typeof cell.value === 'number' && !Number.isFinite(cell.value)) throw Error('Source cell number must be finite.');
      if (typeof cell.value === 'string') textLength += text(cell.value, 'Source cell text', 100000).length;
      const formula = cell.formula === null ? null : text(cell.formula, 'Source formula', 100000);
      textLength += formula?.length ?? 0;
      const type = text(cell.type, 'Source cell type', 32);
      if (textLength > 10000000) throw Error('Workbook source text exceeds the local import limit.');
      cells[coordinate] = { value: cell.value, formula, type };
    }
    const merges = array(sheet.merges, 'Source merges', 10000).map(range => {
      text(range, 'Source merge', 40);
      const parts = range.split(':');
      if (parts.length !== 2 || !parts.every(sourceCoordinate)) throw Error('Workbook contains an invalid merge range.');
      return range;
    });
    return { name, cells, merges };
  });
  return { fileName, sha256, sheets };
}

function componentId(name) { return `component:${encodeURIComponent(name)}`; }
function rowId(component, code) { return `${component}:${code}`; }

function blankObservations(samples) {
  return Object.fromEntries(samples.map(sample => [sample.id, Object.fromEntries(SIDES.map(side => [side, null]))]));
}

function blankRow(component, code, description, method, sourceRow, sourceSha256, samples = []) {
  return { id: rowId(component, code), code, description, method, retired: false, sourceRow, sourceSha256, definitionHistory: [],
    targetCm: null, toleranceMinusCm: null, tolerancePlusCm: null, proposedDeltaCm: null,
    notes: '', observations: blankObservations(samples) };
}

/** No unit, sample round, working target, tolerance, or approval is inferred. */
export function createDevelopment() {
  return { schemaVersion: 1, source: null, components: [], samples: [] };
}

/** Strict portable JSON validation. Numeric values already represent canonical CM. */
export function normalizeDevelopment(input, unit = null) {
  requireUnit(unit);
  exact(input, ['schemaVersion', 'source', 'components', 'samples'], 'Garment development');
  if (input.schemaVersion !== 1) throw Error('This garment-development version is not supported.');
  const source = input.source === null ? null : normalizeWorkbook(input.source);
  const sampleIds = new Set();
  const samples = array(input.samples, 'Development samples', 64).map(sample => {
    exact(sample, ['id', 'label', 'round', 'notes'], 'Development sample');
    const id = text(sample.id, 'Sample ID', 128);
    if (!/^[\w-]{1,128}$/.test(id) || sampleIds.has(id)) throw Error('Sample IDs must be unique safe identifiers.');
    sampleIds.add(id);
    return { id, label: text(sample.label, 'Sample label', 240), round: text(sample.round, 'Sample round', 240), notes: text(sample.notes, 'Sample notes', 10000) };
  });
  const componentIds = new Set(), rowIds = new Set();
  let numericEntered = false, rowCount = 0;
  const components = array(input.components, 'Development components', 32).map(component => {
    exact(component, ['id', 'name', 'sourceSheet', 'rows'], 'Garment component');
    const name = text(component.name, 'Component name', 100);
    const sourceSheet = text(component.sourceSheet, 'Component source sheet', 100);
    const id = text(component.id, 'Component ID', 1000);
    if (!name || name !== sourceSheet || id !== componentId(sourceSheet) || componentIds.has(id)) throw Error('Component identity must match a unique source sheet.');
    componentIds.add(id);
    const rows = array(component.rows, 'Component POM rows', 2000).map(row => {
      if (++rowCount > 10000) throw Error('Development contains too many POM rows.');
      exact(row, ROW_KEYS, 'Component POM');
      const code = text(row.code, 'POM code', 64);
      if (!/^[A-Za-z]+\d+$/.test(code) || row.id !== rowId(id, code) || rowIds.has(row.id)) throw Error('POM identity must match a unique authored code and component.');
      rowIds.add(row.id);
      if (typeof row.retired !== 'boolean' || !Number.isInteger(row.sourceRow) || row.sourceRow < 1 || row.sourceRow > 1048576) throw Error('POM source position or retired state is invalid.');
      if (typeof row.sourceSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(row.sourceSha256)) throw Error('POM definition source hash is invalid.');
      const normalized = { id: row.id, code, description: text(row.description, 'POM description', 100000), method: text(row.method, 'Measuring method', 100000), retired: row.retired, sourceRow: row.sourceRow, sourceSha256: row.sourceSha256 };
      normalized.definitionHistory = array(row.definitionHistory, 'POM definition history', 100).map(entry => {
        exact(entry, ['description', 'method', 'sourceRow', 'sourceSha256'], 'Previous POM definition');
        if (!Number.isInteger(entry.sourceRow) || entry.sourceRow < 1 || entry.sourceRow > 1048576 || typeof entry.sourceSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(entry.sourceSha256)) throw Error('Previous POM definition source is invalid.');
        return { description: text(entry.description, 'Previous POM description', 100000), method: text(entry.method, 'Previous measuring method', 100000), sourceRow: entry.sourceRow, sourceSha256: entry.sourceSha256 };
      });
      for (const key of LOCAL_NUMBERS) {
        normalized[key] = number(row[key], key, key === 'proposedDeltaCm');
        if (normalized[key] !== null) numericEntered = true;
      }
      if (normalized.targetCm !== null && normalized.proposedDeltaCm !== null && normalized.targetCm + normalized.proposedDeltaCm < 0) throw Error('A proposed working target cannot be negative.');
      normalized.notes = text(row.notes, 'POM notes', 10000);
      object(row.observations, 'POM observations');
      if (Object.keys(row.observations).length > sampleIds.size) throw Error('Observations must use known samples.');
      normalized.observations = {};
      for (const [sampleId, values] of Object.entries(row.observations)) {
        if (!sampleIds.has(sampleId)) throw Error('Observations must use known samples.');
        exact(values, SIDES, 'Sample-side observations');
        normalized.observations[sampleId] = Object.fromEntries(SIDES.map(side => {
          const value = number(values[side], `${code} ${side} observation`);
          if (value !== null) numericEntered = true;
          return [side, value];
        }));
      }
      return normalized;
    });
    return { id, name, sourceSheet, rows };
  });
  if (numericEntered && unit === null) throw Error('Choose CM or IN before entering garment measurements.');
  if (components.length && source === null) throw Error('Imported components require their local workbook source.');
  return { schemaVersion: 1, source, components, samples };
}

function definitions(workbook, samples) {
  const components = [], warnings = [SOURCE_WARNING];
  for (const sheet of workbook.sheets) {
    if (!/-SPEC$/i.test(sheet.name)) continue;
    const id = componentId(sheet.name), codes = new Set(), rows = [];
    const coordinates = Object.keys(sheet.cells).filter(coordinate => /^A\d+$/.test(coordinate)).sort((left, right) => Number(left.slice(1)) - Number(right.slice(1)));
    for (const coordinate of coordinates) {
      const cell = sheet.cells[coordinate];
      if (typeof cell.value !== 'string' || !/^[A-Za-z]+\d+$/.test(cell.value)) continue;
      if (cell.formula !== null) {
        warnings.push(`${sheet.name} ${coordinate}: a formula-backed POM code was not imported as an authored definition.`);
        continue;
      }
      const code = cell.value, sourceRow = Number(coordinate.slice(1));
      if (codes.has(code)) throw Error(`${sheet.name} contains duplicate authored POM code ${code}; resolve it before importing.`);
      codes.add(code);
      const readText = column => {
        const sourceCell = sheet.cells[`${column}${sourceRow}`];
        if (!sourceCell || sourceCell.value === null) return '';
        if (sourceCell.formula !== null) warnings.push(`${sheet.name} ${column}${sourceRow}: the cached source text is retained; its formula is not calculated.`);
        return String(sourceCell.value);
      };
      rows.push(blankRow(id, code, readText('B'), readText('D'), sourceRow, workbook.sha256, samples));
    }
    if (rows.length) components.push({ id, name: sheet.name, sourceSheet: sheet.name, rows });
  }
  if (!components.length) throw Error('No authored component POMs were found in *-SPEC sheets.');
  if (components.length > 32 || components.reduce((count, component) => count + component.rows.length, 0) > 10000 || components.some(component => component.rows.length > 2000)) throw Error('Workbook contains too many component definitions.');
  return { components, warnings };
}

function stableString(value) {
  if (Array.isArray(value)) return `[${value.map(stableString).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableString(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function fingerprint(value) {
  const serialized = stableString(value);
  let first = 2166136261, second = 5381;
  for (let index = 0; index < serialized.length; index++) {
    const code = serialized.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619) >>> 0;
    second = (Math.imul(second, 33) ^ code) >>> 0;
  }
  return `${serialized.length}:${first.toString(16).padStart(8, '0')}:${second.toString(16).padStart(8, '0')}`;
}

/** Preview definitions only; source measurements never become working values. */
export function previewComponentWorkbook(workbook, existingDevelopment = null, { unit = null } = {}) {
  const existing = normalizeDevelopment(existingDevelopment ?? createDevelopment(), unit);
  const normalizedWorkbook = normalizeWorkbook(workbook);
  const { components, warnings } = definitions(normalizedWorkbook, existing.samples);
  const changes = [], changed = new Set();
  let added = 0, retired = 0;
  const existingComponents = new Map(existing.components.map(component => [component.id, component]));
  const incomingIds = new Set();
  for (const component of components) {
    incomingIds.add(component.id);
    const previous = existingComponents.get(component.id);
    if (!previous) changes.push({ type: 'component-added', componentId: component.id, message: `Add component ${component.name}.` });
    const previousRows = new Map((previous?.rows ?? []).map(row => [row.id, row]));
    for (const row of component.rows) {
      const old = previousRows.get(row.id);
      if (!old) {
        added++;
        changes.push({ type: 'row-added', componentId: component.id, rowId: row.id, message: `${component.name} ${row.code}: add authored POM definition; working values remain blank.` });
      } else {
        for (const field of ['description', 'method']) if (old[field] !== row[field]) {
          changed.add(row.id);
          changes.push({ type: field === 'method' ? 'method-changed' : 'description-changed', componentId: component.id, rowId: row.id,
            message: `${component.name} ${row.code}: source ${field} changed. Existing working values and observations will be retained for review.` });
        }
        if (old.retired) {
          changed.add(row.id);
          changes.push({ type: 'row-reactivated', componentId: component.id, rowId: row.id, message: `${component.name} ${row.code}: restore the authored definition; retained working values remain.` });
        }
      }
      previousRows.delete(row.id);
    }
    for (const old of previousRows.values()) if (!old.retired) {
      retired++;
      changes.push({ type: 'row-retired', componentId: component.id, rowId: old.id, message: `${component.name} ${old.code}: absent from this workbook; retain as retired with all working values.` });
    }
  }
  for (const oldComponent of existing.components) if (!incomingIds.has(oldComponent.id)) {
    for (const old of oldComponent.rows) if (!old.retired) {
      retired++;
      changes.push({ type: 'row-retired', componentId: oldComponent.id, rowId: old.id, message: `${oldComponent.name} ${old.code}: component absent from this workbook; retain as retired with all working values.` });
    }
  }
  return { schemaVersion: 1, baseFingerprint: fingerprint(existing), workbook: normalizedWorkbook, components, changes, warnings,
    summary: { components: components.length, rows: components.reduce((count, component) => count + component.rows.length, 0), added, changed: changed.size, retired } };
}

/** Apply the reviewed source atomically while preserving every local working value. */
export function applyComponentWorkbook(existingDevelopment, preview, { unit = null } = {}) {
  const existing = normalizeDevelopment(existingDevelopment ?? createDevelopment(), unit);
  exact(preview, ['schemaVersion', 'baseFingerprint', 'workbook', 'components', 'changes', 'warnings', 'summary'], 'Workbook preview');
  if (preview.schemaVersion !== 1 || preview.baseFingerprint !== fingerprint(existing)) throw Error('The workbook preview is stale; preview again before applying.');
  const expected = previewComponentWorkbook(preview.workbook, existing, { unit });
  if (stableString(preview) !== stableString(expected)) throw Error('The workbook preview changed; preview again before applying.');
  const previousComponents = new Map(existing.components.map(component => [component.id, component]));
  const components = expected.components.map(component => {
    const previous = previousComponents.get(component.id);
    const previousRows = new Map((previous?.rows ?? []).map(row => [row.id, row]));
    const rows = component.rows.map(row => {
      const old = previousRows.get(row.id);
      previousRows.delete(row.id);
      if (!old) return row;
      const definitionHistory = [...old.definitionHistory];
      if (old.description !== row.description || old.method !== row.method) definitionHistory.push({ description: old.description, method: old.method, sourceRow: old.sourceRow, sourceSha256: old.sourceSha256 });
      return { ...old, description: row.description, method: row.method, sourceRow: row.sourceRow, sourceSha256: row.sourceSha256, definitionHistory, retired: false };
    });
    for (const old of previousRows.values()) rows.push({ ...old, retired: true });
    previousComponents.delete(component.id);
    return { ...component, rows };
  });
  for (const previous of previousComponents.values()) components.push({ ...previous, rows: previous.rows.map(row => ({ ...row, retired: true })) });
  return normalizeDevelopment({ schemaVersion: 1, source: expected.workbook, components, samples: existing.samples }, unit);
}

function subtract(left, right) { return Number((left - right).toFixed(12)); }

/** Actual minus target, with independent sample/side identity and explicit tolerances. */
export function compareObservation(row, sampleId, side = 'general') {
  if (!SIDES.includes(side)) throw Error('Choose a supported observation side.');
  object(row, 'Development POM');
  const actualCm = number(row.observations?.[sampleId]?.[side] ?? null, 'Sample observation');
  const targetCm = number(row.targetCm, 'Working target');
  const toleranceMinusCm = number(row.toleranceMinusCm, 'Minus tolerance');
  const tolerancePlusCm = number(row.tolerancePlusCm, 'Plus tolerance');
  const proposedDeltaCm = number(row.proposedDeltaCm, 'Proposed change', true);
  if (targetCm !== null && proposedDeltaCm !== null && targetCm + proposedDeltaCm < 0) throw Error('A proposed working target cannot be negative.');
  const deltaCm = actualCm === null || targetCm === null ? null : subtract(actualCm, targetCm);
  const hasTolerance = toleranceMinusCm !== null && tolerancePlusCm !== null;
  const lowerCm = targetCm === null || !hasTolerance ? null : subtract(targetCm, toleranceMinusCm);
  const upperCm = targetCm === null || !hasTolerance ? null : subtract(targetCm, -tolerancePlusCm);
  const rawDelta = deltaCm === null ? null : actualCm - targetCm;
  const epsilon = Number.EPSILON * Math.max(1, Math.abs(actualCm ?? 0), Math.abs(targetCm ?? 0), toleranceMinusCm ?? 0, tolerancePlusCm ?? 0) * 4;
  const toleranceStatus = deltaCm === null ? 'missing' : !hasTolerance ? 'not-set'
    : rawDelta >= -toleranceMinusCm - epsilon && rawDelta <= tolerancePlusCm + epsilon ? 'within' : 'outside';
  return { actualCm, targetCm, deltaCm, toleranceStatus, lowerCm, upperCm,
    proposedTargetCm: targetCm === null || proposedDeltaCm === null ? null : subtract(targetCm, -proposedDeltaCm) };
}
