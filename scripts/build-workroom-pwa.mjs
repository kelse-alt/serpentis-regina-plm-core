import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function hostedPage(html, page, version, css) {
  if (!html.includes('</head>') || !html.includes('</body>')) throw new Error(`Invalid ${page} standalone HTML`);
  const policy = "default-src 'none'; script-src 'self' 'unsafe-inline'; worker-src 'self'; manifest-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; font-src data:; connect-src 'self'; base-uri 'none'; form-action 'none'";
  const metadata = `<meta name="theme-color" content="#101820"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="SR Workroom"><meta name="workroom-app-version" content="${version}"><link rel="manifest" href="./manifest.webmanifest"><link rel="apple-touch-icon" href="./icons/apple-touch-icon.png"><style id="workroom-pwa-css">${css}</style>`;
  if (!/<meta\s+http-equiv="Content-Security-Policy"\s+content="[^"]*"/i.test(html)) {
    throw new Error(`Missing ${page} standalone content-security policy`);
  }
  return html
    .replace(/(<meta\s+http-equiv="Content-Security-Policy"\s+content=")[^"]*("\s*\/?>)/i, `$1${policy}$2`)
    .replace(/(<meta\s+name="viewport"\s+content=")[^"]*("\s*\/?>)/i, '$1width=device-width,initial-scale=1,viewport-fit=cover$2')
    .replace('<body>', `<body data-pwa-page="${page}">`)
    .replace('</head>', `${metadata}</head>`)
    .replace('</body>', '<script src="./pwa.js" defer></script></body>');
}

export async function buildWorkroomPwa({ rootDir = projectRoot, outputDir = path.join(rootDir, 'reports/workroom-pwa') } = {}) {
  const [packageText, techPack, clientIntake, css, pwaScript, manifest, workerTemplate] = await Promise.all([
    readFile(path.join(rootDir, 'package.json'), 'utf8'),
    readFile(path.join(rootDir, 'tech-pack.html'), 'utf8'),
    readFile(path.join(rootDir, 'client-intake.html'), 'utf8'),
    readFile(path.join(rootDir, 'pwa/app.css'), 'utf8'),
    readFile(path.join(rootDir, 'pwa/pwa.js')),
    readFile(path.join(rootDir, 'pwa/manifest.webmanifest')),
    readFile(path.join(rootDir, 'pwa/sw.template.js'), 'utf8')
  ]);
  const { version } = JSON.parse(packageText);
  if (!/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(version)) throw new Error('Invalid app version');
  const files = new Map([
    ['index.html', Buffer.from(hostedPage(techPack, 'workroom', version, css))],
    ['client-intake.html', Buffer.from(hostedPage(clientIntake, 'client', version, css))],
    ['pwa.js', pwaScript],
    ['manifest.webmanifest', manifest]
  ]);
  for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
    const bytes = await readFile(path.join(rootDir, 'pwa/icons', name));
    if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
        bytes.readUInt32BE(16) !== size || bytes.readUInt32BE(20) !== size) {
      throw new Error(`${name} must be an original-seal PNG rendered at ${size} × ${size}`);
    }
    files.set(`icons/${name}`, bytes);
  }
  const assets = [...files].map(([assetPath, bytes]) => ({ path:assetPath, sha256:sha256(bytes) }));
  // Include worker logic as well as every shell byte: a worker-only fix must
  // receive its own cache, so failed installation cannot damage an older app.
  const buildId = sha256(JSON.stringify({ version, assets, workerTemplateHash:sha256(workerTemplate) }));
  const worker = workerTemplate
    .replace('__WORKROOM_VERSION__', JSON.stringify(version))
    .replace('__WORKROOM_BUILD_ID__', JSON.stringify(buildId))
    .replace('__WORKROOM_ASSETS__', JSON.stringify(assets, null, 2));
  if (/__WORKROOM_[A-Z_]+__/.test(worker)) throw new Error('Unresolved service-worker build token');
  files.set('sw.js', Buffer.from(worker));
  const staging = `${outputDir}.building-${process.pid}`;
  await rm(staging, { recursive:true, force:true });
  await mkdir(path.join(staging, 'icons'), { recursive:true });
  try {
    for (const [name, bytes] of files) await writeFile(path.join(staging, name), bytes);
    await rm(outputDir, { recursive:true, force:true });
    await rename(staging, outputDir);
  } catch (error) {
    await rm(staging, { recursive:true, force:true });
    throw error;
  }
  return { version, buildId, outputDir, files:[...files.keys()] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildWorkroomPwa();
  console.log(`Built Workroom v${result.version} (${result.buildId.slice(0, 12)}) → ${path.relative(projectRoot, result.outputDir)}/`);
}
