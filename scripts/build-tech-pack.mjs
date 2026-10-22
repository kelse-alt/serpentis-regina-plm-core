/** Bundle all six source tabs as a blank, fully offline workroom. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { inlineClientIntakeAssets, loadClientIntakeStyles } from '../src/client-intake-assets.mjs';
const root = new URL('../', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const [index, styles, core, app, template, source, form, methods] = await Promise.all([
  read('workbook-web/index.html'), read('workbook-web/app.css'), read('src/tech-pack.mjs'), read('workbook-web/app.mjs'),
  read('data/templates/tech-pack-workbook.v1.json'), read('data/templates/tech-pack-workbook-source.v1.json'),
  read('data/house-fit-forms/SR-FORM-001.v1.json'), read('data/house-fit-forms/SR-FORM-001-methods.v1.json'),
]);
const baselineStyles = await loadClientIntakeStyles();
const tokens = baselineStyles.slice(0, baselineStyles.indexOf('}') + 1);
const data = { template: JSON.parse(template), source: JSON.parse(source), form: JSON.parse(form), methods: JSON.parse(methods) };
if(data.template.sheets.length !== 6 || data.form.measurements.length !== 20) throw Error('Source tab/reference count mismatch');
const inlineApp = app.replace(/import\s*\{[\s\S]*?\}\s*from\s*['"]\.\.\/src\/tech-pack\.mjs['"];?\s*/, '');
if (/^import\s/m.test(inlineApp)) throw Error('Unbundled module import');
const script = `const WORKBOOK_DATA = ${JSON.stringify(data).replace(/</g,'\\u003c')};\n${core.replace(/^export /gm,'')}\n${inlineApp}`.replace(/<\/script/gi,'<\\/script');
let html = index.replace('<head>',`<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'">`)
 .replace('<link rel="stylesheet" href="/workbook.css">',()=>`<style>${tokens}\n${styles}</style>`)
 .replace('<script type="module" src="/workbook-app.mjs"></script>',()=>`<script type="module">${script}</script>`);
html = await inlineClientIntakeAssets(html);
for(const name of ['mannequin-front.jpg','mannequin-back.jpg']) {
 const dataUrl = `data:image/jpeg;base64,${(await readFile(new URL('assets/house-sheet/'+name,root))).toString('base64')}`;
 html = html.replaceAll('/assets/house-sheet/'+name,dataUrl);
}
await mkdir(new URL('reports/',root),{recursive:true});
await writeFile(new URL('tech-pack.html',root),html);
await writeFile(new URL('reports/tech-pack.html',root),html);
console.log('Built tech-pack.html · six tabs · blank garment drafts · approved 20-POM reference');
