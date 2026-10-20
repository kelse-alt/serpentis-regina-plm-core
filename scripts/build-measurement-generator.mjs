/** Build one downloadable HTML application with no external assets or service. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadHouseData, buildMeasurementRows } from '../src/house-measurement-sheet.mjs';

const root = new URL('../', import.meta.url);
const { form, sourceMethods } = await loadHouseData();
const template = {
  formId: form.formId, revision: 'v1', unit: form.unit,
  measurements: buildMeasurementRows(form, sourceMethods).map(record => ({
    pomCode: record.pomCode, description: record.description,
    sourceLabel: record.sourceLabel, howToMeasure: record.howToMeasure,
    houseStandard: record.houseStandard, manufacturerReference: record.manufacturerReference,
  })),
};
const [index, css, core, app] = await Promise.all([
  readFile(new URL('web/index.html', root), 'utf8'),
  readFile(new URL('web/app.css', root), 'utf8'),
  readFile(new URL('src/measurement-session.mjs', root), 'utf8'),
  readFile(new URL('web/app.mjs', root), 'utf8'),
]);
const inlineCore = core.replace(/^export /gm, '');
const inlineApp = app.replace(/import\s*\{[\s\S]*?\}\s*from\s*['"]\/measurement-session\.mjs['"];?\s*/, '');
if (/^import\s/m.test(inlineApp)) throw Error('The standalone app must not require external module imports.');
const json = JSON.stringify(template).replace(/</g, '\\u003c');
const script = `window.__OFFLINE_GENERATOR__ = true;\nwindow.__MEASUREMENT_TEMPLATE__ = ${json};\n${inlineCore}\n${inlineApp}`
  .replace(/<\/script/gi, '<\\/script');
let html = index
  .replace(/<link\b[^>]*href=["']\/app\.css["'][^>]*>/, () => `<style>${css}</style>`)
  .replace(/<script\b[^>]*src=["']\/app\.mjs["'][^>]*>\s*<\/script>/, () => `<script type="module">${script}</script>`);
if (html === index || /(?:src|href)=["']\/(?:app\.(?:css|mjs)|measurement-session\.mjs)["']/.test(html)) {
  throw Error('Could not inline every application asset.');
}
html = html.replace('<head>', `<head>\n<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; base-uri 'none'; form-action 'none'">`);
await mkdir(new URL('reports/', root), { recursive: true });
const output = new URL('reports/measurement-sheet-generator.html', root);
await writeFile(output, html, 'utf8');
// Include a ready-to-open copy in GitHub source ZIPs, with no user session data.
await writeFile(new URL('measurement-sheet-generator.html', root), html, 'utf8');
console.log(`Standalone generator built with all ${template.measurements.length} POMs: ${fileURLToPath(output)}`);
