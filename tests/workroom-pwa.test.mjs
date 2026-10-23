import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildWorkroomPwa } from '../scripts/build-workroom-pwa.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const source = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'"></head><body><main>Sanitized blank test template</main></body></html>';

async function fixture(t) {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'sr-workroom-pwa-'));
  t.after(() => rm(temporary, { recursive:true, force:true }));
  await mkdir(path.join(temporary, 'pwa/icons'), { recursive:true });
  await cp(path.join(root, 'pwa'), path.join(temporary, 'pwa'), { recursive:true });
  await writeFile(path.join(temporary, 'package.json'), JSON.stringify({ version:'0.7.0' }));
  await writeFile(path.join(temporary, 'tech-pack.html'), source);
  await writeFile(path.join(temporary, 'client-intake.html'), source);
  return temporary;
}

test('hosted build is reproducible, leaves standalone sources intact, and constrains installation to its own directory', async t => {
  const rootDir = await fixture(t);
  const first = await buildWorkroomPwa({ rootDir });
  const workerBefore = await readFile(path.join(first.outputDir, 'sw.js'), 'utf8');
  const second = await buildWorkroomPwa({ rootDir });
  assert.equal(first.buildId, second.buildId);
  assert.equal(workerBefore, await readFile(path.join(second.outputDir, 'sw.js'), 'utf8'));
  assert.equal(await readFile(path.join(rootDir, 'tech-pack.html'), 'utf8'), source);
  assert.equal(await readFile(path.join(rootDir, 'client-intake.html'), 'utf8'), source);
  const manifest = JSON.parse(await readFile(path.join(second.outputDir, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.id, './');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.theme_color, '#101820');
  const hosted = await readFile(path.join(second.outputDir, 'index.html'), 'utf8');
  assert.match(hosted, /worker-src 'self'; manifest-src 'self'/);
  assert.match(hosted, /connect-src 'self'/);
  assert.match(hosted, /viewport-fit=cover/);
  assert.match(hosted, /data-pwa-page="workroom"/);
  assert.match(hosted, /<script src="\.\/pwa\.js" defer>/);
  const client = await readFile(path.join(second.outputDir, 'client-intake.html'), 'utf8');
  assert.match(client, /data-pwa-page="client"/);
  assert.equal(second.files.length, 8);
  const changedSource = source.replace('Sanitized blank', 'Updated sanitized blank');
  await writeFile(path.join(rootDir, 'tech-pack.html'), changedSource);
  const changed = await buildWorkroomPwa({ rootDir });
  assert.notEqual(changed.buildId, first.buildId);
  const workerTemplate = path.join(rootDir, 'pwa/sw.template.js');
  await writeFile(workerTemplate, await readFile(workerTemplate, 'utf8') + '\n// Worker-only maintenance change.\n');
  const workerOnly = await buildWorkroomPwa({ rootDir });
  assert.notEqual(workerOnly.buildId, changed.buildId, 'worker-only changes need a separate cache to protect the active version');
});

test('worker admits only one checksum-verified public shell and waits for an explicit activation message', async t => {
  const rootDir = await fixture(t);
  const { outputDir, buildId } = await buildWorkroomPwa({ rootDir });
  const worker = await readFile(path.join(outputDir, 'sw.js'), 'utf8');
  const handlers = new Map();
  const cacheStores = new Map([['unrelated-portal-cache', new Map()]]);
  let skipped = 0;
  let claimed = 0;
  let corruptPath = null;
  const scope = 'https://example.test/serpentis-regina-plm-core/workroom/';
  const caches = {
    async open(name) {
      if (!cacheStores.has(name)) cacheStores.set(name, new Map());
      const values = cacheStores.get(name);
      return { async put(key, value) { values.set(key, value.clone()); }, async match(key) { return values.get(key)?.clone(); } };
    },
    async delete(name) { return cacheStores.delete(name); },
    async keys() { return [...cacheStores.keys()]; }
  };
  const fetcher = async request => {
    const url = new URL(request.url);
    const relative = url.pathname.slice(new URL(scope).pathname.length);
    return new Response(relative === corruptPath ? 'stale deployment bytes' : await readFile(path.join(outputDir, relative)));
  };
  const bindings = {
    self:{ registration:{ scope }, clients:{ async claim() { claimed++; } }, async skipWaiting() { skipped++; }, addEventListener(type, fn) { handlers.set(type, fn); } },
    crypto:globalThis.crypto, URL, Request, Response, Uint8Array, caches, fetch:fetcher
  };
  const context = vm.createContext({ ...bindings });
  vm.runInContext(worker, context);
  async function dispatch(type, data = {}) {
    let pending;
    handlers.get(type)({ ...data, waitUntil(promise) { pending = promise; } });
    await pending;
  }
  await dispatch('install');
  assert.equal(skipped, 0, 'install must not force an update over active edits');
  const cacheName = [...cacheStores.keys()].find(key => key.endsWith(buildId));
  assert.ok(cacheName.includes('/serpentis-regina-plm-core/workroom/'));
  const cached = cacheStores.get(cacheName);
  assert.equal(cached.size, 7);
  assert.ok([...cached.keys()].every(key => key.startsWith(scope)));
  for (const [key, response] of cached) {
    const local = await readFile(path.join(outputDir, key.slice(scope.length)));
    assert.equal(hash(await response.clone().bytes()), hash(local));
  }
  let responsePromise;
  handlers.get('fetch')({ request:new Request(scope), respondWith(promise) { responsePromise = promise; } });
  assert.equal((await responsePromise).status, 200);
  for (const url of [scope + 'unknown-private-record', 'https://example.test/serpentis-regina-plm-core/', scope + 'api/clients']) {
    let intercepted = false;
    handlers.get('fetch')({ request:new Request(url), respondWith() { intercepted = true; } });
    assert.equal(intercepted, false, `must not intercept ${url}`);
  }
  await dispatch('message', { source:{ url:'https://example.test/serpentis-regina-plm-core/' }, data:{ type:'ACTIVATE_UPDATE' } });
  assert.equal(skipped, 0, 'portal page cannot activate the workroom worker');
  await dispatch('message', { source:{ url:scope }, data:{ type:'ACTIVATE_UPDATE' } });
  assert.equal(skipped, 1);
  await dispatch('activate');
  assert.equal(claimed, 1);
  assert.ok(cacheStores.has('unrelated-portal-cache'));

  cached.delete(scope + 'client-intake.html');
  let repaired;
  await dispatch('message', { source:{ url:scope }, data:{ type:'GET_VERSION' }, ports:[{ postMessage(info) { repaired = info; } }] });
  assert.equal(repaired.offlineReady, true, 'App info should repair evicted same-version static assets online');
  assert.ok(cached.has(scope + 'client-intake.html'));
  cached.delete(scope + 'client-intake.html');
  corruptPath = 'client-intake.html';
  await dispatch('message', { source:{ url:scope }, data:{ type:'GET_VERSION' }, ports:[{ postMessage(info) { repaired = info; } }] });
  assert.equal(repaired.offlineReady, false, 'Mixed-version files cannot claim offline readiness after eviction');
  assert.equal(cached.has(scope + 'client-intake.html'), false);

  await writeFile(path.join(rootDir, 'tech-pack.html'), source + '<!-- version two -->');
  const next = await buildWorkroomPwa({ rootDir });
  vm.runInContext(await readFile(path.join(next.outputDir, 'sw.js'), 'utf8'), vm.createContext({ ...bindings }));
  corruptPath = 'index.html';
  await assert.rejects(dispatch('install'), /integrity failed/);
  assert.equal(cacheStores.has(cacheName), true, 'a failed next version must preserve the active offline shell');
  assert.equal([...cacheStores.keys()].some(key => key.endsWith(next.buildId)), false, 'incomplete version must not remain available as an offline shell');
  assert.ok(cacheStores.has('unrelated-portal-cache'));
});

test('invalid icon or missing standalone CSP fails before replacing a previous build', async t => {
  const rootDir = await fixture(t);
  const result = await buildWorkroomPwa({ rootDir });
  const previous = await readFile(path.join(result.outputDir, 'sw.js'), 'utf8');
  await writeFile(path.join(rootDir, 'pwa/icons/icon-192.png'), 'invalid');
  await assert.rejects(buildWorkroomPwa({ rootDir }), /192 × 192/);
  assert.equal(await readFile(path.join(result.outputDir, 'sw.js'), 'utf8'), previous);
  await writeFile(path.join(rootDir, 'tech-pack.html'), '<html><head></head><body></body></html>');
  await assert.rejects(buildWorkroomPwa({ rootDir }), /content-security policy/);
  assert.equal(await readFile(path.join(result.outputDir, 'sw.js'), 'utf8'), previous);
});

test('explicit update waits for full controller activation; timeout unlocks without a later reload', async () => {
  const script = await readFile(path.join(root, 'pwa/pwa.js'), 'utf8');
  async function pageFixture({ firstInstall = false } = {}) {
    function target(extra = {}) {
      const listeners = new Map();
      return Object.assign({
        addEventListener(type, listener) {
          if (!listeners.has(type)) listeners.set(type, new Set());
          listeners.get(type).add(listener);
        },
        removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
        async fire(type) { await Promise.all([...(listeners.get(type) || [])].map(listener => listener({ type }))); }
      }, extra);
    }
    const elements = new Map();
    const element = () => target({ dataset:{}, setAttribute() {}, append() {}, close() {}, showModal() {} });
    const byId = id => {
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    };
    const timers = new Map();
    let timerId = 0, reloads = 0, cancellations = 0;
    const active = target({ state:'activated', postMessage(_data, ports) {
      queueMicrotask(() => ports[0].postMessage({ version:'0.7.0', buildId:'old', offlineReady:true }));
    } });
    const waiting = target({ state:'installed', postMessage() {} });
    const registration = target({ active:firstInstall ? null : active, waiting, async update() {} });
    const serviceWorker = target({ controller:firstInstall ? null : active, ready:Promise.resolve(registration), async register() { return registration; } });
    const window = target({ isSecureContext:true, WORKROOM_UPDATES:{
      async prepare() { return { ready:true }; }, cancel() { cancellations++; }
    } });
    const document = target({
      body:{ dataset:{ pwaPage:'workroom' }, append() {} },
      createElement:element, getElementById:byId,
      querySelector(selector) { return selector.startsWith('meta') ? { content:'0.7.0' } : element(); }
    });
    class Channel {
      constructor() {
        this.port1 = { close() {}, onmessage:null };
        this.port2 = { postMessage:data => this.port1.onmessage?.({ data }) };
      }
    }
    vm.runInNewContext(script, { window, document, navigator:{ serviceWorker, onLine:true },
      matchMedia:() => ({ matches:false }), MessageChannel:Channel,
      setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
      clearTimeout(id) { timers.delete(id); }, location:{ reload() { reloads++; } }
    });
    await new Promise(resolve => setImmediate(resolve));
    return { byId, serviceWorker, registration, waiting, timers,
      get reloads() { return reloads; }, get cancellations() { return cancellations; } };
  }

  const page = await pageFixture();
  await page.byId('pwa-apply-update').fire('click');
  page.waiting.state = 'activating';
  page.registration.active = page.waiting;
  page.serviceWorker.controller = page.waiting;
  await page.serviceWorker.fire('controllerchange');
  assert.equal(page.reloads, 0, 'claiming an activating worker must not reload');
  assert.ok([...page.timers.values()].some(timer => timer.delay === 15000), 'activation keeps the existing cancellation timeout');
  page.waiting.state = 'activated';
  await page.waiting.fire('statechange');
  assert.equal(page.reloads, 1, 'requesting page reloads only after activation completes');
  assert.equal(page.cancellations, 0);

  const timedOut = await pageFixture();
  await timedOut.byId('pwa-apply-update').fire('click');
  timedOut.waiting.state = 'activating';
  timedOut.serviceWorker.controller = timedOut.waiting;
  await timedOut.serviceWorker.fire('controllerchange');
  [...timedOut.timers.values()].find(timer => timer.delay === 15000).callback();
  assert.equal(timedOut.cancellations, 1, 'a stalled activation unlocks editing');
  timedOut.waiting.state = 'activated';
  await timedOut.waiting.fire('statechange');
  assert.equal(timedOut.reloads, 0, 'late activation after cancellation cannot discard resumed edits');

  const sibling = await pageFixture();
  assert.equal(sibling.byId('pwa-apply-update').hidden, false);
  sibling.serviceWorker.controller = sibling.waiting;
  sibling.waiting.state = 'activated';
  sibling.registration.active = sibling.waiting;
  sibling.registration.waiting = null;
  await sibling.serviceWorker.fire('controllerchange');
  assert.equal(sibling.reloads, 0, 'a page without an explicit update never reloads on controller change');
  assert.equal(sibling.byId('pwa-apply-update').hidden, true, 'another window applying the update clears a stale update action');
  const firstInstall = await pageFixture({ firstInstall:true });
  assert.equal(firstInstall.byId('pwa-apply-update').hidden, true, 'the first worker transiently waiting must not be advertised as an update');
});
