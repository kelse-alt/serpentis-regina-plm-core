/** Local tech-pack draft data. Measurements are canonical centimetres. */
const MAX_NUMBER = 1e9;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const EDITABLE_TYPES = new Set(['text', 'number', 'measurement']);

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error(`${label} must be an object.`);
  if (Object.keys(value).some(key => UNSAFE_KEYS.has(key))) throw Error(`${label} contains an unsafe key.`);
  return value;
}

function exactKeys(value, keys, label) {
  object(value, label);
  const expected = new Set(keys);
  if (Object.keys(value).length !== expected.size || Object.keys(value).some(key => !expected.has(key))) {
    throw Error(`${label} must contain exactly the known template fields.`);
  }
}

function editable(definition) {
  return !definition.readonly && !['readonly', 'calculated'].includes(definition.type);
}

/** A source row can contain manual cells where the surrounding column has formulas. */
export function columnsForRow(table, row) {
  return (table.columns ?? []).map(column => ({ ...column, ...row.columnOverrides?.[column.key], key: column.key }));
}

function editableColumns(table, row) {
  return columnsForRow(table, row).filter(column => editable(column) && EDITABLE_TYPES.has(column.type ?? 'text'));
}

function text(value, label, max = 2000) {
  if (typeof value !== 'string' || value.length > max || value.includes('\0')) throw Error(`${label} must be text of at most ${max} characters.`);
  return value;
}

function numeric(value, label, allowNegative = false) {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > MAX_NUMBER || (!allowNegative && value < 0)) {
    throw Error(`${label} must be ${allowNegative ? 'a finite' : 'a non-negative'} number or blank.`);
  }
  return Object.is(value, -0) ? 0 : value;
}

