import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { worlds } from './worlds.js';
import './style.css';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const dialog = document.querySelector('#world-dialog');
const galleries = [];
let finish = 'reflective';
let entering = false;
let lastTrigger;

// Small, explicit runtime state also makes model failures visible to smoke checks.
window.portal = { loaded: [], errors: [], selectedWorld: null, finish };
document.querySelector('#year').textContent = new Date().getFullYear();

function closeWorld() {
  dialog.close();
  lastTrigger?.focus({ preventScroll: true });
}
document.querySelector('.dialog-close').addEventListener('click', closeWorld);
document.querySelector('.return-link').addEventListener('click', closeWorld);
dialog.addEventListener('click', event => { if (event.target === dialog) {
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeWorld();
}});
dialog.addEventListener('close', () => {
  window.portal.selectedWorld = null;
  document.body.style.overflow = '';
  lastTrigger?.focus({ preventScroll: true });
});

async function enterWorld(world, trigger, gallery) {
  if (entering || dialog.open) return;
  entering = true;
  lastTrigger = trigger;
  const card = document.getElementById(world.id);
  card.classList.add('entering');
  if (!reducedMotion.matches) {
    gallery?.animateEntry();
    // A brief swirl, expansion and fade follows the blueprint's transition note.
    const animation = card.animate([
      { opacity: 1, transform: 'translateY(0) scale(1)' },
      { opacity: 0.5, transform: 'translateY(-8px) scale(1.045)', offset: 0.7 },
      { opacity: 0, transform: 'translateY(-12px) scale(1.07)' },
    ], { duration: 650, easing: 'cubic-bezier(.22,.7,.3,1)' });
    await animation.finished.catch(() => {});
  }
  document.querySelector('#dialog-role').textContent = world.role;
  document.querySelector('#dialog-title').textContent = world.name;
  document.querySelector('#dialog-description').textContent = world.description;
  document.querySelector('#dialog-note').textContent = world.note;
  const topics = document.querySelector('#dialog-topics');
  topics.replaceChildren(...world.topics.map(topic => {
    const item = document.createElement('li'); item.textContent = topic; return item;
  }));
  topics.hidden = !world.topics.length;
  const destination = document.querySelector('#dialog-destination');
  destination.hidden = !world.destination;
  if (world.destination) destination.href = world.destination;
  else destination.removeAttribute('href');
  window.portal.selectedWorld = world.id;
  document.body.style.overflow = 'hidden';
  dialog.showModal();
  card.classList.remove('entering');
  entering = false;
}

function marbleTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const context = canvas.getContext('2d');
  const image = context.createImageData(512, 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const wave = Math.sin(x * 0.014 + y * 0.025 + Math.sin(y * 0.02) * 3 + Math.sin(x * 0.018 + y * 0.012) * 2);
    const vein = Math.pow(Math.abs(wave), 30);
    const cloud = Math.sin(x * 0.009 + y * 0.007) * 3;
    const index = (y * 512 + x) * 4;
    image.data[index] = 239 - vein * 37 + cloud;
    image.data[index + 1] = 229 - vein * 44 + cloud;
    image.data[index + 2] = 218 - vein * 39 + cloud;
    image.data[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
const marble = marbleTexture();

function sculptureMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xebdce5, metalness: 0.94, roughness: 0.19,
    clearcoat: 1, clearcoatRoughness: 0.16, iridescence: 0.7,
    iridescenceIOR: 1.35, iridescenceThicknessRange: [160, 430],
    envMapIntensity: 1.35, side: THREE.DoubleSide,
  });
}

function applyFinish(material) {
  const reflective = finish === 'reflective';
  material.color.set(reflective ? 0xebdce5 : 0xffeae2);
  material.metalness = reflective ? 0.94 : 0.15;
  material.roughness = reflective ? 0.19 : 0.3;
  material.iridescence = reflective ? 0.7 : 0.12;
  material.envMapIntensity = reflective ? 1.35 : 0.8;
  material.needsUpdate = true;
}

