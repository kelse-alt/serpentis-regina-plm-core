import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateFitting } from './dwilla-fitting.mjs';
export const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function saveFitting(directory, fitting, dictionary) {
  const clean = validateFitting(fitting, dictionary);
  const sha = fingerprint(clean);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = join(directory, `${sha}.json`);
  try { writeFileSync(file, JSON.stringify(clean, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
  catch (e) { if (e.code !== 'EEXIST') throw e; loadFitting(directory, sha, dictionary); }
  return sha;
}
export function loadFitting(directory, sha, dictionary) {
  if (!/^[a-f0-9]{64}$/.test(sha)) throw Error('Invalid snapshot ID');
  const value = JSON.parse(readFileSync(join(directory, `${sha}.json`), 'utf8'));
  if (fingerprint(value) !== sha) throw Error('Snapshot fingerprint mismatch');
  return validateFitting(value, dictionary);
}
