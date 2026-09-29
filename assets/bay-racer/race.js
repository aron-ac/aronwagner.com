import { applyDirectionalHeading } from '../shared/directional-drive.js';

export const TOTAL_LAPS = 3;
const SPEED_SCALE = 0.75;
export const NORMAL_SPEED = 19 * SPEED_SCALE;
export const BOOST_SPEED = 26 * SPEED_SCALE;
export const REVERSE_SPEED = 5 * SPEED_SCALE;
export const BOAT_RADIUS = 1.1;
const COOLDOWNS = ['collisionCooldown', 'recoverCooldown', 'missCooldown'];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const damp = (from, to, rate, dt) => from + (to - from) * (1 - Math.exp(-rate * dt));

// Simulation is independent of rendering and DOM; gates are forward crossing planes.
export function createRace(world, onEvent = () => {}) {
  const first = world.gates[0],
    second = world.gates[1];
  const startHeading = Math.atan2(second.x - first.x, second.z - first.z);
  const initial = () => ({
    mode: 'menu',
    pausedMode: null,
    countdown: 3,
    x: first.x,
    z: first.z,
    heading: startHeading,
    speed: 0,
    vx: 0,
    vz: 0,
    steer: 0,
    directionalTurnRate: 0,
    elapsed: 0,
    penalties: 0,
    lap: 1,
    totalLaps: TOTAL_LAPS,
    nextGate: 1,
    gatesCleared: 0,
    cleanGates: 0,
    lapTimes: [],
    lapStartedAt: 0,
    boost: 100,
    boosting: false,
    boostLocked: false,
    bumps: 0,
    collisionCooldown: 0,
    recoverCooldown: 0,
    missCooldown: 0,
  });
  const state = initial();

  function start() {
    Object.assign(state, initial(), { mode: 'countdown' });
    onEvent('start');
  }
  function pause() {
    if (!['racing', 'countdown'].includes(state.mode)) return;
    state.pausedMode = state.mode;
    state.mode = 'paused';
    state.boosting = false;
    onEvent('pause');
  }
  function resume() {
    if (state.mode !== 'paused') return;
    state.mode = state.pausedMode;
    onEvent('resume');
  }
  function recover() {
    if (state.mode !== 'racing' || state.recoverCooldown > 0) return;
    const gate = world.gates[state.nextGate];
    state.x = gate.x - gate.normal.x * 14;
    state.z = gate.z - gate.normal.z * 14;
    state.heading = Math.atan2(gate.normal.x, gate.normal.z);
    state.speed = state.vx = state.vz = state.steer = state.directionalTurnRate = 0;
    state.elapsed += 5;
    state.penalties += 5;
    state.recoverCooldown = 3;
    state.boosting = false;
    onEvent('recover');
  }
  function bump() {
    const impact = Math.hypot(state.vx, state.vz);
    state.speed *= -0.15;
    state.vx *= -0.18;
    state.vz *= -0.18;
    if (impact > 3 && state.collisionCooldown <= 0) {
      state.bumps++;
      state.elapsed += 2;
      state.penalties += 2;
      state.collisionCooldown = 1.25;
      onEvent('bump');
    }
  }
  function collide() {
    let hit = false;
    for (const obstacle of world.obstacles) {
      const dx = state.x - obstacle.x,
        dz = state.z - obstacle.z;
      const distance = Math.hypot(dx, dz),
        limit = obstacle.radius + BOAT_RADIUS;
      if (distance < limit) {
        const nx = distance > 0.001 ? dx / distance : 1;
        const nz = distance > 0.001 ? dz / distance : 0;
        state.x = obstacle.x + nx * limit;
        state.z = obstacle.z + nz * limit;
        hit = true;
      }
    }
    const b = world.bounds;
    const x = clamp(state.x, b.minX + 2, b.maxX - 2);
    const z = clamp(state.z, b.minZ + 2, b.maxZ - 2);
    if (x !== state.x || z !== state.z) hit = true;
    state.x = x;
    state.z = z;
    if (hit) bump();
    return hit;
  }
  function checkpoint(previousX, previousZ) {
    const gate = world.gates[state.nextGate];
    const before = (previousX - gate.x) * gate.normal.x + (previousZ - gate.z) * gate.normal.z;
    const after = (state.x - gate.x) * gate.normal.x + (state.z - gate.z) * gate.normal.z;
    if (before >= 0 || after < 0) return;
    const fraction = -before / (after - before);
    const crossingX = previousX + (state.x - previousX) * fraction - gate.x;
    const crossingZ = previousZ + (state.z - previousZ) * fraction - gate.z;
    const offset = Math.abs(crossingX * gate.normal.z - crossingZ * gate.normal.x);
    if (offset > gate.halfWidth - BOAT_RADIUS) {
      if (state.missCooldown <= 0) {
        state.missCooldown = 3;
        onEvent('miss');
      }
      return;
    }
    const clean = offset < gate.halfWidth * 0.35;
    state.gatesCleared++;
    if (clean) state.cleanGates++;
    state.boost = Math.min(100, state.boost + (clean ? 20 : 8));
    if (state.nextGate === 0) {
      state.lapTimes.push(state.elapsed - state.lapStartedAt);
      state.lapStartedAt = state.elapsed;
      if (state.lap === TOTAL_LAPS) {
        state.mode = 'finished';
        state.boosting = false;
        onEvent('finish');
        return;
      }
      state.lap++;
      onEvent('lap', { clean });
    } else onEvent('gate', { clean });
    state.nextGate = (state.nextGate + 1) % world.gates.length;
  }
  function update(dt, input = {}) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    // Bounded substeps also make swept gate detection consistent at low frame rates.
    const steps = Math.max(1, Math.ceil(Math.min(dt, 0.25) / (1 / 60)));
    const step = Math.min(dt, 0.25) / steps;
    for (let i = 0; i < steps; i++) tick(step, input);
  }
  function tick(dt, input) {
    if (state.mode === 'countdown') {
      const previous = Math.ceil(state.countdown);
      state.countdown = Math.max(0, state.countdown - dt);
      if (state.countdown <= 0.000001) {
        state.countdown = 0;
        state.mode = 'racing';
        onEvent('go');
      } else if (Math.ceil(state.countdown) !== previous) onEvent('countdown');
      return;
    }
    if (state.mode !== 'racing') return;
    state.elapsed += dt;
    for (const key of COOLDOWNS) state[key] = Math.max(0, state[key] - dt);
    const alignment = applyDirectionalHeading(state, input, dt);
    const propulsion = alignment === null ? 1 : clamp(1 + alignment, 0, 1);
    if (!input.boost || state.boost >= 18) state.boostLocked = false;
    state.boosting = !!(
      input.boost &&
      input.gas &&
      !input.reverse &&
      !input.brake &&
      (alignment === null || alignment > 0.95) &&
      state.boost > 0 &&
      !state.boostLocked
    );
    state.boost = clamp(state.boost + (state.boosting ? -34 : 10) * dt, 0, 100);
    if (state.boost <= 0) state.boostLocked = true;
    const targetSpeed =
      (input.brake
        ? 0
        : input.reverse
          ? -REVERSE_SPEED
          : input.gas
            ? state.boosting
              ? BOOST_SPEED
              : NORMAL_SPEED
            : 0) * propulsion;
    const acceleration = Math.max(
      input.brake ? 3 : input.reverse ? 1.65 : input.gas ? 0.9 : 0.28,
      alignment === null ? 0 : 12 * Math.max(0, -alignment),
    );
    state.speed = damp(state.speed, targetSpeed, acceleration, dt);
    if (alignment === null) {
      state.steer = damp(
        state.steer,
        Number.isFinite(input.steering)
          ? clamp(input.steering, -1, 1)
          : (input.left ? 1 : 0) - (input.right ? 1 : 0),
        6,
        dt,
      );
      state.heading +=
        state.steer *
        (1.0 + Math.min(Math.abs(state.speed) / NORMAL_SPEED, 1) * 0.5) *
        Math.min(Math.abs(state.speed) / 4, 1) *
        Math.sign(state.speed) *
        dt;
    }
    // Direction assistance needs the water velocity to follow the nose promptly,
    // especially after a U-turn; otherwise the boat keeps sliding the old way.
    const grip = alignment !== null ? 14 : input.brake ? 3.2 : 2.2;
    state.vx = damp(state.vx, Math.sin(state.heading) * state.speed, grip, dt);
    state.vz = damp(state.vz, Math.cos(state.heading) * state.speed, grip, dt);
    const previousX = state.x,
      previousZ = state.z;
    state.x += state.vx * dt;
    state.z += state.vz * dt;
    // Being pushed away from land cannot count as crossing a checkpoint.
    if (!collide()) checkpoint(previousX, previousZ);
  }
  return { state, start, pause, resume, recover, update };
}
