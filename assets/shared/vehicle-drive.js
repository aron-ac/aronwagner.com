const FORWARD_ARC = (Math.PI * 3) / 4;
const FULL_STEERING_ANGLE = Math.PI / 4;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const angleDifference = (to, from) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

// Keyboard arrows operate pedals and wheels. A touch instead points toward a
// world bearing, with distance controlling the pedal pressure. Both paths feed
// the same vehicle physics; neither directly rotates or repositions the vehicle.
export function mapVehicleInput(keyboard, touch, state, target = {}) {
  let throttle = Number(Boolean(keyboard.up)) - Number(Boolean(keyboard.down));
  let steering = Number(Boolean(keyboard.left)) - Number(Boolean(keyboard.right));
  const brake = Boolean(keyboard.brake);

  if (touch?.active) {
    throttle = 0;
    steering = 0;
    if (
      Number.isFinite(touch.heading) &&
      Number.isFinite(touch.progress) &&
      Number.isFinite(state.heading)
    ) {
      const progress = clamp(touch.progress, 0, 1);
      if (progress > 0) {
        const forwardError = angleDifference(touch.heading, state.heading);
        const direction = Math.abs(forwardError) < FORWARD_ARC ? 1 : -1;
        const error = angleDifference(touch.heading, state.heading + (direction < 0 ? Math.PI : 0));
        throttle = progress ** 3 * direction;
        steering = clamp(error / FULL_STEERING_ANGLE, -1, 1) * direction;
      }
    }
  }

  target.gas = brake ? 0 : Math.max(0, throttle);
  target.reverse = brake ? 0 : Math.max(0, -throttle);
  target.steering = steering;
  target.brake = brake;
  return target;
}
