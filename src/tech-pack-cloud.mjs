/** Private, authenticated cloud drafts. Browser drafts are never uploaded implicitly. */
import { normalizeTechPack } from './tech-pack.mjs';

const CLOUD_BODY_LIMIT = 24 * 1024 * 1024;

function cloudText(value, label, maximum, required = false) {
  if (typeof value !== 'string' || value.includes('\0') || value.length > maximum || (required && !value.trim())) {
    throw Error(`${label} must be ${required ? 'nonempty ' : ''}text of at most ${maximum} characters.`);
  }
  return value.trim();
}

function cloudVersion(value) {
  if (!Number.isSafeInteger(value) || value < 1) throw Error('The cloud returned an invalid save version. Reopen the pack before saving again.');
  return value;
}

function cloudMetadata(record) {
  if (!record || typeof record !== 'object') throw Error('The cloud returned an invalid pack record.');
  const id = cloudText(record.id, 'Pack identity', 200, true);
  const title = cloudText(record.title, 'Pack title', 240);
  if (typeof record.updatedAt !== 'string' || !Number.isFinite(Date.parse(record.updatedAt))) throw Error('The cloud returned an invalid saved time.');
  return { id, title, updatedAt: record.updatedAt, version: cloudVersion(record.version),
    styleNumber: typeof record.styleNumber === 'string' ? record.styleNumber : '',
    description: typeof record.description === 'string' ? record.description : '' };
}

function cloudRevision(record) {
  if (!record || typeof record !== 'object') throw Error('The cloud returned an invalid revision record.');
  if (typeof record.createdAt !== 'string' || !Number.isFinite(Date.parse(record.createdAt))) throw Error('The cloud returned an invalid revision time.');
  return { id: cloudText(record.id, 'Revision identity', 200, true),
    packId: cloudText(record.packId, 'Pack identity', 200, true),
    name: cloudText(record.name, 'Revision name', 160, true),
    author: cloudText(record.author ?? '', 'Recorded author', 160),
    reason: cloudText(record.reason ?? '', 'Change reason', 2000), createdAt: record.createdAt };
}

