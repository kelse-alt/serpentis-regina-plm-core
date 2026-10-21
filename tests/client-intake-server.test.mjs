import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createClientIntakeServer } from '../src/client-intake-server.mjs';
import { createIntakeDraft, summarizeIntake } from '../src/client-intake.mjs';

async function start(databasePath) {
  const server = await createClientIntakeServer({ databasePath });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

async function stop(server) {
  if (server.listening) await new Promise((resolveStop, reject) => server.close(error => error ? reject(error) : resolveStop()));
}

async function withServer(run) {
  const directory = await mkdtemp(join(tmpdir(), 'sr-client-intake-test-'));
  const databasePath = join(directory, 'client-intakes.sqlite');
  let running;
  try {
    running = await start(databasePath);
    const response = await fetch(`${running.base}/api/client-intake/template`);
    assert.equal(response.status, 200);
    const template = await response.json();
    await run({ ...running, template, databasePath });
  } finally {
    if (running) await stop(running.server);
    await rm(directory, { recursive: true, force: true });
  }
}

function newIntake(template) {
  const draft = createIntakeDraft(template);
  draft.fields.clientId = 'DEMO-TEST';
  draft.fields.clientName = 'Demo client';
  draft.fields.measurementDate = '2026-10-20';
  return draft;
}

function post(base, intake, headers = {}) {
  return fetch(`${base}/api/client-intake/sessions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(intake),
  });
}

async function list(base) {
  const response = await fetch(`${base}/api/client-intake/sessions`);
  assert.equal(response.status, 200);
  return (await response.json()).sessions;
}

test('client intake serves its separate 34-POM workbook template with 19 required measurements', async () => {
  await withServer(async ({ base, template }) => {
    const source = JSON.parse(await readFile(new URL('../data/templates/remote-bespoke-client-intake.v1.json', import.meta.url), 'utf8'));
    assert.deepEqual(template, source);
    assert.equal(template.measurements.length, 34);
    assert.equal(template.measurements.filter(record => record.required).length, 19);
    assert.ok(!template.measurements.some(record => record.pomCode === 'RC-21'));
    assert.deepEqual(template.unitOptions, ['CM', 'IN']);
    assert.equal(template.defaultUnit, 'CM');
    assert.deepEqual(await list(base), []);
  });
});

test('partial drafts save and reopen canonical-centimeter values, zero, nulls, and client fields', async () => {
  await withServer(async ({ base, template }) => {
    const intake = newIntake(template);
    intake.unit = 'IN';
    intake.fields.foundationGarments = 'Demo foundation notes';
    intake.croquisReference = 'Demo separate PDF reference';
    intake.clientReference = 'Demo client notes';
    intake.measurements[0].valueCm = 25.4;
    intake.measurements[1].valueCm = 0;
    const response = await post(base, intake);
    assert.equal(response.status, 201);
    const saved = await response.json();
    assert.match(saved.id, /^[0-9a-f-]{36}$/);
    assert.ok(Number.isFinite(Date.parse(saved.createdAt)));
    assert.deepEqual(saved.intake, intake);
    assert.equal(saved.intake.unit, 'IN');
    assert.equal(saved.intake.measurements[0].valueCm, 25.4);
    assert.equal(saved.intake.measurements[1].valueCm, 0);
    assert.equal(saved.intake.measurements[2].valueCm, null);
    const loaded = await fetch(`${base}/api/client-intake/sessions/${saved.id}`);
    assert.equal(loaded.status, 200);
    assert.deepEqual(await loaded.json(), saved);
    const records = await list(base);
    const stats = summarizeIntake(intake, template);
    assert.deepEqual(records, [{ id: saved.id, title: 'DEMO-TEST · Demo client', createdAt: saved.createdAt,
      unit: 'IN', measuredCount: 2, requiredMeasured: stats.requiredMeasured, requiredTotal: 19 }]);
  });
});

test('saving a changed client draft creates a new record without changing the original', async () => {
  await withServer(async ({ base, template }) => {
    const original = newIntake(template);
    original.measurements[0].valueCm = 100;
    const firstResponse = await post(base, original);
    assert.equal(firstResponse.status, 201);
    const first = await firstResponse.json();
    const changed = structuredClone(original);
    changed.measurements[0].valueCm = 101;
    const secondResponse = await post(base, changed);
    assert.equal(secondResponse.status, 201);
    const second = await secondResponse.json();
    assert.notEqual(second.id, first.id);
    assert.equal((await list(base)).length, 2);
    assert.deepEqual(await (await fetch(`${base}/api/client-intake/sessions/${first.id}`)).json(), first);
  });
});

test('client drafts persist after restart in a separate database without modifying house records', async () => {
  await withServer(async ({ base, server, databasePath, template }) => {
    const paths = [new URL('../data/house-fit-forms/SR-FORM-001.v1.json', import.meta.url),
      new URL('../data/house-fit-forms/SR-FORM-001-methods.v1.json', import.meta.url)];
    const before = await Promise.all(paths.map(path => readFile(path)));
    const intake = newIntake(template);
    intake.measurements[0].valueCm = 96;
    const saved = await (await post(base, intake)).json();
    await stop(server);
    const restarted = await start(databasePath);
    try {
      assert.deepEqual(await (await fetch(`${restarted.base}/api/client-intake/sessions/${saved.id}`)).json(), saved);
      const database = new DatabaseSync(databasePath, { readOnly: true });
      try {
        const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(row => row.name);
        assert.deepEqual(tables, ['client_intakes']);
        assert.equal(database.prepare('SELECT COUNT(*) AS total FROM client_intakes').get().total, 1);
      } finally { database.close(); }
      assert.deepEqual(await Promise.all(paths.map(path => readFile(path))), before);
    } finally { await stop(restarted.server); }
  });
});

test('invalid client drafts are rejected without leaving saved records', async () => {
  await withServer(async ({ base, template }) => {
    const cases = [
      intake => { intake.measurements[0].pomCode = 'UNKNOWN'; },
      intake => { intake.measurements[1].pomCode = intake.measurements[0].pomCode; },
      intake => { intake.measurements.pop(); },
      intake => { intake.unit = 'MM'; },
      intake => { intake.measurements[0].valueCm = -1; },
      intake => { intake.measurements[0].valueCm = '100'; },
      intake => { intake.fields.measurementDate = '2026-02-30'; },
      intake => { intake.fields.clientName = {}; },
    ];
    for (const change of cases) {
      const intake = newIntake(template);
      change(intake);
      const response = await post(base, intake);
      assert.equal(response.status, 422);
      assert.equal(typeof (await response.json()).error, 'string');
    }
    assert.deepEqual(await list(base), []);
  });
});

test('malformed JSON, wrong content type, and oversized client intakes are rejected', async () => {
  await withServer(async ({ base }) => {
    const malformed = await fetch(`${base}/api/client-intake/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400);
    const wrongType = await fetch(`${base}/api/client-intake/sessions`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
    assert.equal(wrongType.status, 415);
    assert.equal((await post(base, { clientReference: 'x'.repeat(140_000) })).status, 413);
    const chunkedStatus = await new Promise((resolveStatus, reject) => {
      const request = httpRequest(`${base}/api/client-intake/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, response => {
        response.resume();
        response.on('end', () => resolveStatus(response.statusCode));
      });
      request.on('error', reject);
      request.write('{"clientReference":"');
      request.write('x'.repeat(132_000));
      request.end('"}');
    });
    assert.equal(chunkedStatus, 413);
    assert.deepEqual(await list(base), []);
  });
});

test('foreign origins and non-loopback Host values cannot save client information', async () => {
  await withServer(async ({ base, template }) => {
    const intake = newIntake(template);
    assert.equal((await post(base, intake, { Origin: 'https://example.invalid' })).status, 403);
    const status = await new Promise((resolveStatus, reject) => {
      const request = httpRequest(`${base}/api/client-intake/sessions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Host: 'example.invalid' },
      }, response => {
        response.resume();
        response.on('end', () => resolveStatus(response.statusCode));
      });
      request.on('error', reject);
      request.end(JSON.stringify(intake));
    });
    assert.equal(status, 403);
    assert.deepEqual(await list(base), []);
    assert.equal((await post(base, intake, { Origin: base })).status, 201);
  });
});

test('the client application serves only declared assets and API methods', async () => {
  await withServer(async ({ base }) => {
    const asset = await fetch(`${base}/client-intake.mjs`);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /javascript/);
    assert.match(asset.headers.get('content-security-policy'), /default-src 'none'/);
    assert.equal(asset.headers.get('access-control-allow-origin'), null);
    assert.match(await asset.text(), /validateIntakeDraft/);
    assert.equal((await fetch(`${base}/storage/client-intakes.sqlite`)).status, 404);
    assert.equal((await fetch(`${base}/data/templates/remote-bespoke-client-intake.v1.json`)).status, 404);
    assert.equal((await fetch(`${base}/api/client-intake/sessions/00000000-0000-0000-0000-000000000000`)).status, 404);
    assert.equal((await fetch(`${base}/api/client-intake/sessions`, { method: 'DELETE' })).status, 405);
    const error = await fetch(`${base}/api/client-intake/no-such-route`);
    assert.equal(error.status, 404);
    assert.doesNotMatch(await error.text(), /SELECT|SQLITE|\.mjs|stack/i);
  });
});
