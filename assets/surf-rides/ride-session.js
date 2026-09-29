import { applyDirectionalHeading } from '../shared/directional-drive.js';

export const SHIFT_SECONDS = 180;
export const COCONUT_POINTS = 25;
export const STOP_RADIUS = 4.3;
export const STOP_SECONDS = 1.1;

const COCONUT_RADIUS = 2;
const JEEP_RADIUS = 1.3;
const NAMES = ['Sofi', 'Mateo', 'Luna', 'Kai', 'Valentina', 'Nico', 'Ari', 'Camila'];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const damp = (from, to, rate, dt) => from + (to - from) * (1 - Math.exp(-rate * dt));

// Geometry-free collectible data lets collision/scoring run without a renderer.
export function createCoconutSpots(world) {
  const positions = [
    ...[-12, -26, -58, 18, 30, 58].map((z) => [0, z]),
    ...[-38, 38].flatMap((x) => [-58, -28, -14, 14, 28, 58].map((z) => [x, z])),
    ...[-44, 0, 44].flatMap((z) => [-24, -12, 12, 24].map((x) => [x, z])),
    [-54, -26],
    [-54, 26],
  ];
  const destinations = [...world.pickups, world.dropoff, world.spawn];
  const b = world.bounds;
  return positions
    .filter(
      ([x, z]) =>
        x > b.minX + 3 &&
        x < b.maxX - 3 &&
        z > b.minZ + 3 &&
        z < b.maxZ - 3 &&
        destinations.every((p) => Math.hypot(x - p.x, z - p.z) > 6) &&
        world.obstacles.every((p) => Math.hypot(x - p.x, z - p.z) > p.radius + 2.8),
    )
    .map(([x, z]) => ({ x, z, active: true }));
}

export function nearestRoad(roads, x, z) {
  let closest = null;
  for (const road of roads) {
    const dx = road.x2 - road.x1,
      dz = road.z2 - road.z1;
    const lengthSquared = dx * dx + dz * dz;
    const t = lengthSquared
      ? clamp(((x - road.x1) * dx + (z - road.z1) * dz) / lengthSquared, 0, 1)
      : 0;
    const px = road.x1 + dx * t,
      pz = road.z1 + dz * t;
    const distance = Math.hypot(x - px, z - pz);
    if (!closest || distance < closest.distance) {
      closest = { x: px, z: pz, heading: Math.atan2(dx, dz), distance, width: road.width };
    }
  }
  return closest;
}

