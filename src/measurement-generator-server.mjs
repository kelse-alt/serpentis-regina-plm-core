/** Local entry application. New sessions never replace an approved form revision. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DATABASE_PATH, openHouseDatabase, importHouseForm } from './house-measurement-database.mjs';
import { loadHouseData, buildMeasurementRows } from './house-measurement-sheet.mjs';
import { validateMeasurementSession } from './measurement-session.mjs';

const BODY_LIMIT = 64 * 1024;
const ASSETS = new Map([
  ['/', [new URL('../web/index.html', import.meta.url), 'text/html; charset=utf-8']],
  ['/app.mjs', [new URL('../web/app.mjs', import.meta.url), 'text/javascript; charset=utf-8']],
  ['/app.css', [new URL('../web/app.css', import.meta.url), 'text/css; charset=utf-8']],
  ['/measurement-session.mjs', [new URL('./measurement-session.mjs', import.meta.url), 'text/javascript; charset=utf-8']],
]);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function sendJson(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function readJson(request) {
  if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    request.resume();
    throw new HttpError(415, 'Send the session as application/json.');
  }
  if (Number(request.headers['content-length']) > BODY_LIMIT) {
    request.resume();
    throw new HttpError(413, 'Session exceeds the 64 KB request limit.');
  }
  return new Promise((resolveBody, reject) => {
    let size = 0;
    let chunks = [];
    let rejected = false;
    request.on('data', chunk => {
      if (rejected) return;
      size += chunk.length;
      if (size > BODY_LIMIT) {
        rejected = true;
        chunks = [];
        reject(new HttpError(413, 'Session exceeds the 64 KB request limit.'));
      } else chunks.push(chunk);
    });
    request.on('end', () => {
      if (rejected) return;
      try { resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new HttpError(400, 'The request body is not valid JSON.')); }
    });
    request.on('error', reject);
    request.on('aborted', () => reject(new HttpError(400, 'The request was interrupted.')));
  });
}

function allowedHost(request, server) {
  const port = server.address()?.port;
  return [`127.0.0.1:${port}`, `localhost:${port}`].includes(request.headers.host?.toLowerCase());
}

export async function createGeneratorServer({ databasePath = DATABASE_PATH } = {}) {
  const { form, sourceMethods } = await loadHouseData();
  const template = {
    formId: form.formId,
    revision: 'v1',
    unit: form.unit,
    measurements: buildMeasurementRows(form, sourceMethods).map(record => ({
      pomCode: record.pomCode,
      description: record.description,
      sourceLabel: record.sourceLabel,
      howToMeasure: record.howToMeasure,
      houseStandard: record.houseStandard,
      manufacturerReference: record.manufacturerReference,
    })),
  };
  const database = openHouseDatabase(databasePath);
  try {
    importHouseForm(database, form, sourceMethods);
    database.exec(`
      CREATE TABLE IF NOT EXISTS measurement_sessions (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        name TEXT NOT NULL,
        session_json TEXT NOT NULL
      ) STRICT;
    `);
  } catch (error) {
    database.close();
    throw error;
  }

  const readSession = stored => ({
    id: stored.id,
    createdAt: stored.created_at,
    session: validateMeasurementSession(JSON.parse(stored.session_json), template),
  });
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; form-action 'self'; frame-ancestors 'none'");
    try {
      if (!allowedHost(request, server)) throw new HttpError(403, 'Use this application through localhost or 127.0.0.1.');
      const url = new URL(request.url, `http://${request.headers.host}`);
      if (url.search) throw new HttpError(404, 'Not found.');
      if (request.method === 'POST') {
        const origin = request.headers.origin;
        if (origin && origin !== `http://${request.headers.host}`) {
          request.resume();
          throw new HttpError(403, 'Save sessions from this application only.');
        }
      }
      if (url.pathname === '/api/template' && request.method === 'GET') {
        sendJson(response, 200, template);
      } else if (url.pathname === '/api/sessions' && request.method === 'GET') {
        const records = database.prepare('SELECT id, created_at, session_json FROM measurement_sessions ORDER BY created_at DESC, rowid DESC').all();
        sendJson(response, 200, { sessions: records.map(stored => {
          const { id, createdAt, session } = readSession(stored);
          return { id, createdAt, name: session.name, measurementDate: session.measurementDate,
            referenceMode: session.referenceMode,
            measuredCount: session.measurements.filter(record => record.measured !== null).length };
        }) });
      } else if (url.pathname === '/api/sessions' && request.method === 'POST') {
        const input = await readJson(request);
        let session;
        try { session = validateMeasurementSession(input, template); }
        catch (error) { throw new HttpError(422, error.message); }
        const id = randomUUID();
        const createdAt = new Date().toISOString();
        database.prepare('INSERT INTO measurement_sessions (id, created_at, name, session_json) VALUES (?, ?, ?, ?)')
          .run(id, createdAt, session.name, JSON.stringify(session));
        sendJson(response, 201, { id, createdAt, session });
      } else if (/^\/api\/sessions\/[0-9a-f-]{36}$/i.test(url.pathname) && request.method === 'GET') {
        const id = url.pathname.split('/').at(-1);
        const stored = database.prepare('SELECT id, created_at, session_json FROM measurement_sessions WHERE id = ?').get(id);
        if (!stored) throw new HttpError(404, 'Measurement session not found.');
        sendJson(response, 200, readSession(stored));
      } else if (ASSETS.has(url.pathname) && ['GET', 'HEAD'].includes(request.method)) {
        const [path, type] = ASSETS.get(url.pathname);
        let content;
        try { content = await readFile(path); }
        catch (error) { if (error.code === 'ENOENT') throw new HttpError(404, 'Not found.'); throw error; }
        response.writeHead(200, { 'Content-Type': type, 'Content-Length': content.length });
        response.end(request.method === 'HEAD' ? undefined : content);
      } else if (url.pathname === '/favicon.ico' && request.method === 'GET') {
        response.writeHead(204);
        response.end();
      } else if (url.pathname.startsWith('/api/')) {
        if (url.pathname === '/api/sessions' || url.pathname === '/api/template') {
          response.setHeader('Allow', url.pathname === '/api/sessions' ? 'GET, POST' : 'GET');
          throw new HttpError(405, 'Method not allowed.');
        }
        throw new HttpError(404, 'Not found.');
      } else throw new HttpError(404, 'Not found.');
    } catch (error) {
      if (!response.headersSent) sendJson(response, error.status ?? 500, {
        error: error.status ? error.message : 'The application could not complete that request.',
      });
      else response.end();
    }
  });
  let closed = false;
  const closeDatabase = () => { if (!closed) { closed = true; database.close(); } };
  server.once('close', closeDatabase);
  server.once('error', closeDatabase);
  return server;
}

async function main() {
  const portText = process.env.PORT ?? '3000';
  if (!/^\d+$/.test(portText) || Number(portText) > 65535) throw Error('PORT must be an integer from 0 to 65535.');
  const server = await createGeneratorServer();
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(Number(portText), '127.0.0.1', resolveListen);
  });
  console.log(`Measurement generator ready: http://127.0.0.1:${server.address().port}`);
  console.log('20 POMs; new sessions save locally in SQLite without changing the approved baseline.');
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
