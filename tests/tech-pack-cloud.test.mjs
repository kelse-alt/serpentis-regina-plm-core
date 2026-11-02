import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudPackStore } from '../src/tech-pack-cloud.mjs';
import { createTechPack, normalizeTechPack } from '../src/tech-pack.mjs';

const template = { id: 'SYNTHETIC-CLOUD-TEMPLATE', sheets: [] };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const isConflict = error => error.name === 'ConflictError' && error.status === 409;

function syntheticPack() {
  const pack = createTechPack(template);
  pack.id = 'synthetic-cloud-pack';
  pack.title = 'Synthetic working pack';
  pack.style.number = 'SYN-001';
  return pack;
}

/** A remote compare-and-swap boundary shared by independent browser stores. */
function remotePack(initial, version = 1) {
  const state = { pack: structuredClone(initial), version };
  const requests = [];
  const metadata = () => ({ id: state.pack.id, title: state.pack.title,
    updatedAt: state.pack.updatedAt, version: state.version,
    styleNumber: state.pack.style.number, description: state.pack.style.description });
  async function fetch(path, options) {
    requests.push({ path, method: options.method,
      body: options.body === undefined ? undefined : JSON.parse(options.body),
      credentials: options.credentials, cache: options.cache });
    if (options.method === 'PUT') {
      const body = JSON.parse(options.body);
      if (body.expectedVersion !== state.version) return json({ error: 'Synthetic newer remote draft' }, 409);
      state.pack = structuredClone(body.pack);
      state.version++;
      return json(metadata());
    }
    if (path === '/api/packs') return json({ packs: [metadata()] });
    return json({ pack: state.pack, version: state.version });
  }
  return { state, requests, fetch };
}

test('directory reads never grant permission to overwrite an unseen cloud draft', async () => {
  const pack = syntheticPack(), api = remotePack(pack, 7);
  const store = createCloudPackStore(template, { fetch: api.fetch });
  assert.equal((await store.listDrafts())[0].version, 7);
  await assert.rejects(store.saveDraft(pack), isConflict);
  assert.equal(api.requests.find(request => request.method === 'PUT').body.expectedVersion, null);
  assert.equal(api.state.version, 7);
  assert.ok(api.requests.every(request => request.credentials === 'same-origin' && request.cache === 'no-store'));
});

test('a stale device retains its input and lease until it opens the newer saved pack', async () => {
  const original = syntheticPack(), api = remotePack(original);
  const store = createCloudPackStore(template, { fetch: api.fetch });
  const local = await store.getDraft(original.id);
  local.title = 'Synthetic unsaved device edit';
  const before = structuredClone(local);
  api.state.pack.title = 'Synthetic edit from another device';
  api.state.version = 2;
  await store.listDrafts(); // Seeing newer metadata must not adopt its lease.
  await assert.rejects(store.saveDraft(local), isConflict);
  await assert.rejects(store.saveDraft(local), isConflict);
  assert.deepEqual(local, before);
  assert.equal(api.state.pack.title, 'Synthetic edit from another device');
  assert.deepEqual(api.requests.filter(request => request.method === 'PUT').map(request => request.body.expectedVersion), [1, 1]);
  const reopened = await store.getDraft(original.id);
  reopened.title = 'Synthetic reviewed merge';
  assert.equal((await store.saveDraft(reopened)).version, 3);
  assert.equal(api.state.pack.title, 'Synthetic reviewed merge');
});

test('rejecting a read after concurrent editing cannot adopt an unseen remote version', async () => {
  const pack = syntheticPack(), api = remotePack(pack);
  const store = createCloudPackStore(template, { fetch: api.fetch });
  const local = await store.getDraft(pack.id);
  api.state.version = 2;
  await assert.rejects(store.getDraft(pack.id, { acceptIf: () => false }), /draft changed while cloud data was loading/);
  local.title = 'Synthetic edit retained on screen';
  await assert.rejects(store.saveDraft(local), isConflict);
  assert.equal(api.requests.at(-1).body.expectedVersion, 1);
  assert.equal(api.state.pack.title, pack.title);
});

