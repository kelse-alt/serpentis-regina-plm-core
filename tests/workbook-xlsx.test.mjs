import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { readWorkbookXlsx } from '../src/workbook-xlsx.mjs';

const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const OFFICE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function fixtureCrc(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return (value ^ 0xffffffff) >>> 0;
}

function zip(entries, { method = 0, flags = 0x800, declaredSize, crcOverride, dataDescriptor = false } = {}) {
  if (dataDescriptor) flags |= 8;
  const local = [], central = []; let offset = 0;
  for (const [name, text] of entries) {
    const filename = Buffer.from(name), bytes = Buffer.from(text), compressed = method === 8 ? deflateRawSync(bytes) : bytes;
    const size = declaredSize?.(name, bytes.length) ?? bytes.length, crc = crcOverride ?? fixtureCrc(bytes);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(flags, 6); header.writeUInt16LE(method, 8);
    header.writeUInt32LE(crc, 14); header.writeUInt32LE(compressed.length, 18); header.writeUInt32LE(size, 22); header.writeUInt16LE(filename.length, 26);
    if (dataDescriptor) header.fill(0, 14, 26);
    local.push(header, filename, compressed);
    if (dataDescriptor) {
      const descriptor = Buffer.alloc(16);
      descriptor.writeUInt32LE(0x08074b50); descriptor.writeUInt32LE(crc, 4); descriptor.writeUInt32LE(compressed.length, 8); descriptor.writeUInt32LE(size, 12);
      local.push(descriptor);
    }
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6); directory.writeUInt16LE(flags, 8); directory.writeUInt16LE(method, 10);
    directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(compressed.length, 20); directory.writeUInt32LE(size, 24); directory.writeUInt16LE(filename.length, 28); directory.writeUInt32LE(offset, 42);
    central.push(directory, filename); offset += header.length + filename.length + compressed.length + (dataDescriptor ? 16 : 0);
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

function workbookEntries({ cells = '<row r="1"><c r="A1" t="inlineStr"><is><t>EX01</t></is></c></row>', sheetName = 'Example-SPEC', shared, merges = '', workbookTarget = 'xl/workbook.xml', worksheetTarget = 'worksheets/sheet1.xml', targetMode = '', workbookXml, worksheetXml, sharedXml } = {}) {
  return [
    ['[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'],
    ['_rels/.rels', `<Relationships xmlns="${REL}"><Relationship Id="root" Type="${OFFICE_REL}/officeDocument" Target="${workbookTarget}"/></Relationships>`],
    ['xl/workbook.xml', workbookXml ?? `<workbook xmlns="${MAIN}" xmlns:rel="${OFFICE_REL}"><sheets><sheet name="${sheetName}" sheetId="1" rel:id="sheet1"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<Relationships xmlns="${REL}"><Relationship Id="sheet1" Type="${OFFICE_REL}/worksheet" Target="${worksheetTarget}" ${targetMode}/>${shared !== undefined || sharedXml !== undefined ? `<Relationship Id="strings" Type="${OFFICE_REL}/sharedStrings" Target="sharedStrings.xml"/>` : ''}</Relationships>`],
    ['xl/worksheets/sheet1.xml', worksheetXml ?? `<worksheet xmlns="${MAIN}"><sheetData>${cells}</sheetData>${merges ? `<mergeCells>${merges}</mergeCells>` : ''}</worksheet>`],
    ...((shared !== undefined || sharedXml !== undefined) ? [['xl/sharedStrings.xml', sharedXml ?? `<sst xmlns="${MAIN}">${shared}</sst>`]] : []),
  ];
}

test('stored XLSX cells retain whitespace, entity-decoded rich text, primitive types, formulas, and merges', async () => {
  const cells = `<row r="1">
    <c r="A1" t="s"><v>0</v></c>
    <c r="B1" t="inlineStr"><is><r><t xml:space="preserve">  first </t></r><r><t>&amp; second&#10;🐍</t></r><rPh><t>not visible</t></rPh></is></c>
    <c r="C1"><f>SUM(1, 2)</f><v>999</v></c>
    <c r="D1" t="b"><v>0</v></c><c r="E1" t="b"><v>1</v></c>
    <c r="F1" t="e"><v>#DIV/0!</v></c><c r="G1" s="4"><v>46000</v></c>
    <c r="H1" t="str"><v></v></c><c r="I1"/><c r="J1" t="d"><v>2026-01-02T00:00:00Z</v></c>
    <c r="K1" t="inlineStr"><is><t>_x005F_x0041_ and _x000D_</t></is></c>
    <c r="L1"><v>0</v></c><c r="M1"><f t="shared" si="1"/><v/></c>
  </row>`;
  const bytes = zip(workbookEntries({ cells, shared: '<si><r><t xml:space="preserve"> shared </t></r><r><t>&lt;value&gt;</t></r></si>', merges: '<mergeCell ref="A2:B2"/>' }));
  const result = await readWorkbookXlsx(bytes, { fileName: 'example.xlsx' });
  assert.equal(result.fileName, 'example.xlsx');
  assert.equal(result.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(result.sheets[0].name, 'Example-SPEC');
  const actual = result.sheets[0].cells;
  assert.deepEqual(actual.A1, { value: ' shared <value>', formula: null, type: 's' });
  assert.equal(actual.B1.value, '  first & second\n🐍');
  assert.deepEqual(actual.C1, { value: 999, formula: 'SUM(1, 2)', type: 'n' });
  assert.equal(actual.D1.value, false); assert.equal(actual.E1.value, true);
  assert.equal(actual.F1.value, '#DIV/0!'); assert.equal(actual.G1.value, 46000);
  assert.equal(actual.H1.value, ''); assert.equal(actual.I1.value, null);
  assert.equal(actual.J1.value, '2026-01-02T00:00:00Z');
  assert.equal(actual.K1.value, '_x0041_ and \r'); assert.equal(actual.L1.value, 0);
  assert.equal(actual.M1.formula, ''); assert.equal(actual.M1.value, null);
  assert.deepEqual(result.sheets[0].merges, ['A2:B2']);
});

test('compressed workbooks produce the same cells through native and bundled older-browser decompression', async () => {
  const bytes = zip(workbookEntries({ cells: '<row r="1"><c r="A1" t="inlineStr"><is><t>  repeat text  </t></is></c></row>' }), { method: 8 });
  const native = await readWorkbookXlsx(bytes);
  const constructor = globalThis.DecompressionStream;
  try {
    globalThis.DecompressionStream = undefined;
    assert.deepEqual(await readWorkbookXlsx(bytes), native);
  } finally { globalThis.DecompressionStream = constructor; }
});

test('stream-written ZIP data descriptors preserve checked central sizes and CRC values', async () => {
  const parsed = await readWorkbookXlsx(zip(workbookEntries(), { method: 8, dataDescriptor: true }));
  assert.equal(parsed.sheets[0].cells.A1.value, 'EX01');
});

test('prefixed spreadsheet namespaces, CDATA, empty strings, and inferred coordinates remain readable', async () => {
  const worksheetXml = `<s:worksheet xmlns:s="${MAIN}"><s:sheetData><s:row r="2"><s:c t="inlineStr"><s:is><s:t><![CDATA[ <literal>&value ]]></s:t></s:is></s:c><s:c r="D2" t="s"><s:v>0</s:v></s:c><s:c><s:v>-1.25e2</s:v></s:c></s:row><s:row><s:c t="inlineStr"><s:is><s:t/></s:is></s:c></s:row></s:sheetData></s:worksheet>`;
  const parsed = await readWorkbookXlsx(zip(workbookEntries({ worksheetXml, sheetName: 'Example &amp; notes', shared: '<si><t/></si>' })));
  const sheet = parsed.sheets[0];
  assert.equal(sheet.name, 'Example & notes');
  assert.equal(sheet.cells.A2.value, ' <literal>&value ');
  assert.equal(sheet.cells.D2.value, ''); assert.equal(sheet.cells.E2.value, -125);
  assert.equal(sheet.cells.A3.value, '');
});

test('typed array views are bounded correctly and invalid file types/names are rejected', async () => {
  const bytes = zip(workbookEntries()), padded = Buffer.concat([Buffer.from('padding'), bytes, Buffer.from('tail')]);
  assert.equal((await readWorkbookXlsx(padded.subarray(7, 7 + bytes.length))).sheets.length, 1);
  assert.equal((await readWorkbookXlsx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length))).sheets.length, 1);
  await assert.rejects(readWorkbookXlsx('not bytes'), /XLSX/);
  await assert.rejects(readWorkbookXlsx(bytes, { fileName: '../sample.xlsx' }), /filename/);
  await assert.rejects(readWorkbookXlsx(bytes.subarray(0, bytes.length - 1)), /ZIP/);
});

