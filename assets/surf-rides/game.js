import * as THREE from '../vendor/three/three.module.js';
import { createJeepModel } from './jeep-model.js';
import { createWorld } from './world.js';
import { createCoconuts } from './coconuts.js';
import { createRideSession, COCONUT_POINTS, STOP_RADIUS, STOP_SECONDS } from './ride-session.js';
import { readStoredNumber, writeStoredNumber } from '../shared/storage.js';
import { createSynthAudio } from '../shared/audio.js';
import { createGameInput } from '../shared/input.js';
import { createGameLoop } from '../shared/game-loop.js';
import { requireElements, setText } from '../shared/dom.js';
import { createCamera, cameraOffset } from '../shared/camera-rig.js';

const ui = requireElements([
  'viewport',
  'load-state',
  'overlay',
  'start',
  'restart',
  'pause',
  'recover',
  'dispatch',
  'target',
  'speedometer',
  'touch-controls',
  'time',
  'cash',
  'rides',
  'speed',
  'surface',
  'request-name',
  'request-detail',
  'radio-title',
  'streak',
  'meter-label',
  'meter-value',
  'meter-fill',
  'boarding',
  'target-arrow',
  'target-label',
  'target-distance',
  'toast',
  'minimap',
  'map-panel',
  'menu-eyebrow',
  'menu-title',
  'menu-description',
  'intro-details',
  'results',
  'menu-note',
  'best',
  'sound',
  'score',
  'coconut-count',
  'coconut-hud',
  'coconut-pop',
]);
const clamp = THREE.MathUtils.clamp;
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (error) {
  ui['load-state'].textContent =
    'This little 3D world needs WebGL 2. Enable hardware acceleration or try a current Chrome, Safari, or Firefox browser.';
  throw error;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
ui.viewport.appendChild(renderer.domElement);
renderer.domElement.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  pauseGame();
  ui['load-state'].textContent =
    'The graphics connection was interrupted. Refresh to start a new shift.';
  ui['load-state'].classList.remove('hidden');
});
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xadcdbb);
scene.fog = new THREE.Fog(0xadcdbb, 95, 230);
scene.add(new THREE.HemisphereLight(0xfff8db, 0x527354, 2.6));
const sun = new THREE.DirectionalLight(0xffead0, 3.4);
sun.position.set(-32, 62, 36);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -65, right: 65, top: 65, bottom: -65, near: 1, far: 155 });
sun.shadow.normalBias = 0.055;
sun.shadow.bias = -0.0002;
scene.add(sun);
scene.add(sun.target);
const camera = createCamera();
const cameraDirection = cameraOffset(1);
let initialCamera = true;
let viewportAspect = 1;
const world = createWorld();
scene.add(world.group);
const jeep = createJeepModel();
scene.add(jeep);
const session = createRideSession(world, handleGameEvent);
const { state, score } = session;
const coconuts = createCoconuts(session.coconuts);
scene.add(coconuts.group);
const input = createGameInput({
  bindings: {
    gas: ['KeyW', 'ArrowUp'],
    reverse: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    brake: ['Space'],
  },
  isActive: () => state.mode === 'playing',
});
const { keys } = input;
const control = input.isDown;
const clearInput = input.clear;
const drivingInput = {};
const greetings = [
  'The swell is picking up. Let’s go!',
  'Board waxed. Coffee finished. Ready.',
  'One more session before sunset?',
  'Heard the waves are perfect today.',
  'Beach, please. The ocean is calling.',
  'Chasing a little pura vida.',
];
const points = (amount) => `${amount.toLocaleString('en-US')} pts`;
const BEST_SCORE_KEY = 'cr-surf-rides-best-score';
let coconutPopUntil = 0,
  coconutPopPoints = 0,
  toastUntil = 0;
let best = readStoredNumber(BEST_SCORE_KEY);
ui.best.textContent = points(best);
const money = (amount) => '$' + Math.round(amount).toLocaleString('en-US');
const coarse = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;
const audio = createSynthAudio({ button: ui.sound });
const { beep } = audio;
function toast(text, seconds = 3) {
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  toastUntil = performance.now() + seconds * 1000;
}

