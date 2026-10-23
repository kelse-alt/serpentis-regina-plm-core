import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTechPack } from '../src/tech-pack.mjs';
import { parseGridClipboard, previewGridPaste, applyGridPaste, createEditHistory } from '../src/workroom-editing.mjs';

const gridTemplate = {
  id: 'GRID-EDITING-TEST', version: 1,
  sheets: [
    { id: 'spec', title: 'Garment specs', tables: [{ id: 'measurements', title: 'Measurements',
      columns: [
        { key: 'line', label: 'Line', type: 'readonly' },
        { key: 'name', label: 'POM description', type: 'text' },
        { key: 'length', label: 'Sample measurement', type: 'measurement' },
        { key: 'delta', label: 'Delta', type: 'calculated' },
        { key: 'adjustment', label: 'Adjustment', type: 'measurement', allowNegative: true },
        { key: 'quantity', label: 'Quantity', type: 'number' },
        { key: 'note', label: 'Action note', type: 'text', maxLength: 20 },
      ],
      rows: [{ id: '1', values: { line: '1' } },
        { id: '2', values: { line: '2' }, columnOverrides: { delta: { type: 'measurement', allowNegative: true } } },
        { id: '3', values: { line: '3' } }],
    }], attachments: [{ key: 'front' }] },
    { id: 'body', title: 'Body notes', reference: true, tables: [{ id: 'notes', title: 'Local target notes',
      columns: [{ key: 'pom', label: 'POM', type: 'readonly' }, { key: 'target', label: 'Local target', type: 'measurement' }],
      rows: [{ id: 'BF-01', values: { pom: 'BF-01' } }],
    }] },
  ],
};

function gridDraft(unit = 'in') {
  const pack = createTechPack(gridTemplate);
  pack.unit = unit;
  return pack;
}

const gridAnchor = { sheetId: 'spec', tableId: 'measurements', rowId: '1', columnKey: 'length' };

test('spreadsheet clipboard parsing preserves quoted tabs, newlines, quotes and blank cells', () => {
  assert.deepEqual(parseGridClipboard('"half\tchest"\t24\r\n"line\nbreak"\t0\r\n'),
    [['half\tchest', '24'], ['line\nbreak', '0']]);
  assert.deepEqual(parseGridClipboard('"he said ""check"""\t\n\t'), [['he said "check"', ''], ['', '']]);
  assert.deepEqual(parseGridClipboard(''), [['']]);
  for (const [text, expression] of [
    ['1\t2\n3', /row 2.*2 columns/], ['"unclosed', /close the quoted cell/],
    ['"closed"tail', /unexpected text/], ['x'.repeat(1_000_001), /smaller range/],
  ]) assert.throws(() => parseGridClipboard(text), expression);
});

test('reviewed mixed-inch ranges convert once, skip locked fields and preserve zero without mutating inputs', () => {
  const pack = gridDraft(), before = structuredClone(pack), source = structuredClone(gridTemplate);
  const preview = previewGridPaste(pack, gridTemplate, { ...gridAnchor,
    text: '24 3/8\t-1/2\t0\n24 1/4\t0\t2' });
  assert.deepEqual(preview.columnKeys, ['length', 'adjustment', 'quantity']);
  assert.deepEqual(preview.rowIds, ['1', '2']);
  assert.equal(preview.changes.length, 6);
  const next = applyGridPaste(pack, gridTemplate, preview);
  assert.equal(next.tables.spec.measurements['1'].length, 61.9125);
  assert.equal(next.tables.spec.measurements['1'].adjustment, -1.27);
  assert.equal(next.tables.spec.measurements['1'].quantity, 0);
  assert.equal(next.tables.spec.measurements['2'].length, 61.595);
  assert.equal(next.tables.spec.measurements['2'].adjustment, 0);
  assert.equal(next.tables.spec.measurements['2'].quantity, 2);
  assert.equal(next.tables.spec.measurements['2'].delta, null, 'A manual exception must not shift the other pasted destinations.');
  assert.deepEqual(pack, before);
  assert.deepEqual(gridTemplate, source);
});