test('malformed XML, DTDs, external entities and external/escaping relationships are rejected', async () => {
  for (const options of [
    { worksheetXml: `<!DOCTYPE worksheet [<!ENTITY external SYSTEM "https://example.invalid/secret">]><worksheet xmlns="${MAIN}"><sheetData/></worksheet>` },
    { worksheetXml: `<worksheet xmlns="${MAIN}"><sheetData></worksheet>` },
    { worksheetXml: `<worksheet xmlns="${MAIN}"><sheetData>&unknown;</sheetData></worksheet>` },
    { worksheetTarget: 'https://example.invalid/sheet.xml', targetMode: 'TargetMode="External"' },
    { worksheetTarget: '../../outside.xml' },
    { workbookTarget: '../outside.xml' },
    { worksheetXml: `<?xml-stylesheet href="https://example.invalid/style"?><worksheet xmlns="${MAIN}"/>` },
    { worksheetXml: `<worksheet xmlns="${MAIN}"><sheetData><unbound:row/></sheetData></worksheet>` },
    { worksheetXml: `<worksheet xmlns="${MAIN}" unbound:attribute="bad"/>` },
  ]) await assert.rejects(readWorkbookXlsx(zip(workbookEntries(options))));
});

test('ZIP traversal, duplicate paths, encryption and bad CRC32 do not reach cell parsing', async () => {
  const entries = workbookEntries();
  for (const unsafe of ['../bad.xml', '/absolute.xml', 'xl\\bad.xml', 'xl/./bad.xml']) {
    await assert.rejects(readWorkbookXlsx(zip([...entries, [unsafe, 'ignored']])), /path/);
  }
  await assert.rejects(readWorkbookXlsx(zip([...entries, entries[0]])), /Duplicate ZIP/);
  await assert.rejects(readWorkbookXlsx(zip(entries, { flags: 0x801 })), /Encrypted/);
  await assert.rejects(readWorkbookXlsx(zip(entries, { crcOverride: 0 })), /integrity/);
});