// A standing surfer and his/her board mark the live request.
const surfer = new THREE.Group();
const skin = new THREE.MeshStandardMaterial({ color: 0xd29870, roughness: 1 });
const shirt = new THREE.MeshStandardMaterial({ color: 0xffae68, roughness: 1 });
const shorts = new THREE.MeshStandardMaterial({ color: 0x246775, roughness: 1 });
function personPart(geometry, material, x, y, z) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  surfer.add(m);
  return m;
}
personPart(new THREE.SphereGeometry(0.3, 10, 8), skin, 0, 1.83, 0);
personPart(new THREE.CylinderGeometry(0.24, 0.3, 0.62, 8), shirt, 0, 1.19, 0);
for (const x of [-0.16, 0.16]) {
  personPart(new THREE.CylinderGeometry(0.125, 0.1, 0.36, 6), shorts, x, 0.74, 0);
  personPart(new THREE.CylinderGeometry(0.085, 0.085, 0.47, 6), skin, x, 0.33, 0);
  personPart(new THREE.BoxGeometry(0.18, 0.12, 0.32), skin, x, 0.07, 0.08);
}
const arm = personPart(new THREE.CylinderGeometry(0.085, 0.085, 0.65, 7), skin, -0.36, 1.28, 0);
arm.rotation.z = -0.35;
const wavingArm = personPart(new THREE.CylinderGeometry(0.085, 0.085, 0.7, 7), skin, 0.4, 1.55, 0);
wavingArm.rotation.z = -0.65;
const board = personPart(
  new THREE.SphereGeometry(1, 12, 10),
  new THREE.MeshStandardMaterial({ color: 0xffd369, roughness: 0.6 }),
  -0.68,
  1.13,
  0,
);
board.scale.set(0.32, 1.22, 0.075);
board.rotation.z = -0.14;
surfer.visible = false;
scene.add(surfer);
function makeBeacon(color) {
  const g = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 1,
    toneMapped: false,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.8, 4.15, 48), material);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  g.add(ring);
  const inner = new THREE.Mesh(
    new THREE.CircleGeometry(3.8, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, depthWrite: false }),
  );
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.1;
  g.add(inner);
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.19, 9, 8),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.42,
      toneMapped: false,
      depthWrite: false,
    }),
  );
  pillar.position.y = 4.6;
  g.add(pillar);
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.75), material);
  diamond.position.y = 10;
  g.add(diamond);
  g.userData.diamond = diamond;
  return g;
}
const pickupBeacon = makeBeacon(0xffd568),
  beachBeacon = makeBeacon(0xff896f);
scene.add(pickupBeacon, beachBeacon);
pickupBeacon.visible = false;
beachBeacon.visible = false;
beachBeacon.position.set(world.dropoff.x, 0, world.dropoff.z);
// Small pooled dust puffs make speed readable without any image assets.
const dustGeometry = new THREE.IcosahedronGeometry(0.35, 0);
const dustMaterial = new THREE.MeshBasicMaterial({
  color: 0xe8d3a5,
  transparent: true,
  opacity: 0.28,
  depthWrite: false,
});
const dust = Array.from({ length: 22 }, () => {
  const mesh = new THREE.Mesh(dustGeometry, dustMaterial);
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, life: 0 };
});
let dustTimer = 0,
  dustIndex = 0;

