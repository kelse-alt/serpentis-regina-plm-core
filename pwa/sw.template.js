'use strict';

// Only the public shell is cached. Working records remain in the app's existing
// IndexedDB/local storage; neither uploaded images nor API responses enter here.
const APP_VERSION = __WORKROOM_VERSION__;
const BUILD_ID = __WORKROOM_BUILD_ID__;
const PRECACHE = __WORKROOM_ASSETS__;
const SCOPE = new URL(self.registration.scope);
const CACHE_PREFIX = `serpentis-regina-workroom:${SCOPE.pathname}:`;
const CACHE_NAME = CACHE_PREFIX + BUILD_ID;
const ASSETS = new Map(PRECACHE.map(asset => [new URL(asset.path, SCOPE).href, asset]));
const INDEX_URL = new URL('index.html', SCOPE).href;

function canonicalAsset(url) {
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return null;
  url.search = '';
  url.hash = '';
  if (url.href === SCOPE.href) return INDEX_URL;
  return ASSETS.has(url.href) ? url.href : null;
}

async function digest(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('');
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      // Check every deployed byte before admitting a version. Mixed CDN versions
      // fail installation and leave the previous working app in control.
      for (const asset of PRECACHE) {
        const url = new URL(asset.path, SCOPE);
        const response = await fetch(new Request(url.href, { cache:'reload', credentials:'same-origin' }));
        if (!response.ok || response.type === 'opaque' || response.redirected ||
            await digest(await response.clone().arrayBuffer()) !== asset.sha256) {
          throw new Error(`Workroom asset integrity failed: ${asset.path}`);
        }
        await cache.put(url.href, response);
      }
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error;
    }
    // Updating an open workroom waits for its explicit save-and-update action.
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const key = canonicalAsset(new URL(event.request.url));
  if (!key) return; // Unknown paths never become an app route or cached record.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(key);
    if (response) return response;
    // Recover evicted bytes online only when they match this exact app version.
    // Never put a newer shell into the cache of an older open workroom.
    try {
      const fetched = await fetch(new Request(key, { cache:'reload', credentials:'same-origin' }));
      if (fetched.ok && !fetched.redirected && fetched.type !== 'opaque' &&
          await digest(await fetched.clone().arrayBuffer()) === ASSETS.get(key).sha256) {
        await cache.put(key, fetched.clone());
        return fetched;
      }
    } catch { /* Offline or partially deployed: keep this version intact. */ }
    return new Response('The offline app files are unavailable. Reconnect and reopen the Workroom link to prepare this device again.', {
      status:503, headers:{ 'Content-Type':'text/plain; charset=utf-8', 'Cache-Control':'no-store' }
    });
  })());
});

self.addEventListener('message', event => {
  event.waitUntil((async () => {
    const sourceUrl = event.source?.url ? new URL(event.source.url) : null;
    if (!sourceUrl || sourceUrl.origin !== SCOPE.origin || !sourceUrl.pathname.startsWith(SCOPE.pathname)) return;
    if (event.data?.type === 'GET_VERSION') {
      const cache = await caches.open(CACHE_NAME);
      // A browser may evict individual shell files without unregistering this
      // worker. App info repairs only missing, still-identical public files.
      await Promise.all([...ASSETS].map(async ([url, asset]) => {
        if (await cache.match(url)) return;
        try {
          const response = await fetch(new Request(url, { cache:'reload', credentials:'same-origin' }));
          if (response.ok && !response.redirected && response.type !== 'opaque' &&
              await digest(await response.clone().arrayBuffer()) === asset.sha256) {
            await cache.put(url, response);
          }
        } catch { /* Offline status below remains false for incomplete files. */ }
      }));
      const present = await Promise.all([...ASSETS.keys()].map(url => cache.match(url)));
      event.ports[0]?.postMessage({ version:APP_VERSION, buildId:BUILD_ID, offlineReady:present.every(Boolean) });
    }
    if (event.data?.type === 'ACTIVATE_UPDATE') await self.skipWaiting();
  })());
});
