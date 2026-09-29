const TURN_RATE = 6;
const TURN_RESPONSE = 10;
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
// every frame rate. The returned alignment scales propulsion/braking; null leaves
// existing low-level gas, reverse and wheel-steering controls unchanged.
export function applyDirectionalHeading(state, input, dt) {
  if (!input.gas || !Number.isFinite(state.heading)) return null;
  if (!Number.isFinite(input.targetHeading)) return null;

  const error = angleDifference(input.targetHeading, state.heading);
  const turn = clamp(error * (1 - Math.exp(-TURN_RESPONSE * dt)), -TURN_RATE * dt, TURN_RATE * dt);
  state.heading += turn;
  state.steer = turn / (TURN_RATE * dt);
  return Math.max(0, Math.cos(error - turn));
}
