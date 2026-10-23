/** Bundle all six source tabs as a blank, fully offline workroom. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { inlineClientIntakeAssets, loadClientIntakeStyles } from '../src/client-intake-assets.mjs';
const root = new URL('../', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const [index, styles, core, persistence, editing, app, template, source, form, methods] = await Promise.all([
  read('workbook-web/index.html'), read('workbook-web/app.css'), read('src/tech-pack.mjs'), read('src/tech-pack-storage.mjs'), read('src/workroom-editing.mjs'), read('workbook-web/app.mjs'),
  read('data/templates/tech-pack-workbook.v1.json'), read('data/templates/tech-pack-workbook-source.v1.json'),
  read('data/house-fit-forms/SR-FORM-001.v1.json'), read('data/house-fit-forms/SR-FORM-001-methods.v1.json'),
]);
const baselineStyles = await loadClientIntakeStyles();
const tokens = baselineStyles.slice(0, baselineStyles.indexOf('}') + 1);
const data = { template: JSON.parse(template), source: JSON.parse(source), form: JSON.parse(form), methods: JSON.parse(methods) };
if(data.template.sheets.length !== 6 || data.form.measurements.length !== 20) throw Error('Source tab/reference count mismatch');
// Each small module keeps its private helpers in its own closure. Named imports
// bind to the bundled modules, so the downloaded file needs no network access.
const bundledNames = {'tech-pack.mjs':'TECHPACK_CORE','tech-pack-storage.mjs':'TECHPACK_STORAGE','workroom-editing.mjs':'TECHPACK_EDITING'};
function bindImports(code) {
 const bound=code.replace(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g,(_match,names,path)=>{
  const module=bundledNames[path.split('/').at(-1)];if(!module)throw Error('Unknown workbook module: '+path);
  return `const {${names.replace(/\s+as\s+/g,':')}} = ${module};`;
 });
 if(/^import\s/m.test(bound))throw Error('Unbundled module import');
 return bound;
}
function bundleModule(name,code) {
 const exports=[...code.matchAll(/^export\s+(?:async\s+)?(?:function|class|const|let)\s+(\w+)/gm)].map(match=>match[1]);
 return `const ${name} = (()=>{\n${bindImports(code).replace(/^export /gm,'')}\nreturn {${exports.join(',')}};\n})();`;
}
const script = `const WORKBOOK_DATA = ${JSON.stringify(data).replace(/</g,'\\u003c')};\n${bundleModule('TECHPACK_CORE',core)}\n${bundleModule('TECHPACK_STORAGE',persistence)}\n${bundleModule('TECHPACK_EDITING',editing)}\n${bindImports(app)}`.replace(/<\/script/gi,'<\\/script');
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