test('declared size and expansion limits apply to both native and bundled DEFLATE readers', async () => {
  const entries = workbookEntries({ cells: `<row r="1"><c r="A1" t="inlineStr"><is><t>${'A'.repeat(200000)}</t></is></c></row>` });
  const options = { method: 8, declaredSize: (name, size) => name === 'xl/worksheets/sheet1.xml' ? 10 : size };
  await assert.rejects(readWorkbookXlsx(zip(entries, options)), /size|compressed/);
  const constructor = globalThis.DecompressionStream;
  try {
    globalThis.DecompressionStream = undefined;
    await assert.rejects(readWorkbookXlsx(zip(entries, options)), /size/);
  } finally { globalThis.DecompressionStream = constructor; }
  await assert.rejects(readWorkbookXlsx(zip(workbookEntries(), { declaredSize: (name, size) => name === 'xl/workbook.xml' ? 17 * 1024 * 1024 : size })), /expanded size/);
});

test('unknown types, duplicate/invalid cell references, missing string indices and non-finite numbers fail', async () => {
  for (const cells of [
    '<row r="1"><c r="A1" t="unknown"><v>1</v></c></row>',
    '<row r="1"><c r="A1"/><c r="A1"/></row>',
    '<row r="1"><c r="XFE1"/></row>',
    '<row r="1"><c r="A2"/></row>',
    '<row r="1"><c r="A1" t="s"><v>1</v></c></row>',
    '<row r="1"><c r="A1"><v>1e309</v></c></row>',
    '<row r="1"><c r="A1" t="b"><v>2</v></c></row>',
  ]) await assert.rejects(readWorkbookXlsx(zip(workbookEntries({ cells }))));
});
