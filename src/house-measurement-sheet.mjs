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

// Bundle the reusable brand system and original artwork into every offline report.
// The browser never requests fonts, images, or measurements from another service.
const brand = JSON.parse(await readFile(new URL('../design/brand-tokens.json', import.meta.url), 'utf8'));
const [sheetCss, sheetScript] = await Promise.all([
  readFile(new URL('../sheet-web/sheet.css', import.meta.url), 'utf8'),
  readFile(new URL('../sheet-web/sheet.js', import.meta.url), 'utf8'),
]);
const assetTypes = {
  'mannequin-front.jpg': 'image/jpeg',
  'mannequin-back.jpg': 'image/jpeg',
  'serpentis-regina-seal.png': 'image/png',
  'fonts/barlow-condensed-500.ttf': 'font/ttf',
  'fonts/barlow-condensed-700.ttf': 'font/ttf',
};
const assets = Object.fromEntries(await Promise.all(Object.entries(assetTypes).map(async ([name, type]) => {
  const bytes = await readFile(new URL(`../assets/house-sheet/${name}`, import.meta.url));
  return [name, `data:${type};base64,${bytes.toString('base64')}`];
})));
// Electric boxes use Ruby; matte ink is retained outside them. Salmon stays excluded.
const excludedColors = new Set([...brand.houseRules.excludedInterfaceColors, ...brand.houseMeasurementSheet.excludedColors]);
const grainSvg = await readFile(new URL('../sheet-web/matte-grain.svg', import.meta.url));
const sheetColors = { ...brand.colors, 'ash-ink': brand.houseMeasurementSheet.matteInk.color, 'ash-line': brand.houseMeasurementSheet.matteInk.line };
const brandCss = ':root{' + Object.entries(sheetColors).filter(([name]) => !excludedColors.has(name)).map(([name, value]) => `--${name}:${value}`).join(';') + `;--matte-grain:url("data:image/svg+xml;base64,${grainSvg.toString('base64')}")}`;
const fontCss = [
  ['Barlow Condensed', 500, 'fonts/barlow-condensed-500.ttf'],
  ['Barlow Condensed', 700, 'fonts/barlow-condensed-700.ttf'],
].map(([family, weight, file]) => `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url('${assets[file]}') format('truetype')}`).join('\n');

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
function matteText(value) {
  return `<span class="matte-ink">${escapeHtml(value)}</span>`;
}