function requireUnit(unit) {
  if (!['cm', 'in'].includes(unit)) throw Error('Choose CM or IN before entering measurements.');
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !value.startsWith('0000') &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `pack-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Create a blank local draft, never copying source examples into editable specs. */
export function createTechPack(template) {
  const pack = {
    schemaVersion: 1, templateId: template.id, id: newId(), title: 'Untitled tech pack', unit: null,
    fields: {}, tables: {}, attachments: {}, updatedAt: new Date().toISOString(),
  };
  for (const sheet of template.sheets) {
    pack.fields[sheet.id] = Object.fromEntries((sheet.fields ?? []).filter(editable).map(field => [field.key, '']));
    pack.tables[sheet.id] = Object.fromEntries((sheet.tables ?? []).map(table => [table.id,
      Object.fromEntries((table.rows ?? []).map(row => [row.id,
        Object.fromEntries(editableColumns(table, row).map(column => [column.key, ['measurement', 'number'].includes(column.type) ? null : '']))]))]));
    pack.attachments[sheet.id] = Object.fromEntries((sheet.attachments ?? []).map(slot => [slot.key, null]));
  }
  return pack;
}

/** Validate an imported snapshot against the controlled schema; no arbitrary fields survive. */
export function normalizeTechPack(input, template) {
  exactKeys(input, ['schemaVersion', 'templateId', 'id', 'title', 'unit', 'fields', 'tables', 'attachments', 'updatedAt'], 'Tech pack');
  if (input.schemaVersion !== 1 || input.templateId !== template.id) throw Error('This tech-pack template or version is not compatible.');
  if (input.unit !== null) requireUnit(input.unit);
  const id = text(input.id, 'Pack ID', 128);
  if (!/^[\w-]{1,128}$/.test(id)) throw Error('Pack ID contains unsupported characters.');
  const title = text(input.title, 'Pack title', 240);
  if (typeof input.updatedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(input.updatedAt) ||
      !Number.isFinite(Date.parse(input.updatedAt)) || new Date(input.updatedAt).toISOString() !== input.updatedAt) throw Error('The draft update time is invalid.');
  const sheetIds = template.sheets.map(sheet => sheet.id);
  for (const key of ['fields', 'tables', 'attachments']) exactKeys(input[key], sheetIds, key);
  const result = createTechPack(template);
  Object.assign(result, { id, title, unit: input.unit, updatedAt: input.updatedAt });
  let attachmentCount = 0;
  for (const sheet of template.sheets) {
    const fields = (sheet.fields ?? []).filter(editable);
    exactKeys(input.fields[sheet.id], fields.map(field => field.key), `${sheet.title} fields`);
    for (const field of fields) {
      const value = text(input.fields[sheet.id][field.key], field.label, field.maxLength ?? (field.multiline || ['textarea', 'note'].includes(field.type) ? 10000 : 2000));
      if ((field.type === 'date' || field.inputType === 'date') && value && !validDate(value)) throw Error(`${field.label}: enter a valid date.`);
      result.fields[sheet.id][field.key] = value;
    }
    const tables = sheet.tables ?? [];
    exactKeys(input.tables[sheet.id], tables.map(table => table.id), `${sheet.title} tables`);
    for (const table of tables) {
      exactKeys(input.tables[sheet.id][table.id], table.rows.map(row => row.id), `${table.title} rows`);
      for (const row of table.rows) {
        const columns = editableColumns(table, row);
        const values = input.tables[sheet.id][table.id][row.id];
        exactKeys(values, columns.map(column => column.key), `${table.title} ${row.id}`);
        for (const column of columns) {
          const label = `${table.title} ${row.id} ${column.label}`;
          const value = ['measurement', 'number'].includes(column.type)
            ? numeric(values[column.key], label, column.allowNegative === true)
            : text(values[column.key], label, column.maxLength ?? 4000);
          if (column.type === 'measurement' && value !== null && input.unit === null && !sheet.reference) throw Error('A draft with garment measurements must specify CM or IN.');
          result.tables[sheet.id][table.id][row.id][column.key] = value;
        }
      }
    }
    const slots = sheet.attachments ?? [];
    exactKeys(input.attachments[sheet.id], slots.map(slot => slot.key), `${sheet.title} image slots`);
    for (const slot of slots) {
      const attachment = input.attachments[sheet.id][slot.key];
      if (attachment === null) continue;
      if (++attachmentCount > 12) throw Error('A draft can contain at most 12 reference images.');
      exactKeys(attachment, ['name', 'type', 'dataUrl'], `${slot.key} image`);
      const name = text(attachment.name, 'Image filename', 255);
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(attachment.type)) throw Error('Reference images must be PNG, JPEG, or WebP.');
      const prefix = `data:${attachment.type};base64,`;
      if (typeof attachment.dataUrl !== 'string' || !attachment.dataUrl.startsWith(prefix)) throw Error('Reference images must be embedded image data.');
      const encoded = attachment.dataUrl.slice(prefix.length);
      if (!encoded || encoded.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 || encoded.length % 4 !== 0 ||
          !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw Error('Reference images must contain valid base64 data no larger than 5 MB.');
      const bytes = encoded.length / 4 * 3 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
      if (bytes > MAX_IMAGE_BYTES) throw Error('Each reference image must be no larger than 5 MB.');
      const header = globalThis.atob(encoded.slice(0, 32));
      const validHeader = attachment.type === 'image/png' ? header.startsWith('\x89PNG\r\n\x1a\n')
        : attachment.type === 'image/jpeg' ? header.startsWith('\xff\xd8\xff')
        : header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP';
      if (!validHeader) throw Error('The reference image data does not match its image type.');
      result.attachments[sheet.id][slot.key] = { name, type: attachment.type, dataUrl: attachment.dataUrl };
    }
  }
  return result;
}

/** Parse only decimal text; an empty field is missing, never zero. */
export function parseMeasure(value, unit, { allowNegative = false } = {}) {
  requireUnit(unit);
  if (value === null || (typeof value === 'string' && !value.trim())) return null;
  if (typeof value === 'string') {
    const pattern = allowNegative ? /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/ : /^\+?(?:\d+(?:\.\d*)?|\.\d+)$/;
    if (!pattern.test(value.trim())) throw Error('Enter a decimal measurement, or leave the field blank.');
    value = Number(value.trim());
  }
  numeric(value, 'Measurement', allowNegative);
  return numeric(value * (unit === 'in' ? 2.54 : 1), 'Measurement', allowNegative);
}

/** Formatting never writes rounded display values back into a draft. */
export function formatMeasure(valueCm, unit, signed = false) {
  requireUnit(unit);
  if (valueCm === null) return '';
  numeric(valueCm, 'Stored measurement', true);
  const displayed = Number((valueCm / (unit === 'in' ? 2.54 : 1)).toFixed(6));
  return `${signed && displayed > 0 ? '+' : ''}${displayed}`;
}

/** Missing operands stay missing; a measured zero is valid. */
export function difference(left, right) {
  if (left === null || right === null || left === undefined || right === undefined) return null;
  numeric(left, 'Left operand', true);
  numeric(right, 'Right operand', true);
  return Number((left - right).toFixed(12));
}

/** Spreadsheet-safe CSV: text beginning with formula syntax is prefixed with an apostrophe. */
export function csvEncode(rows) {
  if (!Array.isArray(rows) || rows.some(row => !Array.isArray(row))) throw Error('CSV rows must be arrays.');
  return rows.map(row => row.map(value => {
    let cell = String(value ?? '');
    if (typeof value !== 'number' && /^[\s\uFEFF]*[=+@-]/u.test(cell)) cell = `'${cell}`;
    return `"${cell.replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n') + '\r\n';
}

export function serializeTechPack(pack) {
  return JSON.stringify(pack, null, 2) + '\n';
}
