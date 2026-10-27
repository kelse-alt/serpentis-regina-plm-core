/** Device-local drafts and immutable named snapshots; original images use Blob storage. */
import { normalizeTechPack } from './tech-pack.mjs';

const PACK_LEGACY_KEY = 'serpentis-regina.tech-packs.v1';
const PACK_DATABASE_NAME = 'serpentis-regina.workroom.v2';

function storageId(prefix) {
  return prefix + '-' + (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
}

function storageRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? Error('The local database request failed.'));
  });
}

function storageTransaction(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error ?? Error('The local database write was cancelled.'));
    transaction.onerror = () => {}; // onabort supplies the final transaction result.
  });
}

function storageMetadata(record) {
  return { id: record.id, title: record.title, updatedAt: record.updatedAt };
}

function revisionMetadata(record) {
  return { id: record.id, packId: record.packId, name: record.name, author: record.author, reason: record.reason, createdAt: record.createdAt };
}

function recoveryMetadata(record) {
  return { id: record.id, source: record.source, sourceIndex: record.sourceIndex ?? null,
    packId: record.packId ?? '', reason: record.reason, createdAt: record.createdAt };
}

function storageLabel(value, label, maximum, required = false) {
  if (typeof value !== 'string' || value.includes('\0') || value.length > maximum || (required && !value.trim())) {
    throw Error(`${label} must be ${required ? 'nonempty ' : ''}text of at most ${maximum} characters.`);
  }
  return value.trim();
}

function storageVersion(record) {
  return record.writeId ?? record.updatedAt;
}

/** Locations keep gallery members independent while reusing the same Blob store. */
function snapshotImageEntries(snapshot) {
  const entries = [];
  for (const attachments of Object.values(snapshot.attachments ?? {})) {
    for (const [slot, attachment] of Object.entries(attachments ?? {})) {
      if (Array.isArray(attachment?.images)) {
        attachment.images.forEach((image, index) => entries.push({ container: attachment.images, key: index, image }));
      } else if (attachment) entries.push({ container: attachments, key: slot, image: attachment });
    }
  }
  return entries;
}

/**
 * IndexedDB is required for a successful save. If unavailable, callers must
 * retain the working draft and offer a portable JSON download instead.
 */
