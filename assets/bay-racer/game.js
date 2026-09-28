import * as THREE from '../vendor/three/three.module.js';
import { createCamera, cameraOffset } from '../shared/camera-rig.js';
import { createBoatModel } from './boat-model.js';
import { createBayWorld } from './world.js';
import { createRace, NORMAL_SPEED } from './race.js';
import { createSynthAudio } from '../shared/audio.js';
import { createGameInput } from '../shared/input.js';
import { createGameLoop } from '../shared/game-loop.js';
import { createDrivingUI } from '../shared/driving-ui.js';
import { requireElements, setText, isInteractiveTarget } from '../shared/dom.js';
import { readStoredNumber, writeStoredNumber } from '../shared/storage.js';

const ui = requireElements([
  'game-shell',
  'viewport',
  'load-state',
  'overlay',
  'start',
  'restart',
  'pause',
  'recover',
  'menu-recover',
  'map-toggle',
  'course-panel',
  'target',
  'speedometer',
  'touch-controls',
  'time',
  'lap',
  'best',
  'speed',
  'water-status',
  'gate-label',
  'gate-detail',
  'boost-value',
  'boost-meter',
  'target-arrow',
  'target-distance',
  'toast',
  'countdown',
  'minimap',
  'map-panel',
  'menu-eyebrow',
  'menu-title',
  'menu-description',
  'intro-details',
  'results',
  'menu-note',
  'sound',
]);
const drivingUI = createDrivingUI(ui);
const formatTime = (seconds) => {
  const tenths = Math.floor(Math.max(0, seconds) * 10);
  return `${Math.floor(tenths / 600)}:${((tenths % 600) / 10).toFixed(1).padStart(4, '0')}`;
};
const coarse = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (error) {
  ui['load-state'].textContent =
    'Bay Racer needs WebGL 2. Enable hardware acceleration or try a current browser.';
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
ui.viewport.appendChild(renderer.domElement);
renderer.domElement.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  pauseRace();
  ui['load-state'].textContent =
    'The graphics connection was interrupted. Refresh to launch another race.';
  ui['load-state'].classList.remove('hidden');
});
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x91c5c9);
scene.fog = new THREE.Fog(0x91c5c9, 120, 280);
scene.add(new THREE.HemisphereLight(0xfff6df, 0x477b88, 2.6));
const sun = new THREE.DirectionalLight(0xfff0db, 3.3);
sun.position.set(-32, 62, 36);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -65, right: 65, top: 65, bottom: -65, near: 1, far: 155 });
sun.shadow.normalBias = 0.055;
sun.shadow.bias = -0.0002;
scene.add(sun, sun.target);
const world = createBayWorld();
scene.add(world.group);
const boat = createBoatModel();
scene.add(boat);
const camera = createCamera();
const race = createRace(world, raceEvent);
const state = race.state;
const controls = createGameInput({
  bindings: {
    gas: ['KeyW', 'ArrowUp'],
    reverse: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    boost: ['Space'],
    brake: ['KeyB'],
  },
  isActive: () => state.mode === 'racing' || state.mode === 'countdown',
});
const keys = controls.keys;
const clearInput = () => controls.clear();
const frameInput = {};
const BEST_TIME_KEY = 'bay-racer-best-time';
const storedBest = readStoredNumber(BEST_TIME_KEY, Infinity);
let best = storedBest > 0 ? storedBest : Infinity;
state.best = best;
let toastUntil = 0,
  goUntil = 0,
  activeGate = -2;
const audio = createSynthAudio({ button: ui.sound });
const beep = (frequency = 440, duration = 0.12, delay = 0) =>
  audio.beep(frequency, duration, 'sine', delay);
