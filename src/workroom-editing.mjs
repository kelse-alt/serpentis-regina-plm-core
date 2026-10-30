/** Spreadsheet entry helpers. Approved references and source templates stay read-only. */
import { columnsForRow, normalizeTechPack, parseMeasure } from './tech-pack.mjs';

const GRID_EDITABLE_TYPES = new Set(['text', 'number', 'measurement']);
const GRID_MAX_PASTE_CHARACTERS = 1_000_000;
const GRID_MAX_PASTE_CELLS = 10_000;

function gridEditable(column) {
  return !column.readonly && GRID_EDITABLE_TYPES.has(column.type ?? 'text');
}

function gridTable(template, sheetId, tableId) {
  const sheet = template.sheets.find(item => item.id === sheetId);
  const table = sheet?.tables?.find(item => item.id === tableId);
  if (!sheet || !table) throw Error('Choose an editable worksheet table before pasting.');
  return { sheet, table };
}

/** Parse a rectangular TSV range, including spreadsheet-quoted multiline cells. */
export function parseGridClipboard(text) {
  if (typeof text !== 'string') throw Error('Paste text copied from a spreadsheet.');
  if (text.length > GRID_MAX_PASTE_CHARACTERS) throw Error('Paste a smaller range: at most 1,000,000 characters.');
  const input = text.replace(/\r\n?/g, '\n');
  const rows = [];
  let row = [], cell = '', quoted = false, closed = false, atStart = true;
  const finishCell = () => { row.push(cell); cell = ''; closed = false; atStart = true; };
  const finishRow = () => { finishCell(); rows.push(row); row = []; };
  for (let index = 0; index < input.length; index++) {
    const character = input[index];
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') { cell += '"'; index++; }
        else { quoted = false; closed = true; }
      } else cell += character;
      continue;
    }
    if (closed && character !== '\t' && character !== '\n') {
      throw Error(`Paste row ${rows.length + 1}, column ${row.length + 1}: unexpected text after a quoted cell.`);
    }
    if (character === '\t') finishCell();
    else if (character === '\n') finishRow();
    else if (character === '"' && atStart) { quoted = true; atStart = false; }
    else { cell += character; atStart = false; }
  }
  if (quoted) throw Error(`Paste row ${rows.length + 1}, column ${row.length + 1}: close the quoted cell.`);
  finishRow();
  // A copied spreadsheet range commonly has one record-terminating newline.
  if (input.endsWith('\n') && rows.at(-1).length === 1 && rows.at(-1)[0] === '') rows.pop();
  const width = rows[0]?.length ?? 0;
  if (!width || !rows.length) throw Error('Paste at least one spreadsheet cell.');
  const uneven = rows.findIndex(item => item.length !== width);
  if (uneven !== -1) throw Error(`Paste row ${uneven + 1}: every row must contain ${width} columns.`);
  if (rows.length * width > GRID_MAX_PASTE_CELLS) throw Error('Paste a smaller range: at most 10,000 cells.');
  return rows;
}

function gridVisibleKeys(definitions, supplied, label) {
  if (supplied === undefined) return definitions.map(item => item.id ?? item.key);
  const known = new Set(definitions.map(item => item.id ?? item.key));
  if (!Array.isArray(supplied) || !supplied.length || new Set(supplied).size !== supplied.length ||
      supplied.some(key => typeof key !== 'string' || !known.has(key))) {
    throw Error(`The visible ${label} do not match this worksheet.`);
  }
  const selected = new Set(supplied);
  return definitions.map(item => item.id ?? item.key).filter(key => selected.has(key));
}

function gridParsedValue(value, column, unit) {
  if (column.type === 'measurement') return parseMeasure(value, unit, { allowNegative: !!column.allowNegative });
  // Quantities remain dimensionless decimal numbers, regardless of garment units.
  if (column.type === 'number') return parseMeasure(value, 'cm', { allowNegative: !!column.allowNegative });
  if (value.length > (column.maxLength ?? 4000) || value.includes('\0')) {
    throw Error(`Enter text of at most ${column.maxLength ?? 4000} characters without null characters.`);
  }
  return value;
}

/**
 * Clipboard columns fill visible editable fields in source order. Locked cells
 * are skipped; manual overrides such as wash deltas are resolved for each row.
 * rowIds can restrict the operation to currently visible search results.
 */