export function createCloudPackStore(template, options = {}) {
  const fetchCloud = options.fetch ?? globalThis.fetch?.bind(globalThis);
  const expectedVersions = new Map();
  const revisionPacks = new Map();
  let initializing, writeQueue = Promise.resolve();

  async function request(path, { method = 'GET', body } = {}) {
    if (!fetchCloud) throw Error('Cloud access is unavailable in this browser. Download JSON to keep your work.');
    let encoded;
    if (body !== undefined) {
      encoded = JSON.stringify(body);
      if (new TextEncoder().encode(encoded).byteLength > CLOUD_BODY_LIMIT) throw Error('This pack exceeds the 24 MB cloud save limit. Download JSON to preserve every original image.');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 30000);
    let response;
    try {
      response = await fetchCloud(path, { method, credentials: 'same-origin', cache: 'no-store',
        headers: { Accept: 'application/json', ...(encoded === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(encoded === undefined ? {} : { body: encoded }), signal: controller.signal });
    } catch (error) {
      throw Error(error?.name === 'AbortError'
        ? 'Cloud access timed out. The save was not confirmed; keep your draft and retry or export JSON.'
        : 'Cloud access failed. Check your connection, then retry. Keep this draft or export JSON for a backup.', { cause: error });
    } finally { clearTimeout(timer); }
    if (response.status === 401 || response.status === 403 || response.redirected) {
      const error = Error('Your cloud sign-in needs attention. Export JSON to keep any unsaved changes, then sign in again.');
      error.name = 'SignInError'; error.status = response.status; throw error;
    }
    let result;
    try { result = await response.json(); }
    catch { throw Error('The cloud returned an unreadable response. The save was not confirmed; export JSON before reloading.'); }
    if (!response.ok) {
      const fallback = response.status === 409
        ? 'This pack changed on another device. Download JSON to keep your edits, then reopen the newer saved pack.'
        : response.status === 413 ? 'This pack exceeds the cloud save limit. Download JSON to keep your work.'
        : 'The cloud operation failed. Keep your current draft and retry or export JSON.';
      const error = Error(typeof result?.error === 'string' ? result.error : fallback);
      error.name = response.status === 409 ? 'ConflictError' : 'CloudError';
      error.status = response.status;
      throw error;
    }
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw Error('The cloud returned an invalid response. The save was not confirmed.');
    return result;
  }

  function enqueueWrite(operation) {
    const result = writeQueue.then(operation, operation);
    writeQueue = result.catch(() => {});
    return result;
  }

  async function readDirectory() {
    const result = await request('/api/packs');
    if (!Array.isArray(result.packs)) throw Error('The cloud directory could not be read. Your open draft is unchanged.');
    // Listing metadata must never authorize overwriting an unseen pack revision.
    return result.packs.map(cloudMetadata).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async function init() {
    if (!initializing) {
      initializing = readDirectory().then(() => ({ migrated: 0, skipped: 0, recoveryCount: 0, legacyUnavailable: false }))
        .catch(error => { initializing = undefined; throw error; });
    }
    return initializing;
  }

  async function listDrafts() {
    await init();
    return readDirectory();
  }

  async function getDraft(id, options = {}) {
    const result = await request('/api/packs/' + encodeURIComponent(id));
    const snapshot = normalizeTechPack(result.pack, template);
    if (snapshot.id !== id) throw Error('The cloud returned a different pack. Your open draft is unchanged.');
    const version = cloudVersion(result.version);
    if (options.acceptIf && !options.acceptIf()) throw Error('The draft changed while cloud data was loading. Finish the edit, then open or import again.');
    expectedVersions.set(id, version);
    return snapshot;
  }

  async function saveDraft(input) {
    const captured = normalizeTechPack(input, template);
    return enqueueWrite(async () => {
      const result = cloudMetadata(await request('/api/packs/' + encodeURIComponent(captured.id), {
        method: 'PUT', body: { pack: captured, expectedVersion: expectedVersions.get(captured.id) ?? null }
      }));
      if (result.id !== captured.id) throw Error('The cloud returned a different pack. The save was not confirmed.');
      expectedVersions.set(captured.id, result.version);
      return result;
    });
  }

  async function listRevisions(packId) {
    const result = await request('/api/packs/' + encodeURIComponent(packId) + '/revisions');
    if (!Array.isArray(result.revisions)) throw Error('Cloud revision history could not be read.');
    const revisions = result.revisions.map(cloudRevision);
    for (const revision of revisions) {
      if (revision.packId !== packId) throw Error('The cloud returned revision history for a different pack.');
      revisionPacks.set(revision.id, packId);
    }
    return revisions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async function createRevision(input, details = {}) {
    const captured = normalizeTechPack(input, template);
    const name = cloudText(details.name, 'Revision name', 160, true);
    const author = cloudText(details.author ?? '', 'Recorded author', 160);
    const reason = cloudText(details.reason ?? '', 'Change reason', 2000);
    return enqueueWrite(async () => {
      const revision = cloudRevision(await request('/api/packs/' + encodeURIComponent(captured.id) + '/revisions', {
        method: 'POST', body: { pack: captured, name, author, reason }
      }));
      if (revision.packId !== captured.id) throw Error('The cloud returned a revision for a different pack.');
      revisionPacks.set(revision.id, captured.id);
      return revision;
    });
  }

  async function getRevision(id) {
    const packId = revisionPacks.get(id);
    if (!packId) throw Error('Refresh revision history, then select this named revision again.');
    const result = await request('/api/packs/' + encodeURIComponent(packId) + '/revisions/' + encodeURIComponent(id));
    const revision = cloudRevision(result.revision);
    const snapshot = normalizeTechPack(result.pack, template);
    if (revision.id !== id || revision.packId !== packId || snapshot.id !== packId) throw Error('The cloud returned a different revision. Your open draft is unchanged.');
    return snapshot;
  }

  async function recoveries() { return []; }
  async function exportRecovery() { throw Error('Legacy recovery belongs to the original device. Export its pack JSON there, then import it here.'); }
  function close() {}

  return { init, listDrafts, getDraft, saveDraft, listRevisions, createRevision, getRevision, recoveries, exportRecovery, close };
}