function environment(renderer) {
  const room = new RoomEnvironment();
  // Colored reflection panels echo the existing website head's pink contours.
  for (const [color, x, y, z, rotation] of [
    [0xff2e94, -3, 2, 2, Math.PI / 2],
    [0x2ae7df, 3, 1.5, 1, -Math.PI / 2],
    [0x9671e9, 0, 3, -3, 0],
  ]) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(3, 5), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    panel.position.set(x, y, z); panel.rotation.y = rotation; room.add(panel);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(room, 0.045);
  room.dispose(); pmrem.dispose();
  return target.texture;
}

async function createSculpture(world, stage, status, enterButton) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.setAttribute('aria-label', `${world.head} sculpture for ${world.name}. Drag to rotate; use the Enter button to choose this world.`);
    stage.append(canvas);
    const scene = new THREE.Scene();
    scene.environment = environment(renderer);
    scene.add(new THREE.HemisphereLight(0xfff7ed, 0xb77d8f, 2.1));
    const key = new THREE.DirectionalLight(0xffe9d5, 4); key.position.set(3, 5, 4); scene.add(key);
    const pink = new THREE.DirectionalLight(0xff56a2, 3.4); pink.position.set(-4, 1, 3); scene.add(pink);
    const teal = new THREE.DirectionalLight(0x72ece5, 1.6); teal.position.set(3, 2, -1); scene.add(teal);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.9, 0.13, 64), new THREE.MeshStandardMaterial({ map: marble, color: 0xf5e6d6, roughness: 0.42 }));
    base.position.y = -0.81; scene.add(base);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.69, 0.73, 0.9, 64), new THREE.MeshStandardMaterial({ map: marble, color: 0xf5e6df, roughness: 0.4 }));
    column.position.y = -0.3; scene.add(column);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.79, 0.79, 0.11, 64), column.material);
    top.position.y = 0.2; scene.add(top);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.008, 6, 64), new THREE.MeshStandardMaterial({ color: 0xb77f67, metalness: 0.65, roughness: 0.4 }));
    trim.rotation.x = Math.PI / 2; trim.position.y = 0.125; scene.add(trim);

    const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 50);
    camera.position.set(0, 1.65, 7.6); camera.lookAt(0, 0.95, 0);
    let model;
    const pivot = new THREE.Group(); scene.add(pivot);
    const material = sculptureMaterial(); applyFinish(material);
    let visible = true, pointer = null, lastRotation = 0, hover = false, entryUntil = 0;
    let needsRender = true, lastRender = 0;
    let frame;
    const resize = () => {
      renderer.setSize(stage.clientWidth, stage.clientHeight, false);
      camera.aspect = stage.clientWidth / Math.max(stage.clientHeight, 1); camera.updateProjectionMatrix();
      needsRender = true;
    };
    new ResizeObserver(resize).observe(stage); resize();
    const clock = new THREE.Clock();
    reducedMotion.addEventListener('change', () => { needsRender = true; });
    function draw(timestamp = 0) {
      frame = requestAnimationFrame(draw);
      if (!visible || document.hidden) return;
      if (timestamp - lastRender < 1000 / 30 && !needsRender) return;
      if (reducedMotion.matches && !needsRender && !pointer && performance.now() >= entryUntil) return;
      lastRender = timestamp;
      const t = clock.getElapsedTime();
      if (model) {
        const scale = hover && !pointer && !reducedMotion.matches ? 1.025 : 1;
        pivot.scale.lerp(new THREE.Vector3(scale, scale, scale), reducedMotion.matches ? 1 : 0.12);
        if (performance.now() < entryUntil) pivot.rotation.y += 0.025;
        else if (!pointer && !reducedMotion.matches) pivot.position.y = Math.sin(t * 0.7) * 0.025;
        else pivot.position.y = 0;
      }
      renderer.render(scene, camera);
      needsRender = false;
    }
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }, { rootMargin: '100px' }).observe(stage);
    draw();
    const modelUrl = window.__PORTAL_MODEL_URLS__?.[world.model]
      ?? `${import.meta.env.BASE_URL}models/${world.model}`;
    const gltf = await new GLTFLoader().loadAsync(modelUrl);
    model = gltf.scene; model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    model.position.sub(center);
    const normalized = new THREE.Group(); normalized.add(model);
    const factor = 2.25 / Math.max(size.x, size.y, size.z);
    normalized.scale.setScalar(factor);
    normalized.position.y = 0.36 + size.y * factor / 2;
    pivot.add(normalized);
    model.traverse(object => { if (object.isMesh) object.material = material; });
    const gallery = { world, material, pivot,
      animateEntry: () => { entryUntil = performance.now() + 650; needsRender = true; },
      updateFinish: () => { applyFinish(material); needsRender = true; },
    };
    galleries.push(gallery);
    needsRender = true;
    status.textContent = `${world.head} sculpture loaded.`; status.classList.add('loaded');
    window.portal.loaded.push(world.id);

    const raycaster = new THREE.Raycaster();
    function intersects(event) {
      const rect = canvas.getBoundingClientRect();
      const position = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(position, camera);
      return raycaster.intersectObject(pivot, true).length > 0;
    }
    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !intersects(event)) return;
      pointer = { x: event.clientX, y: event.clientY, moved: false, id: event.pointerId };
      lastRotation = pivot.rotation.y; canvas.setPointerCapture(event.pointerId); stage.classList.add('dragging');
    });
    canvas.addEventListener('pointermove', event => {
      hover = intersects(event);
      stage.style.cursor = pointer ? 'grabbing' : hover ? 'grab' : 'default';
      if (!pointer) return;
      if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 7) pointer.moved = true;
      if (pointer.moved) { pivot.rotation.y = lastRotation + (event.clientX - pointer.x) * 0.012; needsRender = true; }
    });
    canvas.addEventListener('pointerup', event => {
      if (!pointer) return;
      const activate = !pointer.moved;
      pointer = null; stage.classList.remove('dragging');
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (activate) enterWorld(world, enterButton, gallery);
    });
    const cancelPointer = () => { pointer = null; hover = false; stage.classList.remove('dragging'); };
    canvas.addEventListener('pointercancel', cancelPointer);
    canvas.addEventListener('lostpointercapture', cancelPointer);
    canvas.addEventListener('pointerleave', () => { hover = false; });
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); cancelAnimationFrame(frame);
      status.textContent = 'The sculpture is temporarily unavailable. You can still enter below.';
      status.classList.remove('loaded');
    });
    enterButton.addEventListener('pointerenter', () => { hover = true; });
    enterButton.addEventListener('pointerleave', () => { hover = false; });
    return gallery;
  } catch (error) {
    status.textContent = 'The sculpture could not load. You can still enter this world below.';
    window.portal.errors.push({ world: world.id, message: error.message });
    return null;
  }
}

