/** Build a blank, standalone client form from the sanitized workbook template. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const [templateText, index, css, core, app] = await Promise.all([
  readFile(new URL('data/templates/remote-bespoke-client-intake.v1.json', root), 'utf8'),
  readFile(new URL('client-web/index.html', root), 'utf8'),
  readFile(new URL('client-web/app.css', root), 'utf8'),
  readFile(new URL('src/client-intake.mjs', root), 'utf8'),
  readFile(new URL('client-web/app.mjs', root), 'utf8'),
]);
const template = JSON.parse(templateText);
if (template.measurements.length !== 34 || template.fields.some(field => Object.hasOwn(field, 'value'))) {
  throw Error('The build requires the blank, sanitized 34-POM intake template.');
}
const inlineCore = core.replace(/^export /gm, '');
const inlineApp = app.replace(/import\s*\{[\s\S]*?\}\s*from\s*['"]\/client-intake\.mjs['"];?\s*/, '');
if (/^import\s/m.test(inlineApp)) throw Error('The standalone intake must not require external module imports.');
const json = JSON.stringify(template).replace(/</g, '\\u003c');
const script = `window.__OFFLINE_CLIENT_INTAKE__ = true;\nwindow.__CLIENT_INTAKE_TEMPLATE__ = ${json};\n${inlineCore}\n${inlineApp}`
  .replace(/<\/script/gi, '<\\/script');
let html = index
  .replace(/<link\b[^>]*href=["']\/intake\.css["'][^>]*>/, () => `<style>${css}</style>`)
  .replace(/<script\b[^>]*src=["']\/intake-app\.mjs["'][^>]*>\s*<\/script>/, () => `<script type="module">${script}</script>`);
if (html === index || /(?:src|href)=["']\/(?:intake\.(?:css)|intake-app\.mjs|client-intake\.mjs)["']/.test(html)) {
  throw Error('Could not inline every client-intake asset.');
}
html = html.replace('<head>', `<head>\n<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; base-uri 'none'; form-action 'none'">`);
await mkdir(new URL('reports/', root), { recursive: true });
await writeFile(new URL('client-intake.html', root), html, 'utf8');
const output = new URL('reports/client-intake.html', root);
await writeFile(output, html, 'utf8');
console.log(`Blank client intake built from ${template.measurements.length} workbook POMs: ${fileURLToPath(output)}`);
