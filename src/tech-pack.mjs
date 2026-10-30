/** Local tech-pack draft data. Measurements are canonical centimetres. */
import { normalizeDevelopment } from './garment-development.mjs';
const MAX_NUMBER = 1e9;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const EDITABLE_TYPES = new Set(['text', 'number', 'measurement']);
const STYLE_KEYS = ['number', 'description', 'category', 'season', 'baseSize', 'sampleSize', 'maker', 'patternRevision', 'owner', 'fabric'];
const SHARED_FIELDS = {
  pattern: { style: 'number', styleNumber: 'number', size: 'baseSize', fabric: 'fabric' },
  wash: { style: 'number', description: 'description', fabric: 'fabric', asampleSize: 'sampleSize', bsampleSize: 'sampleSize', aseason: 'season', bseason: 'season' },
  fit: { style: 'number', description: 'description', fabric: 'fabric', sampleSize: 'sampleSize', season: 'season' },
  graded: { style: 'number', description: 'description', selfFabric: 'fabric' },
  master: { style: 'number', description: 'description', category: 'category', season: 'season', sampleSize: 'sampleSize', fabric: 'fabric', maker: 'maker' },
};

/** Only fields with the same garment meaning inherit shared style defaults. */
export function sharedStyleKey(sheetId, fieldKey) {
  return Object.hasOwn(SHARED_FIELDS, sheetId) && Object.hasOwn(SHARED_FIELDS[sheetId], fieldKey)
    ? SHARED_FIELDS[sheetId][fieldKey] : null;
}

function hasText(value) { return typeof value === 'string' && value.trim() !== ''; }

/** Explicit sheet values win; blank fields inherit without changing stored data. */
export function resolveFieldValue(pack, sheet, field) {
  const sheetId = typeof sheet === 'string' ? sheet : sheet.id;
  const fieldKey = typeof field === 'string' ? field : field.key;
  if (sheetId === 'fit' && fieldKey === 'style') {
    const linked = pack.fields.pattern?.style;
    return hasText(linked) ? linked : pack.style?.number ?? '';
  }
  const local = pack.fields[sheetId]?.[fieldKey];
  if (hasText(local)) return local;
  const key = sharedStyleKey(sheetId, fieldKey);
  return key ? pack.style?.[key] ?? '' : local ?? '';
}

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
    schemaVersion: 2, templateId: template.id, id: newId(), title: 'Untitled tech pack', unit: null,
    style: Object.fromEntries(STYLE_KEYS.map(key => [key, ''])),
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

/** Read old single-image references and current galleries without rewriting either. */
export function patternReferenceImages(pack) {
  const reference = pack.attachments?.pattern?.reference;
  return reference ? (Array.isArray(reference.images) ? reference.images : [reference]) : [];
}

/** The current gallery selection is shared by the Pattern Card and pinned panel. */
export function selectedPatternReference(pack) {
  const reference = pack.attachments?.pattern?.reference;
  return patternReferenceImages(pack)[reference?.selectedIndex ?? 0] ?? null;
}

function validateImage(attachment, label) {
  exactKeys(attachment, ['name', 'type', 'dataUrl'], `${label} image`);
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
  return { name, type: attachment.type, dataUrl: attachment.dataUrl };
}

/** Validate either known schema before migrating; no arbitrary fields survive. */
function validateTechPack(input, template, version) {
  const keys = ['schemaVersion', 'templateId', 'id', 'title', 'unit', 'fields', 'tables', 'attachments', 'updatedAt'];
  exactKeys(input, version === 3 ? [...keys, 'style', 'development'] : version === 2 ? [...keys, 'style'] : keys, 'Tech pack');
  if (input.schemaVersion !== version || input.templateId !== template.id) throw Error('This tech-pack template or version is not compatible.');
  if (input.unit !== null) requireUnit(input.unit);
  const id = text(input.id, 'Pack ID', 128);
  if (!/^[\w-]{1,128}$/.test(id)) throw Error('Pack ID contains unsupported characters.');
  const title = text(input.title, 'Pack title', 240);
  if (typeof input.updatedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(input.updatedAt) ||
      !Number.isFinite(Date.parse(input.updatedAt)) || new Date(input.updatedAt).toISOString() !== input.updatedAt) throw Error('The draft update time is invalid.');
  const sheetIds = template.sheets.map(sheet => sheet.id);
  for (const key of ['fields', 'tables', 'attachments']) exactKeys(input[key], sheetIds, key);
  const result = createTechPack(template);
  result.schemaVersion = version;
  if (version === 1) delete result.style;
  else {
    exactKeys(input.style, STYLE_KEYS, 'Shared style');
    for (const key of STYLE_KEYS) result.style[key] = text(input.style[key], `Style ${key}`, key === 'description' ? 4000 : 2000);
  }
  Object.assign(result, { id, title, unit: input.unit, updatedAt: input.updatedAt });
  if (version === 3) result.development = normalizeDevelopment(input.development, input.unit);
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
      if (version >= 2 && sheet.id === 'pattern' && slot.key === 'reference' && Object.hasOwn(attachment, 'images')) {
        exactKeys(attachment, ['images', 'selectedIndex'], 'Pattern reference gallery');
        if (!Array.isArray(attachment.images) || !attachment.images.length || attachment.images.length > 12) throw Error('A Pattern Card gallery must contain between 1 and 12 reference images.');
        if (!Number.isInteger(attachment.selectedIndex) || attachment.selectedIndex < 0 || attachment.selectedIndex >= attachment.images.length) throw Error('The selected gallery image is unavailable.');
        attachmentCount += attachment.images.length;
        result.attachments[sheet.id][slot.key] = {
          images: attachment.images.map((image, index) => validateImage(image, `Pattern reference ${index + 1}`)),
          selectedIndex: attachment.selectedIndex,
        };
      } else {
        attachmentCount++;
        result.attachments[sheet.id][slot.key] = validateImage(attachment, slot.key);
      }
      if (attachmentCount > 12) throw Error('A draft can contain at most 12 reference images across all sheets.');
    }
  }
  return result;
}

