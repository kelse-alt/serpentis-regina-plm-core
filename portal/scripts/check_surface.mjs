import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { smoothHeadNormals } from '../src/surface.js';

// Exercise the actual approved GLBs, including their shared buffers and material
// primitives. A synthetic sphere would miss the seams and carved-fold risks.
const originals = [
  {
    file: 'kelsea-mother.glb', primitives: 3, vertices: 72371, triangles: 144738,
    sha256: '96767a86c1632e6d3019e88cc78e1a8a3f31a78a74bbbdacee30f6af9a3f4804',
  },
  {
    file: 'serpentis-maiden.glb', primitives: 5, vertices: 81801, triangles: 163602,
    sha256: '74e7f062d930ed9ba3bd1786dca7550c23dd191d387fba11cb2c6171546aafaa',
  },
  {
    file: 'crown.glb', primitives: 3, vertices: 73180, triangles: 146356,
    sha256: '60a6313b5276baf5ca7d7e57268dd419fd81d9510b0bf663f094e1ab86af636d',
  },
];

function bytes(array) {
  return Buffer.from(array.buffer, array.byteOffset, array.byteLength);
}

function cosine(a, b, first, second) {
  const i = first * 3, j = second * 3;
  const dot = a[i] * b[j] + a[i + 1] * b[j + 1] + a[i + 2] * b[j + 2];
  const length = Math.hypot(a[i], a[i + 1], a[i + 2]) * Math.hypot(b[j], b[j + 1], b[j + 2]);
  return Math.min(1, Math.max(-1, dot / length));
}

function angle(a, b, first, second = first) {
  return Math.acos(cosine(a, b, first, second)) * 180 / Math.PI;
}

