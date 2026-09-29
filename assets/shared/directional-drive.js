const TURN_RATE = 6;
const TURN_RESPONSE = 10;
const CIRCLE_RATE = 2.4;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const angleDifference = (to, from) => {
  const difference = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  // An exact U-turn has two equally short routes. Always choose the same one.
  return Math.abs(Math.abs(difference) - Math.PI) < 1e-8 ? Math.PI : difference;
};

// Single arrows aim the nose toward a screen direction. Holding a vertical and
// horizontal arrow instead makes a continuous forward circle in that turn direction.
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
    const horizontal = Number(Boolean(input.right)) - Number(Boolean(input.left));
    const vertical = Number(Boolean(input.down)) - Number(Boolean(input.up));
    target.brake = Boolean(input.brake);
    target.boost = Boolean(input.boost);
    target.gas = false;
    target.reverse = false;
    target.steering = 0;
    target.targetHeading = null;
    target.turnRate = 0;
    // Reused input objects must not leak the screen axes into legacy wheel steering.
    for (const action of ['up', 'down', 'left', 'right']) delete target[action];
    if ((!horizontal && !vertical) || !Number.isFinite(state.heading)) return target;

    target.gas = true;
    if (horizontal && vertical) {
      // Positive world yaw projects counterclockwise through the fixed camera.
      target.turnRate = -horizontal * CIRCLE_RATE;
    } else {
      const down = vertical / verticalScale;
      target.targetHeading = Math.atan2(
        horizontal * cos + down * sin,
        -horizontal * sin + down * cos,
      );
    }
    return target;
  }

  return { update, reset };
}

// Apply assistance inside each simulation step, so aiming works at rest and at
// every frame rate. The returned alignment scales propulsion/braking; null leaves
// existing low-level gas, reverse and wheel-steering controls unchanged.
export function applyDirectionalHeading(state, input, dt) {
  if (!input.gas || !Number.isFinite(state.heading)) return null;
  if (Number.isFinite(input.turnRate) && input.turnRate !== 0) {
    const rate = clamp(input.turnRate, -CIRCLE_RATE, CIRCLE_RATE);
    state.heading += rate * dt;
    state.steer = rate / CIRCLE_RATE;
    return 1;
  }
  if (!Number.isFinite(input.targetHeading)) return null;

  const error = angleDifference(input.targetHeading, state.heading);
  const turn = clamp(error * (1 - Math.exp(-TURN_RESPONSE * dt)), -TURN_RATE * dt, TURN_RATE * dt);
  state.heading += turn;
  state.steer = turn / (TURN_RATE * dt);
  return Math.max(0, Math.cos(error - turn));
}
