import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createGeneratorServer } from '../src/measurement-generator-server.mjs';
import { createMeasurementSession, calculateDelta } from '../src/measurement-session.mjs';
import { loadHouseData, buildMeasurementRows } from '../src/house-measurement-sheet.mjs';
import { readHouseForm } from '../src/house-measurement-database.mjs';

async function start(databasePath) {
  const server = await createGeneratorServer({ databasePath });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

async function stop(server) {
  if (!server.listening) return;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

async function withServer(run) {
  const directory = await mkdtemp(join(tmpdir(), 'sr-measurement-generator-'));
  const databasePath = join(directory, 'generator.sqlite');
  let running;
  try {
    running = await start(databasePath);
    const template = await (await fetch(`${running.base}/api/template`)).json();
    await run({ ...running, databasePath, template });
  } finally {
    if (running) await stop(running.server);
    await rm(directory, { recursive: true, force: true });
  }
}

function newSession(template, options = {}) {
  const session = createMeasurementSession(template, {
    name: 'Test measurement session', measurementDate: '2026-10-20', ...options,
  });
  session.measurements[0].measured = 42;
  return session;
}

function post(base, session, extraHeaders = {}) {
  return fetch(`${base}/api/sessions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...extraHeaders }, body: JSON.stringify(session),
  });
}

async function list(base) {
  const response = await fetch(`${base}/api/sessions`);
  assert.equal(response.status, 200);
  return (await response.json()).sessions;
}

test('the generator exposes the exact approved 20-POM template and starts with no new sessions', async () => {
  await withServer(async ({ base, template }) => {
    const { form, sourceMethods } = await loadHouseData();
    assert.equal(template.formId, form.formId);
    assert.equal(template.revision, 'v1');
    assert.equal(template.unit, 'in');
    const original = buildMeasurementRows(form, sourceMethods);
    assert.equal(template.measurements.length, 20);
    for (const [index, row] of template.measurements.entries()) {
      for (const field of ['pomCode', 'description', 'sourceLabel', 'howToMeasure', 'houseStandard', 'manufacturerReference']) {
        assert.equal(row[field], original[index][field]);
      }
    }
    assert.deepEqual(await list(base), []);
  });
});

test('new measurements, explicit zero, blank references, and metadata survive save and load', async () => {
  await withServer(async ({ base, template }) => {
    const session = newSession(template, { referenceMode: 'manufacturer', note: 'New sample, not an approval.' });
    session.measurements[0].measured = session.measurements[0].reference + 0.5;
    session.measurements[1].measured = 0;
    session.measurements[3].measured = 35;
    const response = await post(base, session);
    assert.equal(response.status, 201);
    const saved = await response.json();
    assert.match(saved.id, /^[0-9a-f-]{36}$/);
    assert.ok(Number.isFinite(Date.parse(saved.createdAt)));
    assert.deepEqual(saved.session, session);
    assert.equal(calculateDelta(saved.session.measurements[0].measured, saved.session.measurements[0].reference), 0.5);
    assert.equal(saved.session.measurements[1].measured, 0);
    assert.equal(saved.session.measurements[3].reference, null);
    assert.equal(calculateDelta(saved.session.measurements[3].measured, saved.session.measurements[3].reference), null);
    const reopened = await fetch(`${base}/api/sessions/${saved.id}`);
    assert.equal(reopened.status, 200);
    assert.deepEqual(await reopened.json(), saved);
    const records = await list(base);
    assert.equal(records.length, 1);
    assert.equal(records[0].id, saved.id);
    assert.equal(records[0].name, session.name);
    assert.equal(records[0].measurementDate, session.measurementDate);
    assert.equal(records[0].referenceMode, 'manufacturer');
    assert.equal(records[0].measuredCount, 3);
  });
});

test('saving another version creates a new session and leaves the first saved record unchanged', async () => {
  await withServer(async ({ base, template }) => {
    const original = newSession(template);
    const first = await (await post(base, original)).json();
    const changed = structuredClone(original);
    changed.name = 'Second measurement session';
    changed.measurements[0].measured += 1;
    const secondResponse = await post(base, changed);
    assert.equal(secondResponse.status, 201);
    const second = await secondResponse.json();
    assert.notEqual(first.id, second.id);
    assert.equal((await list(base)).length, 2);
    assert.deepEqual(await (await fetch(`${base}/api/sessions/${first.id}`)).json(), first);
  });
});

test('sessions persist after a server restart while approved sources and database records remain unchanged', async () => {
  await withServer(async ({ base, template, server, databasePath }) => {
    const paths = [new URL('../data/house-fit-forms/SR-FORM-001.v1.json', import.meta.url),
      new URL('../data/house-fit-forms/SR-FORM-001-methods.v1.json', import.meta.url)];
    const sourceBefore = await Promise.all(paths.map(path => readFile(path, 'utf8')));
    const session = newSession(template, { referenceMode: 'custom' });
    session.measurements[0].reference = 40;
    const saved = await (await post(base, session)).json();
    await stop(server);
    const restarted = await start(databasePath);
    try {
      assert.deepEqual(await (await fetch(`${restarted.base}/api/sessions/${saved.id}`)).json(), saved);
      assert.equal((await list(restarted.base)).length, 1);
      const database = new DatabaseSync(databasePath, { readOnly: true });
      try {
        const { form, sourceMethods } = await loadHouseData();
        const baseline = readHouseForm(database);
        assert.deepEqual(baseline.form, form);
        assert.deepEqual(baseline.sourceMethods, sourceMethods);
        assert.equal(baseline.rows.length, 20);
        assert.equal(database.prepare('SELECT COUNT(*) AS total FROM measurement_sessions').get().total, 1);
      } finally { database.close(); }
      assert.deepEqual(await Promise.all(paths.map(path => readFile(path, 'utf8'))), sourceBefore);
    } finally { await stop(restarted.server); }
  });
});

test('invalid sessions are rejected without leaving any partially saved records', async () => {
  await withServer(async ({ base, template }) => {
    const cases = [
      session => { session.measurements[0].pomCode = 'UNKNOWN-POM'; },
      session => { session.measurements[1].pomCode = session.measurements[0].pomCode; },
      session => { session.measurements.pop(); },
      session => { session.measurements[0].reference += 1; },
      session => { session.measurements[0].measured = -1; },
      session => { session.measurements[0].measured = 'Infinity'; },
      session => { session.measurementDate = '2026-02-31'; },
      session => { session.name = ''; },
      session => { session.measurements.forEach(row => { row.measured = null; }); },
    ];
    for (const change of cases) {
      const session = newSession(template);
      change(session);
      const response = await post(base, session);
      assert.equal(response.status, 422);
      assert.equal(typeof (await response.json()).error, 'string');
    }
    assert.deepEqual(await list(base), []);
  });
});

test('malformed JSON, wrong content type, and oversized bodies do not create sessions', async () => {
  await withServer(async ({ base }) => {
    const malformed = await fetch(`${base}/api/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400);
    const wrongType = await fetch(`${base}/api/sessions`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
    assert.equal(wrongType.status, 415);
    const oversized = await post(base, { note: 'x'.repeat(70_000) });
    assert.equal(oversized.status, 413);
    const chunkedStatus = await new Promise((resolveStatus, reject) => {
      const request = httpRequest(`${base}/api/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, response => {
        response.resume();
        response.on('end', () => resolveStatus(response.statusCode));
      });
      request.on('error', reject);
      request.write('{"note":"');
      request.write('x'.repeat(70_000));
      request.end('"}');
    });
    assert.equal(chunkedStatus, 413);
    assert.deepEqual(await list(base), []);
  });
});

test('foreign origins and non-loopback Host values cannot save a session', async () => {
  await withServer(async ({ base, template }) => {
    const session = newSession(template);
    assert.equal((await post(base, session, { Origin: 'https://example.invalid' })).status, 403);
    // fetch sets Host from its URL; use native HTTP to exercise a crafted header.
    const foreignHostStatus = await new Promise((resolveStatus, reject) => {
      const request = httpRequest(`${base}/api/sessions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Host: 'example.invalid' },
      }, response => {
        response.resume();
        response.on('end', () => resolveStatus(response.statusCode));
      });
      request.on('error', reject);
      request.end(JSON.stringify(session));
    });
    assert.equal(foreignHostStatus, 403);
    assert.deepEqual(await list(base), []);
    assert.equal((await post(base, session, { Origin: base })).status, 201);
  });
});

test('only declared assets and API methods are served, with no external resource policy', async () => {
  await withServer(async ({ base }) => {
    const asset = await fetch(`${base}/measurement-session.mjs`);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /javascript/);
    assert.match(await asset.text(), /calculateDelta/);
    assert.match(asset.headers.get('content-security-policy'), /default-src 'none'/);
    assert.equal(asset.headers.get('access-control-allow-origin'), null);
    assert.equal((await fetch(`${base}/data/house-fit-forms/SR-FORM-001.v1.json`)).status, 404);
    assert.equal((await fetch(`${base}/src/house-measurement-database.mjs`)).status, 404);
    assert.equal((await fetch(`${base}/api/sessions/00000000-0000-0000-0000-000000000000`)).status, 404);
    assert.equal((await fetch(`${base}/api/sessions`, { method: 'DELETE' })).status, 405);
    const error = await fetch(`${base}/api/no-such-route`);
    assert.equal(error.status, 404);
    assert.doesNotMatch(await error.text(), /SELECT|SQLITE|\.mjs|stack/i);
  });
});