test('overlapping saves use captured snapshots and serialize their version leases', async () => {
  const pack = syntheticPack(), api = remotePack(pack);
  const entered = Promise.withResolvers(), release = Promise.withResolvers();
  let inFlight = 0, maximumInFlight = 0, writes = 0;
  const store = createCloudPackStore(template, { fetch: async (path, options) => {
    if (options.method !== 'PUT') return api.fetch(path, options);
    inFlight++;maximumInFlight = Math.max(maximumInFlight, inFlight);
    try {
      if (++writes === 1) { entered.resolve();await release.promise; }
      return await api.fetch(path, options);
    } finally { inFlight--; }
  } });
  await store.getDraft(pack.id);
  const first = structuredClone(pack), second = structuredClone(pack);
  first.title = 'Synthetic first snapshot';second.title = 'Synthetic second snapshot';
  const savingFirst = store.saveDraft(first);
  await entered.promise;
  const savingSecond = store.saveDraft(second);
  second.title = 'Later typing must not alter the queued snapshot';
  release.resolve();
  const results = await Promise.all([savingFirst, savingSecond]);
  assert.deepEqual(results.map(result => result.version), [2, 3]);
  assert.deepEqual(api.requests.filter(request => request.method === 'PUT').map(request => request.body.expectedVersion), [1, 2]);
  assert.equal(maximumInFlight, 1);
  assert.equal(api.state.pack.title, 'Synthetic second snapshot');
});

test('named revisions reopen their own normalized snapshot across browser stores', async () => {
  const snapshot = syntheticPack();snapshot.style.description = 'Synthetic fitting milestone';
  const original = structuredClone(snapshot);
  const revision = { id: 'synthetic-revision', packId: snapshot.id, name: 'Synthetic fitting',
    author: 'Synthetic tester', reason: 'Synthetic reviewed change', createdAt: '2026-11-02T17:00:00Z' };
  const posted = [];
  const fetch = async (path, options) => {
    if (options.method === 'POST') { posted.push(JSON.parse(options.body));return json(revision); }
    if (path.endsWith('/revisions')) return json({ revisions: [revision] });
    return json({ pack: original, revision });
  };
  const writer = createCloudPackStore(template, { fetch });
  await writer.createRevision(snapshot, { name: revision.name, author: revision.author, reason: revision.reason });
  snapshot.style.description = 'Later draft edit';
  const anotherDevice = createCloudPackStore(template, { fetch });
  assert.deepEqual(await anotherDevice.listRevisions(snapshot.id), [revision]);
  assert.deepEqual(await anotherDevice.getRevision(revision.id), normalizeTechPack(original, template));
  assert.equal(posted[0].pack.style.description, 'Synthetic fitting milestone');
  assert.equal(posted[0].reason, revision.reason);
});

test('a failed cloud save never confirms success or advances the accepted version', async () => {
  const pack = syntheticPack(), api = remotePack(pack);
  let unavailable = true, succeeded = false;
  const store = createCloudPackStore(template, { fetch: async (path, options) => {
    if (options.method === 'PUT' && unavailable) return json({ error: 'Synthetic service outage' }, 503);
    return api.fetch(path, options);
  } });
  const local = await store.getDraft(pack.id);
  local.title = 'Synthetic retry after outage';
  const before = structuredClone(local);
  await assert.rejects(store.saveDraft(local).then(() => { succeeded = true; }), /Synthetic service outage/);
  assert.equal(succeeded, false);
  assert.deepEqual(local, before);
  assert.equal(api.state.version, 1);
  unavailable = false;
  assert.equal((await store.saveDraft(local)).version, 2);
  assert.equal(api.requests.at(-1).body.expectedVersion, 1);
  assert.equal(api.state.pack.title, local.title);
});
