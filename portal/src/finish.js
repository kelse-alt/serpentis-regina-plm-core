import * as THREE from 'three';

// A local HDR lighting texture, not a visible backdrop or extra scene objects.
// Broad neutral softboxes create continuous reflections on the clear lacquer.
export function studioEnvironment(renderer) {
  const width = 512, height = 256;
  const pixels = new Float32Array(width * height * 4);
  const lights = [
    { direction: new THREE.Vector3(-0.65, 0.55, 0.65).normalize(), spread: 18, strength: 4.5 },
    { direction: new THREE.Vector3(0.75, 0.25, 0.5).normalize(), spread: 30, strength: 2.5 },
    { direction: new THREE.Vector3(0.05, 0.95, -0.25).normalize(), spread: 12, strength: 1.8 },
  ];
  for (let y = 0; y < height; y++) {
    const theta = Math.PI * (y + 0.5) / height;
    for (let x = 0; x < width; x++) {
      const phi = 2 * Math.PI * (x + 0.5) / width;
      const dx = -Math.sin(theta) * Math.cos(phi);
      const dy = Math.cos(theta);
      const dz = Math.sin(theta) * Math.sin(phi);
      let radiance = 0.1;
      for (const light of lights) {
        const dot = dx * light.direction.x + dy * light.direction.y + dz * light.direction.z;
        radiance += light.strength * Math.exp((dot - 1) * light.spread);
      }
      const at = (y * width + x) * 4;
      pixels[at] = pixels[at + 1] = pixels[at + 2] = radiance;
      pixels[at + 3] = 1;
    }
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat, THREE.FloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.needsUpdate = true;
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromEquirectangular(texture);
  generator.dispose(); texture.dispose();
  return environment.texture;
}

export function logoMaterial() {
  const material = new THREE.MeshPhysicalMaterial({
    color: '#b8b8b8',
    metalness: 0,
    roughness: 0.25,
    clearcoat: 0.85,
    clearcoatRoughness: 0.19,
    envMapIntensity: 1,
    side: THREE.DoubleSide,
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.logoPearl = { value: new THREE.Color('#b8b8b8') };
    shader.uniforms.logoRose = { value: new THREE.Color('#b68294') };
    shader.uniforms.logoPink = { value: new THREE.Color('#b00046') };
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
      #include <common>
      uniform vec3 logoPearl;
      uniform vec3 logoRose;
      uniform vec3 logoPink;
    `).replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      float logoFacing = max(dot(normal, normalize(vViewPosition)), 0.0);
      float logoRim = pow(1.0 - logoFacing, 1.6);
      vec3 logoColor = mix(logoPearl, logoRose, smoothstep(0.05, 0.42, logoRim) * 0.83);
      diffuseColor.rgb = mix(logoColor, logoPink, smoothstep(0.18, 0.85, logoRim));
    `);
  };
  material.customProgramCacheKey = () => 'logo-clearcoat-v2.1';
  return material;
}
