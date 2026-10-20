/** Shared by Node.js and the browser. New measurements never approve or revise the baseline. */
export const REFERENCE_MODES = ['house', 'manufacturer', 'custom'];

export function parseMeasurement(value) {
  if (value === null || (typeof value === 'string' && value.trim() === '')) return null;
  if (typeof value === 'string') {
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) {
      throw Error('Enter a non-negative decimal measurement, or leave it blank.');
    }
    value = Number(value.trim());
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw Error('Enter a non-negative decimal measurement, or leave it blank.');
  }
  return value;
}

export function calculateDelta(measured, reference) {
  const measurement = parseMeasurement(measured);
  const baseline = parseMeasurement(reference);
  return measurement === null || baseline === null
    ? null
    : Number((measurement - baseline).toFixed(3));
}

export function formatDelta(value) {
  return value === null ? '—' : value > 0 ? `+${value}` : String(value);
}

function referenceFor(record, mode) {
  return mode === 'house' ? record.houseStandard : mode === 'manufacturer' ? record.manufacturerReference : null;
}

export function createMeasurementSession(template, options = {}) {
  const referenceMode = options.referenceMode ?? 'house';
  if (!REFERENCE_MODES.includes(referenceMode)) throw Error('Choose a supported reference mode.');
  return {
    schemaVersion: 1,
    formId: template.formId,
    templateRevision: template.revision,
    unit: template.unit,
    name: options.name ?? 'New measurement session',
    measurementDate: options.measurementDate ?? '',
    note: options.note ?? '',
    referenceMode,
    measurements: template.measurements.map(record => ({
      pomCode: record.pomCode,
      description: record.description,
      sourceLabel: record.sourceLabel,
      howToMeasure: record.howToMeasure,
      measured: null,
      reference: referenceFor(record, referenceMode),
    })),
  };
}

export function validateMeasurementSession(input, template) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('A measurement session is required.');
  if (input.schemaVersion !== 1 || input.formId !== template.formId ||
      input.templateRevision !== template.revision || input.unit !== template.unit) {
    throw Error('Session template, version, or unit does not match this register.');
  }
  if (!REFERENCE_MODES.includes(input.referenceMode)) throw Error('Choose a supported reference mode.');
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 120) {
    throw Error('Enter a session name between 1 and 120 characters.');
  }
  const date = input.measurementDate;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith('0000') ||
      Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw Error('Enter a valid measurement date.');
  }
  if (typeof input.note !== 'string' || input.note.length > 4000) throw Error('Notes must be text with at most 4000 characters.');
  if (!Array.isArray(input.measurements) || input.measurements.length !== template.measurements.length) {
    throw Error('Include all 20 POMs; leave unmeasured values blank.');
  }
  const records = new Map();
  const knownCodes = new Set(template.measurements.map(record => record.pomCode));
  for (const record of input.measurements) {
    if (!record || !knownCodes.has(record.pomCode) || records.has(record.pomCode)) {
      throw Error('Session contains an unknown or duplicate POM.');
    }
    records.set(record.pomCode, record);
  }
  const session = createMeasurementSession(template, {
    name: input.name.trim(), measurementDate: date, note: input.note, referenceMode: input.referenceMode,
  });
  for (const record of session.measurements) {
    const incoming = records.get(record.pomCode);
    record.measured = parseMeasurement(incoming.measured);
    const reference = parseMeasurement(incoming.reference);
    if (session.referenceMode !== 'custom' && reference !== record.reference) {
      throw Error('Preset references must match the selected baseline. Choose custom references to edit them.');
    }
    record.reference = reference;
    calculateDelta(record.measured, reference);
  }
  if (!session.measurements.some(record => record.measured !== null)) {
    throw Error('Enter at least one new measurement before saving or exporting.');
  }
  return session;
}

export function summarizeSession(session) {
  return {
    total: session.measurements.length,
    measured: session.measurements.filter(record => record.measured !== null).length,
    compared: session.measurements.filter(record => record.measured !== null && record.reference !== null).length,
    missingReferences: session.measurements.filter(record => record.reference === null).length,
  };
}

export function sessionToCsv(session) {
  const cell = value => {
    if (value === null) return '';
    if (typeof value === 'number') return String(value);
    let text = String(value);
    // Prevent spreadsheet formulas in free-text names/notes/labels.
    if (/^[=+@-]/.test(text.trimStart())) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const header = ['Session', 'Measurement date', 'Reference mode', 'Unit', 'POM', 'Description',
    'Source label', 'How to measure', 'Reference', 'New measurement', 'Delta (new minus reference)', 'Notes'];
  const lines = [header.map(cell).join(',')];
  for (const record of session.measurements) {
    lines.push([session.name, session.measurementDate, session.referenceMode, session.unit,
      record.pomCode, record.description, record.sourceLabel, record.howToMeasure,
      record.reference, record.measured, calculateDelta(record.measured, record.reference), session.note].map(cell).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}