export function previewGridPaste(pack, template, options) {
  const clean = normalizeTechPack(pack, template);
  const { sheetId, tableId, rowId, columnKey, text, columnKeys, rowIds } = options ?? {};
  const { sheet, table } = gridTable(template, sheetId, tableId);
  const unit = sheet.reference ? options.unit : clean.unit;
  const matrix = parseGridClipboard(text);
  const visibleColumns = new Set(gridVisibleKeys(table.columns, columnKeys, 'columns'));
  const visibleRows = gridVisibleKeys(table.rows, rowIds, 'rows');
  const startRow = visibleRows.indexOf(rowId);
  if (startRow === -1) throw Error('Choose a visible worksheet row before pasting.');
  if (startRow + matrix.length > visibleRows.length) {
    throw Error(`Paste row ${visibleRows.length - startRow + 1}: the range extends beyond the available rows.`);
  }
  const anchor = table.rows.find(item => item.id === rowId);
  const anchorColumns = columnsForRow(table, anchor).filter(column => visibleColumns.has(column.key) && gridEditable(column));
  const startColumn = anchorColumns.findIndex(column => column.key === columnKey);
  if (startColumn === -1) throw Error('Paste row 1: the starting field is locked, calculated, or hidden.');
  if (startColumn + matrix[0].length > anchorColumns.length) {
    throw Error(`Paste row 1, column ${anchorColumns.length - startColumn + 1}: the range extends beyond the editable columns.`);
  }
  // Every row uses the same destinations. A per-row manual formula exception
  // must never shift a pasted value sideways into an unrelated specification.
  const destinations = anchorColumns.slice(startColumn, startColumn + matrix[0].length).map(column => column.key);
  const changes = [];
  for (let rowOffset = 0; rowOffset < matrix.length; rowOffset++) {
    const definition = table.rows.find(item => item.id === visibleRows[startRow + rowOffset]);
    const columns = columnsForRow(table, definition);
    for (let columnOffset = 0; columnOffset < matrix[rowOffset].length; columnOffset++) {
      const column = columns.find(item => item.key === destinations[columnOffset]);
      if (!column || !gridEditable(column)) {
        throw Error(`Paste row ${rowOffset + 1}, column ${columnOffset + 1}: ${column?.label ?? destinations[columnOffset]} is locked or calculated on this row.`);
      }
      const label = `${table.title}, row ${definition.id}, ${column.label ?? column.key}`;
      let after;
      try {
        after = gridParsedValue(matrix[rowOffset][columnOffset], column, unit);
      } catch (error) {
        throw Error(`Paste row ${rowOffset + 1}, column ${columnOffset + 1} (${column.label ?? column.key}): ${error.message}`);
      }
      const before = clean.tables[sheetId][tableId][definition.id][column.key];
      if (!Object.is(before, after)) changes.push({ rowId: definition.id, columnKey: column.key, before, after, label });
    }
  }
  return { packId: clean.id, unit, garmentUnit: clean.unit, sheetId, tableId,
    changes, rowCount: matrix.length, columnCount: matrix[0].length,
    columnKeys: destinations, rowIds: visibleRows.slice(startRow, startRow + matrix.length) };
}

/** Commit a reviewed range atomically; stale previews cannot overwrite new edits. */
export function applyGridPaste(pack, template, preview, options = {}) {
  const clean = normalizeTechPack(pack, template);
  if (!preview || preview.packId !== clean.id || preview.garmentUnit !== clean.unit || !Array.isArray(preview.changes)) {
    throw Error('This paste preview belongs to another draft or unit. Paste the range again.');
  }
  const { sheet, table } = gridTable(template, preview.sheetId, preview.tableId);
  const unit = sheet.reference ? options.unit : clean.unit;
  if (unit !== preview.unit) throw Error('The display unit changed after this preview. Paste the range again.');
  const seen = new Set();
  for (const change of preview.changes) {
    const row = table.rows.find(item => item.id === change.rowId);
    const column = row && columnsForRow(table, row).find(item => item.key === change.columnKey);
    const identity = `${change.rowId}\0${change.columnKey}`;
    if (!column || !gridEditable(column) || seen.has(identity)) throw Error('This paste preview contains a locked, duplicated, or unknown cell.');
    seen.add(identity);
    if (!Object.is(clean.tables[preview.sheetId][preview.tableId][change.rowId][change.columnKey], change.before)) {
      throw Error(`${change.label || 'A worksheet cell'} changed after this preview. Paste the range again.`);
    }
  }
  // No draft object is changed until every preview cell passes the stale checks.
  for (const change of preview.changes) clean.tables[preview.sheetId][preview.tableId][change.rowId][change.columnKey] = change.after;
  return normalizeTechPack(clean, template);
}

function gridHistorySnapshot(snapshot) {
  // Keep immutable image strings outside structuredClone, avoiding repeated
  // copies of original raster bytes for every keystroke in a measurement cell.
  const { attachments, ...rest } = snapshot;
  const result = structuredClone(rest);
  if (attachments !== undefined) result.attachments = Object.fromEntries(Object.entries(attachments).map(([sheetId, slots]) =>
    [sheetId, Object.fromEntries(Object.entries(slots).map(([key, image]) => [key, image === null ? null : Array.isArray(image.images)
      ? { ...image, images: image.images.map(item => ({ ...item })) } : { ...image }]))]));
  return result;
}

/** Session undo/redo. Push the state before each edit; equal keys group typing. */
export function createEditHistory(limit = 40) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw Error('Undo history must contain between 1 and 200 steps.');
  const past = [], future = [];
  let lastKey = null;
  return {
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
    get undoCount() { return past.length; },
    get redoCount() { return future.length; },
    push(snapshot, key = null) {
      future.length = 0;
      if (key !== null && key === lastKey && past.length) return;
      past.push(gridHistorySnapshot(snapshot));
      if (past.length > limit) past.shift();
      lastKey = key;
    },
    breakGroup() { lastKey = null; },
    undo(current) {
      lastKey = null;
      if (!past.length) return null;
      future.push(gridHistorySnapshot(current));
      return gridHistorySnapshot(past.pop());
    },
    redo(current) {
      lastKey = null;
      if (!future.length) return null;
      past.push(gridHistorySnapshot(current));
      if (past.length > limit) past.shift();
      return gridHistorySnapshot(future.pop());
    },
    reset() { past.length = 0; future.length = 0; lastKey = null; },
  };
}