const results = [];
const failures = [];
for (const original of originals) {
  const path = fileURLToPath(new URL(`../public/models/${original.file}`, import.meta.url));
  const file = await readFile(path);
  assert.equal(createHash('sha256').update(file).digest('hex'), original.sha256, `${original.file}: source hash`);
  const input = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  const inputSnapshot = Buffer.from(new Uint8Array(input));
  const { scene } = await new GLTFLoader().parseAsync(input, '');
  const meshes = [];
  scene.traverse(object => { if (object.isMesh) meshes.push(object); });
  assert.equal(meshes.length, original.primitives, `${original.file}: actual material primitive count`);
  const initial = meshes.map(mesh => {
    const geometry = mesh.geometry;
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const index = geometry.index;
    return {
      geometry, position, normal, normalArray: normal.array, index,
      positions: Buffer.from(bytes(position.array)),
      normals: Buffer.from(bytes(normal.array)),
      indices: Buffer.from(bytes(index.array)),
    };
  });
  const before = initial[0].normal.array.slice();
  assert.equal(before.length / 3, original.vertices);
  const count = original.vertices;
  const edges = new Map();
  let triangles = 0;
  for (const { index } of initial) {
    const array = index.array;
    triangles += array.length / 3;
    for (let i = 0; i < array.length; i += 3) {
      const a = array[i], b = array[i + 1], c = array[i + 2];
      for (const [first, second] of [[a, b], [b, c], [c, a]]) {
        const key = Math.min(first, second) * count + Math.max(first, second);
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
  }
  assert.equal(triangles, original.triangles, `${original.file}: complete shared surface`);
  assert([...edges.values()].every(uses => uses === 2), `${original.file}: closed manifold baseline`);

  smoothHeadNormals(scene);
  const sharedNormal = meshes[0].geometry.getAttribute('normal');
  const after = sharedNormal.array;
  for (let i = 0; i < meshes.length; i++) {
    const geometry = meshes[i].geometry;
    const source = initial[i];
    assert.strictEqual(geometry.getAttribute('position'), source.position, `${original.file}: position attribute retained`);
    assert.strictEqual(geometry.index, source.index, `${original.file}: original topology retained`);
    assert(bytes(source.position.array).equals(source.positions), `${original.file}: all vertex positions unchanged`);
    assert(bytes(source.index.array).equals(source.indices), `${original.file}: every triangle index unchanged`);
    assert.strictEqual(source.normal.array, source.normalArray, `${original.file}: original normal array retained`);
    assert(bytes(source.normalArray).equals(source.normals), `${original.file}: original normal buffer unmutated`);
    assert.notStrictEqual(geometry.getAttribute('normal'), source.normal, `${original.file}: polished normals are a separate attribute`);
    assert.strictEqual(geometry.getAttribute('normal'), sharedNormal, `${original.file}: one common normal attribute prevents primitive seams`);
  }
  assert(Buffer.from(input).equals(inputSnapshot), `${original.file}: input GLB buffer unmutated`);
  assert((await readFile(path)).equals(file), `${original.file}: source file bytes unchanged`);
  assert(after.length === before.length && after.every(Number.isFinite), `${original.file}: finite complete normals`);

  const changes = [];
  let maximumUnitError = 0;
  for (let vertex = 0; vertex < count; vertex++) {
    const at = vertex * 3;
    maximumUnitError = Math.max(maximumUnitError, Math.abs(Math.hypot(after[at], after[at + 1], after[at + 2]) - 1));
    changes.push(angle(before, after, vertex));
  }
  assert(maximumUnitError < 1e-6, `${original.file}: normals remain unit length`);
  changes.sort((a, b) => a - b);
  let variationBefore = 0, variationAfter = 0, ridges = 0, ridgesRetained = 0;
  for (const key of edges.keys()) {
    const first = Math.floor(key / count), second = key % count;
    const oldAngle = angle(before, before, first, second);
    const newAngle = angle(after, after, first, second);
    variationBefore += oldAngle;
    variationAfter += newAngle;
    if (oldAngle >= 60) {
      ridges++;
      if (newAngle >= 45) ridgesRetained++;
    }
  }
  const metric = {
    file: original.file, primitives: meshes.length, vertices: count, triangles,
    uniqueEdges: edges.size,
    meanEdgeAngleBefore: variationBefore / edges.size,
    meanEdgeAngleAfter: variationAfter / edges.size,
    variationReductionPercent: (1 - variationAfter / variationBefore) * 100,
    normalChangeP99Degrees: changes[Math.floor(count * 0.99)],
    maximumNormalChangeDegrees: changes.at(-1),
    originalSharpEdges: ridges,
    sharpEdgesRetained: ridgesRetained,
    maximumUnitError,
    positionsAndTopologyUnchanged: true,
    sourceBuffersUnmutated: true,
  };
  results.push(metric);
  // These bounds assess the visible outcome independently of implementation:
  // less small-scale normal variation, mild per-vertex lighting changes, and
  // retention of strongly carved folds rather than indiscriminate blurring.
  if (!(variationAfter < variationBefore * 0.98)) failures.push(`${original.file}: local variation must decrease by at least 2%`);
  if (!(changes.at(-1) <= 20.01)) failures.push(`${original.file}: normal changes exceed the 20-degree preservation limit`);
  if (!(ridges === 0 || ridgesRetained / ridges >= 0.95)) failures.push(`${original.file}: fewer than 95% of strong ridges remain >=45 degrees`);
}

console.log(JSON.stringify({ actualModelSurfaceChecks: results }, null, 2));
assert.deepEqual(failures, [], failures.join('\n'));
const record = {
  version: '2.1',
  passed: true,
  checkedAt: new Date().toISOString(),
  modelsChecked: results.length,
  method: 'Actual approved GLBs loaded through GLTFLoader; independent edge-angle and buffer-preservation checks.',
  thresholds: {
    minimumMeanEdgeAngleReductionPercent: 2,
    maximumNormalChangeDegrees: 20.01,
    maximumUnitLengthError: 1e-6,
    sharpEdgeOriginalAngleDegrees: 60,
    sharpEdgeRetainedAngleDegrees: 45,
    minimumSharpEdgeRetentionFraction: 0.95,
  },
  actualModelSurfaceChecks: results,
  limits: 'Measures lighting-normal continuity and exact vertex/topology preservation, not visual gloss quality or physical-device GPU performance. Edge checks do not prove the absence of all non-local surface intersections.',
};
await writeFile(new URL('../docs/validation/portal-v2.1-surfaces.json', import.meta.url), `${JSON.stringify(record, null, 2)}\n`);
console.log('All three original GLBs passed surface-preservation and smooth-normal checks.');
