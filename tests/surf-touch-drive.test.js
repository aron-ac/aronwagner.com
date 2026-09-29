import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../assets/vendor/three/three.module.js';
import { createTouchDrive } from '../assets/surf-rides/touch-drive.js';

class Viewport extends EventTarget {
  constructor() {
    super();
    this.canvas = {};
    this.captured = new Set();
    this.bounds = { left: 20, top: 40, width: 800, height: 600 };
  }
  querySelector(selector) {
    return selector === 'canvas' ? this.canvas : null;
  }
  getBoundingClientRect() {
    return this.bounds;
  }
  setPointerCapture(id) {
    this.captured.add(id);
  }
  hasPointerCapture(id) {
    return this.captured.has(id);
  }
  releasePointerCapture(id) {
    this.captured.delete(id);
    dispatch(this, 'lostpointercapture', { pointerId: id });
  }
}

function dispatch(element, type, properties = {}) {
  const event = new Event(type, { cancelable: true });
  for (const [name, value] of Object.entries(properties))
    Object.defineProperty(event, name, { value });
  element.dispatchEvent(event);
  return event;
}

function fixture(t) {
  const window = new EventTarget();
  const document = new EventTarget();
  document.hidden = false;
  for (const [name, value] of Object.entries({ window, document })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else delete globalThis[name];
    });
  }
  const element = new Viewport();
  const camera = new THREE.PerspectiveCamera(35, 4 / 3, 0.1, 300);
  camera.position.set(25, 30, 35);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const state = { x: 0, z: 0, heading: 0 };
  let playing = true;
  const drive = createTouchDrive({ element, camera, state, isActive: () => playing });
  t.after(() => drive.dispose());
  function point(x, z) {
    camera.updateMatrixWorld();
    const projected = new THREE.Vector3(x, 0, z).project(camera);
    const bounds = element.bounds;
    return {
      clientX: bounds.left + ((projected.x + 1) * bounds.width) / 2,
      clientY: bounds.top + ((1 - projected.y) * bounds.height) / 2,
    };
  }
  function pointer(type, x = 0, z = 8, pointerId = 1, extra = {}) {
    return dispatch(element, type, {
      target: element.canvas,
      pointerId,
      pointerType: 'touch',
      ...point(x, z),
      ...extra,
    });
  }
  return {
    element,
    camera,
    state,
    drive,
    pointer,
    window,
    document,
    setPlaying: (value) => (playing = value),
  };
}

