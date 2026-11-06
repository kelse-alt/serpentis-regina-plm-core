import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWorkroomBackup, MAX_WORKROOM_BACKUP_BYTES, createPackStore } from '../src/tech-pack-storage.mjs';
import { createTechPack } from '../src/tech-pack.mjs';

const template = { id: 'SYNTHETIC-BACKUP-TEMPLATE', sheets: [] };
function archive() {
  const pack = createTechPack(template);
  return { format: 'serpentis-regina-workroom-backup', version: 1, createdAt: '2026-11-06T12:00:00.000Z',
    drafts: [pack], revisions: [{ id: 'revision-synthetic', packId: pack.id, name: 'Synthetic first review',
      author: 'Synthetic reviewer', reason: 'Synthetic baseline', createdAt: '2026-11-06T12:00:00.000Z', snapshot: structuredClone(pack) }] };
}

test('portable backup validates the complete draft and immutable named history without aliasing input', () => {
  const source = archive(), result = validateWorkroomBackup(JSON.stringify(source), template);
  assert.deepEqual(result, source);
  result.drafts[0].title = 'Changed after validation';
  assert.notEqual(result.drafts[0].title, source.drafts[0].title);
  assert.equal(result.revisions[0].snapshot.title, source.revisions[0].snapshot.title);
  assert.equal(MAX_WORKROOM_BACKUP_BYTES, 100 * 1024 * 1024);
});

test('backup rejects unknown envelopes, revisions, dates and unsupported pack data', () => {
  const checks = [
    value => { value.format = 'unrelated'; },
    value => { value.extra = true; },
    value => { value.createdAt = '2026-02-30T12:00:00.000Z'; },
    value => { value.revisions[0].extra = true; },
    value => { value.revisions[0].snapshot.schemaVersion = 99; },
    value => { value.revisions[0].packId = 'different-pack'; },
    value => { value.revisions[0].name = ''; },
    value => { value.revisions[0].id = '../outside'; },
  ];
  for (const change of checks) {
    const source = archive(); change(source);
    assert.throws(() => validateWorkroomBackup(source, template));
  }
  assert.throws(() => validateWorkroomBackup('{broken', template), /valid JSON/);
});

test('duplicate identities and excessive record counts are refused before recovery', () => {
  const duplicateDraft = archive(); duplicateDraft.drafts.push(structuredClone(duplicateDraft.drafts[0]));
  assert.throws(() => validateWorkroomBackup(duplicateDraft, template), /duplicate draft/);
  const duplicateRevision = archive(); duplicateRevision.revisions.push(structuredClone(duplicateRevision.revisions[0]));
  assert.throws(() => validateWorkroomBackup(duplicateRevision, template), /duplicate revision/);
  const excessive = archive(); excessive.drafts = Array.from({ length: 101 }, () => excessive.drafts[0]);
  assert.throws(() => validateWorkroomBackup(excessive, template), /100 drafts/);
});

test('backup read and recovery report unavailable persistence as errors', async () => {
  const store = createPackStore(template, { indexedDB: null, legacyStorage: null });
  await assert.rejects(store.exportBackup(), /storage is unavailable/);
  await assert.rejects(store.importBackup(archive()), /storage is unavailable/);
});