await Promise.all(worlds.map(async world => {
  const card = document.createElement('article'); card.className = 'world'; card.id = world.id;
  const stage = document.createElement('div'); stage.className = 'sculpture-stage';
  const status = document.createElement('p'); status.className = 'model-status'; status.setAttribute('role', 'status'); status.textContent = `Preparing ${world.head}…`;
  stage.append(status);
  const number = document.createElement('p'); number.className = 'world-number'; number.textContent = world.number;
  const role = document.createElement('p'); role.className = 'world-role'; role.textContent = world.role;
  const title = document.createElement('h2'); title.textContent = world.name;
  const summary = document.createElement('p'); summary.className = 'world-summary'; summary.textContent = world.summary;
  const button = document.createElement('button'); button.type = 'button'; button.className = 'enter-world'; button.setAttribute('aria-label', `Enter ${world.name}`); button.append('ENTER THE WORLD ');
  const arrow = document.createElement('span'); arrow.setAttribute('aria-hidden', 'true');
  arrow.innerHTML = '<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M4 16 16 4M4 4h12v12" stroke="currentColor" stroke-width="1"/></svg>';
  button.append(arrow);
  card.append(stage, number, role, title, summary, button); document.querySelector('#worlds').append(card);
  let gallery;
  button.addEventListener('click', () => enterWorld(world, button, gallery));
  gallery = await createSculpture(world, stage, status, button);
}));

for (const button of document.querySelectorAll('[data-finish]')) button.addEventListener('click', () => {
  finish = button.dataset.finish; window.portal.finish = finish;
  for (const control of document.querySelectorAll('[data-finish]')) control.setAttribute('aria-pressed', String(control === button));
  for (const gallery of galleries) gallery.updateFinish();
});
document.documentElement.dataset.ready = 'true';