/** Migrate known v1 drafts without changing their existing fields or measurements. */
export function migrateTechPack(input, template) {
  object(input, 'Tech pack');
  if (input.schemaVersion === 3) return validateTechPack(input, template, 3);
  if (input.schemaVersion === 2) return validateTechPack(input, template, 2);
  if (input.schemaVersion !== 1) throw Error('This tech-pack template or version is not compatible.');
  const legacy = validateTechPack(input, template, 1);
  const migrated = { ...legacy, schemaVersion: 2, style: Object.fromEntries(STYLE_KEYS.map(key => [key, ''])) };
  const get = (sheet, key) => legacy.fields[sheet]?.[key];
  const unique = values => [...new Set(values.filter(hasText).map(value => value.trim()))];
  const prefer = (primary, fallback = []) => hasText(primary) ? primary.trim() : unique(fallback).length === 1 ? unique(fallback)[0] : '';
  // Conflicting Pattern Card style/pattern identifiers stay explicit, not guessed.
  const patternNumbers = unique([get('pattern', 'styleNumber'), get('pattern', 'style')]);
  migrated.style.number = patternNumbers.length === 1 ? patternNumbers[0] : patternNumbers.length > 1 ? ''
    : prefer(get('master', 'style'), [get('wash', 'style'), get('graded', 'style')]);
  migrated.style.description = prefer(get('master', 'description'), [get('wash', 'description'), get('fit', 'description'), get('graded', 'description')]);
  migrated.style.category = prefer(get('master', 'category'));
  migrated.style.season = prefer(get('master', 'season'), [get('fit', 'season')]);
  migrated.style.baseSize = prefer(get('pattern', 'size'));
  migrated.style.sampleSize = prefer(get('master', 'sampleSize'), [get('fit', 'sampleSize')]);
  migrated.style.maker = prefer(get('master', 'maker'));
  migrated.style.fabric = prefer(get('pattern', 'fabric'), [get('master', 'fabric'), get('wash', 'fabric'), get('fit', 'fabric'), get('graded', 'selfFabric')]);
  // Owner and pattern revision have no unambiguous predecessor fields.
  return migrated;
}

/** Return a validated independent current-schema draft, accepting known v1 input. */
export function normalizeTechPack(input, template) {
  return migrateTechPack(input, template);
}

function attachmentSummary(attachment) {
  if (!attachment) return null;
  if (Array.isArray(attachment.images)) return { images: attachment.images.map(attachmentSummary), selectedIndex: attachment.selectedIndex };
  const encoded = attachment.dataUrl ?? '';
  let hash = 2166136261;
  for (let index = 0; index < encoded.length; index++) hash = Math.imul(hash ^ encoded.charCodeAt(index), 16777619) >>> 0;
  const payload = encoded.slice(encoded.indexOf(',') + 1);
  const bytes = payload.length / 4 * 3 - (payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0);
  return { name: attachment.name, type: attachment.type, bytes, contentFingerprint: hash.toString(16).padStart(8, '0') };
}

/** Human-readable change records; image content is represented by compact metadata. */
export function compareTechPacks(before, after) {
  const flatten = pack => {
    const values = new Map();
    const visit = (value, path) => {
      if (value !== null && typeof value === 'object') {
        for (const key of Object.keys(value).sort()) visit(value[key], `${path}.${key}`);
      } else values.set(path, value);
    };
    for (const key of ['title', 'unit', 'style', 'fields', 'tables', 'development']) visit(pack[key] ?? null, key);
    for (const [sheetId, slots] of Object.entries(pack.attachments ?? {})) {
      for (const [key, attachment] of Object.entries(slots)) values.set(`attachments.${sheetId}.${key}`, attachmentSummary(attachment));
    }
    return values;
  };
  const left = flatten(before), right = flatten(after), changes = [];
  for (const path of [...new Set([...left.keys(), ...right.keys()])].sort()) {
    const oldValue = left.get(path) ?? null, newValue = right.get(path) ?? null;
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) changes.push({ path, before: oldValue, after: newValue });
  }
  return changes;
}

/** Decimals in either unit; tape-measure fractions in inches only. */
export function parseMeasure(value, unit, { allowNegative = false } = {}) {
  requireUnit(unit);
  if (value === null || (typeof value === 'string' && !value.trim())) return null;
  if (typeof value === 'string') {
    const pattern = allowNegative ? /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/ : /^\+?(?:\d+(?:\.\d*)?|\.\d+)$/;
    const entered = value.trim();
    if (pattern.test(entered)) value = Number(entered);
    else {
      const fraction = unit === 'in' && entered.match(/^([+-]?)(?:(\d+)\s+)?(\d+)\/(\d+)$/);
      if (!fraction || (!allowNegative && fraction[1] === '-')) throw Error(unit === 'in' ? 'Enter a decimal or fraction such as 24 3/8, or leave the field blank.' : 'Enter a decimal measurement, or leave the field blank.');
      const whole = Number(fraction[2] ?? 0), numerator = Number(fraction[3]), denominator = Number(fraction[4]);
      if (![whole, numerator, denominator].every(Number.isSafeInteger) || !denominator || (fraction[2] !== undefined && numerator >= denominator)) throw Error('Enter a valid fraction with a nonzero denominator.');
      value = (whole + numerator / denominator) * (fraction[1] === '-' ? -1 : 1);
    }
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