export function createPackStore(template, options = {}) {
  let factory;
  // Some browsers throw on the storage getter itself (for example opaque origins).
  // Keep construction safe so the UI can still offer a JSON download.
  try { factory = Object.hasOwn(options, 'indexedDB') ? options.indexedDB : globalThis.indexedDB; }
  catch { factory = null; }
  const databaseName = options.dbName ?? PACK_DATABASE_NAME;
  let database, initializing, writeQueue = Promise.resolve();
  const expectedVersions = new Map();
  const imageCache = new Map();

  function enqueueWrite(operation) {
    const result = writeQueue.then(operation, operation);
    writeQueue = result.catch(() => {});
    return result;
  }

  async function readAll(storeName) {
    const transaction = database.transaction(storeName, 'readonly');
    const done = storageTransaction(transaction);
    try {
      const rows = await storageRequest(transaction.objectStore(storeName).getAll());
      await done;
      return rows;
    } catch (error) {
      await done.catch(() => {});
      throw error;
    }
  }

  async function readRecord(storeName, id) {
    const transaction = database.transaction(storeName, 'readonly');
    const done = storageTransaction(transaction);
    try {
      const row = await storageRequest(transaction.objectStore(storeName).get(id));
      await done;
      return row;
    } catch (error) {
      await done.catch(() => {});
      throw error;
    }
  }

  async function encodeSnapshot(input) {
    const snapshot = normalizeTechPack(input, template);
    const images = new Map();
    for (const { container, key, image } of snapshotImageEntries(snapshot)) {
      let cached = imageCache.get(image.dataUrl);
      if (!cached) {
        const binary = globalThis.atob(image.dataUrl.slice(image.dataUrl.indexOf(',') + 1));
        const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
        let id;
        if (globalThis.crypto?.subtle) {
          const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
          id = 'sha256-' + [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
        } else {
          id = storageId('image');
        }
        cached = { id, type: image.type, blob: new Blob([bytes], { type: image.type }) };
        imageCache.set(image.dataUrl, cached);
      }
      images.set(cached.id, cached);
      container[key] = { name: image.name, type: image.type, imageId: cached.id };
    }
    return { snapshot, images: [...images.values()] };
  }

  async function hydrateSnapshot(record) {
    if (!record?.snapshot || typeof record.snapshot !== 'object') throw Error('The saved snapshot is missing.');
    const snapshot = structuredClone(record.snapshot);
    const ids = new Set();
    const entries = snapshotImageEntries(snapshot);
    for (const { image } of entries) if (image?.imageId) ids.add(image.imageId);
    const found = new Map();
    if (ids.size) {
      const transaction = database.transaction('images', 'readonly');
      const done = storageTransaction(transaction);
      const store = transaction.objectStore('images');
      let images;
      try {
        images = await Promise.all([...ids].map(id => storageRequest(store.get(id))));
        await done;
      } catch (error) {
        await done.catch(() => {});
        throw error;
      }
      for (const image of images) {
        if (!image || !(image.blob instanceof Blob)) throw Error('An original image is missing from local storage.');
        const bytes = new Uint8Array(await image.blob.arrayBuffer());
        const chunks = [];
        for (let offset = 0; offset < bytes.length; offset += 32768) {
          chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 32768)));
        }
        const dataUrl = `data:${image.type};base64,` + globalThis.btoa(chunks.join(''));
        found.set(image.id, dataUrl);
        imageCache.set(dataUrl, image);
      }
    }
    for (const { container, key, image } of entries) {
      if (image?.imageId) {
        if (!found.has(image.imageId)) throw Error('An original image is missing from local storage.');
        container[key] = { name: image.name, type: image.type, dataUrl: found.get(image.imageId) };
      }
    }
    return snapshot;
  }

  async function preserveRecovery({ source, sourceIndex = null, packId = '', raw, reason }) {
    const prior = await readAll('recoveries');
    const duplicate = prior.find(item => item.source === source && item.sourceIndex === sourceIndex && item.raw === raw);
    if (duplicate) return duplicate.id;
    const record = { id: storageId('recovery'), source, sourceIndex, packId, raw,
      reason: String(reason), createdAt: new Date().toISOString() };
    const transaction = database.transaction('recoveries', 'readwrite');
    const done = storageTransaction(transaction);
    transaction.objectStore('recoveries').add(record);
    await done;
    return record.id;
  }

  async function validatedSnapshot(record, source) {
    let hydrated;
    try {
      hydrated = await hydrateSnapshot(record);
      return normalizeTechPack(hydrated, template);
    } catch (error) {
      const recoveryId = await preserveRecovery({ source, packId: record?.packId ?? record?.id ?? '',
        raw: JSON.stringify(hydrated ?? record), reason: error.message });
      const recoveryError = Error(error.message);
      recoveryError.name = 'RecoveryError';
      recoveryError.recoveryId = recoveryId;
      throw recoveryError;
    }
  }

  async function writeDraft(input, { migrate = false } = {}) {
    const prepared = await encodeSnapshot(input);
    const snapshot = prepared.snapshot;
    const record = { id: snapshot.id, title: snapshot.title, updatedAt: snapshot.updatedAt,
      writeId: storageId('write'), snapshot };
    const transaction = database.transaction(['drafts', 'images'], 'readwrite');
    const done = storageTransaction(transaction);
    try {
      const drafts = transaction.objectStore('drafts');
      const previous = await storageRequest(drafts.get(record.id));
      if (migrate && previous) {
        await done;
        return null;
      }
      if (previous && !migrate) {
        const expected = expectedVersions.get(record.id);
        if ((expected !== undefined && expected !== storageVersion(previous)) ||
            (expected === undefined && snapshot.updatedAt !== previous.updatedAt)) {
          const error = Error('This pack changed in another tab or a newer saved draft exists. Download JSON to preserve your edits, then reopen the saved pack before saving again.');
          error.name = 'ConflictError';
          throw error;
        }
      }
      for (const image of prepared.images) transaction.objectStore('images').put(image);
      drafts.put(record);
      await done;
      if (!migrate) expectedVersions.set(record.id, record.writeId);
      return storageMetadata(record);
    } catch (error) {
      try { transaction.abort(); } catch {}
      await done.catch(() => {});
      throw error;
    }
  }

  async function migrateLegacy() {
    const report = { migrated: 0, skipped: 0, recoveryCount: 0, legacyUnavailable: false };
    let raw;
    try {
      const legacy = Object.hasOwn(options, 'legacyStorage') ? options.legacyStorage : globalThis.localStorage;
      raw = legacy?.getItem(PACK_LEGACY_KEY);
    } catch { report.legacyUnavailable = true; }
    if (raw) {
      let records;
      try {
        records = JSON.parse(raw);
        if (!Array.isArray(records)) throw Error('The old saved-pack list is not an array.');
      } catch (error) {
        await preserveRecovery({ source: 'legacy', raw, reason: error.message });
        records = [];
      }
      for (let index = 0; index < records.length; index++) {
        const record = records[index];
        try {
          const normalized = normalizeTechPack(record, template);
          const result = await writeDraft(normalized, { migrate: true });
          if (result) report.migrated++; else report.skipped++;
        } catch (error) {
          await preserveRecovery({ source: 'legacy', sourceIndex: index,
            packId: typeof record?.id === 'string' ? record.id : '', raw: JSON.stringify(record), reason: error.message });
        }
      }
    }
    report.recoveryCount = (await readAll('recoveries')).length;
    return report;
  }

  async function init() {
    if (!initializing) {
      initializing = (async () => {
        if (!factory?.open) throw Error('Local database storage is unavailable. Download JSON to keep your work.');
        database = await new Promise((resolve, reject) => {
          let rejected = false;
          const request = factory.open(databaseName, 1);
          request.onupgradeneeded = () => {
            const db = request.result;
            db.createObjectStore('drafts', { keyPath: 'id' });
            const revisions = db.createObjectStore('revisions', { keyPath: 'id' });
            revisions.createIndex('packId', 'packId', { unique: false });
            db.createObjectStore('images', { keyPath: 'id' });
            db.createObjectStore('recoveries', { keyPath: 'id' });
          };
          request.onerror = () => {
            rejected = true;
            reject(request.error ?? Error('Could not open local storage. Download JSON to keep your work.'));
          };
          request.onblocked = () => {
            rejected = true;
            reject(Error('Another workroom tab is blocking local storage. Close the older tab and reopen this workroom; keep a JSON backup of any unsaved edits.'));
          };
          request.onsuccess = () => {
            const opened = request.result;
            if (rejected) { opened.close(); return; }
            opened.onversionchange = () => opened.close();
            resolve(opened);
          };
        });
        return migrateLegacy();
      })();
    }
    return initializing;
  }

  async function listDrafts() {
    await init();
    const valid = [];
    for (const record of await readAll('drafts')) {
      try {
        const snapshot = await validatedSnapshot(record, 'draft');
        valid.push(storageMetadata(snapshot));
      } catch (error) {
        // Skip an isolated incompatible snapshot only after preserving recovery.
        // Database failures still reach the UI instead of resembling an empty list.
        if (error.name !== 'RecoveryError') throw error;
      }
    }
    return valid.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async function getDraft(id) {
    await init();
    const record = await readRecord('drafts', id);
    if (!record) throw Error('This saved pack was not found in this browser.');
    const snapshot = await validatedSnapshot(record, 'draft');
    expectedVersions.set(id, storageVersion(record));
    return snapshot;
  }

  async function saveDraft(input) {
    const captured = normalizeTechPack(input, template);
    await init();
    return enqueueWrite(() => writeDraft(captured));
  }

  async function listRevisions(packId) {
    await init();
    const transaction = database.transaction('revisions', 'readonly');
    const done = storageTransaction(transaction);
    try {
      const records = await storageRequest(transaction.objectStore('revisions').index('packId').getAll(packId));
      await done;
      const valid = [];
      for (const record of records) {
        try {
          storageLabel(record.name, 'Revision name', 160, true);
          storageLabel(record.author, 'Recorded author', 160);
          storageLabel(record.reason, 'Change reason', 2000);
          if (typeof record.createdAt !== 'string' || !Number.isFinite(Date.parse(record.createdAt))) throw Error('The revision time is invalid.');
          valid.push(revisionMetadata(record));
        } catch (error) {
          await preserveRecovery({ source: 'revision', packId: record.packId ?? '', raw: JSON.stringify(record), reason: error.message });
        }
      }
      return valid.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (error) {
      await done.catch(() => {});
      throw error;
    }
  }

  async function createRevision(input, details = {}) {
    const captured = normalizeTechPack(input, template);
    const name = storageLabel(details.name, 'Revision name', 160, true);
    const author = storageLabel(details.author ?? '', 'Recorded author', 160);
    const reason = storageLabel(details.reason ?? '', 'Change reason', 2000);
    await init();
    return enqueueWrite(async () => {
      const prepared = await encodeSnapshot(captured);
      const record = { id: storageId('revision'), packId: prepared.snapshot.id, name, author, reason,
        createdAt: new Date().toISOString(), snapshot: prepared.snapshot };
      const transaction = database.transaction(['revisions', 'images'], 'readwrite');
      const done = storageTransaction(transaction);
      try {
        for (const image of prepared.images) transaction.objectStore('images').put(image);
        transaction.objectStore('revisions').add(record); // Immutable append; never put/replace a snapshot.
        await done;
        return revisionMetadata(record);
      } catch (error) {
        try { transaction.abort(); } catch {}
        await done.catch(() => {});
        throw error;
      }
    });
  }

  async function getRevision(id) {
    await init();
    const record = await readRecord('revisions', id);
    if (!record) throw Error('This named revision was not found in this browser.');
    return validatedSnapshot(record, 'revision');
  }

  async function recoveries() {
    await init();
    return (await readAll('recoveries')).map(recoveryMetadata).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async function exportRecovery(id) {
    await init();
    const record = typeof id === 'number'
      ? (await readAll('recoveries')).find(item => item.sourceIndex === id)
      : await readRecord('recoveries', id);
    if (!record) throw Error('This recovery record was not found in this browser.');
    return record.raw;
  }

  function close() {
    database?.close();
  }

  return { init, listDrafts, getDraft, saveDraft, listRevisions, createRevision, getRevision, recoveries, exportRecovery, close };
}
