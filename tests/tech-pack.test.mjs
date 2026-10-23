import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTechPack, normalizeTechPack, parseMeasure, formatMeasure, difference, csvEncode, serializeTechPack, columnsForRow } from '../src/tech-pack.mjs';

const template = {
  id: 'SR-TECH-PACK-V1', version: 1,
  sheets: [{ id: 'pattern', title: 'Pattern card', fields: [{ key: 'style', label: 'Style' }, { key: 'date', label: 'Date', type: 'date' }],
    tables: [{ id: 'pieces', title: 'Pieces', columns: [{ key: 'pom', label: 'POM', type: 'readonly' }, { key: 'name', label: 'Name', type: 'text' },
      { key: 'qty', label: 'Quantity', type: 'number' }, { key: 'length', label: 'Length', type: 'measurement' },
      { key: 'adjustment', label: 'Adjustment', type: 'measurement', allowNegative: true }, { key: 'delta', label: 'Delta', type: 'calculated' }],
      rows: [{ id: '1', values: { pom: 'BF-01', name: 'SOURCE EXAMPLE', length: 10 } }] }], attachments: [{ key: 'front' }] },
    { id: 'reference', title: 'Reference' }],
};

test('tech-pack drafts remain blank and separate from source examples and approved read-only values', () => {
  const before = structuredClone(template);
  const draft = createTechPack(template);
  assert.equal(draft.unit, null);
  assert.deepEqual(draft.fields.pattern, { style: '', date: '' });
  assert.deepEqual(draft.tables.pattern.pieces['1'], { name: '', qty: null, length: null, adjustment: null });
  assert.deepEqual(draft.attachments.pattern, { front: null });
  assert.deepEqual(draft.fields.reference, {});
  assert.deepEqual(normalizeTechPack(draft, template), draft);
  assert.notEqual(createTechPack(template).id, draft.id);
  assert.deepEqual(template, before);
});

test('canonical measurements preserve explicit zero, negatives only where allowed, and repeated unit display', () => {
  assert.equal(parseMeasure('', 'cm'), null);
  assert.equal(parseMeasure('0', 'in'), 0);
  assert.equal(parseMeasure('.125', 'in'), 0.3175);
  assert.equal(parseMeasure(' 12.7 ', 'cm'), 12.7);
  assert.equal(parseMeasure('-0.5', 'in', { allowNegative: true }), -1.27);
  assert.equal(formatMeasure(null, 'cm'), '');
  assert.equal(formatMeasure(20, 'in'), '7.874016');
  assert.equal(formatMeasure(0, 'cm', true), '0');
  assert.equal(formatMeasure(1, 'cm', true), '+1');
  assert.equal(formatMeasure(-1, 'cm', true), '-1');
  const canonical = parseMeasure('20', 'cm');
  for (let i = 0; i < 20; i++) { assert.equal(formatMeasure(canonical, 'in'), '7.874016'); assert.equal(formatMeasure(canonical, 'cm'), '20'); }
  for (const bad of ['1/2', '1e2', '0x10', 'NaN', '-1', Infinity, undefined, true, [], {}]) assert.throws(() => parseMeasure(bad, 'cm'));
  assert.throws(() => parseMeasure('10', null));
  assert.throws(() => formatMeasure(10, 'CM'));
});

test('source subtraction semantics distinguish blanks, measured zero, and signed results', () => {
  assert.equal(difference(null, 0), null);
  assert.equal(difference(1, undefined), null);
  assert.equal(difference(0, 0), 0);
  assert.equal(difference(10, 12), -2);
  assert.equal(difference(12, 10), 2);
  assert.equal(difference(0.3, 0.1), 0.2);
  assert.throws(() => difference('10', 2));
});

test('imports validate known template shape, units, numbers, dates, immutable columns, and unsafe keys', () => {
  for (const edit of [
    d => { d.extra = 'unrecognized'; }, d => { d.schemaVersion = 3; }, d => { d.templateId = 'other'; },
    d => { d.id = '../../unsafe'; }, d => { d.title = 'x'.repeat(241); }, d => { d.updatedAt = '2026-02-30T00:00:00.000Z'; },
    d => { d.unit = 'CM'; }, d => { d.fields.pattern.date = '2026-02-30'; }, d => { d.fields.pattern.style = 1; },
    d => { d.fields.pattern.unknown = ''; }, d => { delete d.fields.pattern.style; }, d => { d.tables.pattern.pieces['1'].length = 10; },
    d => { d.tables.pattern.pieces['1'].qty = -1; }, d => { d.tables.pattern.pieces['1'].qty = NaN; },
    d => { d.tables.pattern.pieces['1'].name = 'x'.repeat(4001); }, d => { d.tables.pattern.pieces['1'].delta = 10; },
    d => { d.tables.pattern.pieces['2'] = {}; }, d => { d.attachments.pattern.unknown = null; },
    d => { Object.assign(d, JSON.parse('{"__proto__":{"polluted":true}}')); },
  ]) {
    const draft = createTechPack(template); edit(draft);
    assert.throws(() => normalizeTechPack(draft, template));
  }
  const draft = createTechPack(template);
  draft.unit = 'in'; draft.tables.pattern.pieces['1'].length = 20; draft.tables.pattern.pieces['1'].adjustment = -2;
  const normalized = normalizeTechPack(draft, template);
  assert.equal(normalized.tables.pattern.pieces['1'].length, 20);
  normalized.fields.pattern.style = 'independent';
  assert.equal(draft.fields.pattern.style, '');
  assert.deepEqual(normalizeTechPack(JSON.parse(serializeTechPack(draft)), template), draft);
});

