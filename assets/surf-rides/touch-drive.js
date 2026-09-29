import * as THREE from '../vendor/three/three.module.js';

const INNER_RADIUS = 3.5;
const OUTER_RADIUS = 8;

// Touches choose a bearing and throttle, rather than a destination to chase.
// Sampling only pointer events keeps that command stable as the Jeep and camera move.
export function createTouchDrive({ element, camera, state, isActive }) {
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  const canvas = element.querySelector('canvas');
  const pointers = new Set();
  const raycaster = new THREE.Raycaster();
  const screen = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const intersection = new THREE.Vector3();
  let primaryPointer = null;
  let suspended = false;
  let active = false;
  let heading = state.heading;
  let progress = 0;
  let disposed = false;

  const group = new THREE.Group();
  group.name = 'Touch_Drive_Guide';
  group.visible = false;
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff5d8,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const directionMaterial = new THREE.MeshBasicMaterial({
    color: 0xffdb83,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  for (const [name, radius] of [
    ['Touch_Drive_Deadzone', INNER_RADIUS],
    ['Touch_Drive_Full_Throttle', OUTER_RADIUS],
  ]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.09, radius, 64), ringMaterial);
    ring.name = name;
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);
  }
  const direction = new THREE.Group();
  direction.name = 'Touch_Drive_Direction';
  group.add(direction);
  const stem = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 1), directionMaterial);
  stem.rotation.x = -Math.PI / 2;
  direction.add(stem);
  const arrowGeometry = new THREE.BufferGeometry();
  arrowGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-0.5, 0, -0.7, 0, 0, 0.3, 0.5, 0, -0.7], 3),
  );
  const arrow = new THREE.Mesh(arrowGeometry, directionMaterial);
  arrow.name = 'Touch_Drive_Arrow';
  direction.add(arrow);

  function stopDriving() {
    active = false;
    progress = 0;
    group.visible = false;
  }

  function releaseCapture(id) {
    if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
  }

  function clear() {
    // Pausing can reveal a menu underneath an existing finger. Keep ownership
    // until it lifts so that release cannot activate a newly exposed button.
    primaryPointer = null;
    suspended = pointers.size > 0;
    stopDriving();
  }

  function releaseAll() {
    const captured = [...pointers];
    pointers.clear();
    primaryPointer = null;
    suspended = false;
    stopDriving();
    for (const id of captured) releaseCapture(id);
  }

  function sample(event) {
    const bounds = element.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      stopDriving();
      return;
    }
    screen.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      1 - ((event.clientY - bounds.top) / bounds.height) * 2,
    );
    camera.updateMatrixWorld();
    raycaster.setFromCamera(screen, camera);
    if (!raycaster.ray.intersectPlane(ground, intersection)) {
      stopDriving();
      return;
    }
    const x = intersection.x - state.x;
    const z = intersection.z - state.z;
    heading = Math.atan2(x, z);
    progress = THREE.MathUtils.clamp(
      (Math.hypot(x, z) - INNER_RADIUS) / (OUTER_RADIUS - INNER_RADIUS),
      0,
      1,
    );
    active = true;
  }

  element.addEventListener(
    'pointerdown',
    (event) => {
      if (
        disposed ||
        !isActive() ||
        !['touch', 'pen'].includes(event.pointerType) ||
        (event.target !== element && event.target !== canvas) ||
        pointers.has(event.pointerId)
      )
        return;
      event.preventDefault();
      pointers.add(event.pointerId);
      element.setPointerCapture(event.pointerId);
      if (pointers.size > 1 || suspended) {
        suspended = true;
        stopDriving();
        return;
      }
      primaryPointer = event.pointerId;
      sample(event);
    },
    options,
  );
  element.addEventListener(
    'pointermove',
    (event) => {
      if (!pointers.has(event.pointerId)) return;
      event.preventDefault();
      if (!isActive()) {
        clear();
        return;
      }
      if (!suspended && event.pointerId === primaryPointer) sample(event);
    },
    options,
  );
  const release = (event) => {
    if (!pointers.delete(event.pointerId)) return;
    if (event.pointerId === primaryPointer) primaryPointer = null;
    stopDriving();
    if (pointers.size === 0) suspended = false;
    releaseCapture(event.pointerId);
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
    element.addEventListener(type, release, options);
  window.addEventListener('blur', releaseAll, options);
  window.addEventListener('pagehide', releaseAll, options);
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) releaseAll();
    },
    options,
  );

  function snapshot(target = {}) {
    if (!isActive()) clear();
    target.active = active;
    target.heading = heading;
    target.progress = progress;
    return target;
  }

  function update() {
    if (!isActive()) clear();
    group.visible = active;
    if (!active) return;
    group.position.set(state.x, 0.15, state.z);
    direction.visible = progress > 0;
    direction.rotation.y = heading;
    const radius = INNER_RADIUS + (OUTER_RADIUS - INNER_RADIUS) * progress;
    const length = Math.max(0.01, radius - INNER_RADIUS);
    stem.scale.y = length;
    stem.position.z = INNER_RADIUS + length / 2;
    arrow.position.z = radius;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    releaseAll();
    listeners.abort();
    group.removeFromParent();
    group.traverse((object) => object.geometry?.dispose());
    ringMaterial.dispose();
    directionMaterial.dispose();
  }

  return { group, snapshot, update, clear, dispose };
}