// Read-only, offline browser report: no external libraries or third-party servers.
export function buildHtml(form, rows) {
  const stats = summarizeRows(rows);
  let body = '';
  for (const row of rows) {
    const status = row.hasReference ? 'compared' : 'missing';
    body += `<tr data-status="${status}" data-search="${escapeHtml((row.pomCode + ' ' + row.description + ' ' + row.sourceLabel + ' ' + row.howToMeasure).toLowerCase())}">
<td class="pom">${matteText(row.pomCode)}</td><td class="measurement-name">${matteText(row.description)}</td>
<td class="method">${matteText(row.howToMeasure)}</td><td class="num mfr">${row.hasReference ? matteText(row.manufacturerReference) : '<span class="missing matte-ink" aria-label="No manufacturer measurement">—</span>'}</td>
<td class="num actual">${matteText(row.houseStandard)}</td><td class="num delta">${row.hasReference ? matteText(formatDifference(row.difference)) : '<span class="missing matte-ink" aria-label="Delta unavailable without manufacturer measurement">—</span>'}</td></tr>`;
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; base-uri 'none'; form-action 'none'">
<title>Serpentis Regina — ${escapeHtml(form.formId)} Measurement Sheet</title>
<link rel="icon" href="data:,">
<style>${brandCss}\n${fontCss}\n${sheetCss}</style></head><body>
<a class="skip-link" href="#measurement-chart">Skip to measurements</a>
<main class="sheet"><header class="masthead"><div class="title-bar">
<div class="brand-line"><span class="wordmark">SERPENTIS REGINA</span><span class="division">Technical design / House archive</span><span class="case">CASE / 001</span></div>
<h1><span class="title-subject">Mannequin</span> <span class="title-primary">Measurement Sheet</span></h1>
<div class="identity-strip"><strong>${escapeHtml(form.formId)}</strong><span>SIZE ${escapeHtml(form.manufacturerDesignatedSize)}</span><span>INCHES</span><span>${stats.total} POINTS OF MEASURE</span><span class="approval">Approved house standard</span></div>
</div><div class="seal-zone"><div class="seal"><img src="${assets['serpentis-regina-seal.png']}" alt="Serpentis Regina sculpted head seal" width="1366" height="892"></div></div>
</header>
<section class="workspace" aria-label="Mannequin measurement study">
<aside class="form-panel" aria-labelledby="form-heading">
<div class="panel-heading"><span class="section-number" aria-hidden="true">01</span><h2 id="form-heading">The house form</h2></div>
<div class="photo-pair">
<figure><img src="${assets['mannequin-front.jpg']}" alt="Front view of the actual size 8 house mannequin" width="724" height="2048"><figcaption>Front</figcaption></figure>
<figure><img src="${assets['mannequin-back.jpg']}" alt="Back view of the actual size 8 house mannequin" width="696" height="2048"><figcaption>Back</figcaption></figure>
</div>
<div class="form-caption"><p>ACTUAL FORM<strong>The physical house standard.</strong></p><span class="size-tag" aria-label="Manufacturer designated size ${escapeHtml(form.manufacturerDesignatedSize)}">${escapeHtml(form.manufacturerDesignatedSize)}</span></div>
</aside>
<section class="measurement-panel" aria-labelledby="measurement-heading">
<div class="panel-heading measure-heading"><div class="heading-group"><span class="section-number" aria-hidden="true">02</span><h2 id="measurement-heading">Measurements</h2></div><span class="unit-tag">UNIT / IN</span></div>
<div class="toolbar"><label class="search-field"><span class="sr-only">Search measurements</span><input id="search" type="search" placeholder="Find a measurement…"></label>
<button type="button" data-filter="all" aria-pressed="true">All ${stats.total}</button><button type="button" data-filter="compared" aria-pressed="false">With MFR ${stats.compared}</button>
<button type="button" data-filter="missing" aria-pressed="false">MFR missing ${stats.missingReferences}</button><button type="button" class="print" id="print-sheet">Print / PDF</button></div>
<div class="table-caption"><span id="count" role="status" aria-live="polite">Showing ${stats.total} of ${stats.total} measurements</span><span class="formula">Δ = ACTUAL FORM − MFR</span></div>
<div class="table-scroll" id="measurement-chart" tabindex="0" role="region" aria-label="Scrollable measurement chart; use arrow keys to scroll">
<table aria-label="House mannequin measurement register"><colgroup><col class="pom-col"><col class="name-col"><col class="method-col"><col class="mfr-col"><col class="actual-col"><col class="delta-col"></colgroup>
<thead><tr><th scope="col">POM</th><th scope="col">Body measurement</th><th scope="col">How to measure</th><th scope="col" class="num">MFR</th><th scope="col" class="num actual-heading">Actual form</th><th scope="col" class="num">Delta</th></tr></thead>
<tbody id="measurements">${body}</tbody></table>
<p class="empty-state" id="empty-state" hidden>No measurements match. Try another search or choose All.</p>
<details class="record-notes"><summary>Record history & measurement notes</summary>
<p>PUBLIC HOUSE REGISTER · ${escapeHtml(form.source.document)} · ${escapeHtml(form.source.tab)}. Original Google Sheet currently shows an earlier pending-verification status; it has not been edited. This approved designation comes from the versioned approved record.</p>
<p>Delta = approved house standard − manufacturer reference. These differences are not garment tolerances or fit pass/fail results. Verify methods and approval trace before manufacturing.</p></details>
</div>
<div class="panel-foot"><p>“—” means no MFR value, so no delta is calculated.</p><span class="scroll-hint">Scroll the chart ↕</span></div>
</section></section></main><script>${sheetScript}</script></body></html>`;
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