function toast(text, seconds = 2.5) {
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  toastUntil = performance.now() + seconds * 1000;
}
function setDrivingUI(show) {
  for (const id of ['course-panel', 'target', 'speedometer', 'pause', 'recover'])
    ui[id].classList.toggle('hidden', !show);
  ui['touch-controls'].classList.toggle('hidden', !show || !coarse);
  drivingUI.setPlaying(show, state.mode === 'paused');
  updateRecoveryUI();
}
function updateRecoveryUI() {
  const coolingDown = state.recoverCooldown > 0;
  const disabled = state.mode !== 'racing' || coolingDown;
  if (ui.recover.disabled !== disabled) ui.recover.disabled = disabled;
  const menuDisabled = state.mode !== 'paused' || state.pausedMode !== 'racing' || coolingDown;
  if (ui['menu-recover'].disabled !== menuDisabled) ui['menu-recover'].disabled = menuDisabled;
}
function raceEvent(type, detail = {}) {
  if (type === 'start') {
    ui.overlay.classList.add('hidden');
    ui.results.classList.add('hidden');
    ui.toast.classList.remove('show');
    goUntil = 0;
    setDrivingUI(true);
    beep(330);
    for (const puff of wake) {
      puff.life = 0;
      puff.mesh.visible = false;
    }
  } else if (type === 'countdown') beep(330);
  else if (type === 'go') {
    goUntil = performance.now() + 800;
    beep(880, 0.24);
  } else if (type === 'gate') {
    toast(detail.clean ? 'Perfect line! +20 boost' : 'Gate cleared · +8 boost', 1.5);
    beep(detail.clean ? 784 : 587);
  } else if (type === 'lap') {
    toast(`Lap ${state.lap - 1} · ${formatTime(state.lapTimes.at(-1))} — keep it going!`);
    beep(660);
    beep(880, 0.15, 0.13);
  } else if (type === 'miss')
    toast('Missed the gate? Circle back through the gold buoys, or reset with R.', 4);
  else if (type === 'bump') {
    toast('Watch the shoreline · +2 seconds');
    beep(150, 0.22);
  } else if (type === 'recover') {
    toast('Back on course · +5 seconds');
    clearInput();
  } else if (type === 'pause') {
    clearInput();
    setDrivingUI(false);
    ui.countdown.classList.add('hidden');
    ui.overlay.classList.remove('hidden');
    ui['intro-details'].classList.add('hidden');
    ui.results.classList.add('hidden');
    ui['menu-eyebrow'].textContent = 'TAKE A BREATHER';
    ui['menu-title'].textContent = 'Anchors down.';
    ui['menu-description'].textContent = 'Your race is paused. The clock will wait.';
    ui.start.innerHTML = 'RESUME RACE <span aria-hidden="true">↗</span>';
    ui.restart.classList.remove('hidden');
    ui.start.focus({ preventScroll: true });
  } else if (type === 'resume') {
    ui.overlay.classList.add('hidden');
    setDrivingUI(true);
    ui.start.blur();
  } else if (type === 'finish') {
    clearInput();
    setDrivingUI(false);
    ui.overlay.classList.remove('hidden');
    ui['intro-details'].classList.add('hidden');
    ui.results.classList.remove('hidden');
    ui.restart.classList.add('hidden');
    ui.toast.classList.remove('show');
    const record = state.elapsed < best;
    if (record) {
      best = state.elapsed;
      state.best = best;
      writeStoredNumber(BEST_TIME_KEY, best);
    }
    const medal = state.elapsed < 100 ? 'GOLD' : state.elapsed < 125 ? 'SILVER' : 'BRONZE';
    ui['menu-eyebrow'].textContent = `${medal} FINISH${record ? ' · PERSONAL BEST' : ''}`;
    ui['menu-title'].textContent = record ? 'A new best.' : 'Nice wake.';
    ui['menu-description'].textContent =
      `Three laps in ${formatTime(state.elapsed)}. ${state.cleanGates} clean passes. One more run?`;
    ui.results.innerHTML = `<div><span>RACE TIME</span><strong>${formatTime(state.elapsed)}</strong></div><div><span>BEST LAP</span><strong>${formatTime(Math.min(...state.lapTimes))}</strong></div><div><span>PENALTIES</span><strong>+${state.penalties}s</strong></div><div><span>PERSONAL BEST</span><strong>${formatTime(best)}</strong></div>`;
    ui.start.innerHTML = 'RACE AGAIN <span aria-hidden="true">↗</span>';
    ui.start.focus({ preventScroll: true });
    beep(523);
    beep(659, 0.15, 0.15);
    beep(784, 0.25, 0.3);
  }
}
function startRace() {
  clearInput();
  race.start();
  ui.start.blur();
  updateUI();
}
function pauseRace() {
  race.pause();
  updateUI();
}
function resumeRace() {
  clearInput();
  race.resume();
  updateUI();
}
function recover() {
  race.recover();
  updateUI();
}
ui.start.addEventListener('click', () => {
  if (state.mode === 'paused') resumeRace();
  else startRace();
});
ui.restart.addEventListener('click', startRace);
ui.pause.addEventListener('click', pauseRace);
ui.recover.addEventListener('click', recover);
ui['menu-recover'].addEventListener('click', () => {
  if (state.mode !== 'paused' || ui['menu-recover'].disabled) return;
  resumeRace();
  recover();
});
document.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code === 'KeyP' || event.code === 'Escape') {
    if (state.mode === 'paused') resumeRace();
    else pauseRace();
  }
  if (event.code === 'KeyR') recover();
  if (
    event.code === 'Enter' &&
    !isInteractiveTarget(event.target) &&
    ['menu', 'finished', 'paused'].includes(state.mode)
  ) {
    event.preventDefault();
    if (state.mode === 'paused') resumeRace();
    else startRace();
  }
});

