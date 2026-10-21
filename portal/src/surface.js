import * as THREE from 'three';

// Nomad's material primitives share a complete vertex buffer. Build one
// neighborhood across every primitive so polishing cannot create material seams.
// Only the lighting normals change; positions, topology and silhouettes stay exact.
export function smoothHeadNormals(model, passes = 4) {
  const surfaces = new Map();
  model.traverse(object => {
    if (!object.isMesh) return;
    const position = object.geometry.getAttribute('position');
    const key = position.array;
    if (!surfaces.has(key)) surfaces.set(key, []);
    surfaces.get(key).push(object);
  });

  let vertices = 0;
  for (const meshes of surfaces.values()) {
    const source = meshes[0].geometry.getAttribute('normal');
    const count = source.count;
    vertices += count;
    const degrees = new Uint32Array(count);
    const visitEdges = callback => {
      for (const mesh of meshes) {
        const indices = mesh.geometry.index.array;
        for (let i = 0; i < indices.length; i += 3) {
          const a = indices[i], b = indices[i + 1], c = indices[i + 2];
          callback(a, b); callback(b, a);
          callback(b, c); callback(c, b);
          callback(c, a); callback(a, c);
        }
      }
    };
    visitEdges(a => degrees[a]++);
    const offsets = new Uint32Array(count + 1);
    for (let i = 0; i < count; i++) offsets[i + 1] = offsets[i] + degrees[i];
    const neighbors = new Uint32Array(offsets[count]);
    const cursor = offsets.slice(0, count);
    visitEdges((a, b) => { neighbors[cursor[a]++] = b; });

    const original = new Float32Array(source.array);
    for (let i = 0; i < original.length; i += 3) {
      const length = Math.hypot(original[i], original[i + 1], original[i + 2]) || 1;
      original[i] /= length; original[i + 1] /= length; original[i + 2] /= length;
    }
    const maxAngle = THREE.MathUtils.degToRad(20);
    const minDot = Math.cos(maxAngle), maxTangent = Math.sin(maxAngle);
    let current = new Float32Array(original);
    let next = new Float32Array(current.length);
    for (let pass = 0; pass < passes; pass++) {
      for (let i = 0; i < count; i++) {
        const at = i * 3;
        const x = current[at], y = current[at + 1], z = current[at + 2];
        let sumX = 0, sumY = 0, sumZ = 0, weight = 0;
        for (let j = offsets[i]; j < offsets[i + 1]; j++) {
          const neighbor = neighbors[j] * 3;
          const dot = x * current[neighbor] + y * current[neighbor + 1] + z * current[neighbor + 2];
          const originalDot = original[at] * original[neighbor] + original[at + 1] * original[neighbor + 1] + original[at + 2] * original[neighbor + 2];
          // A 60-degree gate preserves carved folds and separate surface sides.
          const amount = Math.max(0, (dot - 0.5) * 2) ** 2 * Math.max(0, (originalDot - 0.5) * 2) ** 2;
          sumX += current[neighbor] * amount;
          sumY += current[neighbor + 1] * amount;
          sumZ += current[neighbor + 2] * amount;
          weight += amount;
        }
        const blend = weight > 0 ? 0.55 / weight : 0;
        const nx = x * 0.45 + sumX * blend;
        const ny = y * 0.45 + sumY * blend;
        const nz = z * 0.45 + sumZ * blend;
        const length = Math.hypot(nx, ny, nz) || 1;
        next[at] = nx / length;
        next[at + 1] = ny / length;
        next[at + 2] = nz / length;
        // Iteration must not drift across the original sculpt's sharp ridges.
        const alignment = next[at] * original[at] + next[at + 1] * original[at + 1] + next[at + 2] * original[at + 2];
        if (alignment < minDot) {
          const tx = next[at] - original[at] * alignment;
          const ty = next[at + 1] - original[at + 1] * alignment;
          const tz = next[at + 2] - original[at + 2] * alignment;
          const tangentScale = maxTangent / (Math.hypot(tx, ty, tz) || 1);
          next[at] = original[at] * minDot + tx * tangentScale;
          next[at + 1] = original[at + 1] * minDot + ty * tangentScale;
          next[at + 2] = original[at + 2] * minDot + tz * tangentScale;
        }
      }
      [current, next] = [next, current];
    }
    const normal = new THREE.BufferAttribute(current, 3);
    for (const mesh of meshes) mesh.geometry.setAttribute('normal', normal);
  }
  return { surfaces: surfaces.size, vertices, normalPasses: passes, positionsChanged: false };
}