function setDrivingUI(visible) {
  for (const name of ['dispatch', 'target', 'speedometer', 'pause', 'recover', 'coconut-hud'])
    ui[name].classList.toggle('hidden', !visible);
  ui['touch-controls'].classList.toggle('hidden', !visible || !coarse);
  ui['map-panel'].classList.toggle('menu-map', !visible);
  if (!visible) ui['coconut-pop'].classList.remove('show');
}
function handleGameEvent(type, detail = {}) {
  const { ride } = detail;
  switch (type) {
    case 'start':
      coconuts.reset();
      coconutPopUntil = 0;
      coconutPopPoints = 0;
      ui['coconut-pop'].classList.remove('show');
      for (const puff of dust) {
        puff.life = 0;
        puff.mesh.visible = false;
      }
      dustTimer = 0;
      dustIndex = 0;
      initialCamera = true;
      beachBeacon.visible = true;
      clearInput();
      jeep.userData.surfboards.visible = false;
      ui.overlay.classList.add('hidden');
      setDrivingUI(true);
      ui.start.blur();
      break;
    case 'request': {
      const p = ride.pickup;
      pickupBeacon.position.set(p.x, 0, p.z);
      pickupBeacon.visible = true;
      surfer.position.set(p.x + 2.8, 0, p.z - 1.5);
      surfer.visible = true;
      ui['request-name'].textContent = `${ride.name} needs a ride`;
      ui['request-detail'].textContent = `${p.name} → Playa Guiones`;
      ui['radio-title'].textContent = 'INCOMING REQUEST';
      toast(`New request · ${p.name}`);
      beep(740, 0.12);
      beep(980, 0.18, 'sine', 0.14);
      break;
    }
    case 'pause':
      clearInput();
      setDrivingUI(false);
      ui.overlay.classList.remove('hidden');
      ui['menu-eyebrow'].textContent = 'TAKE A BREATHER';
      ui['menu-title'].innerHTML = 'On island<br>time.';
      ui['menu-description'].textContent = 'Your shift is paused. The waves can wait.';
      ui['intro-details'].classList.add('hidden');
      ui.results.classList.add('hidden');
      ui['menu-note'].classList.add('hidden');
      ui.start.innerHTML = 'KEEP RIDING <span>↗</span>';
      ui.restart.classList.remove('hidden');
      ui.start.focus();
      break;
    case 'resume':
      clearInput();
      ui.overlay.classList.add('hidden');
      setDrivingUI(true);
      ui.start.blur();
      break;
    case 'end':
      showResults();
      break;
    case 'recover':
      toast('Back on the road · 5 seconds off your shift');
      clearInput();
      break;
    case 'bump':
      toast(
        detail.hasPassenger
          ? 'Easy on the bumps! Ride comfort −18%'
          : 'Oof! Try a little less throttle.',
        2,
      );
      beep(120, 0.17, 'triangle');
      break;
    case 'pickup':
      surfer.visible = false;
      pickupBeacon.visible = false;
      jeep.userData.surfboards.visible = true;
      ui['radio-title'].textContent = 'SURFER ON BOARD';
      ui['request-name'].textContent = 'Next stop: the waves';
      ui['request-detail'].textContent =
        `${ride.name}: “${greetings[state.rides % greetings.length]}”`;
      toast(`${ride.name} is aboard · Head to the coral beach marker`);
      beep(523, 0.13);
      beep(784, 0.17, 'sine', 0.15);
      break;
    case 'dropoff':
      jeep.userData.surfboards.visible = false;
      ui['radio-title'].textContent = 'RIDE COMPLETE';
      ui['request-name'].textContent = 'Another happy surfer';
      ui['request-detail'].textContent =
        `${money(ride.quote)} fare + ${money(detail.tip)} tip. Next request coming in…`;
      toast(`Beach drop-off! +${money(detail.fare)} · ${money(detail.tip)} tip`, 3);
      beep(660, 0.15);
      beep(880, 0.15, 'sine', 0.15);
      beep(1100, 0.25, 'sine', 0.3);
      break;
    case 'expired':
      surfer.visible = false;
      pickupBeacon.visible = false;
      jeep.userData.surfboards.visible = false;
      ui['radio-title'].textContent = 'REQUEST CLOSED';
      ui['request-name'].textContent = 'Catch the next one';
      ui['request-detail'].textContent =
        ride.phase === 'pickup'
          ? `${ride.name} caught another ride. A new request is on its way.`
          : `${ride.name} ended the ride. No fare this time.`;
      toast('Request timed out · Streak reset');
      beep(220, 0.2);
      break;
    case 'coconut': {
      coconuts.collect(detail.index);
      const now = performance.now();
      coconutPopPoints = now < coconutPopUntil ? coconutPopPoints + detail.points : detail.points;
      coconutPopUntil = now + 950;
      ui['coconut-pop'].textContent = `🥥 +${coconutPopPoints} pts`;
      ui['coconut-pop'].classList.add('show');
      beep(1046, 0.09, 'sine');
      beep(1397, 0.14, 'sine', 0.08);
      break;
    }
  }
}
function showResults() {
  clearInput();
  setDrivingUI(false);
  ui.overlay.classList.remove('hidden');
  const newBest = score() > best;
  if (newBest) {
    best = score();
    writeStoredNumber(BEST_SCORE_KEY, best);
  }
  ui['menu-eyebrow'].textContent = newBest ? 'NEW PERSONAL BEST' : 'THAT’S A WRAP';
  ui['menu-title'].innerHTML = state.rides
    ? 'Pura vida.<br>Nice driving.'
    : 'Next wave.<br>Next shift.';
  ui['menu-description'].textContent = state.rides
    ? `${state.rides} happy surfer${state.rides === 1 ? '' : 's'} made it to the break. There’s always time for one more shift.`
    : 'The beach is waiting. Slow down inside each marker to complete a stop.';
  ui['intro-details'].classList.add('hidden');
  ui.results.classList.remove('hidden');
  ui.results.innerHTML = `<div><span>TOTAL SCORE</span><strong>${score()}</strong></div><div><span>COCONUTS</span><strong>${state.coconuts} <small>+${state.coconuts * COCONUT_POINTS} pts</small></strong></div><div><span>EARNED</span><strong>${money(state.cash)}</strong></div><div><span>SURFERS</span><strong>${state.rides}</strong></div><div><span>TIPS</span><strong>${money(state.totalTips)}</strong></div><div><span>BEST STREAK</span><strong>${state.bestStreak}×</strong></div>`;
  ui.start.innerHTML = 'ANOTHER SHIFT <span>↗</span>';
  ui.restart.classList.add('hidden');
  ui['menu-note'].classList.remove('hidden');
  ui['menu-note'].textContent =
    `Best score: ${points(best)} · $1 earned = 1 pt · Each coconut = ${COCONUT_POINTS} pts.`;
  ui.start.focus();
  beep(660, 0.2);
  beep(880, 0.3, 'sine', 0.23);
}
function startGame() {
  session.start();
  updateUI();
}
const pauseGame = session.pause,
  resumeGame = session.resume,
  endGame = session.end;
