import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const built = new URL('dist/', root);
const output = new URL('artifacts/pages-site/', root);
const expected = ['assets', 'index.html', 'models'];
const entries = (await readdir(built)).sort();
if (JSON.stringify(entries) !== JSON.stringify(expected)) throw Error('Expected only the portal index, bundled assets and models.');
const models = (await readdir(new URL('models/', built))).sort();
if (JSON.stringify(models) !== JSON.stringify(['crown.glb', 'kelsea-mother.glb', 'serpentis-maiden.glb'])) throw Error('Unexpected portal model files.');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(built, output, { recursive: true });
await writeFile(new URL('.nojekyll', output), '');
await writeFile(new URL('.gitattributes', output), '* -text\nassets/* -diff linguist-generated=true\nmodels/* -diff linguist-generated=true\n');
const files = [];
async function fingerprint(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) await fingerprint(url, relative + '/');
    else {
      const bytes = await readFile(url);
      files.push({ path: relative, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
  }
}
await fingerprint(output);
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fileURLToPath(root), encoding: 'utf8' }).trim();
const sourceBranch = execFileSync('git', ['branch', '--show-current'], { cwd: fileURLToPath(root), encoding: 'utf8' }).trim();
await writeFile(new URL('portal-deployment.json', output), JSON.stringify({
  designVersion: '2.1',
  integration: 'Squarespace',
  sourceRepository: 'kelse-alt/serpentis-regina-plm-core',
  sourceBranch, sourceCommit,
  builtAt: new Date().toISOString(),
  files: files.sort((a, b) => a.path.localeCompare(b.path)),
}, null, 2) + '\n');
console.log(`Pages branch contents ready: ${fileURLToPath(output)}`);
console.log('Publish this directory to portal-site, then select portal-site / (root) in GitHub Settings → Pages.');
