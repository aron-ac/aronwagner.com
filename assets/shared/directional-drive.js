const GEAR_THRESHOLD = 0.15;
const STEERING_GAIN = 2.5;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Screen directions become ordinary throttle/steering commands, keeping each
// game's acceleration, reverse speed, collisions and braking in its simulation.
export function createDirectionalDrive({ azimuth, elevation }) {
  const verticalScale = Math.sin(elevation);
  if (!Number.isFinite(azimuth) || !Number.isFinite(verticalScale) || verticalScale <= 0.000001)
    throw new RangeError('Directional driving requires a finite, elevated camera angle.');
  const sin = Math.sin(azimuth);
  const cos = Math.cos(azimuth);
  let gear = 1;

  function reset() {
    gear = 1;
  }

  function update(input, state, target = {}) {
    const horizontal = Number(Boolean(input.right)) - Number(Boolean(input.left));
    const vertical = Number(Boolean(input.down)) - Number(Boolean(input.up));
    target.brake = Boolean(input.brake);
    target.boost = Boolean(input.boost);
    target.gas = false;
    target.reverse = false;
    target.steering = 0;
    // A reused input object must never leak screen-left/right into wheel steering.
    for (const action of ['up', 'down', 'left', 'right']) delete target[action];
    if ((!horizontal && !vertical) || !Number.isFinite(state.heading)) {
      reset();
      return target;
    }

    // Undo the ground plane's vertical foreshortening before rotating its axes.
    // This also makes a diagonal press produce a diagonal direction on screen.
    const down = vertical / verticalScale;
    const desiredHeading = Math.atan2(
      horizontal * cos + down * sin,
      -horizontal * sin + down * cos,
    );
    const alignment = Math.cos(desiredHeading - state.heading);
    if (alignment > GEAR_THRESHOLD) gear = 1;
    else if (alignment < -GEAR_THRESHOLD) gear = -1;
    const bodyHeading = desiredHeading + (gear === -1 ? Math.PI : 0);
    const error = Math.atan2(
      Math.sin(bodyHeading - state.heading),
      Math.cos(bodyHeading - state.heading),
    );
    // During a reversal the vehicle still steers according to its current motion.
    // Near rest, use the requested gear so either side arrow can start a turn.
    const movement = Math.abs(state.speed) > 0.1 ? Math.sign(state.speed) : gear;
    target.gas = gear === 1;
    target.reverse = gear === -1;
    target.steering = clamp(error * STEERING_GAIN * movement, -1, 1);
    return target;
  }

  return { update, reset };
}
