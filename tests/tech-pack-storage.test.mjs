import test from 'node:test';
import assert from 'node:assert/strict';
import { createPackStore } from '../src/tech-pack-storage.mjs';
import { createTechPack } from '../src/tech-pack.mjs';

const template = { id: 'SYNTHETIC-STORAGE-TEMPLATE', sheets: [] };

test('unavailable local storage refuses draft and revision saves instead of reporting memory-only success', async () => {
  const store = createPackStore(template, { indexedDB: null, legacyStorage: null });
  const draft = createTechPack(template);
  await assert.rejects(store.init(), /storage is unavailable.*JSON/);
  await assert.rejects(store.saveDraft(draft), /storage is unavailable/);
  await assert.rejects(store.createRevision(draft, { name: 'Synthetic revision' }), /storage is unavailable/);
});

test('a blocked database reports recovery guidance and closes a late connection', async () => {
  let closed = 0;
  const request = { result: { close() { closed++; } } };
  const factory = { open() { queueMicrotask(() => request.onblocked()); return request; } };
  const store = createPackStore(template, { indexedDB: factory, legacyStorage: null });
  await assert.rejects(store.init(), /blocking.*JSON backup/);
  request.onsuccess();
  assert.equal(closed, 1);
});

test('a denied storage getter leaves the interface able to offer a JSON backup', async () => {
  const options = { get indexedDB() { throw Error('Synthetic denied origin'); } };
  const store = createPackStore(template, options);
  await assert.rejects(store.init(), /storage is unavailable.*JSON/);
});

test('database-open failures are reported without removing legacy browser data', async () => {
  let legacyRead = false;
  const request = { error: Error('Synthetic disk failure') };
  const factory = { open() { queueMicrotask(() => request.onerror()); return request; } };
  const legacyStorage = { getItem() { legacyRead = true; return '[]'; }, removeItem() { throw Error('Must never remove legacy data'); } };
  const store = createPackStore(template, { indexedDB: factory, legacyStorage });
  await assert.rejects(store.init(), /Synthetic disk failure/);
  assert.equal(legacyRead, false);
});
