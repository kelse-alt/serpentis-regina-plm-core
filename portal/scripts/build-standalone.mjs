import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
let html = await readFile(new URL('dist/index.html', root), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g)];
const styles = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)];
if (scripts.length !== 1 || styles.length !== 1) throw Error('Expected one bundled script and stylesheet.');

const models = {};
for (const name of ['kelsea-mother.glb', 'serpentis-maiden.glb', 'crown.glb']) {
  const bytes = await readFile(new URL('public/models/' + name, root));
  models[name] = 'data:model/gltf-binary;base64,' + bytes.toString('base64');
}
const script = await readFile(new URL('dist/' + scripts[0][1].replace(/^\//, ''), root), 'utf8');
const css = await readFile(new URL('dist/' + styles[0][1].replace(/^\//, ''), root), 'utf8');
if (/\b(?:import|export)\s+[^;]*\bfrom\s*['"]/.test(script)) throw Error('The standalone bundle cannot depend on external modules.');

html = html.replace(scripts[0][0], () =>
  '<script>window.__PORTAL_MODEL_URLS__=' + JSON.stringify(models) + ';</script>\n' +
  '<script type="module">' + script.replace(/<\/script/gi, '<\\/script') + '</script>');
html = html.replace(styles[0][0], () => '<style>' + css + '</style>');
html = html.replace('<body>', '<body id="top">').replace('class="wordmark" href="./"', 'class="wordmark" href="#top"');
if (/\b(?:src|href)="\/(?:assets|models)\//.test(html)) throw Error('The standalone file still contains external app resources.');
const output = new URL('Serpentis-Regina-Portal.html', root);
await writeFile(output, html);
console.log(`Ready-to-open portal: ${fileURLToPath(output)} (${Buffer.byteLength(html)} bytes)`);
