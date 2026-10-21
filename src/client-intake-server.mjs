/** Local client-intake storage. Filled client records stay outside the source tree. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync, openSync, closeSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateIntakeDraft, summarizeIntake } from './client-intake.mjs';

export const CLIENT_DATABASE_PATH = fileURLToPath(new URL('../storage/client-intakes.sqlite', import.meta.url));
const TEMPLATE = new URL('../data/templates/remote-bespoke-client-intake.v1.json', import.meta.url);
const BODY_LIMIT = 128 * 1024;
const ASSETS = new Map([
  ['/', [new URL('../client-web/index.html', import.meta.url), 'text/html; charset=utf-8']],
  ['/intake.css', [new URL('../client-web/app.css', import.meta.url), 'text/css; charset=utf-8']],
  ['/intake-app.mjs', [new URL('../client-web/app.mjs', import.meta.url), 'text/javascript; charset=utf-8']],
  ['/client-intake.mjs', [new URL('./client-intake.mjs', import.meta.url), 'text/javascript; charset=utf-8']],
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
    throw new HttpError(415, 'Send the intake as application/json.');
  }
  if (Number(request.headers['content-length']) > BODY_LIMIT) {
    request.resume();
    throw new HttpError(413, 'Intake exceeds the 128 KB request limit.');
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
        reject(new HttpError(413, 'Intake exceeds the 128 KB request limit.'));
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

function openClientDatabase(databasePath) {
  if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
    try { closeSync(openSync(databasePath, 'ax', 0o600)); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  const database = new DatabaseSync(databasePath);
  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS client_intakes (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        title TEXT NOT NULL,
        intake_json TEXT NOT NULL
      ) STRICT;
    `);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

function intakeTitle(intake) {
  return [intake.fields.clientId, intake.fields.clientName].filter(Boolean).join(' · ')
    || intake.fields.projectDescription || 'Untitled client intake';
}

export async function createClientIntakeServer({ databasePath = CLIENT_DATABASE_PATH } = {}) {
  const template = JSON.parse(await readFile(TEMPLATE, 'utf8'));
  if (template.templateId !== 'SR-REMOTE-BESPOKE-INTAKE' || template.measurements?.length !== 34) {
    throw Error('The 34-POM client-intake template could not be loaded.');
  }
  const database = openClientDatabase(databasePath);
  const readIntake = stored => ({
    id: stored.id,
    createdAt: stored.created_at,
    intake: validateIntakeDraft(JSON.parse(stored.intake_json), template),
  });
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; form-action 'self'; frame-ancestors 'none'");
    try {
      const port = server.address()?.port;
      if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(request.headers.host?.toLowerCase())) {
        request.resume();
        throw new HttpError(403, 'Use this intake application through localhost or 127.0.0.1.');
      }
      const url = new URL(request.url, `http://${request.headers.host}`);
      if (url.search) throw new HttpError(404, 'Not found.');
      if (request.method === 'POST' && request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) {
        request.resume();
        throw new HttpError(403, 'Save intakes from this application only.');
      }
      if (url.pathname === '/api/client-intake/template' && request.method === 'GET') {
        sendJson(response, 200, template);
      } else if (url.pathname === '/api/client-intake/sessions' && request.method === 'GET') {
        const records = database.prepare('SELECT id, created_at, title, intake_json FROM client_intakes ORDER BY created_at DESC, rowid DESC').all();
        sendJson(response, 200, { sessions: records.map(stored => {
          const { id, createdAt, intake } = readIntake(stored);
          const stats = summarizeIntake(intake, template);
          return { id, title: stored.title, createdAt, unit: intake.unit,
            measuredCount: stats.measured, requiredMeasured: stats.requiredMeasured, requiredTotal: stats.requiredTotal };
        }) });
      } else if (url.pathname === '/api/client-intake/sessions' && request.method === 'POST') {
        const input = await readJson(request);
        let intake;
        try { intake = validateIntakeDraft(input, template); }
        catch (error) { throw new HttpError(422, error.message); }
        const id = randomUUID();
        const createdAt = new Date().toISOString();
        database.prepare('INSERT INTO client_intakes (id, created_at, title, intake_json) VALUES (?, ?, ?, ?)')
          .run(id, createdAt, intakeTitle(intake), JSON.stringify(intake));
        sendJson(response, 201, { id, createdAt, intake });
      } else if (/^\/api\/client-intake\/sessions\/[0-9a-f-]{36}$/i.test(url.pathname) && request.method === 'GET') {
        const id = url.pathname.split('/').at(-1);
        const stored = database.prepare('SELECT id, created_at, intake_json FROM client_intakes WHERE id = ?').get(id);
        if (!stored) throw new HttpError(404, 'Client intake not found.');
        sendJson(response, 200, readIntake(stored));
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
      } else if (['/api/client-intake/sessions', '/api/client-intake/template'].includes(url.pathname)) {
        response.setHeader('Allow', url.pathname.endsWith('/sessions') ? 'GET, POST' : 'GET');
        throw new HttpError(405, 'Method not allowed.');
      } else throw new HttpError(404, 'Not found.');
    } catch (error) {
      if (!response.headersSent) sendJson(response, error.status ?? 500, {
        error: error.status ? error.message : 'The intake application could not complete that request.',
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
  const portText = process.env.PORT ?? '3002';
  if (!/^\d+$/.test(portText) || Number(portText) > 65535) throw Error('PORT must be an integer from 0 to 65535.');
  const server = await createClientIntakeServer();
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(Number(portText), '127.0.0.1', resolveListen);
  });
  console.log(`Client intake ready: http://127.0.0.1:${server.address().port}`);
  console.log('34 workbook POMs; 19 required. New intakes save only in the separate local client database.');
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
