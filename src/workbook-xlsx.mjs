/** Offline XLSX cell reader. Formula text is retained, never evaluated.
 * Read only XML cell/merge parts; images, macros, external links and styles do
 * not execute or load. Styled date numbers remain their original raw numbers.
 */
import { inflateXlsxRaw } from './vendor/fflate-inflate.mjs';

const XLSX_LIMITS = Object.freeze({ file: 24 * 1024 * 1024, entry: 16 * 1024 * 1024, total: 64 * 1024 * 1024, entries: 2048, sheets: 64, cells: 200000, text: 32767 });
const XLSX_MAIN_NS = new Set(['http://schemas.openxmlformats.org/spreadsheetml/2006/main', 'http://purl.oclc.org/ooxml/spreadsheetml/main']);
const XLSX_REL_NS = new Set(['http://schemas.openxmlformats.org/package/2006/relationships', 'http://purl.oclc.org/ooxml/package/relationships']);
const XLSX_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) { let n = i; for (let bit = 0; bit < 8; bit++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; table[i] = n >>> 0; }
  return table;
})();

function xlsxCheck(condition, message) { if (!condition) throw Error(message); }
function xlsxCrc(bytes) { let crc = 0xffffffff; for (const byte of bytes) crc = XLSX_CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
function xlsxUtf8(bytes) { try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw Error('Workbook contains invalid UTF-8 text.'); } }

function xlsxPath(name, { directory = false } = {}) {
  xlsxCheck(typeof name === 'string' && name.length > 0 && name.length <= 1024 && !/[\\\u0000-\u001f:]/.test(name) && !name.startsWith('/'), 'Unsafe ZIP entry path.');
  const parts = (directory && name.endsWith('/') ? name.slice(0, -1) : name).split('/');
  xlsxCheck(parts.every(part => part && part !== '.' && part !== '..'), 'Unsafe ZIP entry path.');
  return name;
}