const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} should be near ${expected}`);

test('Jeep touch steering samples ground bearing and proportional throttle through the real camera', (t) => {
  const { pointer, drive } = fixture(t);
  for (const [x, z, heading, progress] of [
    [0, 8, 0, 1],
    [8, 0, Math.PI / 2, 1],
    [-5.75, 0, -Math.PI / 2, 0.5],
    [0, -5.75, Math.PI, 0.5],
    [0, 2, 0, 0],
    [0, 40, 0, 1],
  ]) {
    const event = pointer('pointerdown', x, z);
    assert.equal(event.defaultPrevented, true);
    const snapshot = drive.snapshot();
    assert.equal(snapshot.active, true);
    near(Math.abs(snapshot.heading), Math.abs(heading));
    if (Math.abs(heading) < Math.PI) near(snapshot.heading, heading);
    near(snapshot.progress, progress);
    drive.update();
    assert.equal(drive.group.visible, true);
    assert.equal(drive.group.getObjectByName('Touch_Drive_Direction').visible, progress > 0);
    pointer('pointerup', x, z);
    assert.equal(drive.group.visible, false);
    assert.equal(drive.snapshot().active, false);
  }
});

test('a stationary thumb holds its sampled command while the Jeep and camera move', (t) => {
  const { pointer, drive, state, camera } = fixture(t);
  pointer('pointerdown', 8, 0);
  const command = drive.snapshot();
  state.x = 12;
  state.z = 9;
  state.heading = -1;
  camera.position.add(new THREE.Vector3(12, 0, 9));
  camera.lookAt(state.x, 0, state.z);
  drive.update();
  assert.deepEqual(drive.snapshot(), command, 'Following a point must not become autopilot');
  near(drive.group.position.x, state.x);
  near(drive.group.position.z, state.z);
  pointer('pointermove', state.x, state.z + 5.75);
  near(drive.snapshot().heading, 0);
  near(drive.snapshot().progress, 0.5);
  const reused = { active: false, heading: 10, progress: 10 };
  assert.equal(drive.snapshot(reused), reused);
  assert.deepEqual(reused, drive.snapshot());
});

test('a second scene finger suspends steering until every scene finger lifts', (t) => {
  const { pointer, drive, element } = fixture(t);
  pointer('pointerdown', 8, 0, 1);
  assert.equal(drive.snapshot().active, true);
  pointer('pointerdown', 0, 8, 2);
  assert.equal(drive.snapshot().active, false);
  assert.equal(drive.snapshot().progress, 0);
  pointer('pointerup', 0, 8, 2);
  pointer('pointermove', 0, -8, 1);
  assert.equal(drive.snapshot().active, false, 'The remaining finger cannot resume driving');
  pointer('pointerdown', 8, 0, 3);
  pointer('pointerup', 8, 0, 1);
  pointer('pointermove', 8, 0, 3);
  assert.equal(drive.snapshot().active, false, 'A replacement finger remains suspended too');
  pointer('pointerup', 8, 0, 3);
  assert.equal(element.captured.size, 0);
  pointer('pointerdown', 8, 0, 4);
  assert.equal(drive.snapshot().active, true, 'A fresh gesture can drive');
});

test('mouse, inactive play and UI targets do not steer or interfere with a scene touch', (t) => {
  const { pointer, drive, element, setPlaying } = fixture(t);
  const mouse = pointer('pointerdown', 8, 0, 1, { pointerType: 'mouse' });
  assert.equal(mouse.defaultPrevented, false);
  assert.equal(drive.snapshot().active, false);
  setPlaying(false);
  const inactive = pointer('pointerdown');
  assert.equal(inactive.defaultPrevented, false);
  assert.equal(element.captured.size, 0);
  setPlaying(true);
  pointer('pointerdown', 8, 0, 1, { pointerType: 'pen' });
  const command = drive.snapshot();
  const button = pointer('pointerdown', 0, 8, 2, { target: {} });
  assert.equal(button.defaultPrevented, false);
  assert.deepEqual(
    drive.snapshot(),
    command,
    'Independent brake/UI touches do not suspend steering',
  );
  assert.equal(element.captured.has(2), false);
  setPlaying(false);
  drive.update();
  assert.equal(drive.snapshot().active, false);
  assert.equal(element.captured.size, 1, 'Pausing owns the existing touch until it lifts');
  pointer('pointerup', 8, 0, 1);
  assert.equal(element.captured.size, 0);
});

test('pausing cancels steering but captures held fingers until release without activating the new menu', (t) => {
  const { pointer, drive, element, setPlaying } = fixture(t);
  pointer('pointerdown', 8, 0, 1);
  setPlaying(false);
  drive.clear();
  drive.update();
  assert.equal(drive.snapshot().active, false);
  assert.equal(drive.snapshot().progress, 0);
  assert.equal(element.captured.has(1), true, 'The original finger must not release onto the menu');
  setPlaying(true);
  pointer('pointermove', 0, 8, 1);
  assert.equal(drive.snapshot().active, false, 'Resuming cannot revive a canceled gesture');
  pointer('pointerdown', 0, 8, 2);
  assert.equal(drive.snapshot().active, false, 'New touches wait until canceled fingers lift');
  pointer('pointerup', 8, 0, 1);
  assert.equal(element.captured.has(1), false);
  pointer('pointermove', 8, 0, 2);
  assert.equal(drive.snapshot().active, false);
  pointer('pointerup', 0, 8, 2);
  assert.equal(element.captured.size, 0);
  pointer('pointerdown', 8, 0, 3);
  assert.equal(drive.snapshot().active, true, 'A fresh gesture works after all old fingers lift');
});

test('release, cancellation, lost capture and lifecycle cleanup clear touch steering', (t) => {
  const { pointer, drive, element, window, document } = fixture(t);
  for (const stop of [
    () => pointer('pointerup'),
    () => pointer('pointercancel'),
    () => pointer('lostpointercapture'),
    () => dispatch(window, 'blur'),
    () => dispatch(window, 'pagehide'),
    () => {
      document.hidden = true;
      dispatch(document, 'visibilitychange');
    },
  ]) {
    pointer('pointerdown');
    assert.equal(element.captured.has(1), true);
    stop();
    assert.equal(drive.snapshot().active, false);
    assert.equal(drive.snapshot().progress, 0);
    assert.equal(element.captured.size, 0);
    document.hidden = false;
  }
});

test('collapsed viewports and rays missing the ground cannot command motion', (t) => {
  const { pointer, drive, element, camera } = fixture(t);
  element.bounds.width = 0;
  pointer('pointerdown');
  assert.equal(drive.snapshot().active, false);
  element.bounds.width = 800;
  pointer('pointermove');
  assert.equal(drive.snapshot().active, true);
  camera.position.set(0, 20, 20);
  camera.lookAt(0, 20, 0);
  pointer('pointermove', 0, 0, 1, { clientX: 420, clientY: 340 });
  assert.equal(drive.snapshot().active, false);
  assert.equal(drive.snapshot().progress, 0);
});

test('disposing touch steering releases captures, listeners and every guide resource once', (t) => {
  const { pointer, drive, element } = fixture(t);
  const scene = new THREE.Scene();
  scene.add(drive.group);
  const resources = new Set();
  drive.group.traverse((object) => {
    if (object.geometry) resources.add(object.geometry);
    if (object.material) resources.add(object.material);
  });
  const disposed = new Map();
  for (const resource of resources)
    resource.addEventListener('dispose', () =>
      disposed.set(resource, (disposed.get(resource) ?? 0) + 1),
    );
  pointer('pointerdown');
  drive.dispose();
  drive.dispose();
  assert.equal(drive.group.parent, null);
  assert.equal(element.captured.size, 0);
  assert.equal(disposed.size, resources.size);
  assert.ok([...disposed.values()].every((count) => count === 1));
  pointer('pointerdown');
  assert.equal(drive.snapshot().active, false);
  assert.equal(element.captured.size, 0);
});