// A small recycled particle pool leaves a foam trail without allocating while driving.
const foamGeometry = new THREE.CircleGeometry(1, 10);
const wake = Array.from({ length: 64 }, () => {
  const mesh = new THREE.Mesh(
    foamGeometry,
    new THREE.MeshBasicMaterial({
      color: 0xf2fff3,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, life: 0, side: 1, heading: 0 };
});
let wakeIndex = 0,
  wakeTimer = 0;
function updateWake(dt) {
  if (state.mode === 'paused') return;
  for (const puff of wake)
    if (puff.life > 0) {
      puff.life -= dt * 0.52;
      puff.mesh.visible = puff.life > 0;
      const spread = 1 - puff.life;
      puff.mesh.scale.set(0.25 + spread * 1.8, 0.6 + spread * 2.5, 1);
      puff.mesh.material.opacity = Math.max(0, puff.life * 0.28);
      puff.mesh.position.x += Math.cos(puff.heading) * puff.side * dt * 1.2;
      puff.mesh.position.z -= Math.sin(puff.heading) * puff.side * dt * 1.2;
    }
  wakeTimer -= dt;
  if (state.mode === 'racing' && state.speed > 3 && wakeTimer <= 0) {
    wakeTimer = 0.08;
    for (const side of [-1, 1]) {
      const puff = wake[wakeIndex++ % wake.length];
      puff.life = 1;
      puff.side = side;
      puff.heading = state.heading;
      puff.mesh.visible = true;
      puff.mesh.position.set(
        state.x - Math.sin(state.heading) * 3.2 + Math.cos(state.heading) * side * 0.65,
        0.11,
        state.z - Math.cos(state.heading) * 3.2 - Math.sin(state.heading) * side * 0.65,
      );
      puff.mesh.rotation.z = state.heading;
      puff.mesh.material.color.setHex(state.boosting ? 0xd4fff4 : 0xf2fff3);
    }
  }
}
function update(dt) {
  race.update(dt, controls.snapshot(frameInput));
  const next = state.mode === 'finished' ? -1 : state.nextGate;
  if (next !== activeGate) {
    activeGate = next;
    world.setActiveGate(next);
  }
}
const map = ui.minimap.getContext('2d');
if (!map) ui['map-panel'].classList.add('hidden');
function drawMap() {
  if (!map) return;
  const width = ui.minimap.width,
    height = ui.minimap.height;
  const X = (x) => ((x + 110) / 220) * width,
    Z = (z) => ((105 - z) / 210) * height;
  map.clearRect(0, 0, width, height);
  map.fillStyle = '#20525e';
  map.fillRect(0, 0, width, height);
  for (const obstacle of world.obstacles) {
    map.beginPath();
    map.arc(X(obstacle.x), Z(obstacle.z), (obstacle.radius / 220) * width, 0, Math.PI * 2);
    map.fillStyle = '#759884';
    map.fill();
  }
  map.beginPath();
  world.gates.forEach((gate, i) => {
    if (i) map.lineTo(X(gate.x), Z(gate.z));
    else map.moveTo(X(gate.x), Z(gate.z));
  });
  map.closePath();
  map.setLineDash([5, 7]);
  map.strokeStyle = '#afdbca75';
  map.lineWidth = 2;
  map.stroke();
  map.setLineDash([]);
  world.gates.forEach((gate, i) => {
    const active = i === state.nextGate && state.mode !== 'finished';
    map.beginPath();
    map.arc(X(gate.x), Z(gate.z), active ? 10 : 6, 0, Math.PI * 2);
    map.fillStyle = active ? '#ffdb83' : i === 0 ? '#fff8e6' : '#9acbbb';
    map.fill();
  });
  map.save();
  map.translate(X(state.x), Z(state.z));
  map.rotate(state.heading);
  map.beginPath();
  map.moveTo(0, -12);
  map.lineTo(-7, 8);
  map.lineTo(0, 5);
  map.lineTo(7, 8);
  map.closePath();
  map.fillStyle = '#ffffff';
  map.strokeStyle = '#153a45';
  map.lineWidth = 3;
  map.fill();
  map.stroke();
  map.restore();
}
const targetProjection = new THREE.Vector3(),
  boatProjection = new THREE.Vector3();
function updateUI() {
  setText(ui.time, formatTime(state.elapsed));
  setText(ui.lap, `${state.lap} / ${state.totalLaps}`);
  setText(ui.best, Number.isFinite(best) ? formatTime(best) : '—');
  setText(ui.speed, Math.round(Math.hypot(state.vx, state.vz) * 3.6));
  setText(ui['water-status'], state.boosting ? 'BOOSTING ≈' : 'FIND YOUR LINE');
  setText(ui['boost-value'], `${Math.round(state.boost)}%`);
  if (ui['boost-meter'].value !== state.boost) ui['boost-meter'].value = state.boost;
  updateRecoveryUI();
  const gate = world.gates[state.nextGate];
  setText(
    ui['gate-label'],
    state.nextGate === 0
      ? 'FINISH THIS LAP'
      : `GATE ${String(state.nextGate).padStart(2, '0')} / ${String(world.gates.length).padStart(2, '0')}`,
  );
  setText(
    ui['gate-detail'],
    state.nextGate === 0
      ? 'Cross the checkered buoys to complete your lap.'
      : 'Pass between the buoys. Keep them in order.',
  );
  setText(ui['target-distance'], `${Math.round(Math.hypot(gate.x - state.x, gate.z - state.z))} m`);
  targetProjection.set(gate.x, 0, gate.z).project(camera);
  boatProjection.set(state.x, 0, state.z).project(camera);
  const angle = Math.atan2(
    targetProjection.x - boatProjection.x,
    (targetProjection.y - boatProjection.y) / viewportAspect,
  );
  const rotation = `rotate(${angle}rad)`;
  if (ui['target-arrow'].style.transform !== rotation)
    ui['target-arrow'].style.transform = rotation;
  const countdown = state.mode === 'countdown';
  const go = state.mode === 'racing' && performance.now() < goUntil;
  ui.countdown.classList.toggle('hidden', !countdown && !go);
  const label = countdown ? String(Math.ceil(state.countdown)) : 'GO!';
  setText(ui.countdown, label);
  drawMap();
}
const desiredLook = new THREE.Vector3(),
  desiredCamera = new THREE.Vector3(),
  lookAt = new THREE.Vector3();
const cameraDirection = cameraOffset(1);
let initialCamera = true,
  uiTimer = 0,
  waterTime = 0;
let viewportAspect = 1;
function resize() {
  const width = ui.viewport.clientWidth,
    height = ui.viewport.clientHeight;
  if (width <= 0 || height <= 0) return;
  viewportAspect = width / height;
  renderer.setSize(width, height, false);
  camera.aspect = viewportAspect;
  camera.updateProjectionMatrix();
}
function animate(dt, now) {
  update(dt);
  updateWake(dt);
  if (state.mode !== 'paused') waterTime += dt;
  world.update(waterTime);
  const velocity = Math.hypot(state.vx, state.vz),
    wave = Math.sin(waterTime * 2.3) * 0.035;
  boat.position.set(state.x, wave + Math.min(velocity / NORMAL_SPEED, 1) * 0.04, state.z);
  boat.rotation.set(
    -Math.min(velocity / NORMAL_SPEED, 1) * 0.045 + Math.sin(waterTime * 1.7) * 0.008,
    state.heading,
    -state.steer * Math.min(velocity / NORMAL_SPEED, 1) * 0.12,
    'YXZ',
  );
  if (boat.userData.steeringWheel) boat.userData.steeringWheel.rotation.z = -state.steer * 0.55;
  const aspect = viewportAspect;
  const menu = state.mode === 'menu' || state.mode === 'finished';
  // Racing needs enough water ahead to read both buoys before entering a turn.
  let distance = aspect < 1 ? 48 : 32;
  if (!menu) distance = 108 + Math.min(32, Math.max(0, 1.2 / aspect - 1) * 18) + velocity * 0.2;
  const ahead = menu ? 0 : velocity * 0.85;
  desiredLook.set(
    state.x + Math.sin(state.heading) * ahead - (menu && aspect > 1 ? 4 : 0),
    0.6,
    state.z + Math.cos(state.heading) * ahead + (menu && aspect > 1 ? 4 : 0),
  );
  desiredCamera.copy(cameraDirection).multiplyScalar(distance).add(desiredLook);
  if (initialCamera) {
    camera.position.copy(desiredCamera);
    lookAt.copy(desiredLook);
    initialCamera = false;
  } else {
    const amount = 1 - Math.exp(-dt * 4);
    camera.position.lerp(desiredCamera, amount);
    lookAt.lerp(desiredLook, amount);
  }
  camera.lookAt(lookAt);
  sun.position.set(state.x - 32, 62, state.z + 36);
  sun.target.position.set(state.x, 0, state.z);
  sun.target.updateMatrixWorld();
  uiTimer -= dt;
  if (uiTimer <= 0) {
    updateUI();
    uiTimer = 0.08;
  }
  if (toastUntil && now > toastUntil) {
    ui.toast.classList.remove('show');
    toastUntil = 0;
  }
  renderer.render(scene, camera);
}
const loop = createGameLoop({
  viewport: ui.viewport,
  frame: animate,
  pause: pauseRace,
  clearInput,
  resize,
  dispose() {
    drivingUI.dispose();
    controls.dispose();
    audio.dispose();
    renderer.dispose();
  },
});
setDrivingUI(false);
updateUI();
ui['load-state'].classList.add('hidden');
loop.start();
if (new URLSearchParams(location.search).has('debug')) {
  window.bayDebug = {
    state,
    world,
    boat,
    scene,
    camera,
    renderer,
    race,
    startRace,
    pauseRace,
    resumeRace,
    recover,
    update,
    keys,
    clearInput,
    updateUI,
    drawMap,
  };
}