// All gameplay mutations live here. Events carry the presentation details the
// browser needs; randomness is injectable so the same inputs can be replayed.
export function createRideSession(world, onEvent = () => {}, { random = Math.random } = {}) {
  const initial = () => ({
    mode: 'menu',
    x: world.dropoff.x,
    z: world.dropoff.z,
    heading: 0,
    speed: 0,
    steer: 0,
    remaining: SHIFT_SECONDS,
    cash: 0,
    coconuts: 0,
    rides: 0,
    missed: 0,
    streak: 0,
    bestStreak: 0,
    totalTips: 0,
    bumps: 0,
    collisionCooldown: 0,
    recoverCooldown: 0,
    ride: null,
    nextRequest: 0,
    boardTime: 0,
    elapsed: 0,
    onRoad: true,
  });
  const state = initial();
  const coconuts = createCoconutSpots(world);
  let previousPickup = -1;
  const score = () => state.cash + state.coconuts * COCONUT_POINTS;

  function requestRide() {
    if (state.mode !== 'playing') return;
    const choices = world.pickups.filter((_, index) => index !== previousPickup);
    const pickup =
      state.rides === 0 && state.missed === 0
        ? world.pickups[1]
        : choices[Math.floor(random() * choices.length)];
    previousPickup = world.pickups.findIndex((point) => point.id === pickup.id);
    state.ride = {
      phase: 'pickup',
      pickup,
      name: NAMES[(state.rides + state.missed) % NAMES.length],
      patience: 45,
      patienceMax: 45,
      rideTime: 0,
      comfort: 100,
      quote:
        18 + Math.round(Math.hypot(pickup.x - world.dropoff.x, pickup.z - world.dropoff.z) * 0.22),
    };
    state.boardTime = 0;
    onEvent('request', { ride: state.ride });
  }

  function start() {
    Object.assign(state, initial(), {
      mode: 'playing',
      x: world.spawn.x,
      z: world.spawn.z,
      heading: Math.PI,
    });
    previousPickup = -1;
    for (const item of coconuts) item.active = true;
    onEvent('start');
    requestRide();
  }
  function pause() {
    if (state.mode !== 'playing') return;
    state.mode = 'paused';
    onEvent('pause');
  }
  function resume() {
    if (state.mode !== 'paused') return;
    state.mode = 'playing';
    onEvent('resume');
  }
  function end() {
    if (state.mode !== 'playing' && state.mode !== 'paused') return;
    state.mode = 'ended';
    state.speed = 0;
    onEvent('end');
  }
  function recover() {
    if (state.mode !== 'playing' || state.recoverCooldown > 0) return;
    const road = nearestRoad(world.roads, state.x, state.z);
    if (!road) return;
    state.x = road.x;
    state.z = road.z;
    state.heading = road.heading;
    state.speed = 0;
    state.remaining = Math.max(0, state.remaining - 5);
    state.recoverCooldown = 3;
    state.boardTime = 0;
    if (state.ride?.phase === 'dropoff') state.ride.comfort = Math.max(0, state.ride.comfort - 8);
    onEvent('recover');
    if (state.remaining === 0) end();
  }

  function collide() {
    let hit = false;
    for (const obstacle of world.obstacles) {
      const dx = state.x - obstacle.x,
        dz = state.z - obstacle.z;
      const distance = Math.hypot(dx, dz),
        minimum = obstacle.radius + JEEP_RADIUS;
      if (distance < minimum) {
        const nx = distance > 0.001 ? dx / distance : 1,
          nz = distance > 0.001 ? dz / distance : 0;
        state.x = obstacle.x + nx * minimum;
        state.z = obstacle.z + nz * minimum;
        hit = true;
      }
    }
    const b = world.bounds;
    const x = clamp(state.x, b.minX + 1.4, b.maxX - 1.4),
      z = clamp(state.z, b.minZ + 1.4, b.maxZ - 1.4);
    if (x !== state.x || z !== state.z) {
      hit = true;
      state.x = x;
      state.z = z;
    }
    if (!hit) return;
    const impact = Math.abs(state.speed);
    state.speed *= -0.18;
    if (impact > 3 && state.collisionCooldown <= 0) {
      state.bumps++;
      state.collisionCooldown = 1.3;
      const hasPassenger = state.ride?.phase === 'dropoff';
      if (hasPassenger) state.ride.comfort = Math.max(0, state.ride.comfort - 18);
      onEvent('bump', { hasPassenger });
    }
  }

  function completeStop() {
    const ride = state.ride;
    state.boardTime = 0;
    if (ride.phase === 'pickup') {
      Object.assign(ride, { phase: 'dropoff', rideTime: 0, patience: 60, patienceMax: 60 });
      onEvent('pickup', { ride });
    } else {
      state.rides++;
      state.streak++;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      const multiplier = 1 + Math.min(state.streak - 1, 4) * 0.15;
      const tip = Math.round(
        (ride.comfort / 100) * (6 + Math.max(0, 30 - ride.rideTime) * 0.5) * multiplier,
      );
      const fare = ride.quote + tip;
      state.cash += fare;
      state.totalTips += tip;
      state.ride = null;
      state.nextRequest = 2.5;
      onEvent('dropoff', { ride, fare, tip });
    }
  }
  function expireRide() {
    const ride = state.ride;
    state.missed++;
    state.streak = 0;
    state.ride = null;
    state.nextRequest = 2;
    state.boardTime = 0;
    onEvent('expired', { ride });
  }

  function update(dt, input = {}) {
    if (state.mode !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    state.elapsed += dt;
    state.remaining = Math.max(0, state.remaining - dt);
    state.collisionCooldown = Math.max(0, state.collisionCooldown - dt);
    state.recoverCooldown = Math.max(0, state.recoverCooldown - dt);
    if (state.remaining === 0) {
      end();
      return;
    }
    const road = nearestRoad(world.roads, state.x, state.z);
    state.onRoad = Boolean(road && road.distance < road.width / 2 + 1);
    const topSpeed = state.onRoad ? 19 : 10;
    const alignment = applyDirectionalHeading(state, input, dt);
    if (alignment !== null) state.speed = damp(state.speed, 0, 12 * (1 - alignment), dt);
    if (input.brake) state.speed = damp(state.speed, 0, 7, dt);
    else if (input.gas) state.speed += (state.speed < 0 ? 27 : 14) * (alignment ?? 1) * dt;
    else if (input.reverse) state.speed -= state.speed > 0 ? 27 * dt : 10 * dt;
    else {
      const friction = state.onRoad ? 3.6 : 5.5;
      state.speed = Math.sign(state.speed) * Math.max(0, Math.abs(state.speed) - friction * dt);
    }
    state.speed = clamp(state.speed, -7, topSpeed);
    if (alignment === null) {
      state.steer = damp(
        state.steer,
        Number.isFinite(input.steering)
          ? clamp(input.steering, -1, 1)
          : (input.left ? 1 : 0) - (input.right ? 1 : 0),
        10,
        dt,
      );
      state.heading +=
        state.steer * 1.95 * clamp(Math.abs(state.speed) / 5, 0, 1) * Math.sign(state.speed) * dt;
    }
    state.x += Math.sin(state.heading) * state.speed * dt;
    state.z += Math.cos(state.heading) * state.speed * dt;
    collide();
    for (const [index, item] of coconuts.entries()) {
      if (item.active && Math.hypot(state.x - item.x, state.z - item.z) <= COCONUT_RADIUS) {
        item.active = false;
        state.coconuts++;
        onEvent('coconut', { index, points: COCONUT_POINTS });
      }
    }
    if (state.ride) {
      const ride = state.ride;
      ride.patience -= dt;
      if (ride.phase === 'dropoff') ride.rideTime += dt;
      const target = ride.phase === 'pickup' ? ride.pickup : world.dropoff;
      if (
        Math.hypot(state.x - target.x, state.z - target.z) < STOP_RADIUS &&
        Math.abs(state.speed) < 1.5
      ) {
        state.boardTime += dt;
        if (state.boardTime >= STOP_SECONDS) completeStop();
      } else state.boardTime = 0;
      if (state.ride && state.ride.patience <= 0) expireRide();
    } else {
      state.nextRequest -= dt;
      if (state.nextRequest <= 0) requestRide();
    }
  }
  return { state, coconuts, score, start, pause, resume, end, recover, requestRide, update };
}