const recover = session.recover,
  requestRide = session.requestRide;
ui.start.addEventListener('click', () => (state.mode === 'paused' ? resumeGame() : startGame()));
ui.restart.addEventListener('click', startGame);
ui.pause.addEventListener('click', pauseGame);
ui.recover.addEventListener('click', recover);
window.addEventListener('keydown', (event) => {
  if (
    event.repeat ||
    event.target.isContentEditable ||
    /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)
  )
    return;
  if (event.code === 'KeyP' || event.code === 'Escape') {
    if (state.mode === 'playing') pauseGame();
    else if (state.mode === 'paused') resumeGame();
  }
  if (event.code === 'KeyR' && state.mode === 'playing') recover();
  if (event.code === 'Enter' && event.target.tagName !== 'BUTTON' && state.mode !== 'playing') {
    event.preventDefault();
    state.mode === 'paused' ? resumeGame() : startGame();
  }
});

function update(dt) {
  session.update(dt, input.snapshot(drivingInput));
  if (state.mode !== 'playing') return;
  coconuts.update(dt, state);
  dustTimer -= dt;
  if (Math.abs(state.speed) > 4 && dustTimer <= 0) {
    const puff = dust[dustIndex++ % dust.length];
    puff.life = 1;
    puff.mesh.position.set(
      state.x - Math.sin(state.heading) * 2 + (Math.random() - 0.5),
      0.22,
      state.z - Math.cos(state.heading) * 2 + (Math.random() - 0.5),
    );
    puff.mesh.visible = true;
    dustTimer = 0.075;
  }
  for (const puff of dust) {
    if (puff.life > 0) {
      puff.life -= dt * 1.6;
      puff.mesh.visible = puff.life > 0;
      puff.mesh.scale.setScalar(1 + (1 - puff.life) * 3);
      puff.mesh.position.y += dt * 0.3;
    }
  }
}

