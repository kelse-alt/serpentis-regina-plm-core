import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { worlds } from './worlds.js';
import { smoothHeadNormals } from './surface.js';
import { logoMaterial, studioEnvironment } from './finish.js';
import './style.css';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const cards = new Map();
let activeWorld = null;
let pinnedWorld = null;
let hideTimer;
let suppressNextFocus = false;

window.portal = { version: 2, revision: '2.1', loaded: [], errors: [], selectedWorld: null, rotations: {}, sceneMeshes: {}, surfaces: {} };

function revealWorld(id) {
  clearTimeout(hideTimer);
  activeWorld = id;
  window.portal.selectedWorld = id;
  for (const [worldId, card] of cards) {
    const active = worldId === id;
    card.info.hidden = !active;
    card.control.setAttribute('aria-expanded', String(active));
    card.article.classList.toggle('revealed', active);
    card.setReveal?.(active);
  }
}

function toggleWorld(id) {
  pinnedWorld = activeWorld === id && pinnedWorld === id ? null : id;
  revealWorld(pinnedWorld);
}

function scheduleHide(id) {
  if (activeWorld !== id || pinnedWorld) return;
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    const card = cards.get(id);
    if (!pinnedWorld && activeWorld === id && !card.info.matches(':hover') && !card.article.contains(document.activeElement)) revealWorld(null);
  }, 180);
}

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !activeWorld) return;
  const card = cards.get(activeWorld);
  const focusWasInInfo = card.info.contains(document.activeElement);
  pinnedWorld = null;
  revealWorld(null);
  if (focusWasInInfo) {
    suppressNextFocus = true;
    card.control.focus({ preventScroll: true });
  }
});

document.addEventListener('pointerdown', event => {
  if (!event.target.closest('canvas, .head-control, .world-info')) {
    pinnedWorld = null;
    revealWorld(null);
  }
});

async function createHead(world, card) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    const canvas = renderer.domElement;
    canvas.setAttribute('aria-hidden', 'true');
    card.stage.append(canvas);
    const scene = new THREE.Scene();
    scene.environment = studioEnvironment(renderer);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xffffff, 2));
    const pivot = new THREE.Group();
    scene.add(pivot);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 100);
    let size, depth = 0, dirty = true, visible = true;
    let pointer = null, rotationStart = 0;
    let reveal = 0, targetReveal = 0;
    function resize() {
      const width = card.stage.clientWidth;
      const height = Math.max(card.stage.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      if (size) {
        const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const fitHeight = size.y / (2 * tangent * 0.91);
        const fitWidth = size.x / (2 * tangent * camera.aspect * 0.96);
        camera.position.set(0, 0, Math.max(fitHeight, fitWidth) + depth * 0.18);
        camera.lookAt(0, 0, 0);
      }
      camera.updateProjectionMatrix();
      dirty = true;
    }
    new ResizeObserver(resize).observe(card.stage);
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; dirty = true; }).observe(card.stage);
    reducedMotion.addEventListener('change', () => { dirty = true; });
    card.setReveal = active => { targetReveal = active ? 1 : 0; dirty = true; };
    let lastFrame = 0;
    function draw(timestamp = 0) {
      requestAnimationFrame(draw);
      if (!visible || document.hidden) return;
      const moving = Math.abs(reveal - targetReveal) > 0.001;
      if (!dirty && !moving) return;
      if (!dirty && timestamp - lastFrame < 1000 / 30) return;
      lastFrame = timestamp;
      reveal = reducedMotion.matches ? targetReveal : THREE.MathUtils.lerp(reveal, targetReveal, 0.17);
      if (Math.abs(reveal - targetReveal) < 0.001) reveal = targetReveal;
      const mobile = card.stage.clientWidth > card.stage.clientHeight;
      pivot.scale.setScalar(1 - reveal * (mobile ? 0.27 : 0.13));
      pivot.position.y = reveal * (mobile ? 0.46 : 0.20);
      renderer.render(scene, camera);
      dirty = false;
    }
    resize(); draw();
    const url = window.__PORTAL_MODEL_URLS__?.[world.model] ?? `${import.meta.env.BASE_URL}models/${world.model}`;
    const gltf = await new GLTFLoader().loadAsync(url);
    const model = gltf.scene;
    window.portal.surfaces[world.id] = smoothHeadNormals(model);
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model, true);
    const originalSize = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    model.position.sub(center);
    const normalized = new THREE.Group();
    const scale = 3 / originalSize.y;
    normalized.scale.setScalar(scale);
    normalized.add(model);
    pivot.add(normalized);
    size = originalSize.clone().multiplyScalar(scale);
    depth = size.z;
    const material = logoMaterial();
    let meshCount = 0;
    model.traverse(object => { if (object.isMesh) { object.material = material; meshCount++; } });
    window.portal.sceneMeshes[world.id] = { head: meshCount, extra: 0 };
    window.portal.rotations[world.id] = 0;
    window.portal.loaded.push(world.id);
    card.status.textContent = `${world.head} loaded. Touch or focus it to reveal ${world.name}.`;
    resize();
    const raycaster = new THREE.Raycaster();
    function hitsHead(event) {
      const rect = canvas.getBoundingClientRect();
      const point = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(point, camera);
      return raycaster.intersectObject(pivot, true).length > 0;
    }
    canvas.addEventListener('pointermove', event => {
      const hit = hitsHead(event);
      card.stage.style.cursor = pointer ? 'grabbing' : hit ? 'pointer' : 'default';
      if (pointer) {
        if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 7) {
          pointer.dragged = true;
          pinnedWorld = null;
          if (activeWorld) revealWorld(null);
          pivot.rotation.y = rotationStart + (event.clientX - pointer.x) * 0.008;
          window.portal.rotations[world.id] = pivot.rotation.y;
          dirty = true;
        }
        return;
      }
      if (event.pointerType !== 'mouse') return;
      if (hit && !pinnedWorld) revealWorld(world.id);
      else if (!hit) scheduleHide(world.id);
    });
    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !hitsHead(event)) return;
      pointer = { x: event.clientX, y: event.clientY, dragged: false };
      rotationStart = pivot.rotation.y;
      canvas.setPointerCapture(event.pointerId);
      card.stage.classList.add('dragging');
    });
    canvas.addEventListener('pointerup', event => {
      if (!pointer) return;
      const activate = !pointer.dragged;
      pointer = null;
      card.stage.classList.remove('dragging');
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (activate) toggleWorld(world.id);
    });
    const cancel = () => { pointer = null; card.stage.classList.remove('dragging'); };
    canvas.addEventListener('pointercancel', cancel);
    canvas.addEventListener('lostpointercapture', cancel);
    canvas.addEventListener('pointerleave', () => { if (!pointer) scheduleHide(world.id); });
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); fallback('The head is temporarily unavailable. Select its name to continue.');
    });
  } catch (error) {
    window.portal.errors.push({ world: world.id, message: error.message });
    fallback('The head could not load. Select its name to continue.');
  }
  function fallback(message) {
    card.article.classList.add('has-fallback');
    card.status.textContent = message;
    renderer?.domElement.remove();
  }
}

