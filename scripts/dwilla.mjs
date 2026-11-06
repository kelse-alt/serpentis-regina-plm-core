#!/usr/bin/env node
// Local CLI: no web listener, uploads, credentials, or production writes.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFitting, validateFitting, fittingSummary, progressFitting } from '../src/dwilla-fitting.mjs';
import { saveFitting, loadFitting } from '../src/dwilla-store.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const store = resolve(root, 'storage/dwilla');
const [command, dictionaryPath, ...args] = process.argv.slice(2);
function privateOutput(path) {
  const out = resolve(path); const rel = relative(root, out);
  if (!rel.startsWith('..') && !rel.startsWith('private/')) throw Error('Output inside checkout must be under private/');
  mkdirSync(dirname(out), { recursive: true, mode: 0o700 });
  return out;
}
try {
  const d = JSON.parse(readFileSync(dictionaryPath, 'utf8'));
  if (command === 'init') {
    const [output, sampleId, sampleRevision, unit, date] = args;
    writeFileSync(privateOutput(output), JSON.stringify(createFitting(d, { sampleId, sampleRevision, unit, date }), null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log('Created private fitting draft; no measurements or approval inferred.');
  } else if (command === 'save') {
    const f = JSON.parse(readFileSync(args[0], 'utf8'));
    console.log(saveFitting(store, f, d));
  } else if (command === 'show') {
    console.log(JSON.stringify(fittingSummary(loadFitting(store, args[0], d), d), null, 2));
  } else if (command === 'advance') {
    const [sha, output, sampleRevision, date] = args;
    const f = progressFitting(loadFitting(store, sha, d), d, { sampleRevision, date, predecessor: sha });
    writeFileSync(privateOutput(output), JSON.stringify(f, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log('Created next fitting draft; readings reset, notes and specs carried forward.');
  } else if (command === 'validate') {
    console.log(JSON.stringify(fittingSummary(validateFitting(JSON.parse(readFileSync(args[0], 'utf8')), d), d), null, 2));
  } else throw Error('Commands: init, validate, save, show, advance. See docs/dwilla-integration.md.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