const map = ui.minimap.getContext('2d');
if (!map) ui['map-panel'].classList.add('hidden');
function drawMap() {
  if (!map) return;
  const W = ui.minimap.width,
    H = ui.minimap.height;
  map.clearRect(0, 0, W, H);
  map.fillStyle = '#4b7461';
  map.fillRect(0, 0, W, H);
  const X = (x) => ((x + 85) / 157) * W,
    Z = (z) => ((z + 75) / 150) * H;
  map.fillStyle = '#43a7ac';
  map.fillRect(0, 0, X(-68), H);
  map.fillStyle = '#d8cf96';
  map.fillRect(X(-68), 0, X(-47) - X(-68), H);
  map.lineCap = 'round';
  map.strokeStyle = '#b9b797';
  for (const road of world.roads) {
    map.lineWidth = road.width * 2.1;
    map.beginPath();
    map.moveTo(X(road.x1), Z(road.z1));
    map.lineTo(X(road.x2), Z(road.z2));
    map.stroke();
  }
  if (coconuts.group.visible)
    for (const item of coconuts.items) {
      if (!item.active) continue;
      map.fillStyle = '#fff1cb';
      map.strokeStyle = '#795034';
      map.lineWidth = 2;
      map.beginPath();
      map.arc(X(item.x), Z(item.z), 3.4, 0, Math.PI * 2);
      map.fill();
      map.stroke();
    }
  for (const point of world.pickups) {
    map.fillStyle = '#eff4d587';
    map.beginPath();
    map.arc(X(point.x), Z(point.z), 4, 0, Math.PI * 2);
    map.fill();
  }
  function dot(point, color, radius) {
    map.fillStyle = color;
    map.strokeStyle = '#173532';
    map.lineWidth = 3;
    map.beginPath();
    map.arc(X(point.x), Z(point.z), radius, 0, Math.PI * 2);
    map.fill();
    map.stroke();
  }
  dot(world.dropoff, '#ff896f', 10);
  if (state.ride?.phase === 'pickup') dot(state.ride.pickup, '#ffdc68', 11);
  map.save();
  map.translate(X(state.x), Z(state.z));
  map.rotate(-state.heading);
  map.beginPath();
  map.moveTo(0, 12);
  map.lineTo(-8, -9);
  map.lineTo(0, -5);
  map.lineTo(8, -9);
  map.closePath();
  map.fillStyle = '#fffce9';
  map.strokeStyle = '#173532';
  map.lineWidth = 3;
  map.fill();
  map.stroke();
  map.restore();
}
const targetProjected = new THREE.Vector3(),
  carProjected = new THREE.Vector3();
