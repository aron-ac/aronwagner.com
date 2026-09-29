const TURN_RATE = 6;
const TURN_RESPONSE = 12;
const TURN_ACCELERATION = 60;
const RELEASE_RESPONSE = 14;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const angleDifference = (to, from) => {
  const difference = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  // An exact U-turn has two equally short routes. Always choose the same one.
  return Math.abs(Math.abs(difference) - Math.PI) < 1e-8 ? Math.PI : difference;
};

// Each arrow aims the nose toward one screen direction. The controller resolves
// overlapping presses before mapping; ambiguous input here safely coasts.
export function createDirectionalDrive({ azimuth, elevation }) {
  const verticalScale = Math.sin(elevation);
  if (!Number.isFinite(azimuth) || !Number.isFinite(verticalScale) || verticalScale <= 0.000001)
    throw new RangeError('Directional driving requires a finite, elevated camera angle.');
  const sin = Math.sin(azimuth);
  const cos = Math.cos(azimuth);

  function reset() {
    // The mapper is stateless; retain the lifecycle API used by both controllers.
  }

  function update(input, state, target = {}) {
    const directions = ['up', 'down', 'left', 'right'];
    const active = directions.filter((direction) => input[direction]);
    target.brake = Boolean(input.brake);
    target.boost = Boolean(input.boost);
    target.gas = false;
    target.reverse = false;
    target.steering = 0;
    target.targetHeading = null;
    // Reused input objects must not leak the screen axes into legacy wheel steering.
    for (const action of directions) delete target[action];
    if (active.length !== 1 || !Number.isFinite(state.heading)) return target;

    const horizontal = Number(active[0] === 'right') - Number(active[0] === 'left');
    const down = (Number(active[0] === 'down') - Number(active[0] === 'up')) / verticalScale;
    target.gas = true;
    target.targetHeading = Math.atan2(
      horizontal * cos + down * sin,
      -horizontal * sin + down * cos,
    );
    return target;
  }

  return { update, reset };
}

// Apply assistance inside each simulation step, so aiming works at rest and at
// every frame rate. Angular momentum eases both the physical nose and steering
// animation into a new course. Signed alignment lets ordinary corners retain
// speed while turns facing away from the requested direction can slow down.
export function applyDirectionalHeading(state, input, dt) {
  if (!Number.isFinite(state.heading) || !Number.isFinite(dt) || dt <= 0) return null;
  if (!Object.hasOwn(input, 'targetHeading')) {
    // Low-level gas/reverse/wheel inputs retain their original simulation path.
    if (state.directionalTurnRate !== undefined) state.directionalTurnRate = 0;
    return null;
  }

  const velocity = state.directionalTurnRate ?? 0;
  if (!input.gas || !Number.isFinite(input.targetHeading)) {
    // Passing through a gap between arrows eases out the current turn instead
    // of abruptly switching to the unrelated wheel-steering gain.
    const decay = Math.exp(-RELEASE_RESPONSE * dt);
    state.heading += (velocity * (1 - decay)) / RELEASE_RESPONSE;
    state.directionalTurnRate = velocity * decay;
    state.steer = state.directionalTurnRate / TURN_RATE;
    return 1;
  }

  const error = angleDifference(input.targetHeading, state.heading);
  // Exact critically damped spring step. Bound acceleration and top turn speed
  // for large changes, integrating those bounded steps with their average rate.
  const decay = Math.exp(-TURN_RESPONSE * dt);
  const response = TURN_RESPONSE * error - velocity;
  const nextError = (error + response * dt) * decay;
  const freeVelocity = (velocity + TURN_RESPONSE * response * dt) * decay;
  const nextVelocity = clamp(
    clamp(freeVelocity, velocity - TURN_ACCELERATION * dt, velocity + TURN_ACCELERATION * dt),
    -TURN_RATE,
    TURN_RATE,
  );
  const turn =
    Math.abs(freeVelocity - nextVelocity) > 1e-10
      ? ((velocity + nextVelocity) * dt) / 2
      : error - nextError;
  state.directionalTurnRate = nextVelocity;
  // A new target may sit inside the current stopping arc. Let the spring settle
  // through that small overshoot instead of snapping the turning rate to zero.
  state.heading += turn;
  state.steer = state.directionalTurnRate / TURN_RATE;
  return Math.cos(error - turn);
}