await Promise.all(worlds.map(async world => {
  const article = document.createElement('article');
  article.className = 'world'; article.id = world.id;
  const stage = document.createElement('div'); stage.className = 'sculpture-stage';
  const status = document.createElement('p'); status.className = 'model-status'; status.setAttribute('role', 'status'); status.textContent = `Loading ${world.head}.`;
  const control = document.createElement('button'); control.className = 'head-control'; control.type = 'button'; control.textContent = world.name;
  control.setAttribute('aria-label', `Reveal ${world.name}`); control.setAttribute('aria-expanded', 'false'); control.setAttribute('aria-controls', `${world.id}-info`);
  const info = document.createElement('section'); info.className = 'world-info'; info.id = `${world.id}-info`; info.hidden = true;
  const role = document.createElement('p'); role.className = 'world-role'; role.textContent = world.role;
  const name = document.createElement('h2'); name.textContent = world.name;
  const summary = document.createElement('p'); summary.className = 'world-summary'; summary.textContent = world.summary;
  info.append(role, name, summary);
  if (world.destination) {
    const link = document.createElement('a'); link.href = world.destination; link.textContent = 'Enter the atelier'; info.append(link);
  }
  article.append(stage, status, control, info);
  document.querySelector('#worlds').append(article);
  const card = { article, stage, status, control, info };
  cards.set(world.id, card);
  control.addEventListener('focus', () => {
    if (suppressNextFocus) { suppressNextFocus = false; return; }
    revealWorld(world.id);
  });
  control.addEventListener('click', () => toggleWorld(world.id));
  article.addEventListener('focusout', event => {
    if (!article.contains(event.relatedTarget) && !pinnedWorld) revealWorld(null);
  });
  info.addEventListener('pointerenter', () => clearTimeout(hideTimer));
  info.addEventListener('pointerleave', () => scheduleHide(world.id));
  await createHead(world, card);
}));
document.documentElement.dataset.ready = 'true';
