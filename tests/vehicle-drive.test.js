import assert from 'node:assert/strict';
import test from 'node:test';
import { mapVehicleInput } from '../assets/shared/vehicle-drive.js';
import { MAX_WHEEL_ANGLE, WHEELBASE } from '../assets/surf-rides/ride-session.js';
import { createRideSession, ROAD_SPEED, REVERSE_SPEED } from '../assets/surf-rides/ride-session.js';
import { CAMERA_AZIMUTH, CAMERA_ELEVATION } from '../assets/shared/camera-rig.js';

const near = (actual, expected, tolerance = 1e-10) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should be near ${expected}`);
const angleDifference = (to, from) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

function projectHeading(heading) {
  const x = Math.sin(heading),
    z = Math.cos(heading);
  return Math.atan2(
    (x * Math.sin(CAMERA_AZIMUTH) + z * Math.cos(CAMERA_AZIMUTH)) * Math.sin(CAMERA_ELEVATION),
    x * Math.cos(CAMERA_AZIMUTH) - z * Math.sin(CAMERA_AZIMUTH),
  );
}

test('Jeep keyboard arrows independently operate throttle and wheels regardless of heading', () => {
  for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    assert.deepEqual(mapVehicleInput({ up: true, right: true }, null, { heading }), {
      gas: 1,
      reverse: 0,
      steering: -1,
      brake: false,
    });
    assert.deepEqual(mapVehicleInput({ down: true, left: true }, null, { heading }), {
      gas: 0,
      reverse: 1,
      steering: 1,
      brake: false,
    });
    assert.deepEqual(mapVehicleInput({ right: true }, null, { heading }), {
      gas: 0,
      reverse: 0,
      steering: -1,
      brake: false,
    });
    assert.deepEqual(
      mapVehicleInput({ up: true, down: true, left: true, right: true }, null, { heading }),
      { gas: 0, reverse: 0, steering: 0, brake: false },
    );
  }
});

test('Jeep touch pressure is progressive and steering follows the requested bearing', () => {
  const state = { heading: 1.3 };
  for (const progress of [0.1, 0.5, 1]) {
    const output = mapVehicleInput(
      {},
      { active: true, heading: state.heading + Math.PI / 8, progress },
      state,
    );
    near(output.gas, progress ** 3);
    near(output.steering, 0.5);
    assert.equal(output.reverse, 0);
  }
  for (const sign of [-1, 1]) {
    const output = mapVehicleInput(
      {},
      { active: true, heading: state.heading + (sign * Math.PI) / 2, progress: 1 },
      state,
    );
    assert.equal(output.gas, 1);
    assert.equal(output.steering, sign);
  }
});

test('Jeep touch selects reverse only behind the 135 degree forward sector and mirrors wheel steering', () => {
  const state = { heading: -2.7 };
  for (const sign of [-1, 1]) {
    let output = mapVehicleInput(
      {},
      { active: true, heading: state.heading + sign * Math.PI * 0.74, progress: 1 },
      state,
    );
    assert.equal(output.gas, 1);
    output = mapVehicleInput(
      {},
      { active: true, heading: state.heading + Math.PI + (sign * Math.PI) / 8, progress: 0.5 },
      state,
    );
    near(output.reverse, 0.125);
    near(output.steering, -sign * 0.5);
    assert.equal(output.gas, 0);
  }
  const wrapped = mapVehicleInput(
    {},
    { active: true, heading: -Math.PI + 0.05, progress: 1 },
    { heading: Math.PI - 0.05 },
  );
  near(wrapped.steering, 0.1 / (Math.PI / 4));
  assert.equal(wrapped.gas, 1);
});

test('Jeep active neutral touch overrides keyboard, brake wins, and reused output clears released commands', () => {
  const state = { heading: 0 };
  const target = {};
  const keys = { up: true, right: true };
  for (const touch of [
    { active: true, heading: 1, progress: 0 },
    { active: true, heading: NaN, progress: 1 },
    { active: true, heading: 1, progress: Infinity },
  ]) {
    assert.equal(mapVehicleInput(keys, touch, state, target), target);
    assert.deepEqual(target, { gas: 0, reverse: 0, steering: 0, brake: false });
  }
  mapVehicleInput(
    { ...keys, brake: true },
    { active: true, heading: Math.PI, progress: 1 },
    state,
    target,
  );
  assert.equal(target.brake, true);
  assert.equal(target.gas, 0);
  assert.equal(target.reverse, 0);
  mapVehicleInput(keys, { active: false }, state, target);
  assert.equal(target.gas, 1);
  assert.equal(target.steering, -1);
  mapVehicleInput({}, null, state, target);
  assert.deepEqual(target, { gas: 0, reverse: 0, steering: 0, brake: false });
});

function createSession(heading = 0, speed = 0) {
  const session = createRideSession({
    bounds: { minX: -2000, maxX: 2000, minZ: -2000, maxZ: 2000 },
    spawn: { x: 0, z: 0 },
    dropoff: { x: 1000, z: 1000 },
    pickups: [
      { id: 'first', x: 1100, z: 1100 },
      { id: 'second', x: 1200, z: 1200 },
    ],
    roads: [{ x1: -2000, z1: 0, x2: 2000, z2: 0, width: 4000 }],
    obstacles: [],
  });
  session.start();
  Object.assign(session.state, { heading, speed });
  return session;
}
function run(session, seconds, keys, fps = 60) {
  const input = {};
  for (let frame = 0; frame < Math.round(seconds * fps); frame++)
    session.update(1 / fps, mapVehicleInput(keys, null, session.state, input));
}

test('Jeep turns its wheels while stationary without spinning or moving its body', () => {
  for (const key of ['left', 'right']) {
    const session = createSession(0.9);
    run(session, 1, { [key]: true });
    near(session.state.heading, 0.9);
    near(session.state.x, 0);
    near(session.state.z, 0);
    near(session.state.speed, 0);
    assert.ok(Math.abs(session.state.steer) > 0.99);
  }
});

test('Jeep simultaneous keyboard throttle and steering produce physical clockwise or counterclockwise circles', () => {
  for (const [key, sign] of [
    ['right', 1],
    ['left', -1],
  ]) {
    const session = createSession(CAMERA_AZIMUTH + Math.PI, ROAD_SPEED);
    let previousScreenAngle = projectHeading(session.state.heading);
    let totalScreenTurn = 0;
    for (let frame = 0; frame < 180; frame++) {
      run(session, 1 / 60, { up: true, [key]: true });
      const screenAngle = projectHeading(session.state.heading);
      const delta = angleDifference(screenAngle, previousScreenAngle);
      assert.ok(delta * sign > 0, 'Wheel steering must turn in the visible requested direction');
      totalScreenTurn += delta;
      previousScreenAngle = screenAngle;
    }
    assert.ok(totalScreenTurn * sign > Math.PI * 2);
    near(session.state.speed, ROAD_SPEED);
    assert.ok(
      Math.hypot(session.state.x, session.state.z) > 1,
      'The body drives around the circle',
    );
  }
});

test('Jeep steering radius follows its wheelbase and naturally mirrors while reversing', () => {
  const turn = (speed, steering) => {
    const session = createSession(0, speed);
    session.state.steer = steering;
    session.update(1 / 60, { gas: speed > 0, reverse: speed < 0, steering });
    near(
      session.state.heading,
      ((session.state.speed / WHEELBASE) * Math.tan(steering * MAX_WHEEL_ANGLE)) / 60,
    );
    return session.state.heading;
  };
  assert.ok(turn(6, -1) < 0);
  assert.ok(turn(-4, -1) > 0);
  assert.ok(turn(6, 1) > 0);
});

test('Jeep opposite pedal stops completely before accelerating in reverse or forward', () => {
  for (const [speed, keys, sign] of [
    [ROAD_SPEED, { down: true }, -1],
    [-REVERSE_SPEED, { up: true }, 1],
  ]) {
    const session = createSession(0, speed);
    let reachedStop = false;
    let changedDirection = false;
    for (let frame = 0; frame < 180; frame++) {
      run(session, 1 / 60, keys);
      if (session.state.speed === 0) reachedStop = true;
      if (session.state.speed * sign > 0) {
        assert.ok(reachedStop, 'A pedal reversal must include a stopped simulation step');
        changedDirection = true;
      }
    }
    assert.ok(changedDirection);
    near(session.state.heading, 0);
    near(session.state.speed, sign > 0 ? ROAD_SPEED : -REVERSE_SPEED);
  }
});

test('Jeep touch can pull away gently, steer toward a bearing and reverse behind without automatic body rotation', () => {
  const session = createSession();
  const touch = { active: true, heading: Math.PI / 4, progress: 0.5 };
  for (let frame = 0; frame < 60; frame++)
    session.update(1 / 60, mapVehicleInput({}, touch, session.state));
  assert.ok(session.state.speed > 1 && session.state.speed < 2);
  assert.ok(session.state.heading > 0 && session.state.heading < Math.PI / 4);
  const previousHeading = session.state.heading;
  session.state.speed = 0;
  touch.heading = previousHeading + Math.PI;
  touch.progress = 1;
  for (let frame = 0; frame < 60; frame++)
    session.update(1 / 60, mapVehicleInput({}, touch, session.state));
  assert.ok(session.state.speed < -4);
  near(session.state.heading, previousHeading, 0.06);
});

test('Jeep steering changes smoothly, release coasts, and brake overrides simultaneous pedals', () => {
  const session = createSession(0, ROAD_SPEED);
  run(session, 0.5, { up: true, right: true });
  const before = session.state.steer;
  run(session, 1 / 60, { up: true, left: true });
  assert.ok(session.state.steer < 0, 'Wheels cannot flip instantly between full lock');
  assert.ok(session.state.steer > before);
  run(session, 1 / 60, {});
  assert.ok(session.state.speed > 0 && session.state.speed < ROAD_SPEED);
  run(session, 2, { up: true, down: true, brake: true });
  assert.ok(session.state.speed < 0.01);
});

test('Jeep driving path remains consistent at phone and desktop frame rates', () => {
  const states = [20, 60, 120].map((fps) => {
    const session = createSession();
    run(session, 1, { up: true }, fps);
    run(session, 0.5, { up: true, right: true }, fps);
    run(session, 0.5, { up: true, left: true }, fps);
    run(session, 1, { down: true }, fps);
    return session.state;
  });
  for (const state of states) {
    const reference = states[1];
    near(state.heading, reference.heading, 0.08);
    near(state.speed, reference.speed, 0.4);
    assert.ok(Math.hypot(state.x - reference.x, state.z - reference.z) < 0.5);
  }
});

test('Jeep pauses steering and clears its wheel angle on recovery or restart', () => {
  const session = createSession(0, ROAD_SPEED);
  run(session, 0.2, { up: true, right: true });
  assert.ok(session.state.steer < -0.5);
  session.pause();
  const paused = structuredClone(session.state);
  run(session, 0.5, { down: true, left: true });
  assert.deepEqual(session.state, paused);
  session.resume();
  session.recover();
  assert.equal(session.state.steer, 0);
  assert.equal(session.state.speed, 0);
  const heading = session.state.heading;
  run(session, 0.5, {});
  near(session.state.heading, heading);
  run(session, 0.5, { up: true, left: true });
  assert.ok(session.state.steer > 0.5);
  session.start();
  assert.equal(session.state.steer, 0);
  assert.equal(session.state.speed, 0);
});

test('Jeep partial touch pressure sustains a slower speed instead of eventually reaching full speed', () => {
  for (const [progress, direction] of [
    [0.5, 1],
    [0.25, 1],
    [0.5, -1],
  ]) {
    const session = createSession();
    const touch = { active: true, heading: direction > 0 ? 0 : Math.PI, progress };
    for (let frame = 0; frame < 480; frame++)
      session.update(1 / 60, mapVehicleInput({}, touch, session.state));
    const limit = direction > 0 ? ROAD_SPEED : REVERSE_SPEED;
    near(session.state.speed, direction * limit * progress ** 3);
    assert.ok(Math.abs(session.state.speed) < limit / 2);
  }
});

test('Jeep moving a touch closer eases down from cruise without immediately clamping its speed', () => {
  const session = createSession(0, ROAD_SPEED);
  const touch = { active: true, heading: 0, progress: 0.5 };
  session.update(1 / 60, mapVehicleInput({}, touch, session.state));
  assert.ok(session.state.speed < ROAD_SPEED);
  assert.ok(
    session.state.speed > ROAD_SPEED * 0.95,
    'The first frame cannot abruptly remove speed',
  );
  let previousSpeed = session.state.speed;
  for (let frame = 0; frame < 120; frame++) {
    session.update(1 / 60, mapVehicleInput({}, touch, session.state));
    assert.ok(session.state.speed <= previousSpeed);
    assert.ok(previousSpeed - session.state.speed < 0.2);
    previousSpeed = session.state.speed;
  }
  near(session.state.speed, ROAD_SPEED / 8);
});

test('Jeep full throttle retains its acceleration and release rolls to a predictable stop', () => {
  const session = createSession();
  run(session, 1, { up: true });
  near(session.state.speed, 10.5);
  run(session, 0.5, { up: true });
  near(session.state.speed, ROAD_SPEED);
  const startingZ = session.state.z;
  run(session, 1 / 60, {});
  assert.ok(
    session.state.speed > ROAD_SPEED * 0.95,
    'Release starts with gradual rolling resistance',
  );
  run(session, 2.5, {});
  near(session.state.speed, 0);
  const travel = session.state.z - startingZ;
  assert.ok(travel > 8 && travel < 13, `Release coasted ${travel} world units`);
});
