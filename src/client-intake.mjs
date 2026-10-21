/** Client intake calculations and validation, shared by browser and Node.js. */
function requireUnit(unit) {
  if (!['CM', 'IN'].includes(unit)) throw Error('Choose CM or IN as the measurement unit.');
}

export function parseClientMeasurement(value, unit) {
  requireUnit(unit);
  if (value === null || (typeof value === 'string' && value.trim() === '')) return null;
  if (typeof value === 'string') {
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) {
      throw Error('Enter a non-negative decimal measurement, or leave it blank.');
    }
    value = Number(value.trim());
  }
  const valueCm = typeof value === 'number' ? value * (unit === 'IN' ? 2.54 : 1) : NaN;
  if (!Number.isFinite(valueCm) || valueCm < 0) throw Error('Enter a non-negative decimal measurement, or leave it blank.');
  return valueCm;
}

export function displayClientMeasurement(valueCm, unit) {
  requireUnit(unit);
  if (valueCm === null) return '';
  if (typeof valueCm !== 'number' || !Number.isFinite(valueCm) || valueCm < 0) throw Error('Invalid stored measurement.');
  return String(Number((valueCm / (unit === 'IN' ? 2.54 : 1)).toFixed(6)));
}

export function createIntakeDraft(template, options = {}) {
  const unit = options.unit ?? template.defaultUnit;
  requireUnit(unit);
  return {
    schemaVersion: 1,
    templateId: template.templateId,
    templateRevision: template.revision,
    unit,
    fields: Object.fromEntries(template.fields.map(field => [field.key,
      options.fields?.[field.key] ?? template.defaults?.[field.key] ?? ''])),
    croquisReference: '',
    clientReference: '',
    measurements: template.measurements.map(record => ({ pomCode: record.pomCode, valueCm: null })),
  };
}

export function summarizeIntake(intake, template) {
  const values = new Map(intake.measurements.map(record => [record.pomCode, record.valueCm]));
  const required = template.measurements.filter(record => record.required);
  const missingRequired = required.filter(record => values.get(record.pomCode) === null || values.get(record.pomCode) === undefined).map(record => record.pomCode);
  return {
    total: template.measurements.length,
    measured: intake.measurements.filter(record => record.valueCm !== null).length,
    requiredTotal: required.length,
    requiredMeasured: required.length - missingRequired.length,
    optionalTotal: template.measurements.length - required.length,
    missingRequired,
  };
}

function validDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !date.startsWith('0000') &&
    Number.isFinite(Date.parse(`${date}T00:00:00Z`)) &&
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
}

export function validateIntakeDraft(input, template, { allowEmpty = false, requireComplete = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('A client intake draft is required.');
  const allowed = new Set(['schemaVersion', 'templateId', 'templateRevision', 'unit', 'fields', 'croquisReference', 'clientReference', 'measurements']);
  if (Object.keys(input).some(key => !allowed.has(key))) throw Error('The intake contains an unrecognized field.');
  if (input.schemaVersion !== 1 || input.templateId !== template.templateId || input.templateRevision !== template.revision) {
    throw Error('The intake template or revision does not match this form.');
  }
  requireUnit(input.unit);
  if (!input.fields || typeof input.fields !== 'object' || Array.isArray(input.fields)) throw Error('Client information fields are required.');
  const keys = new Set(template.fields.map(field => field.key));
  if (Object.keys(input.fields).some(key => !keys.has(key))) throw Error('The client information contains an unrecognized field.');
  const draft = createIntakeDraft(template, { unit: input.unit });
  for (const field of template.fields) {
    const value = input.fields[field.key];
    if (typeof value !== 'string' || value.length > 1000) throw Error(`${field.label}: enter text with at most 1000 characters.`);
    draft.fields[field.key] = value.trim();
    if (field.type === 'date' && value.trim() && !validDate(value.trim())) throw Error(`${field.label}: enter a valid date.`);
  }
  for (const key of ['croquisReference', 'clientReference']) {
    if (typeof input[key] !== 'string' || input[key].length > 4000) throw Error('Reference notes must be text with at most 4000 characters.');
    draft[key] = input[key].trim();
  }
  if (!Array.isArray(input.measurements) || input.measurements.length !== template.measurements.length) {
    throw Error(`Include all ${template.measurements.length} POMs; leave unknown measurements blank.`);
  }
  const expected = new Set(template.measurements.map(record => record.pomCode));
  const records = new Map();
  for (const record of input.measurements) {
    if (!record || !expected.has(record.pomCode) || records.has(record.pomCode)) throw Error('The intake contains an unknown or duplicate POM.');
    if (record.valueCm !== null && (typeof record.valueCm !== 'number' || !Number.isFinite(record.valueCm) || record.valueCm < 0)) {
      throw Error(`${record.pomCode}: measurements must be non-negative numbers or blank.`);
    }
    records.set(record.pomCode, record.valueCm);
  }
  for (const record of draft.measurements) record.valueCm = records.get(record.pomCode);
  const entered = draft.measurements.some(record => record.valueCm !== null) ||
    ['clientId', 'clientName', 'projectDescription', 'projectType', 'measuredBy', 'foundationGarments', 'shoesHeel', 'revision', 'page']
      .some(key => draft.fields[key]?.trim()) || draft.croquisReference || draft.clientReference;
  if (!allowEmpty && !entered) throw Error('Enter client information, reference notes, or at least one measurement before saving.');
  if (requireComplete) {
    if (!draft.fields.clientId && !draft.fields.clientName) throw Error('Enter a client ID or client name before the completeness check.');
    if (!draft.fields.measurementDate) throw Error('Enter the measurement date before the completeness check.');
    const summary = summarizeIntake(draft, template);
    if (summary.missingRequired.length) throw Error(`Required measurements still missing: ${summary.missingRequired.join(', ')}.`);
  }
  return draft;
}

export function intakeToCsv(intake, template) {
  const text = value => {
    let string = String(value ?? '');
    if (/^[=+@-]/.test(string.trimStart())) string = `'${string}`;
    return `"${string.replace(/"/g, '""')}"`;
  };
  const metadataHeaders = template.fields.map(field => field.label);
  const headers = [...metadataHeaders, 'Unit', 'POM', 'Critical', 'Body measurement', 'How to measure', 'Client measurement', 'Source method note', 'Croquis reference', 'Client reference'];
  const values = new Map(intake.measurements.map(record => [record.pomCode, record.valueCm]));
  const lines = [headers.map(text).join(',')];
  for (const record of template.measurements) {
    const display = displayClientMeasurement(values.get(record.pomCode), intake.unit);
    const row = [...template.fields.map(field => intake.fields[field.key]), intake.unit, record.pomCode,
      record.required ? 'REQUIRED' : '', record.sourceLabel, record.howToMeasure, display,
      record.methodNeedsConfirmation ? 'Source instruction includes a question; house clarification pending.' : '',
      intake.croquisReference, intake.clientReference];
    lines.push(row.map(text).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}