test('reference image imports accept embedded raster slots and reject arbitrary URLs and active formats', () => {
  const draft = createTechPack(template);
  draft.attachments.pattern.front = { name: 'reference.png', type: 'image/png', dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0QAAAABJRU5ErkJggg==' };
  assert.deepEqual(normalizeTechPack(draft, template).attachments.pattern.front, draft.attachments.pattern.front);
  for (const attachment of [
    { name: 'bad.svg', type: 'image/svg+xml', dataUrl: 'data:image/svg+xml;base64,AAAA' },
    { name: 'remote.png', type: 'image/png', dataUrl: 'https://example.com/image.png' },
    { name: 'bad.png', type: 'image/png', dataUrl: 'data:image/png;base64,invalid%%%==' },
    { name: 'wrong-format.png', type: 'image/png', dataUrl: 'data:image/png;base64,AAAA' },
    { name: 'extra.png', type: 'image/png', dataUrl: 'data:image/png;base64,AAAA', script: 'unexpected' },
  ]) {
    draft.attachments.pattern.front = attachment;
    assert.throws(() => normalizeTechPack(draft, template));
  }
});

test('CSV quotes complete cell content and prevents formula injection without changing numeric negatives', () => {
  const csv = csvEncode([['POM', 'Note', 'Delta'], ['BF-01', '=HYPERLINK("bad")', -2], ['BF-02', ' \t+SUM(1,2)', null],
    ['BF-03', '@command', 'line one\nline two'], ['BF-04', '-dangerous text', 'plain, "quoted"']]);
  assert.ok(csv.startsWith('"POM","Note","Delta"\r\n'));
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")","-2"'));
  assert.ok(csv.includes('"\' \t+SUM(1,2)"'));
  assert.ok(csv.includes('"\'@command"'));
  assert.ok(csv.includes('"line one\nline two"'));
  assert.ok(csv.includes('"plain, ""quoted"""'));
  assert.throws(() => csvEncode([{}]));
});

test('the actual six-tab workbook schema produces compatible blank snapshots without source sample specs', async () => {
  const actual = JSON.parse(await readFile(new URL('../data/templates/tech-pack-workbook.v1.json', import.meta.url), 'utf8'));
  const draft = createTechPack(actual);
  assert.equal(actual.sheets.length, 6);
  assert.deepEqual(normalizeTechPack(draft, actual), draft);
  for (const sheet of Object.values(draft.tables)) for (const table of Object.values(sheet)) {
    for (const row of Object.values(table)) assert.ok(Object.values(row).every(value => value === null || value === ''));
  }
  const referenceRow = actual.sheets.find(sheet => sheet.id === 'body').tables.find(table => table.id === 'referenceNotes').rows[0].id;
  draft.tables.body.referenceNotes[referenceRow].houseTarget = 90;
  assert.equal(normalizeTechPack(draft, actual).tables.body.referenceNotes[referenceRow].houseTarget, 90,
    'Canonical optional house targets use the separate reference unit selector.');
  const garmentSheet = actual.sheets.find(sheet => !sheet.reference && sheet.tables?.some(table => table.columns.some(column => column.type === 'measurement')));
  const garmentTable = garmentSheet.tables.find(table => table.columns.some(column => column.type === 'measurement'));
  const garmentColumn = garmentTable.columns.find(column => column.type === 'measurement');
  draft.tables[garmentSheet.id][garmentTable.id][garmentTable.rows[0].id][garmentColumn.key] = 10;
  assert.throws(() => normalizeTechPack(draft, actual), /garment measurements must specify/);
  draft.tables[garmentSheet.id][garmentTable.id][garmentTable.rows[0].id][garmentColumn.key] = null;
  draft.fields.pattern.date = '2026-02-30';
  assert.throws(() => normalizeTechPack(draft, actual), /valid date/);
});

test('manual wash difference cells remain editable while neighboring source formulas cannot be overwritten', async () => {
  const actual = JSON.parse(await readFile(new URL('../data/templates/tech-pack-workbook.v1.json', import.meta.url), 'utf8'));
  const table = actual.sheets.find(sheet => sheet.id === 'wash').tables.find(item => item.id === 'measurements');
  const before = structuredClone(table);
  const draft = createTechPack(actual);
  draft.unit = 'cm';
  for (const rowId of ['30', '31']) {
    const row = table.rows.find(item => item.id === rowId);
    const columns = columnsForRow(table, row);
    for (const key of ['adelta', 'bdelta']) {
      const column = columns.find(item => item.key === key);
      assert.equal(column.type, 'measurement');
      assert.equal(column.allowNegative, true);
      assert.equal(column.formula, null);
      assert.equal(draft.tables.wash.measurements[rowId][key], null);
      draft.tables.wash.measurements[rowId][key] = -2;
      assert.equal(normalizeTechPack(draft, actual).tables.wash.measurements[rowId][key], -2);
    }
  }
  assert.ok(!Object.hasOwn(draft.tables.wash.measurements['1'], 'adelta'));
  draft.tables.wash.measurements['1'].adelta = -2;
  assert.throws(() => normalizeTechPack(draft, actual), /known template fields/);
  assert.deepEqual(table, before, 'Resolving a per-row manual override must not mutate the controlled schema.');
});
