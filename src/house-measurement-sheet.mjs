/**
 * SERPENTIS REGINA — HOUSE MEASUREMENT SHEET
 * Lessons in action: variables, objects, arrays, loops, functions, subtraction.
 * Reads the approved v1 form without modifying it or the source Google Sheet.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const FORM = new URL('../data/house-fit-forms/SR-FORM-001.v1.json', import.meta.url);
const METHODS = new URL('../data/house-fit-forms/SR-FORM-001-methods.v1.json', import.meta.url);

export async function loadHouseData() {
  const form = JSON.parse(await readFile(FORM, 'utf8'));
  const sourceMethods = JSON.parse(await readFile(METHODS, 'utf8'));
  return { form, sourceMethods };
}

// Lesson 05: One function works for EVERY measurement object.
export function compareRecord(record) {
  if (!record?.pomCode || !Number.isFinite(record.houseStandard)) throw Error('Invalid house measurement');
  if (record.manufacturerReference !== null && !Number.isFinite(record.manufacturerReference)) {
    throw Error(`Invalid manufacturer reference: ${record.pomCode}`);
  }
  // Lesson 06: approved house standard MINUS manufacturer reference.
  // Missing source values are null, not zero.
  const difference = record.manufacturerReference === null
    ? null
    : Number((record.houseStandard - record.manufacturerReference).toFixed(3));
  return { ...record, difference, hasReference: difference !== null };
}

// Lessons 02–04: objects inside arrays, processed by for...of.
export function buildMeasurementRows(form, sourceMethods) {
  if (form.formId !== sourceMethods.formId || form.unit !== 'in') throw Error('Form identity/units mismatch');
  if (form.approval?.status !== 'APPROVED') throw Error('Unapproved house record');
  if (!Array.isArray(form.measurements) || !Array.isArray(sourceMethods.methods)) throw Error('Invalid arrays');
  const methods = new Map(sourceMethods.methods.map(item => [item.pomCode, item]));
  if (methods.size !== sourceMethods.methods.length) throw Error('Duplicate source POM');
  const rows = [];
  const seen = new Set();
  for (const record of form.measurements) {
    if (seen.has(record.pomCode)) throw Error(`Duplicate POM: ${record.pomCode}`);
    seen.add(record.pomCode);
    const method = methods.get(record.pomCode);
    if (!method?.howToMeasure || !method?.sourceLabel) throw Error(`Missing measuring method: ${record.pomCode}`);
    rows.push({ ...compareRecord(record), sourceLabel: method.sourceLabel, howToMeasure: method.howToMeasure });
  }
  if (methods.size !== rows.length) throw Error('House/source POM count mismatch');
  return rows;
}

export function summarizeRows(rows) {
  return {
    total: rows.length,
    compared: rows.filter(row => row.hasReference).length,
    missingReferences: rows.filter(row => !row.hasReference).length,
    different: rows.filter(row => row.hasReference && row.difference !== 0).length,
  };
}
export function formatDifference(value) {
  return value === null ? '—' : value > 0 ? `+${value}` : String(value);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Read-only, offline browser report: no external libraries or third-party servers.
export function buildHtml(form, rows) {
  const stats = summarizeRows(rows);
  let body = '';
  for (const row of rows) {
    const status = row.hasReference ? 'compared' : 'missing';
    body += `<tr data-status="${status}" data-search="${escapeHtml((row.pomCode + ' ' + row.description + ' ' + row.sourceLabel + ' ' + row.howToMeasure).toLowerCase())}">
<td><b>${escapeHtml(row.pomCode)}</b></td><td><b>${escapeHtml(row.description)}</b><small>Source: ${escapeHtml(row.sourceLabel)}</small></td>
<td>${escapeHtml(row.howToMeasure)}</td><td class="num">${row.hasReference ? row.manufacturerReference : '—'}</td>
<td class="num house">${row.houseStandard}</td><td class="num">${escapeHtml(formatDifference(row.difference))}</td>
<td><span class="status">${row.hasReference ? 'Compared' : 'No reference'}</span></td></tr>`;
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<title>Serpentis Regina — ${escapeHtml(form.formId)} Measurement Sheet</title>
<style>
:root{font-family:system-ui,Arial,sans-serif;color:#302632;background:#faf5f7}*{box-sizing:border-box}
main{max-width:1500px;margin:auto;padding:25px}header{padding:28px 32px;border-radius:18px;color:white;background:linear-gradient(120deg,#402636,#84506b)}
.brand{letter-spacing:.25em;font-size:12px;font-weight:bold}h1{font-family:Georgia,serif;font-weight:normal;font-size:clamp(27px,4vw,44px);margin:12px 0}
header p{opacity:.88}.label{display:inline-block;border:1px solid #ffffff77;padding:5px 10px;border-radius:30px;font-size:11px;font-weight:bold}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}.card{background:white;border:1px solid #eadce3;padding:16px;border-radius:12px}
.card b{display:block;font-size:26px;color:#713755}.card small{color:#726773}.note{background:#fff;border-left:4px solid #b87499;padding:13px 17px;margin:15px 0}
.controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:22px 0 10px}input,button{font:inherit;padding:10px 13px;border-radius:9px;border:1px solid #d6bdcc;background:white}
input{flex:1;min-width:240px}button{cursor:pointer;color:#713755}button[aria-pressed=true]{background:#713755;color:white}button:focus-visible,input:focus-visible{outline:3px solid #c57ca1}
.print{margin-left:auto}.wrap{overflow-x:auto;background:white;border-radius:12px;border:1px solid #eadce3}table{border-collapse:collapse;width:100%;min-width:1100px}
th{background:#f3dfe9;color:#713755;text-align:left;font-size:11px;letter-spacing:.05em;text-transform:uppercase;padding:13px}td{padding:12px;border-bottom:1px solid #eee5eb;vertical-align:top;font-size:13px}
tr:nth-child(even){background:#fdf9fb}td:first-child{color:#713755;white-space:nowrap}td small{display:block;color:#837482;font-size:11px;margin-top:3px}
.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.house{font-weight:bold;color:#983f71;font-size:15px}.status{font-size:11px;background:#f4e8ef;padding:5px 7px;border-radius:20px}
footer{font-size:12px;color:#726773;margin-top:20px}#count{font-size:12px;color:#796978;margin-bottom:8px}
@media(max-width:780px){.cards{grid-template-columns:repeat(2,1fr)}main{padding:12px}header{padding:20px}}
@media print{body{background:white}main{padding:0}.controls{display:none}.wrap{overflow:visible}table{min-width:0;font-size:10px}th,td{padding:5px}tr{break-inside:avoid}}
</style></head><body><main><header><div class="brand">SERPENTIS REGINA · TECHNICAL DESIGN</div>
<h1>House Fit-Form Measurement Sheet</h1><p>${escapeHtml(form.formId)} · Manufacturer size ${escapeHtml(form.manufacturerDesignatedSize)} · Measurements in inches</p>
<span class="label">PUBLIC HOUSE REGISTER · APPROVED STANDARD</span></header>
<section class="cards"><div class="card"><b>${stats.total}</b><small>House POMs</small></div>
<div class="card"><b>${stats.compared}</b><small>Manufacturer comparisons</small></div><div class="card"><b>${stats.missingReferences}</b><small>Missing manufacturer references</small></div><div class="card"><b>${stats.different}</b><small>Non-zero differences</small></div></section>
<div class="note"><b>Comparison rule:</b> Delta = approved house standard − manufacturer reference. “—” means no manufacturer reference, not zero. These differences are not garment tolerances or fit pass/fail results.</div>
<div class="controls"><input id="search" type="search" placeholder="Search POM, description or measuring method" aria-label="Search measurements">
<button data-filter="all" aria-pressed="true">All</button><button data-filter="compared" aria-pressed="false">Compared</button>
<button data-filter="missing" aria-pressed="false">No reference</button><button class="print" onclick="window.print()">Print / Save PDF</button></div>
<div id="count">Showing ${stats.total} of ${stats.total} measurements</div>
<div class="wrap"><table aria-label="House mannequin measurement register"><thead><tr><th>POM</th><th>Body measurement</th><th>How to measure (source)</th><th class="num">Manufacturer (in)</th><th class="num">House standard (in)</th><th class="num">Δ House − Mfr (in)</th><th>Reference</th></tr></thead>
<tbody id="measurements">${body}</tbody></table></div>
<footer><p><b>Source:</b> ${escapeHtml(form.source.document)} · ${escapeHtml(form.source.tab)}. Original Google Sheet currently shows an earlier pending-verification status; it has not been edited. This approved designation comes from the versioned approved record.</p>
<p><b>Project:</b> This register is part of the publicly shared Serpentis Regina learning project. Verify methods and approval trace before manufacturing.</p></footer>
</main><script>
(() => { const search = document.getElementById('search'); const rows = [...document.querySelectorAll('#measurements tr')];
const buttons = [...document.querySelectorAll('[data-filter]')]; let filter = 'all';
function update() { const query = search.value.trim().toLowerCase(); let count = 0;
for (const row of rows) { const show = (filter === 'all' || row.dataset.status === filter) && row.dataset.search.includes(query);
row.hidden = !show; if (show) count++; } document.getElementById('count').textContent = 'Showing ' + count + ' of ' + rows.length + ' measurements'; }
search.addEventListener('input', update); for (const button of buttons) button.addEventListener('click', () => {
filter = button.dataset.filter; for (const item of buttons) item.setAttribute('aria-pressed', String(item === button)); update(); }); })();
</script></body></html>`;
}

export async function writeMeasurementSheet(form, rows, outputArgument) {
  const stats = summarizeRows(rows);
  const outputPath = outputArgument ? resolve(outputArgument) : resolve(ROOT, 'reports/SR-FORM-001-measurement-sheet.html');
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buildHtml(form, rows), 'utf8');
  console.log(`\nSERPENTIS REGINA — HOUSE MEASUREMENT SHEET — ${form.formId}`);
  console.table(rows.map(row => ({ POM: row.pomCode, Measurement: row.description,
    'Mfr (in)': row.hasReference ? row.manufacturerReference : '—', 'HOUSE (in)': row.houseStandard, 'Δ (in)': formatDifference(row.difference) })));
  console.log(`House POMs: ${stats.total}; compared: ${stats.compared}; no reference: ${stats.missingReferences}`);
  console.log(`Offline sheet: ${outputPath}\nPublic learning project — source data remains versioned.\n`);
  return { rows, stats, outputPath };
}
export async function main(outputArgument) {
  const { form, sourceMethods } = await loadHouseData();
  return writeMeasurementSheet(form, buildMeasurementRows(form, sourceMethods), outputArgument);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
}