function updateUI() {
  const seconds = Math.ceil(state.remaining);
  setText(ui.time, `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
  ui.time.classList.toggle('urgent', seconds < 30);
  setText(ui.cash, money(state.cash));
  setText(ui.rides, String(state.rides).padStart(2, '0'));
  setText(ui.speed, Math.round(Math.abs(state.speed) * 3.6));
  setText(ui.surface, state.onRoad ? 'DIRT ROAD' : 'OFF THE BEATEN PATH');
  setText(ui.streak, state.streak ? `${state.streak}× STREAK` : '');
  ui.recover.disabled = state.recoverCooldown > 0;
  setText(ui.score, points(score()));
  setText(ui['coconut-count'], state.coconuts);
  const ride = state.ride;
  if (ride) {
    const point = ride.phase === 'pickup' ? ride.pickup : world.dropoff;
    const dist = Math.hypot(state.x - point.x, state.z - point.z);
    const pct = clamp(ride.patience / ride.patienceMax, 0, 1) * 100;
    setText(
      ui['meter-label'],
      ride.phase === 'pickup'
        ? 'SURFER PATIENCE'
        : `COMFORT ${Math.round(ride.comfort)}% · TIME LEFT`,
    );
    setText(ui['meter-value'], `${Math.ceil(Math.max(0, ride.patience))}s`);
    ui['meter-fill'].style.width = `${pct}%`;
    ui['meter-fill'].style.background =
      pct < 25 ? '#ff896f' : ride.phase === 'pickup' ? '#ffd568' : '#bef8ad';
    let boardingText;
    if (state.boardTime > 0) {
      const action = ride.phase === 'pickup' ? 'Boarding' : 'Dropping off';
      const progress = Math.min(100, Math.round((state.boardTime / STOP_SECONDS) * 100));
      boardingText = `${action}… ${progress}%`;
    } else if (dist < STOP_RADIUS) boardingText = 'Hold the brake. Come to a complete stop.';
    else if (ride.phase === 'pickup') boardingText = 'Stop inside the yellow pickup ring.';
    else boardingText = `Beach-bound · ${money(ride.quote)} fare + tips`;
    setText(ui.boarding, boardingText);
    setText(ui['target-label'], ride.phase === 'pickup' ? 'PICKUP' : 'BEACH DROP-OFF');
    setText(ui['target-distance'], dist < STOP_RADIUS ? 'STOP HERE' : `${Math.round(dist)} m`);
    targetProjected.set(point.x, 0, point.z).project(camera);
    carProjected.set(state.x, 0, state.z).project(camera);
    const angle = Math.atan2(
      targetProjected.x - carProjected.x,
      (targetProjected.y - carProjected.y) / viewportAspect,
    );
    ui['target-arrow'].style.transform = `rotate(${angle}rad)`;
    ui['target-arrow'].style.color = ride.phase === 'pickup' ? '#ffd568' : '#ff896f';
  } else {
    ui['meter-fill'].style.width = '0%';
    setText(ui['meter-label'], 'DISPATCH');
    setText(ui['meter-value'], '…');
    setText(ui.boarding, 'Hang tight. Enjoy the view.');
    setText(ui['target-label'], 'DISPATCH');
    setText(ui['target-distance'], 'Stand by');
  }
  drawMap();
}
function resize() {
  const width = ui.viewport.clientWidth,
    height = ui.viewport.clientHeight;
  if (width <= 0 || height <= 0) return;
  viewportAspect = width / height;
  renderer.setSize(width, height, false);
  camera.aspect = viewportAspect;
  camera.updateProjectionMatrix();
}
const lookAt = new THREE.Vector3(),
  desiredCamera = new THREE.Vector3(),
  desiredLook = new THREE.Vector3();
let uiTimer = 0;
function animate(dt, now) {
  // Substeps prevent narrow objects from being skipped at speed.
  const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
  for (let i = 0; i < steps; i++) update(dt / steps);
  const t = now / 1000,
    playing = state.mode !== 'menu';
  jeep.position.set(
    state.x,
    0.015 +
      (state.mode === 'playing'
        ? Math.sin(t * 25) * Math.min(Math.abs(state.speed), 10) * 0.0015
        : 0),
    state.z,
  );
  jeep.rotation.y = state.heading;
  for (const wheel of jeep.userData.wheels)
    if (state.mode === 'playing')
      wheel.rotation.x += (state.speed * dt) / (jeep.userData.wheelRadius || 0.66);
  for (const pivot of jeep.userData.frontSteering) pivot.rotation.y = state.steer * 0.4;
  for (const light of jeep.userData.brakeLights) {
    if (light.material.emissive)
      light.material.emissive.setHex(control('brake') ? 0xff2010 : 0x440900);
  }
  pickupBeacon.userData.diamond.rotation.y = t;
  beachBeacon.userData.diamond.rotation.y = t;
  pickupBeacon.userData.diamond.position.y = 9.5 + Math.sin(t * 2) * 0.5;
  beachBeacon.userData.diamond.position.y = 9.5 + Math.sin(t * 2) * 0.5;
  wavingArm.rotation.z = -0.7 + Math.sin(t * 4) * 0.25;
  if (state.mode !== 'paused') world.update?.(dt, t);
  const aspect = viewportAspect;
  // The fixed diagonal follows the road smoothly without rotating as you steer.
  // A narrower lens adds depth while keeping the little world easy to read.
  let distance;
  if (!playing) {
    distance = aspect < 1 ? 48 : 34;
    desiredLook.set(state.x - (aspect > 1 ? 5 : 0), 0.8, state.z + (aspect > 1 ? 3 : 0));
  } else {
    const portraitOffset = Math.max(0, 1.25 / aspect - 1) * 14;
    distance = 68 + Math.min(portraitOffset, 27) + Math.min(Math.abs(state.speed), 19) * 0.35;
    const ahead = state.mode === 'playing' ? state.speed * 0.17 : 0;
    desiredLook.set(
      state.x + Math.sin(state.heading) * ahead,
      0.6,
      state.z + Math.cos(state.heading) * ahead,
    );
  }
  desiredCamera.copy(cameraDirection).multiplyScalar(distance).add(desiredLook);
  if (initialCamera) {
    camera.position.copy(desiredCamera);
    lookAt.copy(desiredLook);
    initialCamera = false;
  } else {
    const lerp = 1 - Math.exp(-dt * 4);
    camera.position.lerp(desiredCamera, lerp);
    lookAt.lerp(desiredLook, lerp);
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
  if (coconutPopUntil && now > coconutPopUntil) {
    ui['coconut-pop'].classList.remove('show');
    coconutPopUntil = 0;
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
  pause: pauseGame,
  clearInput,
  resize,
  dispose() {
    input.dispose();
    audio.dispose();
    renderer.dispose();
  },
});
setDrivingUI(false);
updateUI();
ui['load-state'].classList.add('hidden');
loop.start();
// Explicit opt-in inspection hook used for deterministic gameplay smoke checks.
if (new URLSearchParams(location.search).has('debug'))
  window.surfDebug = {
    state,
    world,
    jeep,
    scene,
    camera,
    renderer,
    startGame,
    pauseGame,
    resumeGame,
    update,
    requestRide,
    recover,
    endGame,
    keys,
    drawMap,
    coconuts,
    score,
    updateUI,
  };