test('paste is all-or-nothing for invalid numbers, dimensions, hidden anchors and text limits', () => {
  const pack = gridDraft(), before = structuredClone(pack);
  const attempts = [
    [{ ...gridAnchor, text: '1\t0\t2\n2\t0\tbad' }, /row 2, column 3.*Quantity/],
    [{ ...gridAnchor, rowId: '3', text: '1\n2' }, /row 2.*beyond.*rows/],
    [{ ...gridAnchor, columnKey: 'note', text: 'a\tb' }, /column 2.*beyond/],
    [{ ...gridAnchor, columnKey: 'line', text: '1' }, /locked/],
    [{ ...gridAnchor, columnKey: 'delta', text: '1' }, /locked/],
    [{ ...gridAnchor, columnKeys: ['quantity'], text: '1' }, /hidden/],
    [{ ...gridAnchor, columnKeys: ['length', 'length'], text: '1' }, /visible columns/],
    [{ ...gridAnchor, columnKeys: ['not-a-column'], text: '1' }, /visible columns/],
    [{ ...gridAnchor, columnKey: 'note', text: 'x'.repeat(21) }, /row 1, column 1.*20 characters/],
    [{ ...gridAnchor, columnKey: 'quantity', text: '1/2' }, /row 1, column 1.*Quantity/],
  ];
  for (const [options, expression] of attempts) assert.throws(() => previewGridPaste(pack, gridTemplate, options), expression);
  assert.deepEqual(pack, before);
  assert.throws(() => previewGridPaste(gridDraft(null), gridTemplate, { ...gridAnchor, text: '1' }), /Choose CM or IN/);
  assert.throws(() => previewGridPaste(gridDraft('cm'), gridTemplate, { ...gridAnchor, text: '1/2' }), /row 1, column 1/);
});

test('paste honors visible source-order columns and rows, and blank values stay distinct from zero', () => {
  const pack = gridDraft();
  pack.tables.spec.measurements['1'].length = 12.7;
  const preview = previewGridPaste(pack, gridTemplate, { ...gridAnchor,
    text: '\tfirst\n0\tthird', columnKeys: ['note', 'length'], rowIds: ['3', '1'] });
  assert.deepEqual(preview.columnKeys, ['length', 'note']);
  assert.deepEqual(preview.rowIds, ['1', '3']);
  const next = applyGridPaste(pack, gridTemplate, preview);
  assert.equal(next.tables.spec.measurements['1'].length, null);
  assert.equal(next.tables.spec.measurements['1'].note, 'first');
  assert.equal(next.tables.spec.measurements['3'].length, 0);
  assert.equal(next.tables.spec.measurements['3'].note, 'third');
  assert.equal(next.tables.spec.measurements['2'].note, '');
  const blank = gridDraft(null);
  const noteOnly = previewGridPaste(blank, gridTemplate, { ...gridAnchor, columnKey: 'note', text: 'Ready to measure' });
  assert.equal(applyGridPaste(blank, gridTemplate, noteOnly).tables.spec.measurements['1'].note, 'Ready to measure');
});

test('applying a preview refuses stale unit, draft, or target values and validates every destination', () => {
  const pack = gridDraft();
  const preview = previewGridPaste(pack, gridTemplate, { ...gridAnchor, text: '10' });
  const other = gridDraft();
  assert.throws(() => applyGridPaste(other, gridTemplate, preview), /another draft/);
  const unitChanged = structuredClone(pack); unitChanged.unit = 'cm';
  assert.throws(() => applyGridPaste(unitChanged, gridTemplate, preview), /another draft or unit/);
  const changed = structuredClone(pack); changed.tables.spec.measurements['1'].length = 30;
  assert.throws(() => applyGridPaste(changed, gridTemplate, preview), /changed after/);
  const unrelated = structuredClone(pack); unrelated.tables.spec.measurements['3'].note = 'other work';
  assert.equal(applyGridPaste(unrelated, gridTemplate, preview).tables.spec.measurements['3'].note, 'other work');
  const forged = structuredClone(preview);
  forged.changes.push({ rowId: '1', columnKey: 'line', before: null, after: 'bad' });
  assert.throws(() => applyGridPaste(pack, gridTemplate, forged), /locked/);
  const duplicate = structuredClone(preview); duplicate.changes.push({ ...duplicate.changes[0] });
  assert.throws(() => applyGridPaste(pack, gridTemplate, duplicate), /duplicated/);
  const negative = structuredClone(preview); negative.changes[0].after = -1;
  assert.throws(() => applyGridPaste(pack, gridTemplate, negative), /non-negative/);
  assert.equal(pack.tables.spec.measurements['1'].length, null, 'Rejected application must leave the draft untouched.');
});