function xlsxPart(base, target) {
  xlsxCheck(typeof target === 'string' && !/^[a-z][a-z0-9+.-]*:/i.test(target) && !target.startsWith('//') && !/[\\\u0000-\u001f?#]/.test(target) && !/%(?:2f|5c)/i.test(target), 'External or unsafe workbook relationship.');
  let decoded;
  try { decoded = decodeURIComponent(target); } catch { throw Error('Invalid workbook relationship path.'); }
  const parts = target.startsWith('/') ? [] : base.split('/').slice(0, -1);
  for (const part of decoded.replace(/^\//, '').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') { xlsxCheck(parts.length > 0, 'Workbook relationship escapes the package.'); parts.pop(); }
    else parts.push(part);
  }
  return xlsxPath(parts.join('/'));
}

function xlsxZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = offset => { xlsxCheck(offset >= 0 && offset + 2 <= bytes.length, 'Truncated ZIP structure.'); return view.getUint16(offset, true); };
  const u32 = offset => { xlsxCheck(offset >= 0 && offset + 4 <= bytes.length, 'Truncated ZIP structure.'); return view.getUint32(offset, true); };
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
    if (u32(offset) === 0x06054b50 && offset + 22 + u16(offset + 20) === bytes.length) { end = offset; break; }
  }
  xlsxCheck(end >= 0, 'This file is not a supported XLSX ZIP archive.');
  xlsxCheck(u16(end + 4) === 0 && u16(end + 6) === 0 && u16(end + 8) === u16(end + 10), 'Multi-disk ZIP workbooks are unsupported.');
  const count = u16(end + 10), centralSize = u32(end + 12), central = u32(end + 16);
  xlsxCheck(count > 0 && count !== 65535 && count <= XLSX_LIMITS.entries && centralSize !== 0xffffffff && central !== 0xffffffff, 'ZIP64 or excessive ZIP entries are unsupported.');
  xlsxCheck(central + centralSize === end, 'Invalid ZIP central directory bounds.');
  const entries = new Map(), ranges = [];
  let cursor = central, expanded = 0;
  for (let index = 0; index < count; index++) {
    xlsxCheck(cursor + 46 <= end && u32(cursor) === 0x02014b50, 'Invalid ZIP directory entry.');
    const flags = u16(cursor + 8), method = u16(cursor + 10), crc = u32(cursor + 16), packed = u32(cursor + 20), size = u32(cursor + 24);
    const nameLength = u16(cursor + 28), extraLength = u16(cursor + 30), commentLength = u16(cursor + 32), local = u32(cursor + 42);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    xlsxCheck(next <= end && nameLength > 0 && local !== 0xffffffff && packed !== 0xffffffff && size !== 0xffffffff, 'Invalid or ZIP64 entry bounds.');
    xlsxCheck(!(flags & 0x41) && (method === 0 || method === 8), 'Encrypted or unsupported ZIP compression.');
    xlsxCheck(u16(cursor + 34) === 0 && ((u32(cursor + 38) >>> 16) & 0xf000) !== 0xa000, 'ZIP links and multi-disk entries are unsupported.');
    const name = xlsxUtf8(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    xlsxPath(name, { directory: name.endsWith('/') });
    xlsxCheck(!entries.has(name), 'Duplicate ZIP entry path.');
    expanded += size;
    xlsxCheck(size <= XLSX_LIMITS.entry && expanded <= XLSX_LIMITS.total && (packed > 0 || size === 0), 'Workbook exceeds the supported expanded size.');
    xlsxCheck(local + 30 <= central && u32(local) === 0x04034b50, 'Invalid ZIP local header.');
    const localNameLength = u16(local + 26), localExtraLength = u16(local + 28), data = local + 30 + localNameLength + localExtraLength;
    xlsxCheck(data + packed <= central && u16(local + 6) === flags && u16(local + 8) === method, 'Inconsistent ZIP local entry.');
    xlsxCheck(xlsxUtf8(bytes.subarray(local + 30, local + 30 + localNameLength)) === name, 'ZIP local and central names disagree.');
    if (!(flags & 8)) xlsxCheck(u32(local + 14) === crc && u32(local + 18) === packed && u32(local + 22) === size, 'ZIP local and central sizes disagree.');
    ranges.push([local, data + packed]);
    entries.set(name, { method, crc, packed, size, data });
    cursor = next;
  }
  xlsxCheck(cursor === end, 'ZIP directory size does not match its entries.');
  ranges.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < ranges.length; i++) xlsxCheck(ranges[i][0] >= ranges[i - 1][1], 'Overlapping ZIP entries are unsupported.');
  const cache = new Map();
  return {
    has: name => entries.has(name),
    async read(name) {
      xlsxCheck(entries.has(name), `Required workbook part is missing: ${name}.`);
      if (cache.has(name)) return cache.get(name);
      const entry = entries.get(name), packed = bytes.subarray(entry.data, entry.data + entry.packed);
      let output;
      if (entry.method === 0) output = packed.slice();
      else {
        let stream;
        if (typeof DecompressionStream === 'function') { try { stream = new DecompressionStream('deflate-raw'); } catch { /* Older Safari uses the bundled inflater. */ } }
        if (stream) {
          const reader = new Blob([packed]).stream().pipeThrough(stream).getReader();
          const chunks = []; let length = 0;
          try {
            while (true) {
              const part = await reader.read(); if (part.done) break;
              length += part.value.length;
              xlsxCheck(length <= entry.size && length <= XLSX_LIMITS.entry, 'ZIP expansion exceeds the declared size.');
              chunks.push(part.value);
            }
          } catch (error) { await reader.cancel().catch(() => {}); throw Error(`Invalid compressed workbook part: ${error.message}`); }
          output = new Uint8Array(length); let offset = 0;
          for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
        } else output = inflateXlsxRaw(packed, XLSX_LIMITS.entry, entry.size);
      }
      xlsxCheck(output.length === entry.size && xlsxCrc(output) === entry.crc, 'Workbook ZIP integrity check failed (size or CRC32).');
      cache.set(name, output);
      return output;
    },
  };
}

function xlsxEntities(text) {
  let output = '', cursor = 0;
  while (cursor < text.length) {
    const start = text.indexOf('&', cursor);
    if (start < 0) return output + text.slice(cursor);
    output += text.slice(cursor, start);
    const end = text.indexOf(';', start + 1);
    xlsxCheck(end >= 0 && end - start <= 32, 'Invalid XML entity.');
    const name = text.slice(start + 1, end), named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (Object.hasOwn(named, name)) output += named[name];
    else {
      xlsxCheck(/^#(?:[0-9]+|x[0-9a-f]+)$/i.test(name), 'XML entities and DTD expansion are unsupported.');
      const point = name[1]?.toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      xlsxCheck(point === 9 || point === 10 || point === 13 || (point >= 32 && point <= 0xd7ff) || (point >= 0xe000 && point <= 0xfffd) || (point >= 0x10000 && point <= 0x10ffff), 'Invalid XML character reference.');
      output += String.fromCodePoint(point);
    }
    cursor = end + 1;
  }
  return output;
}

function xlsxXml(bytes, handlers) {
  let source;
  try {
    const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8';
    source = new TextDecoder(encoding, { fatal: true }).decode(bytes).replace(/\r\n?/g, '\n');
  } catch { throw Error('Invalid workbook XML encoding.'); }
  xlsxCheck(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(source), 'Invalid workbook XML control character.');
  const stack = []; let cursor = 0, roots = 0, elements = 0;
  const text = (value, literal = false) => {
    const decoded = literal ? value : xlsxEntities(value);
    if (!stack.length) xlsxCheck(!decoded.trim(), 'Text outside the workbook XML root.');
    else handlers.text?.(decoded, stack);
  };
  while (cursor < source.length) {
    const open = source.indexOf('<', cursor);
    if (open < 0) { text(source.slice(cursor)); cursor = source.length; break; }
    if (open > cursor) text(source.slice(cursor, open));
    if (source.startsWith('<!--', open)) {
      const end = source.indexOf('-->', open + 4); xlsxCheck(end >= 0, 'Unclosed XML comment.'); cursor = end + 3; continue;
    }
    if (source.startsWith('<![CDATA[', open)) {
      const end = source.indexOf(']]>', open + 9); xlsxCheck(end >= 0, 'Unclosed XML CDATA.'); text(source.slice(open + 9, end), true); cursor = end + 3; continue;
    }
    if (source.startsWith('<?', open)) {
      const end = source.indexOf('?>', open + 2); xlsxCheck(end >= 0 && /^xml\s/i.test(source.slice(open + 2, end)) && roots === 0 && stack.length === 0, 'XML processing instructions are unsupported.'); cursor = end + 2; continue;
    }
    xlsxCheck(!source.startsWith('<!', open), 'XML DTDs and external entities are unsupported.');
    let end = open + 1, quote = null;
    for (; end < source.length; end++) {
      const character = source[end];
      if (quote) { if (character === quote) quote = null; }
      else if (character === '"' || character === "'") quote = character;
      else if (character === '>') break;
    }
    xlsxCheck(end < source.length && !quote, 'Unclosed XML tag.');
    const tag = source.slice(open + 1, end).trim();
    if (tag.startsWith('/')) {
      const name = tag.slice(1).trim();
      xlsxCheck(stack.length > 0 && stack.at(-1).name === name, 'Mismatched workbook XML tags.');
      handlers.end?.(stack.at(-1), stack); stack.pop(); cursor = end + 1; continue;
    }
    const selfClosing = tag.endsWith('/'), body = selfClosing ? tag.slice(0, -1).trimEnd() : tag;
    const match = /^([A-Za-z_][A-Za-z0-9_.:-]*)/.exec(body);
    xlsxCheck(match, 'Invalid XML element name.');
    const name = match[1], attrs = Object.create(null); let position = name.length;
    while (position < body.length) {
      const rest = body.slice(position), attribute = /^\s+([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*(["'])([\s\S]*?)\2/.exec(rest);
      xlsxCheck(attribute && !Object.hasOwn(attrs, attribute[1]) && !attribute[3].includes('<'), 'Invalid or duplicate XML attribute.');
      attrs[attribute[1]] = xlsxEntities(attribute[3]); position += attribute[0].length;
      xlsxCheck(Object.keys(attrs).length <= 64, 'Too many XML attributes.');
    }
    const namespaces = Object.assign(Object.create(null), stack.at(-1)?.namespaces ?? { xml: 'http://www.w3.org/XML/1998/namespace' });
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'xmlns') namespaces[''] = value;
      else if (key.startsWith('xmlns:')) {
        const prefix = key.slice(6);
        xlsxCheck(prefix !== 'xmlns' && (prefix !== 'xml' || value === 'http://www.w3.org/XML/1998/namespace'), 'Invalid reserved XML namespace.');
        namespaces[prefix] = value;
      }
    }
    const parts = name.split(':'); xlsxCheck(parts.length <= 2, 'Invalid XML qualified name.');
    if (parts.length === 2) xlsxCheck(Boolean(namespaces[parts[0]]), 'Undeclared XML namespace prefix.');
    for (const key of Object.keys(attrs)) {
      if (key.includes(':') && !key.startsWith('xmlns:')) {
        const attributeParts = key.split(':');
        xlsxCheck(attributeParts.length === 2 && Boolean(namespaces[attributeParts[0]]), 'Undeclared XML attribute prefix.');
      }
    }
    const entry = { name, local: parts.at(-1), ns: namespaces[parts.length === 2 ? parts[0] : ''] ?? '', attrs, namespaces };
    if (!stack.length) { roots++; xlsxCheck(roots === 1, 'Multiple workbook XML roots.'); }
    stack.push(entry); elements++;
    xlsxCheck(stack.length <= 64 && elements <= 1000000, 'Workbook XML structure is too large.');
    handlers.start?.(entry, stack);
    if (selfClosing) { handlers.end?.(entry, stack); stack.pop(); }
    cursor = end + 1;
  }
  xlsxCheck(stack.length === 0 && roots === 1, 'Incomplete workbook XML document.');
}

function xlsxAttr(entry, name) {
  const matches = Object.entries(entry.attrs).filter(([key]) => key.split(':').at(-1) === name);
  xlsxCheck(matches.length <= 1, 'Ambiguous workbook XML attribute.');
  return matches[0]?.[1];
}

function xlsxRelationships(bytes) {
  const relations = new Map();
  xlsxXml(bytes, { start(entry, stack) {
    if (stack.length === 1) xlsxCheck(entry.local === 'Relationships' && XLSX_REL_NS.has(entry.ns), 'Invalid workbook relationship document.');
    if (entry.local !== 'Relationship' || !XLSX_REL_NS.has(entry.ns) || stack.length !== 2) return;
    const id = xlsxAttr(entry, 'Id'), type = xlsxAttr(entry, 'Type'), target = xlsxAttr(entry, 'Target');
    xlsxCheck(id && type && target && !relations.has(id), 'Invalid or duplicate workbook relationship.');
    relations.set(id, { type: type.split('/').at(-1), target, external: xlsxAttr(entry, 'TargetMode')?.toLowerCase() === 'external' });
  } });
  return relations;
}

function xlsxExcelString(value) { return value.replace(/_x([0-9a-f]{4})_/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))); }

function xlsxSharedStrings(bytes) {
  const strings = []; let current = null;
  xlsxXml(bytes, {
    start(entry, stack) {
      if (stack.length === 1) xlsxCheck(entry.local === 'sst' && XLSX_MAIN_NS.has(entry.ns), 'Invalid shared-string document.');
      if (entry.local === 'si' && XLSX_MAIN_NS.has(entry.ns) && stack.length === 2) { xlsxCheck(current === null, 'Invalid nested shared strings.'); current = ''; }
    },
    text(value, stack) {
      if (current !== null && stack.at(-1).local === 't' && XLSX_MAIN_NS.has(stack.at(-1).ns) && !stack.some(item => item.local === 'rPh')) {
        current += value; xlsxCheck(current.length <= XLSX_LIMITS.text, 'Workbook string exceeds the cell text limit.');
      }
    },
    end(entry, stack) {
      if (entry.local === 'si' && XLSX_MAIN_NS.has(entry.ns) && stack.length === 2) {
        strings.push(xlsxExcelString(current)); current = null;
        xlsxCheck(strings.length <= XLSX_LIMITS.cells, 'Too many workbook shared strings.');
      }
    },
  });
  return strings;
}

function xlsxCoordinate(reference) {
  const match = /^([A-Za-z]{1,3})([1-9][0-9]{0,6})$/.exec(reference ?? '');
  xlsxCheck(match, 'Invalid worksheet cell reference.');
  const letters = match[1].toUpperCase(); let column = 0;
  for (const character of letters) column = column * 26 + character.charCodeAt(0) - 64;
  const row = Number(match[2]);
  xlsxCheck(column <= 16384 && row <= 1048576, 'Worksheet reference exceeds Excel limits.');
  return { address: letters + row, column, row };
}

function xlsxColumn(column) { let output = ''; while (column > 0) { column--; output = String.fromCharCode(65 + column % 26) + output; column = Math.floor(column / 26); } return output; }

function xlsxWorksheet(bytes, shared, counter) {
  const cells = Object.create(null), merges = []; let current = null, currentRow = 0, lastColumn = 0;
  xlsxXml(bytes, {
    start(entry, stack) {
      if (stack.length === 1) xlsxCheck(entry.local === 'worksheet' && XLSX_MAIN_NS.has(entry.ns), 'Invalid worksheet document.');
      if (!XLSX_MAIN_NS.has(entry.ns)) return;
      if (entry.local === 'row' && stack.at(-2)?.local === 'sheetData') {
        const row = xlsxAttr(entry, 'r'); currentRow = row === undefined ? currentRow + 1 : Number(row);
        xlsxCheck(Number.isInteger(currentRow) && currentRow > 0 && currentRow <= 1048576, 'Invalid worksheet row.'); lastColumn = 0;
      }
      if (entry.local === 'c' && stack.at(-2)?.local === 'row') {
        xlsxCheck(current === null && currentRow > 0, 'Invalid nested worksheet cell.');
        const coordinate = xlsxCoordinate(xlsxAttr(entry, 'r') ?? `${xlsxColumn(lastColumn + 1)}${currentRow}`);
        xlsxCheck(coordinate.row === currentRow && !Object.hasOwn(cells, coordinate.address), 'Duplicate or inconsistent worksheet cell.');
        lastColumn = coordinate.column;
        current = { address: coordinate.address, type: xlsxAttr(entry, 't') ?? 'n', value: '', inline: '', formula: null, hasValue: false, hasInline: false };
      }
      if (current && entry.local === 'f' && stack.at(-2)?.local === 'c') { xlsxCheck(current.formula === null, 'Multiple worksheet formulas in one cell.'); current.formula = ''; }
      if (current && entry.local === 'v' && stack.at(-2)?.local === 'c') { xlsxCheck(!current.hasValue, 'Multiple worksheet values in one cell.'); current.hasValue = true; }
      if (current && entry.local === 'is' && stack.at(-2)?.local === 'c') current.hasInline = true;
      if (entry.local === 'mergeCell' && stack.at(-2)?.local === 'mergeCells') {
        const range = xlsxAttr(entry, 'ref'); xlsxCheck(typeof range === 'string', 'Missing worksheet merge range.');
        const parts = range.split(':'); xlsxCheck(parts.length <= 2, 'Invalid worksheet merge range.');
        const first = xlsxCoordinate(parts[0]), last = xlsxCoordinate(parts[1] ?? parts[0]);
        xlsxCheck(first.column <= last.column && first.row <= last.row && merges.length < 10000, 'Invalid or excessive worksheet merges.'); merges.push(range);
      }
    },
    text(value, stack) {
      if (!current || !XLSX_MAIN_NS.has(stack.at(-1).ns)) return;
      const name = stack.at(-1).local;
      if (name === 'v' && stack.at(-2)?.local === 'c') current.value += value;
      else if (name === 'f' && stack.at(-2)?.local === 'c') current.formula += value;
      else if (name === 't' && current.hasInline && !stack.some(item => item.local === 'rPh')) current.inline += value;
      xlsxCheck(current.value.length <= XLSX_LIMITS.text && current.inline.length <= XLSX_LIMITS.text && (current.formula?.length ?? 0) <= XLSX_LIMITS.text, 'Workbook cell text exceeds the supported limit.');
    },
    end(entry, stack) {
      if (entry.local !== 'c' || !XLSX_MAIN_NS.has(entry.ns) || stack.at(-2)?.local !== 'row' || !current) return;
      const { type, formula } = current; let value = null;
      if (type === 'inlineStr') { xlsxCheck(!current.hasValue, 'Inline worksheet text has an incompatible value.'); value = xlsxExcelString(current.inline); }
      else if (current.hasValue) {
        if (type === 's' && current.value !== '') { const index = Number(current.value.trim()); xlsxCheck(/^\d+$/.test(current.value.trim()) && index < shared.length, 'Invalid workbook shared-string index.'); value = shared[index]; }
        else if (type === 'b' && current.value !== '') { xlsxCheck(current.value === '0' || current.value === '1', 'Invalid worksheet boolean.'); value = current.value === '1'; }
        else if (type === 'n' && current.value.trim() !== '') { xlsxCheck(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(current.value.trim()), 'Invalid worksheet number.'); value = Number(current.value); xlsxCheck(Number.isFinite(value), 'Non-finite worksheet number.'); }
        else if (['str', 'e', 'd'].includes(type)) value = xlsxExcelString(current.value);
        else xlsxCheck(['n', 's', 'b'].includes(type), 'Unsupported worksheet cell type.');
      } else xlsxCheck(['n', 's', 'b', 'str', 'e', 'd'].includes(type), 'Unsupported worksheet cell type.');
      cells[current.address] = { value, formula, type };
      counter.total++; xlsxCheck(counter.total <= XLSX_LIMITS.cells, 'Workbook contains too many cells.'); current = null;
    },
  });
  return { cells, merges };
}

export async function readWorkbookXlsx(input, { fileName = 'workbook.xlsx' } = {}) {
  const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : ArrayBuffer.isView(input) ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength) : null;
  xlsxCheck(bytes && bytes.length >= 22 && bytes.length <= XLSX_LIMITS.file, 'Choose an XLSX file no larger than 24 MB.');
  xlsxCheck(typeof fileName === 'string' && fileName.trim() && fileName.length <= 255 && !/[\\/\u0000-\u001f]/.test(fileName), 'Invalid workbook filename.');
  xlsxCheck(globalThis.crypto?.subtle, 'Workbook hashing requires a current browser in a secure context.');
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  const zip = xlsxZip(bytes);
  xlsxCheck(zip.has('[Content_Types].xml') && zip.has('_rels/.rels'), 'This ZIP is not an XLSX workbook.');
  xlsxXml(await zip.read('[Content_Types].xml'), {});
  const packageRelations = xlsxRelationships(await zip.read('_rels/.rels'));
  const office = [...packageRelations.values()].filter(relation => relation.type === 'officeDocument');
  xlsxCheck(office.length === 1 && !office[0].external, 'Workbook package relationship is missing or external.');
  const workbookPath = xlsxPart('', office[0].target);
  const workbookRelationsPath = workbookPath.replace(/([^/]+)$/, '_rels/$1.rels');
  const relationships = xlsxRelationships(await zip.read(workbookRelationsPath));
  const sheetDefinitions = [];
  xlsxXml(await zip.read(workbookPath), { start(entry, stack) {
    if (stack.length === 1) xlsxCheck(entry.local === 'workbook' && XLSX_MAIN_NS.has(entry.ns), 'Invalid workbook document.');
    if (entry.local === 'sheet' && XLSX_MAIN_NS.has(entry.ns) && stack.at(-2)?.local === 'sheets') {
      const name = xlsxExcelString(xlsxAttr(entry, 'name') ?? ''), relationship = relationships.get(xlsxAttr(entry, 'id'));
      xlsxCheck(name && name.length <= 255 && !sheetDefinitions.some(sheet => sheet.name.toLowerCase() === name.toLowerCase()), 'Invalid or duplicate worksheet name.');
      xlsxCheck(relationship?.type === 'worksheet' && !relationship.external, 'Worksheet relationship is missing or external.');
      sheetDefinitions.push({ name, path: xlsxPart(workbookPath, relationship.target) });
      xlsxCheck(sheetDefinitions.length <= XLSX_LIMITS.sheets, 'Workbook contains too many worksheets.');
    }
  } });
  xlsxCheck(sheetDefinitions.length > 0, 'Workbook contains no worksheets.');
  const sharedRelation = [...relationships.values()].find(relation => relation.type === 'sharedStrings');
  xlsxCheck(!sharedRelation?.external, 'External shared-string relationships are unsupported.');
  const shared = sharedRelation ? xlsxSharedStrings(await zip.read(xlsxPart(workbookPath, sharedRelation.target))) : [];
  const sheets = [], counter = { total: 0 };
  for (const sheet of sheetDefinitions) sheets.push({ name: sheet.name, ...xlsxWorksheet(await zip.read(sheet.path), shared, counter) });
  return { fileName, sha256, sheets };
}