test('local reference-note paste uses its own display unit and never writes approved reference columns', () => {
  const pack = gridDraft(null);
  const preview = previewGridPaste(pack, gridTemplate, {
    sheetId: 'body', tableId: 'notes', rowId: 'BF-01', columnKey: 'target', text: '35 1/2', unit: 'in',
  });
  const next = applyGridPaste(pack, gridTemplate, preview, { unit: 'in' });
  assert.equal(next.tables.body.notes['BF-01'].target, 90.17);
  assert.equal(next.unit, null);
  assert.throws(() => applyGridPaste(pack, gridTemplate, preview, { unit: 'cm' }), /display unit changed/);
  assert.throws(() => previewGridPaste(pack, gridTemplate, {
    sheetId: 'body', tableId: 'notes', rowId: 'BF-01', columnKey: 'pom', text: 'changed', unit: 'in',
  }), /locked/);
});

test('actual wash manual-delta cells remain pasteable without exposing neighboring calculated deltas', async () => {
  const template = JSON.parse(await readFile(new URL('../data/templates/tech-pack-workbook.v1.json', import.meta.url), 'utf8'));
  const pack = createTechPack(template); pack.unit = 'in';
  const before = structuredClone(template);
  const options = { sheetId: 'wash', tableId: 'measurements', rowId: '30', columnKey: 'adelta',
    columnKeys: ['adelta'], text: '-1/2\n-1' };
  const preview = previewGridPaste(pack, template, options);
  const next = applyGridPaste(pack, template, preview);
  assert.equal(next.tables.wash.measurements['30'].adelta, -1.27);
  assert.equal(next.tables.wash.measurements['31'].adelta, -2.54);
  assert.throws(() => previewGridPaste(pack, template, { ...options, text: '-1/2\n-1\n-2' }), /row 3, column 1.*locked/);
  assert.throws(() => previewGridPaste(pack, template, { ...options, rowId: '29', text: '-1' }), /locked/);
  assert.ok(!Object.hasOwn(pack.tables.wash.measurements['29'], 'adelta'));
  assert.deepEqual(template, before);
});

test('undo groups typing, supports redo and isolated snapshots, and retains original image values', () => {
  const history = createEditHistory(), pack = gridDraft();
  const image = { name: 'flat.png', type: 'image/png', dataUrl: 'data:image/png;base64,original' };
  pack.attachments.spec.front = image;
  history.push(pack, 'quantity'); pack.tables.spec.measurements['1'].quantity = 1;
  history.push(pack, 'quantity'); pack.tables.spec.measurements['1'].quantity = 2;
  image.name = 'later.png';
  assert.equal(history.undoCount, 1);
  const undone = history.undo(pack);
  assert.equal(undone.tables.spec.measurements['1'].quantity, null);
  assert.equal(undone.attachments.spec.front.name, 'flat.png');
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, true);
  const redone = history.redo(undone);
  assert.equal(redone.tables.spec.measurements['1'].quantity, 2);
  undone.tables.spec.measurements['1'].quantity = 99;
  assert.equal(history.undo(redone).tables.spec.measurements['1'].quantity, null, 'Mutating a restored draft must not mutate retained snapshots.');
});

test('undo has a bounded history, supports explicit group boundaries and clears redo after a new edit', () => {
  const history = createEditHistory(2), pack = gridDraft();
  for (let quantity = 0; quantity < 3; quantity++) {
    history.push(pack); pack.tables.spec.measurements['1'].quantity = quantity;
  }
  assert.equal(history.undoCount, 2);
  const first = history.undo(pack), second = history.undo(first);
  assert.equal(first.tables.spec.measurements['1'].quantity, 1);
  assert.equal(second.tables.spec.measurements['1'].quantity, 0);
  assert.equal(history.undo(second), null);
  history.push(second, 'note'); second.tables.spec.measurements['1'].note = 'one';
  history.breakGroup(); history.push(second, 'note'); second.tables.spec.measurements['1'].note = 'two';
  assert.equal(history.undoCount, 2);
  assert.equal(history.canRedo, false);
  assert.equal(history.undo(second).tables.spec.measurements['1'].note, 'one');
  history.reset();
  assert.equal(history.canUndo, false); assert.equal(history.canRedo, false);
  assert.equal(history.redo(second), null);
  for (const limit of [0, -1, 201, 1.5]) assert.throws(() => createEditHistory(limit), /between 1 and 200/);
});
